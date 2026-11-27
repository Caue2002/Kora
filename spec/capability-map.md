# Capability Map: Pacote "Impressionar na Entrevista"

Iniciativa aprovada pelo usuario em 26/11/2026: acrescentar capacidades que
transformam o que o projeto ja mede/faz em evidencias demonstraveis em
entrevista tecnica. Cada modulo tem spec propria em `spec/SPEC-<id>.md`,
implementada em sequencia (um modulo por vez, com aprovacao do usuario
entre fases do workflow SDD).

| Modulo id | Responsabilidade | Depende de |
|---|---|---|
| metricas-qualidade | Relatorio consolidado de qualidade: metricas de producao + scores de evals persistidos + resumo para entrevista (script + secao no painel) | — |
| eval-retrieval | Golden dataset passa a medir se a buscaHibrida/RAG trouxe o chunk esperado (precision@k por cenario) | — |
| roteamento-modelos | Selecionar modelo por intencao (casual/meta -> lite; triagem de disputa -> forte), nao so por cota | — |
| eval-baseline-ci | CI compara score de evals com baseline persistido e sinaliza regressao | metricas-qualidade (tabela eval_runs), eval-retrieval |
| memoria-usuario | Nori lembra contexto/preferencias ENTRE conversas via identificador anonimo persistente no dispositivo (sem login — decisao do usuario) | — |
| voz-whisper | Ditado por voz via Groq Whisper (pt-BR) como alternativa/complemento ao Web Speech API | — |
| caso-estruturado | Extracao do estado do caso (/api/caso) via saida estruturada (JSON schema + validacao zod) em vez de parsing de texto | — |
| auth-usuarios | Supabase Auth (e-mail/senha) + dados por usuario + RLS. FASE 2 — opcional/deferido; spec SPEC-auth-usuarios.md escrita em 27/11/2026, aguardando aprovacao do usuario | memoria-usuario |

Build order: metricas-qualidade → eval-retrieval → roteamento-modelos →
eval-baseline-ci → memoria-usuario → voz-whisper → caso-estruturado →
(auth-usuarios: fase 2, fora desta rodada)

Status (26/11/2026): TODOS os modulos da fase 1 implementados e
commitados em main — metricas-qualidade (1099b16), eval-retrieval
(26df93c), roteamento-modelos (4a9552a), eval-baseline-ci (e5a44e1),
memoria-usuario (d60b540), voz-whisper (ab67caf), caso-estruturado
(e2a71af). Alem do mapa, um modulo extra nasceu de achado em eval:
guardrails-injecao (spec propria) — detecta injecao de prompt e injeta
diretiva de recusa; evals-juiz subiu para 4/4. Resta apenas
auth-usuarios, fase 2 deferida.

## Decisoes do usuario (26/11/2026)

- Auth completo (login obrigatorio) NAO entra agora; memoria funciona sem
  login. Identificador anonimo persistente (UUID em localStorage) e a
  chave — auth futuro apenas associa dados ao usuario logado.
- Um modulo por vez: capability-map aprovado → spec do modulo → aprovacao
  → implementacao → docs (CONTEXTO_ATUAL, fluxo-kora, Guia PDF) → commit.
- Guia Técnico de Entrevista — Projeto Kora & Agente Nori.pdf sera atualizado ao final de cada modulo (autorizado
  explicitamente nesta rodada): backup antes, edicao incremental via
  PyMuPDF, somente acrescimo de secoes novas.
