// Endpoint POST /api/parecer
// Gera um parecer de conciliacao estruturado a partir da conversa ativa
// Chamado sob demanda pelo botao Exportar do frontend

import { catalogoModelos } from '../shared/env.js';
import { chamarLLM, ErroLimiteModelo } from '../shared/llm.js';
import type { ModeloConfig } from '../shared/env.js';
import { estimarMensagens, estimarTokens } from '../shared/tokens.js';
import { marcarEsgotado, registrarConsumo, selecionarModelo } from '../shared/models.js';
import { verificarLimite } from '../shared/ratelimit.js';
import type { MensagemChat } from '../shared/llm.js';

const TAMANHO_MAX_HISTORICO = 30;

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Percorre a fila de modelos ate obter o parecer
async function gerarParecer(modeloInicial: ModeloConfig, mensagens: MensagemChat[]) {
  const fila = catalogoModelos()
    .filter((m) => m.apiKey)
    .sort((a, b) => a.prioridade - b.prioridade)
    .filter((m) => m.prioridade >= modeloInicial.prioridade);

  for (const modelo of fila) {
    try {
      const r = await chamarLLM(modelo, mensagens, { maxTokens: 1200 });
      return { texto: r.texto, modelo, tokensUso: r.tokensUso };
    } catch (erro) {
      if (erro instanceof ErroLimiteModelo) {
        await marcarEsgotado(modelo.id);
        continue;
      }
      console.warn(`[parecer] falha no modelo ${modelo.provedor}:`, erro);
      continue;
    }
  }
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { erro: 'Metodo nao permitido' });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await verificarLimite(`parecer:${ip}`, 10, 60_000))) {
    return json(429, { erro: 'Muitas requisicoes. Aguarde um instante.' });
  }

  let corpo: { mensagens?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return json(400, { erro: 'JSON invalido' });
  }

  if (!Array.isArray(corpo.mensagens) || corpo.mensagens.length === 0) {
    return json(400, { erro: 'Historico de mensagens ausente' });
  }

  const historico = (corpo.mensagens as Array<{ role?: string; content?: string }>)
    .filter((m) => typeof m?.content === 'string')
    .map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user') as MensagemChat['role'],
      content: String(m.content).slice(0, 4000),
    }))
    .slice(-TAMANHO_MAX_HISTORICO);

  const mensagens: MensagemChat[] = [
    {
      role: 'system',
      content: [
        'Voce e a Nori, agente de IA do Kora, aplicativo de delivery. Com base na conversa abaixo, gere um PARECER DE CONCILIACAO de disputa de pedido em markdown.',
        'Formato obrigatorio: ## Resumo da disputa | ## Fatos confirmados | ## Itens afetados | ## Responsabilidade provavel | ## Plano de conciliacao | ## Pendencias',
        'Use apenas fatos informados na conversa; nao invente dados. Se faltar informacao, liste em Pendencias.',
        'Separe fatos confirmados de hipoteses e nao atribua culpa sem evidencia.',
        'Tom objetivo e operacional.',
      ].join('\n'),
    },
    ...historico,
    { role: 'user', content: 'Gere o parecer de conciliacao desta ocorrencia.' },
  ];

  const tokensEntrada = estimarMensagens(mensagens);
  const modelo = await selecionarModelo(tokensEntrada);
  if (!modelo) {
    return json(429, { erro: 'Cotas gratuitas temporariamente esgotadas.' });
  }

  const gerado = await gerarParecer(modelo, mensagens);
  if (!gerado) {
    return json(502, { erro: 'Nao foi possivel gerar o parecer no momento.' });
  }

  const tokensUso = gerado.tokensUso ?? estimarTokens(gerado.texto) + tokensEntrada;
  await registrarConsumo(gerado.modelo.id, tokensUso);

  return json(200, { parecer: gerado.texto });
}
