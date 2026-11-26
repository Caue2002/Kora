// Endpoint POST /api/memoria
// Recebe { dispositivoId, historico } no encerramento do atendimento e grava
// um resumo curto dos fatos do usuario na tabela `memorias` (spec
// SPEC-memoria-usuario.md). A leitura acontece em /api/chat.
// Fire-and-forget no frontend: nunca pode quebrar o encerramento.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { tratarRequisicaoNode } from '../shared/http.js';
import { catalogoModelos } from '../shared/env.js';
import { chamarLLM, ErroLimiteModelo, type MensagemChat } from '../shared/llm.js';
import { verificarLimite } from '../shared/ratelimit.js';
import { inserir } from '../shared/supabase.js';

interface CorpoRequisicao {
  dispositivoId?: unknown;
  historico?: unknown;
}

const MAX_MENSAGENS = 20;
const MAX_CHARS_MENSAGEM = 1200;
const MAX_CHARS_RESUMO = 400;
// Mesmo formato do conversaId, mas o frontend envia um UUID (36 chars)
const DISPOSITIVO_ID_VALIDO = /^[A-Za-z0-9_-]{10,80}$/;
// Conversa curta demais nao tem fatos uteis para memorizar
const MIN_MENSAGENS = 4;

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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
      role: (m.role === 'assistant' ? 'assistant' : 'user') as MensagemChat['role'],
      content: m.content.slice(0, MAX_CHARS_MENSAGEM),
    }))
    .slice(-MAX_MENSAGENS);
}

const PROMPT_RESUMO = `Voce resume conversas de atendimento de uma assistente de delivery (Kora/Nori) para alimentar a memoria dela.

A partir da transcricao abaixo, escreva em ate 2 frases curtas os FATOS UTILS PARA FUTURAS CONVERSAS com este usuario: preferencias declaradas, pedidos ou disputas ja tratadas (com categoria e desfecho), pendencias em aberto, dados recorrentes (loja favorita, tipo de pedido).

Regras:
- Somente fatos que o PROPRIO usuario informou — nunca hipoteses da assistente.
- Sem dados sensiveis (cartao, endereco completo, CPF).
- Se a conversa for so saudacao/pergunta casual sem nada memoravel, responda exatamente: NADA
- Responda apenas o resumo, sem aspas, sem prefixos.`;

// Resume a conversa com um modelo lite; devolve null quando nao ha nada
// memoravel ou quando todos os modelos falham
async function resumirConversa(historico: MensagemChat[]): Promise<string | null> {
  const catalogo = catalogoModelos()
    .filter((m) => m.apiKey)
    .sort((a, b) => a.prioridade - b.prioridade);

  const transcricao = historico
    .map((m) => `${m.role === 'assistant' ? 'NORI' : 'USUARIO'}: ${m.content}`)
    .join('\n');

  for (const modelo of catalogo) {
    try {
      const r = await chamarLLM(
        modelo,
        [
          { role: 'system', content: PROMPT_RESUMO },
          { role: 'user', content: transcricao },
        ],
        { temperatura: 0.2, maxTokens: 200 },
      );
      const resumo = r.texto.trim();
      if (!resumo || /^nada\b/i.test(resumo)) return null;
      return resumo.slice(0, MAX_CHARS_RESUMO);
    } catch (erro) {
      if (erro instanceof ErroLimiteModelo) continue;
      console.warn(`[memoria] resumo falhou no modelo ${modelo.provedor}:`, erro);
    }
  }
  return null;
}

async function webHandler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { erro: 'Metodo nao permitido' });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await verificarLimite(`memoria:${ip}`, 10, 60_000))) {
    return json(429, { erro: 'Muitas requisicoes. Aguarde um instante.' });
  }

  let corpo: CorpoRequisicao;
  try {
    corpo = (await req.json()) as CorpoRequisicao;
  } catch {
    return json(400, { erro: 'JSON invalido' });
  }

  const dispositivoId = typeof corpo.dispositivoId === 'string' ? corpo.dispositivoId.trim() : '';
  if (!DISPOSITIVO_ID_VALIDO.test(dispositivoId)) {
    return json(400, { erro: 'dispositivoId ausente ou invalido' });
  }

  const historico = normalizarHistorico(corpo.historico);
  // Conversa curta/vazia: nada a memorizar — responde ok sem chamar o LLM
  if (historico.length < MIN_MENSAGENS) {
    return json(200, { ok: true, gravado: false });
  }

  const resumo = await resumirConversa(historico);
  if (!resumo) {
    return json(200, { ok: true, gravado: false });
  }

  try {
    await inserir('memorias', { device_id: dispositivoId, resumo });
    return json(200, { ok: true, gravado: true });
  } catch (erro) {
    // Tabela ainda nao migrada ou Supabase fora: memoria e best-effort
    console.warn('[memoria] insert falhou:', erro);
    return json(200, { ok: true, gravado: false });
  }
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
