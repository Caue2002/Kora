// Endpoint POST /api/chat
// Orquestra o fluxo do Nori: validacao, RAG, selecao de modelo com cota,
// geracao com temperatura levemente maior para conversa natural, validacao de coerencia e registro de consumo
// Aceita { stream: true } para resposta token a token (sem validacao pos-geracao)

import type { IncomingMessage, ServerResponse } from 'node:http';
import { tratarRequisicaoNode } from '../shared/http.js';
import { catalogoModelos, janelaHistorico } from '../shared/env.js';
import { chamarLLM, ErroLimiteModelo, streamLLM, type MensagemChat } from '../shared/llm.js';
import type { ModeloConfig } from '../shared/env.js';
import { estimarMensagens, estimarTokens } from '../shared/tokens.js';
import { marcarEsgotado, registrarConsumo, selecionarModelo } from '../shared/models.js';
import { verificarLimite } from '../shared/ratelimit.js';
import { extrairCodigoPedido, pedidoFicticio } from '../shared/pedidos.js';
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
  imagem?: unknown;
  perfil?: unknown;
}

// Perfis de usuario do marketplace: cada um recebe um contexto de solucao proprio
const PERFIS_VALIDOS = new Set(['cliente', 'parceiro', 'entregador']);

const CONTEXTO_PERFIL: Record<string, string> = {
  cliente:
    'O usuario e um CLIENTE final que recebeu um pedido com problema. Conduza como atendimento ao consumidor: colete dados do pedido, evidencias e aplique as politicas de disputa e reembolso.',
  parceiro:
    'O usuario e um VENDEDOR PARCEIRO (restaurante ou loja). Ajude com demandas do estabelecimento: pedido cancelado indevidamente, avaliacao contestada, divergencia de repasse, problema no cardapio. Aplique as mesmas regras de evidencia; nao prometa acoes no sistema.',
  entregador:
    'O usuario e um ENTREGADOR parceiro. Ajude com demandas de entrega: pedido nao entregue, dificuldade na retirada, pagamento da corrida, atraso. Aplique as mesmas regras de evidencia; nao prometa acoes no sistema.',
};

// Temperatura do chat: um pouco acima do minimo para conversa mais natural
// (validacao de coerencia e regeneracao continuam na temperatura padrao baixa)
const TEMPERATURA_CHAT = 0.4;

const TAMANHO_MAX_MENSAGEM = 4000;
const TAMANHO_MAX_HISTORICO = 24;
const MIMES_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TAMANHO_MAX_IMAGEM_B64 = 4_200_000; // ~3MB em base64 (body total fica abaixo do limite da Vercel)

// Valida o anexo de imagem opcional (evidencia fotografica da disputa)
function normalizarImagem(imagem: unknown): { base64: string; mime: string } | undefined {
  if (typeof imagem !== 'object' || imagem === null) return undefined;
  const { base64, mime } = imagem as { base64?: unknown; mime?: unknown };
  if (typeof base64 !== 'string' || typeof mime !== 'string') return undefined;
  if (!MIMES_IMAGEM.has(mime)) return undefined;
  if (base64.length === 0 || base64.length > TAMANHO_MAX_IMAGEM_B64) return undefined;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) return undefined;
  return { base64, mime };
}

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
      content: m.content.slice(0, 2000),
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
      const r = await chamarLLM(modelo, mensagens, { temperatura: TEMPERATURA_CHAT });
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
      const stream = await streamLLM(modelo, mensagens, { temperatura: TEMPERATURA_CHAT });
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

async function webHandler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { erro: 'Metodo nao permitido' });

  // Rate limit simples por IP: 20 requisicoes por minuto (best-effort em serverless)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await verificarLimite(`chat:${ip}`, 20, 60_000))) {
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
  const imagem = normalizarImagem(corpo.imagem);
  const janela = janelaHistorico() * 2;
  const historicoJanela = historico.slice(-janela);

  // Codigo de pedido informado: os dados deterministicos sao injetados no
  // prompt abaixo e o proprio modelo confirma o pedido com variacao natural
  const codigoPedido = extrairCodigoPedido(mensagem);

  // Estimativa antecipada de tokens de entrada (historico + mensagem + margem
  // para prompt de sistema e contexto RAG) permite escolher o modelo em
  // paralelo com a busca, sem esperar o RAG terminar — corta uma round-trip
  const tokensEntradaPrev = estimarMensagens(historicoJanela) + estimarTokens(mensagem) + 2600;
  const [busca, diretrizes, modelo] = await Promise.all([
    buscaHibrida(mensagem),
    carregarDiretrizes(),
    selecionarModelo(tokensEntradaPrev),
  ]);
  if (!modelo) {
    // Esgotamento total dos 4 modelos no ciclo vigente
    return json(429, {
      erro: 'As cotas gratuitas dos modelos de IA estao temporariamente esgotadas. Tente novamente em instantes.',
    });
  }

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

  const perfil =
    typeof corpo.perfil === 'string' && PERFIS_VALIDOS.has(corpo.perfil) ? corpo.perfil : undefined;

  // Injeta o pedido ficticio deterministico sempre que um codigo for informado:
  // o modelo usa esses dados para confirmar o pedido de forma natural e variada
  const dadosPedido = codigoPedido
    ? `\nPedido localizado no sistema (dados da simulacao): ${pedidoFicticio(codigoPedido)}. Se a descricao do usuario divergir desses dados, o relato dele prevalece — ele conhece o proprio pedido. Confirme os itens com o usuario usando a descricao que fizer mais sentido para a conversa.`
    : '';

  const promptSistema = [
    montarPromptSistema(diretrizes),
    '',
    `Data e hora atuais: ${agora}.`,
    perfil ? `Perfil do usuario: ${CONTEXTO_PERFIL[perfil]}` : '',
    dadosPedido,
    '',
    montarContextoRAG(busca.trechos),
  ].join('\n');

  const mensagens: MensagemChat[] = [
    { role: 'system', content: promptSistema },
    ...historicoJanela,
    { role: 'user', content: mensagem + (imagem ? '\n[O usuario anexou uma foto como evidencia.]' : ''), imagem },
  ];

  // Estimativa de entrada com teto de seguranca (o modelo ja foi escolhido
  // em paralelo com o RAG usando a estimativa antecipada)
  const tokensEntrada = estimarMensagens(mensagens);

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

// Despacha: Vercel chama com (req Node, res); dev-server/testes chamam com Request Web
export default async function handler(req: Request): Promise<Response>;
export default async function handler(
  req: Request | IncomingMessage,
  res?: ServerResponse,
): Promise<Response | void>;
export default async function handler(
  req: Request | IncomingMessage,
  res?: ServerResponse,
): Promise<Response | void> {
  if (res) {
    await tratarRequisicaoNode(req as IncomingMessage, res, webHandler);
    return;
  }
  return webHandler(req as Request);
}
