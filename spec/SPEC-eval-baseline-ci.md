# Spec: Baseline de Evals no CI — V1

Status: implementado — script verificado localmente contra eval_runs

Modulo `eval-baseline-ci` do capability-map (`spec/capability-map.md`).
Depende de `metricas-qualidade` (tabela eval_runs) e `eval-retrieval`
(suite 'retrieval') — ambos implementados.

## Objetivo

Hoje os evals rodam no CI e gravam score em eval_runs, mas ninguem compara
com o passado: uma regressao de qualidade passa verde se os testes nao
falharem no momento. Este modulo transforma o historico em **baseline
automatico**: depois dos evals, um passo do workflow compara o ultimo run
de CI de cada suite com o melhor run anterior e reprova o pipeline se a
taxa de aprovacao cair alem da tolerancia.

## Decisoes

- Novo script `scripts/check_eval_baseline.mjs` (Node ESM, mesmo estilo
  de relatorio_feedback/relatorio_qualidade): le credenciais do .env
  (CI ja monta o arquivo) ou do ambiente; consulta eval_runs via
  PostgREST filtrando origem='ci'.
- Regra de regressao por suite: baseline = maior `aprovados/total` entre
  os runs 'ci' ANTERIORES ao mais recente; o run mais recente reprova se
  `taxa < taxa_baseline - TOLERANCIA`. Tolerancia unica de 10 pontos
  percentuais para todas as suites (o juiz LLM e documentado como flaky;
  rubricas/retrieval tambem dependem de LLM indiretamente via respostas).
- Sem runs 'ci' anteriores (primeira execucao): passa com aviso — o
  baseline ainda nao existe.
- Falha ao consultar o banco NAO reprova o CI (warn + exit 0): telemetria
  nunca pode derrubar o pipeline — mesmo principio do eval_runs nos testes.
- Exit 1 lista as suites que regrediram com taxa baseline vs atual.
- `.github/workflows/evals.yml`: o loop de evals passa a incluir
  tests/evals-retrieval.test.ts (barato, ~13s, sem chamada de chat) e um
  novo step "Baseline de evals" roda o script apos os testes.
- O painel /metricas.html nao muda (historico de runs ja visivel).

## Fora de escopo (V2)

- Baseline por cenario (hoje e por suite/agregado)
- Tolerancia por suite (juiz mais folgado que rubricas)
- Alerta em regressao sem reprovar (ex.: comentario automatico em PR)
- Rollback automatico ou bissecao do commit causador

## Boundaries

- Always: comentarios em portugues; step novo nao pode quebrar o workflow
  existente; validar script localmente.
- Ask first: mudanca no workflow de evals alem de adicionar o arquivo de
  retrieval e o step do baseline.
- Never: reprovar CI por falha de leitura do banco; persistir baseline em
  arquivo do repo (a fonte da verdade e eval_runs).

## Criterios de sucesso

- evals.yml roda as 3 suites e depois o check de baseline.
- Script imprime comparativo por suite e sai 0/1 conforme a regra.
- Sem eval_runs 'ci' previo: exit 0 com mensagem de baseline pendente.
