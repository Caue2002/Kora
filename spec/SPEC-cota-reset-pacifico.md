# Spec: Reset de Cota por Provedor (alinhamento aos fusos reais)

Status: implementado — janela dia por provedor em shared/models.ts,
painel exibe reset_cota_em; migration 0022_metricas_reset_cota APLICADA
em 27/11/2026 via MCP (verificado: reset_cota_em = proxima meia-noite PT)

Origem: analise de 27/11/2026. A janela "dia" de `cotas_modelos` usa
meia-noite do fuso do servidor (na Vercel = UTC), que nao corresponde ao
reset real de nenhum provedor do catalogo:

- **Gemini** (slots 1-5, 7-9, 11, 13): a documentacao oficial
  (`ai.google.dev/gemini-api/docs/rate-limits`) diz "Requests per day
  (RPD) quotas reset at midnight Pacific time" — meia-noite em
  `America/Los_Angeles`, com horario de verao automatico (PDT/PST).
  Hoje sao ~08:00 UTC / 05:00 de Brasilia; em horario de verao ~07:00 UTC.
- **Groq** (slot 6, `openai/gpt-oss-120b`): cotas diarias (RPD/TPD)
  resetam a meia-noite UTC (comportamento reportado de forma consistente;
  a mensagem de 429 do Groq informa o tempo de retry).
- **Pollinations** (slot 10): sem cota diaria formal conhecida; a janela
  "dia" interna e apenas bookkeeping — qualquer fronteira serve.

Hoje a janela interna zera as 00:00 UTC: ~8h DEPOIS do reset real do
Gemini (que ja renovou) e ~3h ANTES dele em relacao a SP. Entre 00:00 e
~08:00 UTC o sistema considera o modelo com cota nova, mas o Gemini ainda
esta no dia antigo e devolve 429 — gerando falhas evitaveis no failover.

RPM/TPM sao janelas movel/continua nos dois provedores — nao tem horario
de reset fixo e o codigo atual (janelas de minuto/hora alinhadas ao
relogio) ja e adequado. A mudanca e SOMENTE na janela `dia`.

## Objetivo

Fazer a janela `dia` de `cotas_modelos` (e o fallback em memoria)
renovar no mesmo instante em que a cota diaria real de cada provedor
renova, e deixar o painel de metricas explicito sobre quando a cota do
Gemini renova de fato.

## Decisoes

- `shared/models.ts`: `inicioJanelas()` passa a receber o provedor (ou o
  `ModeloConfig`) e a janela `dia` vira "meia-noite mais recente no fuso
  de reset do provedor":
  - `gemini` -> `America/Los_Angeles`
  - `groq` -> `UTC` (meia-noite UTC)
  - `pollinations`/desconhecido -> `UTC` (bookkeeping, sem impacto)
- Minuto e hora continuam alinhados ao relogio do servidor (sao janelas
  de duracao fixa; o fuso nao muda o comportamento).
- Calculo do inicio do dia no fuso alvo via `Intl.DateTimeFormat` com
  `timeZone` (Node tem ICU completo na Vercel) — sem dependencias novas.
  Duas passadas de offset para cobrir virada de horario de verao.
- `consumoBancoTodos` passa a agrupar os `janela_inicio` de `dia`
  distintos por provedor (hoje no maximo 2 valores: PT e UTC) e consulta
  `janela_inicio=in.(...)` — uma query so, sem N+1.
- `usoMemoria` continua com um `janelaDia` por modelo — como cada modelo
  tem provedor fixo, basta computar o inicio do dia no fuso do seu
  provedor na comparacao.
- `registrarConsumo(modeloId, tokens)`: a janela `dia` usa o
  `janela_inicio` do fuso do provedor daquele modelo (lookup no
  catalogo por id). Assinatura da RPC `registrar_consumo_tokens` nao
  muda — `p_janela_inicio` ja e parametro.
- `marcarEsgotado` so marca a janela `minuto`: inalterado.
- Linhas antigas de `cotas_modelos` com `janela_inicio` de dia em UTC
  ficam orfas (nao casam mais com a query) — efeito identico a um reset
  unico. Nenhuma migration necessaria; opcionalmente limpar depois.
- Painel `/metricas`: a RPC `metricas_chat_resumo` ganha o campo
  `reset_cota_em` = proximo instante de meia-noite PT (reset diario do
  Gemini), calculado em Postgres com `America/Los_Angeles`. O painel
  exibe esse horario no subtitulo ao lado de "RESET DIARIO" (que continua
  sendo o dia de exibicao em SP) — ex.: "USO DO DIA (SP) · COTA GEMINI
  RENOVA 05:00". Requer nova migration `0018+`/`0019+` recriando a RPC
  (ou `create or replace`).
- Groq e Pollinations: alinhamento ao UTC e aproximacao documentada —
  nao ha API de quota restante em nenhum provedor; a confirmacao real de
  renovacao continua sendo o primeiro 200 apos um 429 (failover ja faz).

## Fora de escopo (V2)

- Consultar `aistudio.google.com/rate-limit` ou qualquer API de quota
  restante (nao existe endpoint publico para isso no Gemini).
- Limites RPD/TPD reais por modelo do Gemini (Google nao publica tabela
  fixa; varia por projeto e tier — os limites internos
  `LIMITE_TOKENS_*` seguem como proxy configuravel por env).
- Janelas de cota por provedor alem de `dia` (minuto/hora sao uniformes).
- Tracking de `ultimo_429_em`/`renovou_em` por modelo no banco.

## Boundaries

- Always: typecheck + testes + build antes de commitar; docs
  (CONTEXTO_ATUAL, fluxo-kora se visivel, DECISOES se decisao duravel)
  no mesmo ciclo; migration versionada em `database/migrations/`.
- Ask first: mudanca no catalogo de modelos (shared/env.ts); escrita no
  Supabase via MCP (usar arquivo de migration + aplicacao pelo fluxo
  normal do projeto).
- Never: alterar janelas de minuto/hora; remover o failover por 429;
  hardcodar data/hora de reset (sempre derivar do fuso, que trata DST).

## Criterios de sucesso

- Teste unitario: `inicioJanelas`/`inicioDiaProvedor` retorna o instante
  correto de meia-noite PT e UTC em datas conhecidas (incluindo uma data
  em PDT e outra em PST).
- `registrarConsumo` de um modelo Gemini grava `janela_inicio` =
  meia-noite PT; de um modelo Groq = meia-noite UTC.
- Apos a virada da meia-noite PT, a janela `dia` do modelo Gemini zera
  no banco e em memoria no mesmo instante do reset real do RPD.
- Painel /metricas exibe o horario do proximo reset de cota do Gemini.
- `npm run typecheck`, `npm test` e `npm --prefix frontend run build`
  verdes.
