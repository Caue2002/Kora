// Autenticacao por API key estatica compartilhada pelos endpoints de
// agentes externos (/api/mcp e /api/a2a): Bearer token ou x-api-key,
// comparacao em tempo constante para nao vazar a chave por timing

import { timingSafeEqual } from 'node:crypto';
import { mcpApiKey } from './env.js';

function chaveConfere(recebida: string, esperada: string): boolean {
  const a = Buffer.from(recebida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Extrai a chave dos headers aceitos pelos clientes MCP/A2A
export function extrairChaveApi(req: Request): string | undefined {
  const auth = req.headers.get('authorization');
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return bearer;
  return req.headers.get('x-api-key')?.trim() || undefined;
}

// Devolve null quando autenticado; senao o status HTTP do erro (401/503)
export function verificarChaveApi(req: Request): 401 | 503 | null {
  const esperada = mcpApiKey();
  if (!esperada) return 503;
  const recebida = extrairChaveApi(req);
  if (!recebida || !chaveConfere(recebida, esperada)) return 401;
  return null;
}
