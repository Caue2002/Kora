// Teste do endpoint /api/mcp (servidor MCP do Kora)
// Cobre autenticacao por API key, initialize, tools/list e tools/call.
// As tools de dominio usam Supabase real quando ha .env; degradam sem ele.

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import handler from '../api/mcp';

function carregarEnv() {
  try {
    const linhas = readFileSync(join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/);
    for (const l of linhas) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2];
    }
  } catch {
    // sem .env: tools que dependem do banco retornam vazio
  }
}

const temCredenciais = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const CHAVE_TESTE = 'chave-teste-mcp';
let chaveAnterior: string | undefined;
let sessionId: string | undefined;
let proximoId = 0;
let ipTeste = 0;

interface RespostaRpc {
  jsonrpc?: string;
  id?: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

// Envia uma mensagem JSON-RPC ao endpoint e devolve o resultado parseado.
// O Streamable HTTP pode responder JSON puro ou SSE (linhas "data: {...}")
async function rpc(method: string, params?: unknown, chave: string | null = CHAVE_TESTE) {
  ipTeste += 1;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'x-forwarded-for': `10.98.${Math.floor(ipTeste / 250)}.${ipTeste % 250}`,
  };
  if (chave !== null) headers.Authorization = `Bearer ${chave}`;
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const res = await handler(
    new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: ++proximoId, method, params }),
    }),
  );
  const novoSession = res.headers.get('mcp-session-id');
  if (novoSession) sessionId = novoSession;

  const texto = await res.text();
  if (!res.ok) return { status: res.status, rpc: null as RespostaRpc | null, texto };

  const contentType = res.headers.get('content-type') ?? '';
  let corpo: RespostaRpc | null = null;
  if (contentType.includes('text/event-stream')) {
    // SSE: cada evento e uma linha "data: <json>"; vale a ultima
    const dados = texto
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    if (dados.length > 0) corpo = JSON.parse(dados[dados.length - 1]!) as RespostaRpc;
  } else {
    corpo = JSON.parse(texto) as RespostaRpc;
  }
  return { status: res.status, rpc: corpo, texto };
}

// Extrai o JSON retornado por uma tool (content[0].text)
function textoTool(resultado: Record<string, unknown> | undefined): Record<string, unknown> {
  const content = resultado?.content as Array<{ type: string; text?: string }> | undefined;
  expect(content?.[0]?.type).toBe('text');
  return JSON.parse(content?.[0]?.text ?? '{}') as Record<string, unknown>;
}

beforeAll(() => {
  carregarEnv();
  chaveAnterior = process.env.MCP_API_KEY;
  process.env.MCP_API_KEY = CHAVE_TESTE;
});

afterAll(() => {
  if (chaveAnterior === undefined) delete process.env.MCP_API_KEY;
  else process.env.MCP_API_KEY = chaveAnterior;
});

describe('/api/mcp', () => {
  it('rejeita requisicao sem chave', async () => {
    const { status } = await rpc('tools/list', undefined, null);
    expect(status).toBe(401);
  });

  it('rejeita chave invalida', async () => {
    const { status } = await rpc('tools/list', undefined, 'chave-errada');
    expect(status).toBe(401);
  });

  it('responde initialize com serverInfo do Kora', async () => {
    const { status, rpc: r } = await rpc('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'vitest', version: '0.0.1' },
    });
    expect(status).toBe(200);
    const info = r?.result?.serverInfo as { name?: string } | undefined;
    expect(info?.name).toBe('kora-nori');
  });

  it('lista as 4 tools read-only', async () => {
    const { status, rpc: r } = await rpc('tools/list');
    expect(status).toBe(200);
    const tools = r?.result?.tools as Array<{ name: string; annotations?: { readOnlyHint?: boolean } }>;
    const nomes = tools.map((t) => t.name).sort();
    expect(nomes).toEqual(['buscar_politica', 'consultar_pedido', 'listar_conciliacoes', 'resumo_metricas']);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });

  it('consultar_pedido retorna dados deterministicos do pedido', async () => {
    const { rpc: r } = await rpc('tools/call', {
      name: 'consultar_pedido',
      arguments: { codigo: '156489' },
    });
    expect(r?.error).toBeUndefined();
    const dados = textoTool(r?.result);
    expect(dados.codigo).toBe('156489');
    expect(typeof dados.descricao).toBe('string');
    expect(dados.descricao).toContain('Pedido 156489');
    expect(dados.detalhes).toBeTruthy();
  });

  it('consultar_pedido rejeita codigo invalido', async () => {
    const { rpc: r } = await rpc('tools/call', {
      name: 'consultar_pedido',
      arguments: { codigo: '!!' },
    });
    // Schema rejeita: erro JSON-RPC ou tool error, nunca crash
    expect(r?.error !== undefined || r?.result?.isError === true).toBe(true);
  });

  it('buscar_politica retorna trechos do RAG', async () => {
    if (!temCredenciais()) return; // RAG depende do Supabase
    const { rpc: r } = await rpc('tools/call', {
      name: 'buscar_politica',
      arguments: { pergunta: 'produto chegou faltando itens' },
    });
    expect(r?.error).toBeUndefined();
    const dados = textoTool(r?.result);
    expect(dados.modo === 'hibrido' || dados.modo === 'lexical').toBe(true);
    expect(Array.isArray(dados.trechos)).toBe(true);
  });

  it('listar_conciliacoes retorna array', async () => {
    if (!temCredenciais()) return;
    const { rpc: r } = await rpc('tools/call', {
      name: 'listar_conciliacoes',
      arguments: { limite: 5 },
    });
    expect(r?.error).toBeUndefined();
    const dados = textoTool(r?.result);
    expect(Array.isArray(dados.conciliacoes)).toBe(true);
  });

  it('resumo_metricas retorna agregados ou null sem banco', async () => {
    if (!temCredenciais()) return;
    const { rpc: r } = await rpc('tools/call', { name: 'resumo_metricas', arguments: {} });
    const dados = textoTool(r?.result);
    expect('metricas' in dados).toBe(true);
  });
});
