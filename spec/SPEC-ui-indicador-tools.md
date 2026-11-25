# Spec: Indicadores de tool no streaming — V1

Status: aprovado

## Objetivo

Tornar o function calling VISIVEL: quando a Nori chama consultar_pedido ou
buscar_politica, o chat mostra um indicador ("Consultando pedido...",
"Buscando na base de conhecimento...") em vez de silencio total.

## Decisoes

- O loop de tools vive dentro do ReadableStream em shared/llm.ts — o cliente
  nao ve nada ate o texto fluir. Para sinalizar, emitir eventos SSE
  customizados no stream: linhas `data: {"tool":"consultar_pedido"}` (JSON)
  antes de cada functionResponse.
- O frontend (api.ts) detecta essas linhas no parser SSE e expoe um callback
  `onTool?: (nome: string) => void`; App.tsx mostra o status na bolha de
  "digitando" (substitui "Pensando..." por "Consultando pedido...").
- Formato do stream: manter texto puro para chunks normais (compat) e uma
  linha JSON prefixada quando tool call acontecer — parser tolera ambos.
- Indicador some sozinho quando o texto comeca a chegar.

## Fora de escopo (V2)

- Indicador de qual argumento foi passado
- Metrica de tool calls no painel
