# Projeto Kora — Agente Nori

Agente de IA para triagem, investigação e conciliação de **disputas de pedidos**
em um aplicativo de delivery fictício (clientes × restaurantes × entregadores).

O Nori coleta evidências (incluindo fotos), separa fatos de hipóteses, consulta as
políticas de disputa no PostgreSQL com **busca híbrida** (textual + vetorial/pgvector),
mantém um **estado estruturado do caso** persistido no banco e guia o usuário até
um plano de conciliação — sem nunca inventar políticas ou acusar sem evidência.

**Deploy de demonstração:** https://kora-frontend-jade.vercel.app

## Funcionalidades

- Chat mobile-first com streaming token a token, histórico persistente, busca e
  renomeação de conversas, dark mode, PWA e ditado por voz (Web Speech API)
- Três perfis de usuário (Cliente, Vendedor parceiro, Entregador) com contexto
  e sugestões de disputa próprias
- Simulação de pedidos: qualquer código informado gera um pedido fictício
  determinístico e variado para confirmação (mesmo código = mesmo pedido)
- Estado do caso estruturado (etapa, fatos, evidências, pendências, status) com
  exportação de resumo — tudo persistido no Supabase
- Extração de caso via LLM com saída sanitizada contra domínio fixo
- Failover de 4 camadas de modelos gratuitos: Gemini → Groq → Gemini reserva →
  Pollinations (sem chave)
- Camadas de segurança sem login: rate limit persistente no Postgres (compartilhado
  entre instâncias serverless), validação rigorosa de entrada, segredos só no
  servidor, headers de segurança (CSP, X-Frame-Options), anti prompt-injection

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| API | Vercel Functions (Node.js) em `api/` |
| Banco | Supabase / PostgreSQL + pgvector |
| LLM | Gemini (principal), Groq, Pollinations (fallback) |
| Testes | Vitest (unitários + integração real) |
| CI | GitHub Actions |

## Setup local

Pré-requisito: Node.js 20+.

```bash
npm install
npm --prefix frontend install
```

1. Crie o `.env` na raiz copiando `.env.example` e preencha as chaves
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`; Groq opcional
   para failover).
2. No Supabase, rode no SQL Editor:
   - `database/migrations/0000_instalacao_completa.sql` (schema inicial completo),
     **ou** os arquivos `0001` e `0003` se o schema base já existir
   - `database/migrations/_rodar_uma_vez_0005_0008.sql` (feedback, categorias,
     tabela `casos` e rate limit — execução única, idempotente)
3. Popule o conhecimento: `node scripts/ingerir_conhecimento.mjs`
   (gera embeddings via Gemini a partir de `database/seeds/politicas_disputa.json`).
4. Suba os servidores:

```bash
npm run dev:api   # API local na porta 3000
npm run dev:web   # frontend Vite na porta 5173 (proxy /api -> :3000)
```

## Comandos

| Comando | Ação |
|---|---|
| `npm run dev:api` | API local (porta 3000) |
| `npm run dev:web` | Frontend Vite (porta 5173) |
| `npm test` | Testes unitários + integração real (precisa de `.env`) |
| `npm run typecheck` | Typecheck TypeScript |
| `npm run build` | Build de produção do frontend |

## Deploy (Vercel)

1. Importe o repositório — **Root Directory deve ser a raiz** (as functions
   ficam em `api/` na raiz; `vercel.json` já configura install/build/output)
2. Cadastre as variáveis do `.env` em *Settings → Environment Variables*
   (somente as 3 obrigatórias + `GROQ_API_KEY` opcional)
3. Aplique as migrations no Supabase antes do primeiro uso

## Estrutura

```
api/           # endpoints serverless: chat, caso, feedback, parecer
shared/        # env, clientes LLM, Supabase, rate limit, pedidos fictícios, adaptador Node
coherence/     # prompt do sistema, diretrizes adaptativas, validação de coerência
rag/           # chunking, embeddings, busca híbrida
frontend/      # SPA React (src/)
database/      # migrations SQL e seeds de conhecimento
docs/          # arquitetura, decisões e contexto atual
scripts/       # dev-server local e ingestão de conhecimento
```

Documentação completa: `docs/ARQUITETURA.md`, `docs/DECISOES.md` e
`docs/CONTEXTO_ATUAL.md`.
