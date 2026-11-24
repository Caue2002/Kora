// Endpoint /api/mcp — servidor MCP (Model Context Protocol) do Projeto Kora
// Expoe capacidades do agente Nori como tools para agentes externos
// (Claude Desktop, Cursor, Devin etc.) via Streamable HTTP.
// Autenticacao: API key estatica em MCP_API_KEY, enviada pelo cliente em
// "Authorization: Bearer <chave>" ou "x-api-key: <chave>".
// V1 somente leitura: nenhuma tool grava ou altera dados.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createMcpHandler } from 'mcp-handler';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { tratarRequisicaoNode } from '../shared/http.js';
import { verificarChaveApi } from '../shared/auth.js';
import { verificarLimite } from '../shared/ratelimit.js';
import { detalhesPedido, pedidoFicticio } from '../shared/pedidos.js';
import { buscaHibrida } from '../rag/search.js';
import { consultar, rpc } from '../shared/supabase.js';

const TAMANHO_MAX_PERGUNTA = 500;
const TAMANHO_MAX_CONCILIACOES = 50;

interface Conciliacao {
  id: number;
  conversa_id: string;
  categoria: string | null;
  status: string | null;
  resumo: string | null;
  parecer: string | null;
  modelo: string | null;
  criado_em: string;
}

// Resposta padrao das tools: JSON serializado em content[0].text
function resultadoJson(dados: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(dados, null, 2) }] };
}

// Registra as tools read-only do Kora no servidor MCP
function registrarTools(server: McpServer): void {
  // Consulta um pedido da simulacao pelo codigo: retorna os dados
  // deterministicos (loja, itens, valor) que o Nori usaria na conversa
  server.registerTool(
    'consultar_pedido',
    {
      title: 'Consultar pedido',
      description:
        'Consulta um pedido ficticio da simulacao Kora pelo codigo e retorna loja, itens e valor deterministicos.',
      inputSchema: z.object({
        codigo: z
          .string()
          .min(3)
          .max(20)
          .regex(/^[A-Za-z0-9-]+$/)
          .describe('Codigo do pedido (ex.: 156489 ou K7X9-AB)'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ codigo }) =>
      resultadoJson({
        codigo: codigo.toUpperCase(),
        descricao: pedidoFicticio(codigo.toUpperCase()),
        detalhes: detalhesPedido(codigo.toUpperCase()),
      }),
  );

  // Busca na base de conhecimento de politicas de disputa (RAG hibrido)
  server.registerTool(
    'buscar_politica',
    {
      title: 'Buscar politica de disputa',
      description:
        'Busca trechos das politicas de disputa do Kora (item faltante, item errado, qualidade, atraso, pagamento) relevantes para a pergunta.',
      inputSchema: z.object({
        pergunta: z
          .string()
          .min(3)
          .max(TAMANHO_MAX_PERGUNTA)
          .describe('Pergunta ou descricao do problema de disputa'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ pergunta }) => {
      const busca = await buscaHibrida(pergunta.trim(), 4);
      return resultadoJson({
        modo: busca.modo,
        trechos: busca.trechos.map((t) => ({
          titulo: t.titulo,
          categoria: t.categoria,
          conteudo: t.conteudo,
          score: t.score,
        })),
      });
    },
  );

  // Lista as conciliacoes registradas pelo agente (disputas com parecer)
  server.registerTool(
    'listar_conciliacoes',
    {
      title: 'Listar conciliacoes',
      description:
        'Lista as conciliacoes de disputa registradas pelo agente Nori, da mais recente para a mais antiga.',
      inputSchema: z.object({
        limite: z
          .number()
          .int()
          .min(1)
          .max(TAMANHO_MAX_CONCILIACOES)
          .optional()
          .describe(`Quantidade maxima de registros (padrao 10, max ${TAMANHO_MAX_CONCILIACOES})`),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ limite }) => {
      const n = limite ?? 10;
      const linhas = await consultar<Conciliacao>(
        'conciliacoes',
        `select=id,conversa_id,categoria,status,resumo,parecer,modelo,criado_em&order=criado_em.desc&limit=${n}`,
      );
      return resultadoJson({ total: linhas.length, conciliacoes: linhas });
    },
  );

  // Agregados de uso do chat (volume, latencia, cache, distribuicao por modelo)
  server.registerTool(
    'resumo_metricas',
    {
      title: 'Resumo de metricas',
      description:
        'Retorna agregados de uso do agente Nori: total de mensagens, latencia media, hits de cache e consumo por modelo.',
      annotations: { readOnlyHint: true },
    },
    async () => resultadoJson({ metricas: await rpc('metricas_chat_resumo', {}) }),
  );
}

// Handler MCP criado uma unica vez por instancia serverless
const mcpHandler = createMcpHandler(
  async (server) => {
    registrarTools(server);
  },
  {
    serverInfo: { name: 'kora-nori', version: '1.0.0' },
    // Nao abrimos streams SSE de subscription: respostas sao request/response
    maxSubscriptions: 0,
  },
);

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function webHandler(req: Request): Promise<Response> {
  // Autenticacao obrigatoria antes de qualquer metodo MCP (initialize incluso)
  const falhaAuth = verificarChaveApi(req);
  if (falhaAuth === 503) {
    return json(503, { erro: 'Servidor MCP desabilitado: MCP_API_KEY nao configurada' });
  }
  if (falhaAuth === 401) {
    return json(401, { erro: 'Chave de acesso invalida ou ausente' });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await verificarLimite(`mcp:${ip}`, 60, 60_000))) {
    return json(429, { erro: 'Muitas requisicoes. Aguarde um instante.' });
  }

  try {
    return await mcpHandler(req);
  } catch (erro) {
    console.error('[mcp] erro no handler:', erro);
    return json(500, { erro: 'Erro interno do servidor MCP' });
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
