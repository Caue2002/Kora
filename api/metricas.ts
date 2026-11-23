// Endpoint GET /api/metricas
// Retorna agregados de uso do chat (metricas_chat): volume, latencia media,
// hits de cache e distribuicao por modelo. Base da observabilidade do Nori

import type { IncomingMessage, ServerResponse } from 'node:http';
import { tratarRequisicaoNode } from '../shared/http.js';
import { verificarLimite } from '../shared/ratelimit.js';
import { rpc } from '../shared/supabase.js';

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function webHandler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json(405, { erro: 'Metodo nao permitido' });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await verificarLimite(`metricas:${ip}`, 30, 60_000))) {
    return json(429, { erro: 'Muitas requisicoes. Aguarde um instante.' });
  }

  try {
    const resumo = await rpc<unknown>('metricas_chat_resumo', {});
    return json(200, { metricas: resumo ?? null });
  } catch (erro) {
    console.warn('[metricas] resumo falhou:', erro);
    return json(200, { metricas: null });
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
