# Spec: Dashboard de Observabilidade — V1

Status: implementado

## Objetivo

Dar visibilidade das metricas de producao do Nori (ja agregadas por
`metricas_chat_resumo`) numa pagina web publica e simples, para demo e
entrevistas: latencia, volume, cache hit rate, consumo por modelo e custo
equivalente estimado.

## Decisoes

- Pagina estatica `frontend/public/metricas.html` — sem framework, sem
  dependencia nova; servida em `/metricas.html` pelo build do Vite e na
  Vercel. Busca `GET /api/metricas` (endpoint ja publico e agregado).
- Graficos em HTML/CSS puro (barras CSS + tabelas) — zero libs de chart.
- "Custo equivalente" calculado no cliente com tabela de precos aproximada
  por modelo (PRECOS_1M), rotulado como estimativa — os modelos rodam em
  free tier, custo real ~US$ 0. Nao persiste preco no banco (muda com
  tabela dos provedores).
- Auto-refresh a cada 30s; tema escuro alinhado ao chat.

## Fora de escopo (V2)

- Metricas de trajeto/tool calls (quando function calling entrar)
- Alertas/threshholds
- Autenticacao na pagina (dados sao agregados nao-sensiveis)
