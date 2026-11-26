# Kora — Agente Nori

> **Experimente:** https://koradelivery.vercel.app · **Observabilidade:** `/metricas.html`

Agente de IA conversacional que tria, investiga e concilia **disputas de
pedidos** em um app de delivery fictício (cliente × vendedor × entregador) —
como se o iFood tivesse um assistente que entende "chegou faltando item",
"veio trocado" ou "não recebi" e conduz o caso até uma decisão.

A Nori conversa por texto e voz, anexa evidências fotográficas, consulta
políticas em base vetorial, **decide quando chamar ferramentas**
(function calling), se apresenta como servidor **MCP** e agente **A2A** para
outros sistemas, e transfere casos complexos para humanos com resumo
estruturado.

## Arquitetura

```
React/Vite (chat mobile-first, PWA, voz)
        │  POST /api/chat (SSE streaming)
        ▼
Vercel Functions (Node/TS)
  ├─ cache semântico (pgvector, resposta idêntica = 0 LLM)
  ├─ RAG híbrido (texto + embedding) ──► Supabase/PostgreSQL + pgvector
  ├─ function calling (Gemini tools) ──► shared/tools.ts
  ├─ guardrails de saída (vazamento/PII)
  └─ failover de modelos ──► 10× Gemini + Groq + Pollinations
        │
        ▼
Supabase: conversas, casos, conciliações, métricas, cotas, feedback
```

## Capacidades

**Experiência do usuário**
- Chat com streaming token a token, indicador de etapa ("Consultando
  pedido..." durante function calling), dark mode, PWA, ditado por voz e
  **respostas faladas em voz neural** (botão ouvir — Edge TTS gratuito)
- Três perfis (cliente, vendedor, entregador) com contexto próprio;
  anexo de foto como evidência; saudação por horário só quando faz sentido
- Estado estruturado do caso (fatos, evidências, pendências) e exportação
  do resumo; encerramento assistido

**Inteligência**
- RAG híbrido sobre 20 políticas de disputa (pgvector + busca textual)
- Cache semântico de respostas (primeira mensagem) com chave por perfil +
  período do dia + código do pedido
- Function calling: o próprio LLM decide consultar pedido ou buscar
  política no meio do raciocínio — tools executadas localmente e devolvidas
  como `functionResponse`, com streaming preservado
- Failover em cascata de **12 modelos gratuitos** com cotas medidas no
  Postgres por janela de tokens; failover imediato em stream morto
- Coerência validada por heurística + regeneração corretiva; guardrails de
  saída contra vazamento de prompt e PII; anti-injection no prompt

**Interoperabilidade (protocolos abertos)**
- **MCP** — `POST /api/mcp` expõe 4 tools read-only (`consultar_pedido`,
  `buscar_politica`, `listar_conciliacoes`, `resumo_metricas`) para qualquer
  agente compatível, com auth por API key
- **A2A** — agent card em `/.well-known/agent-card.json` + endpoint
  `/api/a2a` (JSON-RPC `message/send`): outro agente descobre e conversa
  com a Nori
- **Handoff** — `POST /api/handoff` gera briefing estruturado do caso
  (fatos, evidências, pendências) para o atendente humano

**Qualidade e operação**
- Golden dataset de evals com rubricas objetivas + **LLM-as-judge**
  (nota 1–5 com justificativa) + cenários de guardrail (injeção, ação fora
  do poder, off-topic hostil); roda em CI (GitHub Actions)
- Observabilidade: `metricas_chat` grava modelo, latência, tokens, cache,
  trace por etapa e tool calls; painel `/metricas.html` com KPIs, p50/p95,
  cache hit rate e custo equivalente por modelo
- Rate limit persistente compartilhado entre instâncias serverless;
  segredos só no servidor; validação rigorosa de entrada

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript, Vite, Web Speech API, PWA |
| Backend | Vercel Functions (Node.js/TypeScript) |
| Banco | Supabase / PostgreSQL + pgvector |
| IA | Google Gemini (10 modelos), Groq, Pollinations, embeddings Gemini |
| Voz | msedge-tts (vozes neurais Edge, gratuito) |
| Protocolos | MCP (`mcp-handler`), A2A (JSON-RPC próprio) |
| Testes | Vitest — unitários + integração real com LLM/banco |
| CI/CD | GitHub Actions (testes + evals), deploy automático Vercel |

## Rodando localmente

```sh
npm install && npm --prefix frontend install
cp .env.example .env   # preencha as chaves
npm run dev:api        # API na porta 3000
npm run dev:web        # frontend na porta 5173
```

Validação: `npm run typecheck` · `npm test` · `npm --prefix frontend run build`

## Documentação

- `docs/ARQUITETURA.md` — decisões de arquitetura e fluxo de dados
- `docs/DECISOES.md` — registro de decisões técnicas (D01–D09)
- `docs/CONTEXTO_ATUAL.md` — estado atual, pendências e protocolo de handoff
- `spec/` — specs SDD das capacidades (MCP, A2A, function calling, evals…)
- `api/README.md` — referência dos endpoints
