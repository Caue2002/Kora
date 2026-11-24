# Spec: Function Calling na Nori — V1

Status: proposto

## Objetivo

Transformar capacidades deterministicas do Kora em **tools que o LLM
invoca** (function calling do Gemini), tornando o Nori um agente agentic
real: o modelo decide quando consultar um pedido ou buscar uma politica,
em vez de receber tudo injetado no prompt. Mesmas tools expoem o MCP —
uma historia unica: "as capacidades do agente sao tools padronizadas".

## Tools expostas ao modelo

| Tool | Quando o modelo deve chamar |
|---|---|
| `consultar_pedido(codigo)` | usuario informou codigo e o pedido nao esta injetado, ou quer reconfirmar dados |
| `buscar_politica(pergunta)` | precisa de regra/prazo da base que nao esta no contexto injetado |

## Decisoes tecnicas

- Somente provedores Gemini recebem `tools`/`toolConfig`
  (functionDeclarations + functionCallingConfig AUTO); OpenAI-compat
  nao envia tools nesta V1 — degrada sem erro.
- Execucao server-side: `consultar_pedido` -> `detalhesPedido`/
  `pedidoFicticio`; `buscar_politica` -> `buscaHibrida`.
- Loop de ate 2 rodadas de tool call; respostas `functionResponse`
  voltam como parts na sequencia `contents` do Gemini.
- Streaming preservado: o parser SSE passa a detectar `functionCall`
  nas parts; se chegar functionCall ANTES de qualquer texto, o servidor
  executa as tools e reabre o stream com o historico estendido — o
  usuario nao ve diferenca (TTFB igual quando nao ha tool call).
- Mensagens casuais/meta NAO recebem tools (mesmo criterio do RAG).
- Validacao: codigo de pedido segue regex `[A-Za-z0-9-]{3,20}`;
  pergunta da tool limitada a 500 chars.

## Riscos e mitigacoes

- Latencia extra so quando o modelo decide chamar tool (busca_politica
  ~1s de embedding+RPC) — aceitavel e visivel como diferencial.
- Modelo pode nao chamar tools quando deveria: mitigado mantendo a
  injecao deterministica de pedido por codigo (atalho atual) e o RAG
  pre-injetado; tools sao ESCALADA, nao substituto.
- Custo: function calling nao muda precificacao dos modelos free.

## Fora de escopo (V2)

- Tools de escrita (registrar_evidencia, encerrar_caso)
- Tool calling nos provedores Groq/Pollinations
- Streaming de function calls parcial (tool call visivel ao usuario)
