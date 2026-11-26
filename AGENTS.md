# AGENTS.md — Projeto Kora (Agente Nori)

Leia `docs/CONTEXTO_ATUAL.md` primeiro: ele registra estado atual, decisoes,
pendencias e o protocolo de handoff (inclui remote git e regras de commit).

## Regras inviolaveis (NUNCA quebrar)

- **Supabase MCP — escrita proibida sem aprovacao explicita.** O MCP do
  Supabase (`.devin/mcp_config.local.json`, servidor hospedado com escopo no
  projeto `uzkiayjqcjztzrwestcg`) pode ser usado livremente para **acoes de
  leitura** (`list_tables`, `execute_sql` somente-SELECT, `list_migrations`,
  `query_logs` etc.). **E estritamente proibido** usar o MCP para acoes de
  escrita (`apply_migration`, `execute_sql` com INSERT/UPDATE/DELETE/DDL,
  tools de auth/storage com efeito colateral) **sem aprovacao explicita do
  usuario na conversa**. Nunca por inferencia. Escritas aprovadas devem ser
  registradas em `docs/CONTEXTO_ATUAL.md`; mudancas estruturais preferem
  arquivo versionado em `database/migrations/`. Nunca contornar a regra por
  outra via (script com service role key etc.). Spec completa:
  `spec/SPEC-supabase-mcp-governanca.md`.
- **Nunca commitar segredos**: `.env`, `MCP_API_KEY`, service role keys,
  tokens. `.env.example` documenta nomes, nunca valores.
