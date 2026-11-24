# api/

Funcoes serverless hospedadas na Vercel.

- Validacao de entrada das mensagens
- Controle de orcamento de tokens por modelo
- Alternancia automatica entre os modelos gratuitos configurados (Gemini/Groq/Pollinations) por limite de tokens ou falha, com failover imediato para o proximo da fila
- Orquestracao do fluxo Nori (RAG + coherence)

## /api/mcp — servidor MCP

Endpoint MCP (Streamable HTTP) que expoe o Kora como ferramentas para agentes
externos. Requer `MCP_API_KEY` configurada; o cliente envia a chave em
`Authorization: Bearer <chave>` ou `x-api-key: <chave>`.

Tools disponiveis (somente leitura):

- `consultar_pedido(codigo)` — dados deterministicos do pedido ficticio
- `buscar_politica(pergunta)` — trechos do RAG de politicas de disputa
- `listar_conciliacoes(limite?)` — conciliacoes registradas pelo agente
- `resumo_metricas()` — agregados de uso do chat

Exemplo de conexao (Claude Desktop / Cursor): URL
`https://<deploy>/api/mcp` com header de autorizacao contendo a chave.
Teste local com curl:

```sh
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
