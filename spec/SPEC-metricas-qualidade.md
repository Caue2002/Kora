# Spec: Metricas de Qualidade Consolidadas — V1

Status: proposto

Modulo `metricas-qualidade` do capability-map (`spec/capability-map.md`).

## Objetivo

Transformar a instrumentacao ja existente (metricas_chat + RPC
metricas_chat_resumo + evals com rubricas e juiz LLM) em um **relatorio de
qualidade unico e demonstravel**: um numero consolidado que responda, em
entrevista, "como voce sabe que o sistema esta bom?".

Hoje os evals rodam no CI/local mas os scores se perdem (SPEC-llm-judge-evals
V1 nao persistia nada). As metricas de producao existem mas estao espalhadas
pelo painel. Falta a camada que junta os dois.

## Entregas

### 1. Persistencia de scores de eval (migration 0019)

- Nova tabela `eval_runs`: `id`, `criado_em` (default now()), `suite`
  ('rubricas' | 'juiz'), `total`, `aprovados`, `reprovados`,
  `nota_media` (numeric, so juiz), `detalhes` jsonb (cenario -> resultado),
  `origem` ('local' | 'ci').
- Grants para service_role (padrao das migrations anteriores).
- Arquivo versionado `database/migrations/0019_eval_runs.sql`.
  **Aplicacao no Supabase via MCP somente com aprovacao explicita**
  (regra inviolavel do projeto).

### 2. Evals gravam o resultado

- `tests/evals.test.ts` e `tests/evals-juiz.test.ts`: ao final da suite
  (afterAll), inserir 1 linha em eval_runs com os agregados. Falha de
  escrita NAO reprova o teste (try/catch + warn) — evals nao podem quebrar
  por telemetria.
- Sem credenciais o teste ja pula inteiro — nada muda.

### 3. API agrega qualidade

- `api/metricas.ts` passa a incluir no payload um bloco `qualidade`:
  ultimas N execucoes de eval (suite, aprovados/total, nota_media,
  criado_em) lidas direto via PostgREST em eval_runs (service role ja
  configurada em shared/supabase.ts). Falha na leitura nao derruba o
  endpoint (bloco null, mesmo padrao do resumo).
- Manter contrato atual: `{ metricas: {...}, qualidade: {...} | null }`.

### 4. Painel /metricas.html

- Nova secao "Qualidade (evals)" no estilo visual atual do painel:
  taxa de aprovacao do ultimo run de cada suite, nota media do juiz,
  mini-historico das ultimas ~10 execucoes.
- JS externo `frontend/public/metricas.js` (CSP script-src 'self').

### 5. Script de relatorio para entrevista

- `scripts/relatorio_qualidade.mjs`: le .env, chama a RPC
  metricas_chat_resumo + tabela eval_runs e imprime um relatorio
  textual unico (markdown leve) com: volume do dia, latencia p50/p95,
  cache hit rate, custo equivalente, tools, taxa de fallback por camada
  (via metricas por modelo: entradas cache-*-fallback/generico-fallback),
  e os ultimos scores de eval. Saida pensada para colar em doc/notas de
  entrevista.

## Fora de escopo (V2)

- Comparacao automatica com baseline no CI (modulo eval-baseline-ci)
- Metricas de retrieval/precision@k (modulo eval-retrieval)
- Metricas por usuario/conversa (depende de auth/memoria)
- Alertas quando score de eval cai (entra com baseline-ci)

## Boundaries

- Always: testes novos/alterados em tests/, typecheck + npm test +
  build do frontend antes de commitar, comentarios em portugues.
- Ask first: aplicar migration 0019 no Supabase via MCP (escrita exige
  aprovacao explicita), qualquer mudanca no contrato de /api/metricas
  alem do bloco aditivo `qualidade`.
- Never: alterar texto existente do Guia PDF alem de acrescimo de secao;
  commitar segredos; bloquear testes por falha de telemetria.

## Criterios de sucesso

- `npm run typecheck`, `npm test` e `npm --prefix frontend run build` limpos.
- Evals (quando rodados com credenciais) gravam 1 linha por suite em
  eval_runs; sem credenciais nada quebra.
- /api/metricas retorna `qualidade` populado quando ha runs registrados.
- Painel exibe a secao de qualidade sem erro com dados e com banco vazio.
- `node scripts/relatorio_qualidade.mjs` imprime relatorio legivel mesmo
  sem dados de eval ainda.
- Docs atualizadas: CONTEXTO_ATUAL.md, docs/fluxo-kora/index.html,
  secao nova no Guia PDF (backup + PyMuPDF incremental), AGENTS.md
  (lista de specs).
