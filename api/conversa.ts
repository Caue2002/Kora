// Endpoint GET /api/conversa?conversaId=...
// Retorna o historico de mensagens persistido no servidor para a conversa.
// Espelho do que o frontend guarda em localStorage: backup e base para
// sincronizacao entre dispositivos (a UI continua usando o local)

import type { IncomingMessage, ServerResponse } from 'node:http';
import { tratarRequisicaoNode } from '../shared/http.js';
import { verificarLimite } from '../shared/ratelimit.js';
import { consultar } from '../shared/supabase.js';

interface ConversaRow {
  conversa_id: string;
  perfil: string | null;
  mensagens: Array<{ role: string; content: string }> | null;
  atualizado_em: string;
}

// Ids de conversa sao gerados no frontend como `${timestamp}-${aleatorio}`
const CONVERSA_ID_VALIDO = /^[A-Za-z0-9_-]{10,80}$/;

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function webHandler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json(405, { erro: 'Metodo nao permitido' });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await verificarLimite(`conversa:${ip}`, 60, 60_000))) {
    return json(429, { erro: 'Muitas requisicoes. Aguarde um instante.' });
  }

  const conversaId = new URL(req.url).searchParams.get('conversaId') ?? '';
  if (!CONVERSA_ID_VALIDO.test(conversaId)) {
    return json(400, { erro: 'conversaId ausente ou invalido' });
  }

  try {
    const linhas = await consultar<ConversaRow>(
      'conversas',
      `conversa_id=eq.${encodeURIComponent(conversaId)}&select=conversa_id,perfil,mensagens,atualizado_em&limit=1`,
    );
    return json(200, { conversa: linhas[0] ?? null });
  } catch (erro) {
    console.warn('[conversa] consulta falhou:', erro);
    return json(200, { conversa: null });
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
