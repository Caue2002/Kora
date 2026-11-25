# AGENTS.md — Projeto Kora (Agente Nori)

Leia `docs/CONTEXTO_ATUAL.md` primeiro: ele registra estado atual, decisoes,
pendencias e o protocolo de handoff (inclui remote git e regras de commit).

## Regras do projeto

- Commits em portugues, titulo claro; SEMPRE dar `git push origin main`
  ao final de uma tarefa (remote: github.com/Caue2002/Kora, branch main).
- Nunca commitar `.env` ou segredos.
- Validar antes de commitar: `npm run typecheck`, `npm test`,
  `npm --prefix frontend run build`.
- Comentarios no codigo em portugues, explicando o que a funcao faz.
- Docs em `docs/` devem ser atualizadas quando algo relevante mudar.

## Comandos uteis

- `npm run dev:api` — API local porta 3000
- `npm run dev:web` — frontend Vite porta 5173
- `npm test` — testes (unitarios + integracao real com Supabase/Gemini)
- `node scripts/ingerir_conhecimento.mjs` — re-ingere seeds em
  database/seeds/*.json no Supabase (idempotente)
- `node scripts/testar_modelos_gemini.mjs` — testa quais modelos Gemini a
  GEMINI_API_KEY atual acessa e mede a latencia de cada um

## MCP

- Supabase MCP configurado em `.devin/mcp_config.local.json` (gitignored),
  servidor hospedado `https://mcp.supabase.com/mcp` com OAuth e escopo no
  projeto `uzkiayjqcjztzrwestcg`, com acesso de leitura e escrita.
  Autenticar via `devin mcp login supabase` ou no primeiro uso (abre o
  navegador).

## Dominio

App de delivery ficticio; o Nori tria e concilia disputas de pedidos
(item faltante, item errado, qualidade, atraso/nao recebido).
