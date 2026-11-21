// Endpoint POST /api/chat
// Orquestra o fluxo do Nori: validacao, RAG, selecao de modelo com cota,
// geracao com temperatura baixa, validacao de coerencia e registro de consumo
// Aceita { stream: true } para resposta token a token (sem validacao pos-geracao)

import { catalogoModelos, janelaHistorico } from '../shared/env.js';
import { chamarLLM, ErroLimiteModelo, streamLLM, type MensagemChat } from '../shared/llm.js';
import type { ModeloConfig } from '../shared/env.js';
import { estimarMensagens, estimarTokens } from '../shared/tokens.js';
import { marcarEsgotado, registrarConsumo, selecionarModelo } from '../shared/models.js';
import { verificarLimite } from '../shared/ratelimit.js';
import { buscaHibrida } from '../rag/search.js';
import {
  carregarDiretrizes,
  montarContextoRAG,
  montarPromptSistema,
  validarComLLM,
  validarHeuristico,
} from '../coherence/index.js';

interface CorpoRequisicao {
  mensagem?: unknown;
  historico?: unknown;
  stream?: unknown;
}

const TAMANHO_MAX_MENSAGEM = 4000;
const TAMANHO_MAX_HISTORICO = 24;

// Normaliza o historico recebido do cliente para o formato interno
function normalizarHistorico(historico: unknown): MensagemChat[] {
  if (!Array.isArray(historico)) return [];
  return historico
    .filter(
      (m): m is { role: string; content: string } =>
        typeof m === 'object' &&
        m !== null &&
        typeof (m as { role?: unknown }).role === 'string' &&
        typeof (m as { content?: unknown }).content === 'string',
    )
    .map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user') as MensagemChat['role'],
      content: m.content.slice(0, TAMANHO_MAX_MENSAGEM),
    }))
    .slice(-TAMANHO_MAX_HISTORICO);
}

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Tenta gerar a resposta percorrendo a fila de modelos na ordem de prioridade
// Em limite de cota ou falha transitoria, marca esgotado e passa ao proximo
async function gerarComFailover(
  modeloInicial: ModeloConfig,
  mensagens: MensagemChat[],
): Promise<{ texto: string; modelo: ModeloConfig; tokensUso?: number } | null> {
  const catalogo = catalogoModelos()
    .filter((m) => m.apiKey)
    .sort((a, b) => a.prioridade - b.prioridade);
  const fila = catalogo.filter((m) => m.prioridade >= modeloInicial.prioridade);

  for (const modelo of fila) {
    try {
      const r = await chamarLLM(modelo, mensagens);
      return { texto: r.texto, modelo, tokensUso: r.tokensUso };
    } catch (erro) {
      if (erro instanceof ErroLimiteModelo) {
        await marcarEsgotado(modelo.id);
        continue;
      }
      // falha transitoria: tenta o proximo modelo preservando a conversa
      console.warn(`[chat] falha no modelo ${modelo.provedor}:`, erro);
      continue;
    }
  }
  return null;
}

