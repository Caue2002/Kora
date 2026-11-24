// Endpoint POST /api/handoff
// Gera um resumo estruturado do caso para ESCALONAMENTO a um atendente
// humano (espelha o fluxo real de handoff do iFood): fatos confirmados,
// evidencias, pendencias e recomendacao — sem executar acoes no sistema.
// Chamado sob demanda pelo frontend (menu "..." -> Encaminhar p/ atendente)

import type { IncomingMessage, ServerResponse } from 'node:http';
import { tratarRequisicaoNode } from '../shared/http.js';
import { catalogoModelos } from '../shared/env.js';
import type { ModeloConfig } from '../shared/env.js';
import { chamarLLM, ErroLimiteModelo } from '../shared/llm.js';
import type { MensagemChat } from '../shared/llm.js';
import { verificarLimite } from '../shared/ratelimit.js';

const TAMANHO_MAX_HISTORICO = 30;

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Percorre a fila de modelos ate obter o resumo (mesmo failover do /api/parecer)
async function gerarHandoff(modeloInicial: ModeloConfig, mensagens: MensagemChat[]) {
  const fila = catalogoModelos()
    .filter((m) => m.apiKey)
    .sort((a, b) => a.prioridade - b.prioridade)
    .filter((m) => m.prioridade >= modeloInicial.prioridade);

  for (const modelo of fila) {
    try {
      const r = await chamarLLM(modelo, mensagens, { maxTokens: 900 });
      return { texto: r.texto, modelo };
    } catch (erro) {
      if (erro instanceof ErroLimiteModelo) continue;
      console.warn(`[handoff] falha no modelo ${modelo.provedor}:`, erro);
      continue;
    }
  }
  return null;
}

async function webHandler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { erro: 'Metodo nao permitido' });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await verificarLimite(`handoff:${ip}`, 10, 60_000))) {
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
        'Voce e a Nori, agente de IA do Kora, aplicativo de delivery. A disputa abaixo precisa ser ESCALONADA para um atendente humano.',
        'Gere um RESUMO DE HANDOFF em markdown para o atendente assumir sem ler a conversa inteira.',
        'Formato obrigatorio: ## Resumo do caso | ## Fatos confirmados | ## Evidencias recebidas | ## Pendencias em aberto | ## Recomendacao de proximo passo',
        'Use apenas fatos informados na conversa; nao invente dados. Liste explicitamente o que falta confirmar.',
        'Tom objetivo e operacional, como um briefing interno de suporte.',
      ].join('\n'),
    },
    ...historico,
    { role: 'user', content: 'Gere o resumo de handoff desta disputa para o atendente humano.' },
  ];

  const fila = catalogoModelos()
    .filter((m) => m.apiKey)
    .sort((a, b) => a.prioridade - b.prioridade);
  const modeloInicial = fila[0];
  if (!modeloInicial) {
    return json(429, { erro: 'Cotas gratuitas temporariamente esgotadas.' });
  }

  const gerado = await gerarHandoff(modeloInicial, mensagens);
  if (!gerado) {
    return json(502, { erro: 'Nao foi possivel gerar o resumo de handoff no momento.' });
  }

  return json(200, { handoff: gerado.texto });
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
