# Spec: Servidor MCP do Kora — V1

Status: proposto

## Objetivo

Expor o Projeto Kora (agente Nori) como um **servidor MCP** (Model Context
Protocol) para que outros agentes de IA (Claude Desktop, Cursor, Devin etc.)
consumam suas capacidades como ferramentas externas. Hoje o Nori so fala pelo
chat web; com o MCP, um agente externo pode consultar pedidos, buscar politicas
de disputa e listar conciliacoes sem passar pela conversa.

Sucesso para o usuario: um endpoint `/api/mcp` hospedado na Vercel (gratis),
autenticado por API key, expondo tools read-only que reaproveitam a
infraestrutura existente (Supabase, pedidos deterministicos, RAG).

## Assumptions I'M MAKING

1. Transporte **Streamable HTTP** (transporte MCP atual; nao SSE legado nem stdio)
2. Hospedagem na **Vercel** junto das functions existentes (`api/mcp.ts`)
3. Autenticacao por **API key estatica** em env var `MCP_API_KEY` (header
   `Authorization: Bearer` ou `x-api-key`); sem OAuth nesta versao
4. Tools **read-only** na V1 (nada que grave/mutate dados — sem risco de abuso)
5. Runtime Node/TypeScript igual as demais functions (adaptador
   `shared/http.ts` ja converte Node req/res <-> Web Request/Response)
6. Pacote `mcp-handler` (oficial Vercel) + `@modelcontextprotocol/sdk` para
   implementacao; alternativas avaliadas na fase de plano

## Tech Stack

- `@modelcontextprotocol/sdk` — protocolo MCP (versao estavel, >7 dias publicada)
- `mcp-handler` — adaptador Request/Response para hosts serverless (Vercel)
- Node/TypeScript, mesmo tsconfig do projeto
- Supabase (PostgREST/RPC), `shared/pedidos.ts`, `rag/` — ja existentes

## Commands

- Dev local: `npm run dev:api` (rota `/api/mcp` registrada no dev-server)
- Build: `npm run typecheck` e `npm --prefix frontend run build`
- Testes: `npm test` (vitest; unitarios + integracao real)
- Validacao MCP manual: `curl` com JSON-RPC (`initialize`, `tools/list`,
  `tools/call`) contra `http://localhost:3000/api/mcp`
- Inspector MCP (opcional): `npx @modelcontextprotocol/inspector`

## Project Structure

```
api/mcp.ts            → endpoint MCP (handler web padrao do projeto)
api/README.md         → documentar a nova rota
spec/SPEC-mcp-server.md → esta spec
tests/mcp.test.ts     → testes do endpoint (unitario + integracao real)
scripts/dev-server.ts → registrar rota /api/mcp
docs/CONTEXTO_ATUAL.md → atualizar estado do projeto
```

## Tools propostas (V1, read-only)

| Tool | Entrada | Saida | Implementacao |
|---|---|---|---|
| `consultar_pedido` | `codigo: string` | dados do pedido ficticio | `shared/pedidos.ts` (`pedidoFicticio`) |
| `buscar_politica` | `pergunta: string` | top trechos da base | `rag/embeddings.ts` + RPC `buscar_conhecimento_hibrido` |
| `listar_conciliacoes` | `limite?: number` | conciliacoes registradas | `consultar('conciliacoes', ...)` |
| `resumo_metricas` | — | agregados de uso | RPC `metricas_chat_resumo` |

## Code Style

Mesmo padrao das functions existentes: handler `(req: Request) => Promise<Response>`,
comentarios em portugues explicando o que a funcao faz, validacao estrita de
entrada, erros JSON `{ erro: '...' }`, segredos apenas server-side via env.

## Testing Strategy

- Vitest, `tests/mcp.test.ts`:
  - Requisicao sem/invalid API key → 401/403
  - `tools/list` retorna as 4 tools
  - `tools/call consultar_pedido` retorna dados do pedido ficticio
  - `tools/call buscar_politica` retorna trechos do RAG (integracao real,
    tolerante a indisponibilidade como os demais testes)
- Sem cobertura exigida em frontend (nao ha UI nesta feature)

## Boundaries

- **Always:** validar a API key antes de qualquer tool; validar argumentos
  (codigo/pedido com tamanho maximo); respostas JSON serializaveis; registrar
  a rota no dev-server
- **Ask first:** tools que escrevam dados (ex.: `registrar_conciliacao`),
  autenticacao OAuth, novo provedor de transporte
- **Never:** commitar `MCP_API_KEY` ou qualquer segredo; expor tools de
  escrita sem aprovacao; expor dados de outros usuarios/segredos nas tools

## Success Criteria

- `POST /api/mcp` responde `initialize` e `tools/list` com as 4 tools
- `tools/call` funciona localmente e em producao (apos `MCP_API_KEY` setada
  na Vercel)
- Sem `MCP_API_KEY` valida, nenhuma tool executa
- `npm run typecheck`, `npm test` e build do frontend passam
- Cliente MCP externo consegue conectar e chamar uma tool (verificacao manual
  documentada em api/README.md)

## Out of Scope (Deferred) — backlog V2

- Tools de escrita (`registrar_conciliacao`, `abrir_caso`) — risco de abuso
- OAuth 2.1 / autenticacao por usuario
- Resources e prompts MCP (alem de tools)
- Rate limit dedicado ao endpoint MCP
- SSE legado e transporte stdio
- Logs/auditoria de chamadas MCP em tabela propria

## Open Questions

1. Nome da env var: `MCP_API_KEY` esta ok ou prefere outra?
2. `listar_conciliacoes`/`resumo_metricas` expoem dados agregados do
   projeto — ok para um endpoint publico-com-chave, ou restringir a tools
   de dominio (pedido/politica)?
3. Tools de escrita ficam mesmo fora da V1? (assumi que sim)
