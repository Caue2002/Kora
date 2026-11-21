// Endpoint POST /api/feedback
// Registra avaliacoes do usuario (util, confuso, incompleto, prolixo) para o loop adaptativo

import { inserir } from '../shared/supabase.js';

const AVALIACOES = ['util', 'confuso', 'incompleto', 'prolixo'] as const;
type Avaliacao = (typeof AVALIACOES)[number];

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { erro: 'Metodo nao permitido' });

  let corpo: { avaliacao?: unknown; modeloId?: unknown; turnoId?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return json(400, { erro: 'JSON invalido' });
  }

  const avaliacao = corpo.avaliacao;
  if (typeof avaliacao !== 'string' || !(AVALIACOES as readonly string[]).includes(avaliacao)) {
    return json(400, { erro: 'Avaliacao invalida' });
  }

  await inserir('feedback_respostas', {
    avaliacao: avaliacao as Avaliacao,
    modelo_id: typeof corpo.modeloId === 'number' ? corpo.modeloId : null,
    turno_id: typeof corpo.turnoId === 'string' ? corpo.turnoId : null,
  });

  return json(200, { ok: true });
}
