# Projeto Kora - Agente Nori

Agente de IA para triagem, investigacao e conciliacao de **disputas de pedidos**
em um aplicativo de delivery ficticio (clientes x restaurantes x entregadores).
O Nori coleta evidencias, separa fatos de hipoteses, consulta as politicas de
disputa no PostgreSQL (busca hibrida lexical + vetorial) e gera um parecer de
conciliacao com responsavel provavel e compensacao.

Stack: React + Vite (frontend), Vercel Functions Node/TypeScript (api/),
Supabase/PostgreSQL + pgvector, Gemini (principal) com fila de contingencia
(Groq, Cerebras, OpenRouter), streaming token a token, rate limit, CI no
GitHub Actions.

## Setup local

Pre-requisito: Node.js 20+.

```bash
npm install
npm --prefix frontend install
```

1. Crie o `.env` na raiz copiando `.env.example` e preencha as chaves
   (Supabase URL + service role, Gemini API key; demais provedores opcionais).
2. No Supabase, rode as migracoes SQL de `database/migrations/` no SQL Editor
   (a `0000_instalacao_completa.sql` instala o schema inicial de uma vez).
3. Popule o conhecimento: `node scripts/ingerir_conhecimento.mjs`
   (gera embeddings via Gemini a partir de `database/seeds/politicas_disputa.json`).
4. Suba os servidores:

```bash
npm run dev:api   # API local na porta 3000
npm run dev:web   # frontend Vite na porta 5173 (proxy /api -> :3000)
```

## Comandos

| Comando | Acao |
|---|---|
| `npm run dev:api` | API local (porta 3000) |
| `npm run dev:web` | Frontend Vite (porta 5173) |
| `npm test` | Testes unitarios + integracao real (precisa de .env) |
| `npm run typecheck` | Typecheck TypeScript |
| `npm run build` | Build de producao do frontend |

## Deploy

Vercel: importe o repositorio, cadastre as variaveis do `.env` em
*Settings -> Environment Variables* e faca deploy. `vercel.json` ja esta
configurado.

Documentacao completa: ver `docs/ARQUITETURA.md`, `docs/DECISOES.md` e
`docs/CONTEXTO_ATUAL.md` (estado atual e proximos passos para continuidade).
