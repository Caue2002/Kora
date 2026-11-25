# api/

Funcoes serverless hospedadas na Vercel.

- Validacao de entrada das mensagens
- Controle de orcamento de tokens por modelo
- Alternancia automatica entre os modelos gratuitos configurados (Gemini/Groq/Pollinations) por limite de tokens ou falha, com failover imediato para o proximo da fila
- Orquestracao do fluxo Nori (RAG + coherence)
- Function calling: a Nori pode chamar tools (consultar_pedido,
  buscar_politica) via Gemini function calling — shared/tools.ts define os
  schemas e shared/llm.ts executa o loop tool-call -> functionResponse ->
  resposta final, preservando streaming (so Gemini; demais provedores seguem
  o fluxo simples)

## /api/a2a — protocolo A2A

Endpoint JSON-RPC 2.0 do protocolo Agent2Agent: outros agentes descobrem a
Nori pelo agent card publico em `/.well-known/agent-card.json`
(frontend/public) e conversam via `message/send`. Pipeline enxuto (um turno,
sem historico/estado). Mesma auth `MCP_API_KEY`.

## /api/tts — texto para fala

POST `{ texto }` -> `audio/mpeg` com voz neural Microsoft Edge
(`pt-BR-FranciscaNeural`, gratuita via msedge-tts). Sem auth; rate limit
30/min por IP; texto limpo de markdown e limitado a 1200 chars. O botao
"ouvir" do chat usa este endpoint com fallback para a voz do navegador.

## /api/handoff — encaminhamento humano

Recebe `{ mensagens: [{role, content}] }` e devolve `{ handoff }`: resumo
estruturado do caso (fatos, evidencias, pendencias, proximo passo) gerado
por LLM com saida JSON-mode. Usado pelo botao "Encaminhar p/ atendente" do
chat. Mesma auth `MCP_API_KEY`.

## /metricas.html — painel de observabilidade

Pagina estatica (frontend/public) com KPIs, mensagens/dia e consumo por
modelo (latencia, tokens, custo equivalente) alimentada por GET /api/metricas.
Link no menu de acoes do chat.

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