// Tenta abrir o stream percorrendo a fila; retorna stream + modelo ou null
async function streamComFailover(
  modeloInicial: ModeloConfig,
  mensagens: MensagemChat[],
): Promise<{ stream: ReadableStream<Uint8Array>; modelo: ModeloConfig } | null> {
  const catalogo = catalogoModelos()
    .filter((m) => m.apiKey)
    .sort((a, b) => a.prioridade - b.prioridade);
  const fila = catalogo.filter((m) => m.prioridade >= modeloInicial.prioridade);

  for (const modelo of fila) {
    try {
      const stream = await streamLLM(modelo, mensagens);
      return { stream, modelo };
    } catch (erro) {
      if (erro instanceof ErroLimiteModelo) {
        await marcarEsgotado(modelo.id);
        continue;
      }
      console.warn(`[chat] stream falhou no modelo ${modelo.provedor}:`, erro);
      continue;
    }
  }
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { erro: 'Metodo nao permitido' });

  // Rate limit simples por IP: 20 requisicoes por minuto (best-effort em serverless)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!verificarLimite(`chat:${ip}`, 20, 60_000)) {
    return json(429, { erro: 'Muitas requisicoes. Aguarde um instante.' });
  }

  let corpo: CorpoRequisicao;
  try {
    corpo = (await req.json()) as CorpoRequisicao;
  } catch {
    return json(400, { erro: 'JSON invalido' });
  }

  const mensagem = typeof corpo.mensagem === 'string' ? corpo.mensagem.trim() : '';
  if (mensagem.length === 0 || mensagem.length > TAMANHO_MAX_MENSAGEM) {
    return json(400, { erro: 'Mensagem ausente ou acima do limite de tamanho' });
  }

  const historico = normalizarHistorico(corpo.historico);
  const janela = janelaHistorico() * 2;
  const historicoJanela = historico.slice(-janela);

  // Busca RAG e diretrizes adaptativas em paralelo para baixa latencia
  const [busca, diretrizes] = await Promise.all([buscaHibrida(mensagem), carregarDiretrizes()]);

  // Data e hora atuais permitem responder perguntas casuais sem inventar
  const agora = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const promptSistema = [
    montarPromptSistema(diretrizes),
    '',
    `Data e hora atuais: ${agora}.`,
    '',
    montarContextoRAG(busca.trechos),
  ].join('\n');

  const mensagens: MensagemChat[] = [
    { role: 'system', content: promptSistema },
    ...historicoJanela,
    { role: 'user', content: mensagem },
  ];

  // Estimativa de entrada com teto de seguranca antes de escolher o modelo
  const tokensEntrada = estimarMensagens(mensagens);
  const modelo = await selecionarModelo(tokensEntrada);
  if (!modelo) {
    // Esgotamento total dos 4 modelos no ciclo vigente
    return json(429, {
      erro: 'As cotas gratuitas dos modelos de IA estao temporariamente esgotadas. Tente novamente em instantes.',
    });
  }

  const fontes = busca.trechos.map((t) => ({ titulo: t.titulo, categoria: t.categoria }));

  // ===== Modo streaming: resposta token a token =====
  // Nao roda a validacao pos-geracao (texto ja foi enviado); heuristica fica para o modo normal
  if (corpo.stream === true) {
    const gerado = await streamComFailover(modelo, mensagens);
    if (!gerado) {
      return json(502, { erro: 'Nao foi possivel obter resposta dos modelos disponiveis no momento.' });
    }
    return new Response(gerado.stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'x-modelo': gerado.modelo.nomeModelo,
        'x-fontes': encodeURIComponent(JSON.stringify(fontes)),
      },
    });
  }

  const gerado = await gerarComFailover(modelo, mensagens);
  if (!gerado) {
    return json(502, { erro: 'Nao foi possivel obter resposta dos modelos disponiveis no momento.' });
  }

  // Registra consumo real quando informado, senao a estimativa consolidada
  const tokensUso = gerado.tokensUso ?? estimarTokens(gerado.texto) + tokensEntrada;
  await registrarConsumo(gerado.modelo.id, tokensUso);

  // Validacao obrigatoria de coerencia antes da entrega
  let resposta = gerado.texto;
  let aviso: string | undefined;
  const heuristica = validarHeuristico(resposta);
  if (!heuristica.ok) {
    console.warn('[chat] heuristica de coerencia falhou:', heuristica.problemas);
    // Uma tentativa de regeneracao apontando os problemas detectados
    const correcao: MensagemChat[] = [
      ...mensagens,
      { role: 'assistant', content: resposta },
      {
        role: 'user',
        content: `Sua resposta anterior apresentou problemas de coerencia: ${heuristica.problemas.join('; ')}. Reescreva corrigindo esses pontos, sem inventar dados.`,
      },
    ];
    try {
      const r2 = await chamarLLM(gerado.modelo, correcao);
      const h2 = validarHeuristico(r2.texto);
      if (h2.ok) {
        resposta = r2.texto;
        await registrarConsumo(gerado.modelo.id, r2.tokensUso ?? estimarTokens(r2.texto));
      } else {
        aviso = 'Resposta gerada com ressalvas de coerencia; confirme os pontos sinalizados.';
      }
    } catch (erro) {
      console.warn('[chat] regeneracao de coerencia falhou:', erro);
      aviso = 'Resposta gerada com ressalvas de coerencia; confirme os pontos sinalizados.';
    }
  }

  return json(200, {
    resposta,
    modelo: gerado.modelo.nomeModelo,
    provedor: gerado.modelo.provedor,
    aviso,
    tokens: tokensUso,
    fontes,
  });
}
