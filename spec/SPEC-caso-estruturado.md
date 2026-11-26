# Spec: Extracao do Caso com Schema Estruturado (zod) — V1

Status: implementado

Modulo `caso-estruturado` do capability-map (`spec/capability-map.md`).

## Objetivo

A extracao do estado do caso (/api/caso) ja pede JSON ao modelo, mas a
validacao e manual (parseEstado + sanitizarEstado com whitelists
escritas a mao). Migrar para schema zod formal: o contrato do estado
fica declarado uma vez, validado em runtime e reutilizavel — mais
confiavel e mais facil de estender (novos campos de caso).

## Decisoes

- **`shared/caso.ts`**: `EstadoCasoSchema` (zod) declara etapa
  (enum), categoria (enum|null), status (enum), resumo e as 3 listas.
  Cada campo usa `.catch()` com o mesmo default que o sanitizador
  atual aplicava — um campo invalido nao derruba o objeto inteiro.
  `parseEstadoExtraido(texto)` faz a extracao tolerante do JSON
  (substring {…}) + safeParse; devolve null so quando nao ha JSON.
- **api/caso.ts**: parseEstado/sanitizarEstado/listaStrings saem;
  extrairEstado passa a usar o schema. Comportamento externo
  identico (mesmos defaults, mesmos limites de tamanho).
- Sem mudanca de prompt nem de endpoint — e uma troca de mecanismo de
  validacao, nao de comportamento.

## Fora de escopo (V2)

- Structured output nativo do provedor (responseSchema do Gemini /
  json_schema da OpenAI) — jsonMode + zod ja cobre o caso de uso
- Novos campos no estado do caso

## Boundaries

- Always: defaults identicos aos atuais; typecheck+testes+build.
- Ask first: migrations no Supabase (esta spec nao tem).
- Never: mudar o formato persistido na tabela casos; rejeitar o caso
  inteiro por um campo invalido (o .catch absorve).

## Criterios de sucesso

- Resposta valida do modelo gera o mesmo EstadoCaso de antes.
- JSON com campo fora do enum cai no default (etapa triagem etc.) em
  vez de falhar.
- Texto sem JSON devolve null e o endpoint segue o fluxo atual.
