// Endpoint /api/a2a — agente Nori no protocolo A2A (Agent2Agent)
// JSON-RPC 2.0: implementa message/send, que recebe uma mensagem de texto
// de outro agente e devolve a resposta do Nori como Message A2A.
// Pipeline enxuto (sem historico, streaming ou estado de caso): diretrizes
// + RAG + failover de modelos, um turno so. Auth: mesma MCP_API_KEY do /api/mcp.
// Agent card publico: /.well-known/agent-card.json

import type { IncomingMessage, ServerResponse } from 'node:http';
import { tratarRequisicaoNode } from '../shared/http.js';
import { verificarChaveApi } from '../shared/auth.js';
import { verificarLimite } from '../shared/ratelimit.js';
import { catalogoModelos } from '../shared/env.js';
import type { ModeloConfig } from '../shared/env.js';
import { chamarLLM, ErroLimiteModelo } from '../shared/llm.js';
import type { MensagemChat } from '../shared/llm.js';
import { buscaHibrida } from '../rag/search.js';
import {
  carregarDiretrizes,
  montarContextoRAG,
  montarPromptSistema,
  ehMensagemCasual,
  ehPerguntaMeta,
} from '../coherence/index.js';

const TAMANHO_MAX_MENSAGEM = 2000;

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Erro JSON-RPC padrao
function erroRpc(id: unknown, code: number, message: string): Response {
  return json(200, { jsonrpc: '2.0', id: id ?? null, error: { code, message } });
}

interface MensagemA2A {
  role?: string;
  parts?: Array<{ kind?: string; text?: string }>;
  messageId?: string;
}

// Extrai o texto da mensagem A2A (parts kind=text); null se invalida
function extrairTextoA2A(mensagem: unknown): { texto: string; messageId?: string } | null {
  if (typeof mensagem !== 'object' || mensagem === null) return null;
  const m = mensagem as MensagemA2A;
  if (m.role && m.role !== 'user') return null;
  const texto = (m.parts ?? [])
    .filter((p) => p.kind === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('\n')
    .trim();
  if (texto.length === 0 || texto.length > TAMANHO_MAX_MENSAGEM) return null;
  return { texto, messageId: typeof m.messageId === 'string' ? m.messageId : undefined };
}

// Percorre a fila de modelos com failover (mesmo criterio do /api/chat)
async function gerarResposta(mensagens: MensagemChat[]): Promise<string | null> {
  const fila = catalogoModelos()
    .filter((m) => m.apiKey)
    .sort((a, b) => a.prioridade - b.prioridade) as ModeloConfig[];
  for (const modelo of fila) {
    try {
      const r = await chamarLLM(modelo, mensagens, { temperatura: 0.4, maxTokens: 600 });
      if (r.texto.trim()) return r.texto.trim();
    } catch (erro) {
      if (erro instanceof ErroLimiteModelo) continue;
      console.warn(`[a2a] falha no modelo ${modelo.provedor}:`, erro);
    }
  }
  return null;
}

// Processa um message/send: gera a resposta do Nori para o texto recebido
async function processarMessageSend(params: unknown): Promise<{ texto: string } | { erro: string }> {
  const mensagem = (params as { message?: unknown } | null)?.message;
  const extraido = extrairTextoA2A(mensagem);
  if (!extraido) return { erro: 'Mensagem A2A invalida: esperada role=user com parts text' };

  const casualOuMeta = ehMensagemCasual(extraido.texto) || ehPerguntaMeta(extraido.texto);
  const [diretrizes, busca] = await Promise.all([
    carregarDiretrizes(),
    casualOuMeta ? Promise.resolve({ trechos: [], modo: 'lexical' as const }) : buscaHibrida(extraido.texto, 4),
  ]);

  const promptSistema = [
    montarPromptSistema(diretrizes),
    '',
    'Voce esta respondendo a um agente externo via protocolo A2A. Responda de forma completa e autocontida em texto simples, sem depender de historico de conversa.',
    casualOuMeta
      ? 'A mensagem e casual ou meta: responda de forma leve e direta.'
      : montarContextoRAG(busca.trechos),
  ].join('\n');

  const mensagens: MensagemChat[] = [
    { role: 'system', content: promptSistema },
    { role: 'user', content: extraido.texto },
  ];

  const texto = await gerarResposta(mensagens);
  return texto ? { texto } : { erro: 'Todos os modelos estao temporariamente indisponiveis' };
}

async function webHandler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { erro: 'Metodo nao permitido' });

  const falhaAuth = verificarChaveApi(req);
  if (falhaAuth === 503) {
    return json(503, { erro: 'Endpoint A2A desabilitado: MCP_API_KEY nao configurada' });
  }
  if (falhaAuth === 401) {
    return json(401, { erro: 'Chave de acesso invalida ou ausente' });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await verificarLimite(`a2a:${ip}`, 30, 60_000))) {
    return erroRpc(null, -32000, 'Rate limit excedido');
  }

  let corpo: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return erroRpc(null, -32700, 'Parse error: JSON invalido');
  }

  // Notificacao JSON-RPC (sem id): aceita e nao responde corpo
  if (corpo.id === undefined || corpo.id === null) return new Response(null, { status: 202 });
  if (corpo.jsonrpc !== '2.0' || typeof corpo.method !== 'string') {
    return erroRpc(corpo.id, -32600, 'Requisicao JSON-RPC invalida');
  }

  if (corpo.method === 'message/send') {
    const r = await processarMessageSend(corpo.params);
    if ('erro' in r) return erroRpc(corpo.id, -32602, r.erro);

    // Resposta A2A: Message do agente com parts de texto
    const messageId =
      typeof (corpo.params as { message?: { messageId?: unknown } } | undefined)?.message?.messageId === 'string'
        ? `resp-${Date.now()}`
        : `msg-${Date.now()}`;
    return json(200, {
      jsonrpc: '2.0',
      id: corpo.id,
      result: {
        kind: 'message',
        role: 'agent',
        messageId,
        parts: [{ kind: 'text', text: r.texto }],
      },
    });
  }

  // Demais metodos (tasks, push, streaming) fora da V1
  return erroRpc(corpo.id, -32601, `Metodo nao suportado: ${corpo.method}`);
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
