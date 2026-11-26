# Spec: Eval de Retrieval (RAG) — V1

Status: implementado — hit@4 18/18 na primeira rodada valida; gap real
encontrado e corrigido via ajuste do dataset (ver CONTEXTO_ATUAL)

Modulo `eval-retrieval` do capability-map (`spec/capability-map.md`).

## Objetivo

Os evals atuais medem a RESPOSTA final (rubricas + juiz), mas nao medem a
primeira etapa do pipeline: se a `buscaHibrida` esta trazendo o trecho de
politica certo para cada tipo de disputa. RAG falha em duas etapas
independentes — retrieval e geracao — e so a segunda era medida.

Novo suite de eval dedicado a retrieval: para cada consulta realista do
dominio, verifica se o trecho esperado aparece no top-k, e persiste o
resultado em `eval_runs` (suite `retrieval`) junto das demais.

## Decisoes

- Novo arquivo `tests/evals-retrieval.test.ts`, no mesmo padrao dos evals
  existentes: carrega .env, pula sem credenciais (precisa de Supabase +
  Gemini para embeddings), IP unico por chamada.
- Dataset proprio (~14 consultas) mapeando mensagens realistas de disputa
  para o `titulo` esperado do chunk em `conhecimento_chunks` (as 20 regras
  de `politicas_disputa.json`). Match por substring normalizada
  (sem acento, minuscula) no `titulo` retornado — tolerante a variacao.
- Metrica: hit@4 (o trecho esperado esta entre os 4 retornados).
  result.recall = hits/total impresso no log e persistido.
- Persistencia reutiliza `tests/eval_runs.ts` com suite `'retrieval'`
  (union type ampliada); `nota_media` fica null — retrieval nao tem
  nota de juiz.
- Migration `0020_eval_runs_suite_retrieval.sql`: amplia o check de
  `eval_runs.suite` para incluir `'retrieval'` (drop + add constraint).
  Aplicacao via MCP somente com aprovacao explicita.
- Casos negativos (pergunta casual/meta) ficam FORA da V1: o chat ja pula
  RAG para eles (coherence/intencao.ts) e o score hibrido nao tem
  threshold limpo para "nao deveria retornar nada" — medir isso exigiria
  calibração que nao cabe aqui. Fica como backlog.

## Fora de escopo (V2)

- Retrieval negativo / calibracao de threshold de score
- MRR ou nDCG (V1 mede hit@4 binario por cenario)
- Reranking ou avaliacao por posicao do trecho esperado
- Uso do resultado de retrieval para rotear modelo (modulo
  roteamento-modelos decide por intencao, nao por score de busca)

## Boundaries

- Always: testes pulam sem credenciais; comentarios em portugues;
  typecheck + testes unitarios + build antes de commitar.
- Ask first: aplicar migration 0020 no Supabase via MCP.
- Never: alterar a funcao buscar_conhecimento_hibrido ou o score hibrido
  por causa do eval (o eval mede, nao muda o sistema).

## Criterios de sucesso

- `tests/evals-retrieval.test.ts` roda contra Supabase+Gemini reais,
  imprime hit@4 por cenario e o agregado, e grava 1 linha em eval_runs
  com suite='retrieval'.
- Sem credenciais: suite pulada, nada gravado, suite completa continua
  verde.
- Painel /metricas.html e scripts/relatorio_qualidade.mjs reconhecem a
  suite 'retrieval' (rotulo proprio).
