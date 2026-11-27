# Spec: Observabilidade v2 — V1

Status: implementado

## Objetivo

Aprofundar o painel /metricas.html e a telemetria por request:

1. **Trace por request**: registrar etapas do pipeline (cache, RAG,
   LLM, tools, coerencia) com latencia parcial — nova coluna jsonb
   `trace` em metricas_chat OU nova tabela `metricas_trace` (decidir na
   implementacao; preferir jsonb para nao criar tabela nova).
2. **Percentis**: p50/p95 de latencia no painel (RPC metricas_chat_resumo
   precisa retornar ou calcular no cliente a partir de amostras — RPC
   atual agrega media; estender com percentile_cont se Postgres 15+,
   senao retornar amostras cruas limitadas).
3. **Cache hit rate** ja existe (cache_hits/total) — destacar no painel.
4. **Tool calls**: contar quantas vezes function calling disparou por
   modelo/dia (campo em metricas_chat: tools_usadas int default 0).

## Decisoes

- metricas_chat ganha colunas `trace jsonb` e `tools_usadas integer` —
  migration 0011 nova (pendente de aplicar manualmente como as demais).
- api/chat.ts preenche trace com tempos parciais (Date.now() nos marcos).
- Painel: nova secao "Trace medio" (barras por etapa) + p50/p95 nos KPIs +
  contagem de tool calls.
- Migration 0011 documentada em CONTEXTO_ATUAL como pendente de SQL Editor.

## Fora de escopo (V2)

- Trace individual por request consultavel (endpoint de detalhe)
- Alertas automaticos

## Atualizacao (26/11/2026) — metricas do dia

Todos os agregados da RPC `metricas_chat_resumo()` passaram a filtrar o
dia corrente no fuso America/Sao_Paulo (migration 0018, aplicada em
26/11/2026): total, cache,
latencias, tools, consumo por modelo e traces recentes. O grafico
`por_dia` segue com os ultimos 14 dias como visao historica e a RPC
devolve `dia` para o painel exibir a data de referencia. O painel
/metricas.html rotula KPIs e cartoes como "hoje".
