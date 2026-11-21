// Endpoint POST /api/feedback
// Registra avaliacoes do usuario (util, confuso, incompleto, prolixo) para o loop adaptativo
// Aceita comentario opcional (requer migracao 0005_feedback_comentario.sql)

import type { IncomingMessage, ServerResponse } from 'node:http';
import { tratarRequisicaoNode } from '../shared/http.js';
import { inserir } from '../shared/supabase.js';
import { verificarLimite } from '../shared/ratelimit.js';

const AVALIACOES = ['util', 'confuso', 'incompleto', 'prolixo'] as const;
type Avaliacao = (typeof AVALIACOES)[number];

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function webHandler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { erro: 'Metodo nao permitido' });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await verificarLimite(`feedback:${ip}`, 30, 60_000))) {
    return json(429, { erro: 'Muitas requisicoes. Aguarde um instante.' });
  }

  let corpo: { avaliacao?: unknown; modeloId?: unknown; turnoId?: unknown; comentario?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return json(400, { erro: 'JSON invalido' });
  }

  const avaliacao = corpo.avaliacao;
  if (typeof avaliacao !== 'string' || !(AVALIACOES as readonly string[]).includes(avaliacao)) {
    return json(400, { erro: 'Avaliacao invalida' });
  }

  const dados: Record<string, unknown> = {
    avaliacao: avaliacao as Avaliacao,
    modelo_id: typeof corpo.modeloId === 'number' ? corpo.modeloId : null,
    turno_id: typeof corpo.turnoId === 'string' ? corpo.turnoId : null,
  };

  // Comentario opcional: so envia se preenchido; se a coluna ainda nao existir
  // no banco (migracao pendente), refaz o insert sem o campo
  const comentario = typeof corpo.comentario === 'string' ? corpo.comentario.slice(0, 500) : null;
  try {
    await inserir('feedback_respostas', comentario ? { ...dados, comentario } : dados);
  } catch (erro) {
    console.warn('[feedback] insert com comentario falhou, tentando sem:', erro);
    try {
      await inserir('feedback_respostas', dados);
    } catch (erro2) {
      console.error('[feedback] falha ao registrar feedback:', erro2);
      return json(502, { erro: 'Nao foi possivel registrar o feedback.' });
    }
  }

  return json(200, { ok: true });
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
