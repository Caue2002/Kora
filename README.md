# Projeto Kora — Agente Nori

> **Experimente:** https://kora-frontend-jade.vercel.app

Agente de IA conversacional para triagem, investigação e conciliação de
**disputas de pedidos** em um aplicativo de delivery fictício
(clientes × restaurantes × entregadores).

O Nori conversa com três tipos de usuário — cliente, vendedor parceiro e
entregador — coleta evidências (inclusive fotos), separa fatos confirmados de
hipóteses, consulta políticas de disputa em uma base de conhecimento com
**busca híbrida** (textual + vetorial) e conduz o caso até um plano de
conciliação. Ele nunca inventa políticas, nunca acusa sem evidência e sempre
deixa claro o que é fato e o que ainda precisa ser confirmado.

## Como funciona

1. O usuário escolhe um perfil e descreve o problema (ou informa o código do
   pedido — a Nori "encontra" um pedido fictício determinístico e pede
   confirmação)
2. A cada mensagem, o backend faz **busca híbrida** no PostgreSQL/pgvector:
   correspondência textual exata + similaridade semântica por embeddings
3. O prompt do sistema combina persona, perfil do usuário, data/hora atual,
   diretrizes de estilo adaptativas (aprendidas com feedback) e os trechos
   recuperados — tudo com regras rígidas contra alucinação e prompt injection
4. A resposta é gerada por uma **cadeia de failover** de modelos gratuitos:
   Gemini → Groq → Gemini reserva → Pollinations, com controle de cota por
   janela de tokens persistido no banco
5. Em paralelo, um extrator de caso mantém um **estado estruturado**
   (etapa, fatos, evidências, pendências, status) persistido no Supabase —
   base para o resumo exportável da conversa

## Funcionalidades

- Chat mobile-first com streaming token a token, histórico persistente com
  busca/renomeação, dark mode, PWA instalável e ditado por voz
- Três perfis com contexto e sugestões de disputa próprios
- Estado do caso estruturado e exportável
- Avaliação de respostas (feedback) que alimenta diretrizes de estilo
- Failover automático entre provedores de IA
- Camadas de segurança sem login: rate limit persistente compartilhado entre
  instâncias serverless, validação rigorosa de entrada, segredos apenas no
  servidor, headers de segurança (CSP, X-Frame-Options) e mitigação de
  prompt injection

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript, Vite, Web Speech API, WebAudio, PWA |
| Backend | Vercel Functions (Node.js/TypeScript) |
| Banco de dados | Supabase / PostgreSQL + pgvector |
| IA | Google Gemini (principal), Groq, Pollinations (fallback), embeddings Gemini |
| Testes | Vitest — unitários + integração real com LLM e banco |
| CI/CD | GitHub Actions, deploy automático na Vercel |

## Objetivo

Projeto de portfólio para demonstrar domínio prático de engenharia de
sistemas de IA generativa: RAG, streaming, structured outputs, failover de
provedores, observabilidade de custo (orçamento de tokens), segurança e
operação serverless — além de uma UX de chat polida e mobile-first.

## Documentação

- `docs/ARQUITETURA.md` — decisões de arquitetura e fluxo de dados
- `docs/DECISOES.md` — registro de decisões técnicas (D01–D09)
- `docs/CONTEXTO_ATUAL.md` — estado atual do projeto e pendências
