# Spec: Evals em CI — V1

Status: aprovado

## Objetivo

Rodar o golden dataset (evals.test.ts) + juiz (evals-juiz.test.ts) no GitHub
Actions a cada push/PR, com secrets, como quality gate.

## Decisoes

- Novo workflow `.github/workflows/evals.yml`:
  - trigger: push na main + pull_request + workflow_dispatch
  - job separado do testes.yml existente (evals sao lentos ~5-10min)
  - steps: checkout, setup-node, npm ci, npm --prefix frontend ci (nao
    precisa de build — evals so batem na API handler direto), escrever
    .env a partir de secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY, GROQ_API_KEY se houver), rodar `npx vitest run
    tests/evals.test.ts tests/evals-juiz.test.ts`
  - secrets via GitHub repo Settings > Secrets > Actions — documentar no
    CONTEXTO_ATUAL quais secrets cadastrar
- Falha de eval = check vermelho (nao bloqueia merge se branch protection
  nao exigir — documentar)
- Juiz eval pode ser flaky por natureza do LLM; manter threshold >=4.
  Se instavel demais em CI, rodar juiz so em workflow_dispatch (manual) —
  decidir apos primeiro run.

## Fora de escopo (V2)

- Dashboard de tendencias de evals
- Eval de regressao comparando com baseline
