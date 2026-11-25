# Spec Delta: Pagina "Fluxo Kora" (apresentacao visual do projeto) — V2

Status: implementado (uso local, fora do git). V2 (2025-11): reescrita com
tema claro, sidebar de navegacao, diagramas em componentes HTML (sem SVG,
sem scroll horizontal) e interacoes (trilha clicavel + chat demo animado,
replay do pipeline, scroll-spy, reveal).

## Objective

Criar uma pagina HTML unica, moderna e visual, que explique em ate 5 minutos o
Projeto Kora (agente Nori) para entrevistadores: a dor que resolve, o
funcionamento ponta a ponta (com fluxogramas), a arquitetura, a resiliencia, a
qualidade e a stack. Arquivo em `docs/fluxo-kora/` dentro do repositorio, **ignorado
pelo git** (`.gitignore`: `fluxo-kora/`), sem dependencias externas (HTML + CSS +
JS inline), em portugues, aberto direto no navegador (`file://`).

Origem do pedido: o usuario quer um material visual para entrevistas, facil de
explicar, e quer que a pagina seja mantida em sincronia com o projeto.

## Current Behavior

Nao existia material visual; a explicacao dependia do README, do guia em PDF
(uso pessoal, nao commitado) e da fala do candidato.

## New Behavior

`docs/fluxo-kora/index.html` com as secoes (todas com fluxograma/diagrama quando
faz sentido):

1. Hero — o que e o Kora/Nori em uma frase, 4 numeros-chave, link para o app.
2. A dor — problema do atendimento de disputas em marketplaces de delivery
   (custo, demora, inconsistencia, frustracao) x o que a Nori resolve.
3. Como funciona (fluxograma principal, animado) — jornada de uma disputa em 6
   passos com destaque sincronizado no diagrama; exemplos de mensagens.
4. Arquitetura — diagrama em camadas (cliente, API, servicos, RAG, LLMs, dados,
   protocolos externos) e tabela "camada -> pasta -> responsabilidade".
5. Fluxo de uma mensagem (fluxograma detalhado) — validacao, rate limit, intencao
   (casual / meta / disputa), cache semantico, RAG hibrido, selecao de modelo,
   function calling, streaming, guardrails, caso em segundo plano, metricas.
6. Estado do caso — ciclo triagem > coleta > analise > parecer > encerrado,
   com handoff humano.
7. Resiliencia — cadeia de failover de 15 modelos gratuitos com cotas por janela,
   cache, timeouts, retry, guardrails de saida.
8. Qualidade — golden dataset, evals, LLM-as-judge, guardrails, CI, feedback
   loop, observabilidade (painel /metricas.html).
9. Capacidades por pilar + stack.
10. Como manter atualizado (protocolo).

## Success Criteria

- Abre offline em `file://` sem erros de console; responsivo (desktop e mobile).
- Toda afirmacao tecnica bate com `docs/CONTEXTO_ATUAL.md`, `README.md`,
  `docs/ARQUITETURA.md`, `api/README.md` e o codigo em `api/`, `shared/`,
  `coherence/`, `rag/` (modelos, endpoints, tabelas, limites).
- Fluxogramas legiveis, com legenda, e animacao de fluxo.
- Nenhum arquivo de `docs/fluxo-kora/` aparece em `git status`.
- Validacao: abrir no navegador (sem erros), `npm run typecheck` e `npm test`
  nao afetados (nenhum .ts alterado exceto docs).

## Boundaries

- Always: textos em portugues sem acentos apenas onde o projeto ja usa; manter
  os comentarios do HTML explicando a estrutura para manutencao futura.
- Ask first: adicionar dependencias externas (CDN); publicar a pagina.
- Never: commitar `docs/fluxo-kora/`; expor chaves ou dados reais de usuarios; copiar
  o conteudo do `Guia Kora iFood.pdf` (uso pessoal).

## Out of Scope (Deferred)

- Versao com build (React/Vite) ou deploy da pagina.
- Screenshots reais do app (podem ser adicionados depois como imagem local).
- Versoes em ingles.

## Open Questions

- Nenhuma. Skill `.devin/skills/fluxo-kora/SKILL.md` criada para formalizar
  a atualizacao obrigatoria da pagina ao final de cada tarefa.