- **Nunca commitar `docs/fluxo-kora/`** (material local de entrevista,
  gitignored) nem o **`Guia Kora iFood.pdf`** (`C:\Users\caue\Downloads\`).
- **Nunca editar o `Guia Kora iFood.pdf` sem pedido explicito do usuario**;
  quando autorizado, somente acrescentar secoes novas ou corrigir
  formatacao — nunca alterar/resumir/reescrever texto existente. Fazer
  backup antes de editar; edicao incremental via PyMuPDF, nunca rebuild
  completo sem pedido.
- **Indicador de carregamento**: toda UI de espera DEVE usar o componente
  `IndicadorCarregando` (orbita de 3 esferas) de `frontend/src/App.tsx`.
  NUNCA criar spinners CSS, pontinhos pulsando ou "carregando..." sem ele.
  Ver skill `indicador-carregamento-metaball`.
- **Pagina Fluxo Kora** (`docs/fluxo-kora/index.html`): ao mudar algo
  visivel ao usuario/arquitetura/endpoints/modelos/limites/metricas,
  atualizar a pagina antes de commitar. Regras: portugues sem acentos,
  zero dependencias externas, diagramas sao arrays de dados no JS (nunca
  editar HTML gerado), sem scroll horizontal. Ver skill `fluxo-kora`.
- **Spec antes de codigo**: feature/capacidade nova ou mudanca
  significativa exige `spec/SPEC-<nome>.md` (workflow SDD com aprovacao do
  usuario entre fases). Nao implementar no mesmo turno em que a spec foi
  escrita. Specs de features implementadas ficam `Status: implementado`.
- **Documentacao e prioridade — atualizar SEMPRE, em toda tarefa**: o
  usuario depende da documentacao para entender o projeto, entao
  sincronizar docs e material de entrevista faz parte da tarefa, nao e
  opcional. Checklist obrigatorio antes de commitar:
  1. `docs/CONTEXTO_ATUAL.md` — estado, decisoes, pendencias;
  2. `docs/fluxo-kora/index.html` — pagina de entrevista (ver skill);
  3. painel de metricas (`frontend/public/metricas.html`/`.js`) — se o
     que ele exibe mudou (KPIs, modelos, colunas, RPC);
  4. `Guia Kora iFood.pdf` (`C:\Users\caue\Downloads\`) — **somente
     quando o usuario pedir** (regra acima): backup + acrescimo
     incremental via PyMuPDF;
  5. `docs/DECISOES.md` so para decisoes tecnicas duraveis; README de
     pasta quando o contrato do modulo mudar.
  Ver skill `atualizar-documentacao`.
- **Validar antes de commitar**: `npm run typecheck`, `npm test`,
  `npm --prefix frontend run build`.
- **Commits em portugues**, titulo claro; SEMPRE `git push origin main`
  ao final de uma tarefa (remote: github.com/Caue2002/Kora, branch main).
- **Comentarios no codigo em portugues**, explicando o que a funcao faz.

## Skills do projeto (`.devin/skills/`)

| Skill | Quando usar |
|---|---|
| `atualizar-documentacao` | Fim de toda tarefa que mude comportamento, arquitetura, comandos, dominio ou estado — atualiza `docs/CONTEXTO_ATUAL.md`, `DECISOES.md`, READMEs |
| `fluxo-kora` | Fim de tarefa que mude algo visivel ao usuario/entrevistador — sincroniza `docs/fluxo-kora/index.html` |
| `indicador-carregamento-metaball` | SEMPRE ao criar/alterar qualquer UI de espera/processamento — orbita padrao obrigatoria |
| `preparar-entrevista` | Fim de feature relevante — checklist completo: spec SDD, testes, docs, guia (so se pedido), commit+push |
| `spec-driven-development` | Inicio de projeto/feature/mudanca significativa sem spec — workflow Specify→Plan→Tasks→Implement com gates humanos |

Skills builtin tambem relevantes: `devin-cli` (docs do Devin CLI, config MCP),
`upload-secrets` (upload seguro de segredos), `declarative-repo-setup`.

## Specs (`spec/`)

Specs existentes (SDD): `SPEC-a2a-e-handoff`, `SPEC-evals-ci`,
`SPEC-feedback-loop`, `SPEC-fluxo-kora-pagina`, `SPEC-function-calling`,
`SPEC-guardrails-saida`, `SPEC-indicador-carregamento`, `SPEC-llm-judge-evals`,
`SPEC-mcp-server` (Kora COMO servidor MCP), `SPEC-observabilidade-dashboard`,
`SPEC-observabilidade-v2`, `SPEC-readme-vendavel`, `SPEC-ui-indicador-tools`,
`SPEC-voz-neural`, `SPEC-supabase-mcp-governanca`, `SPEC-metricas-qualidade`
e `SPEC-eval-retrieval`, `SPEC-roteamento-modelos` e `SPEC-eval-baseline-ci`
(implementadas).

`capability-map.md` — iniciativa "impressionar na entrevista" (26/11/2026):
7 modulos em fila de build (metricas-qualidade, eval-retrieval,
roteamento-modelos, eval-baseline-ci, memoria-usuario, voz-whisper,
caso-estruturado); auth-usuarios e fase 2. Um modulo por vez, com
aprovacao do usuario entre fases.

Ao mudar comportamento coberto por uma spec, atualizar a spec correspondente
(Status/Boundaries) no mesmo commit.

## Comandos uteis

- `npm run dev:api` — API local porta 3000
- `npm run dev:web` — frontend Vite porta 5173
- `npm test` — testes (unitarios + integracao real com Supabase/Gemini)
- `npm run typecheck` — typecheck TS
- `node scripts/ingerir_conhecimento.mjs` — re-ingere seeds em
  database/seeds/*.json no Supabase (idempotente)
- `node scripts/testar_modelos_gemini.mjs` — testa quais modelos Gemini a
  GEMINI_API_KEY atual acessa e mede a latencia de cada um

## MCP

- **Supabase** (`supabase`): servidor hospedado
  `https://mcp.supabase.com/mcp?project_ref=uzkiayjqcjztzrwestcg` em
  `.devin/mcp_config.local.json` (gitignored). OAuth no primeiro uso ou
  `devin mcp login supabase`. **Leitura livre; escrita SOMENTE com
  aprovacao explicita do usuario** — ver regra inviolavel acima e
  `spec/SPEC-supabase-mcp-governanca.md`.

## Dominio

App de delivery ficticio; o Nori tria e concilia disputas de pedidos
(item faltante, item errado, qualidade, atraso/nao recebido).
