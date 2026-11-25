# Spec: README vendavel — V1

Status: aprovado

## Objetivo

README.md na raiz vendavel para avaliadores: proposta em uma frase,
screenshot do chat, diagrama da arquitetura, lista de capacidades
agente-ready (RAG, cache, failover, function calling, MCP, A2A, handoff,
evals+juiz, observabilidade), como rodar local e links.

## Decisoes

- Screenshot: gerar via frontend rodando local OU placeholder com
  instrucao — preferir screenshot real se der para capturar
  programaticamente; senao, usar o print do preview e salvar em
  docs/assets/ ou raiz.
- Diagrama: ASCII/mermaid simples (stack: React -> Vercel Functions ->
  Gemini/Groq -> Supabase pgvector).
- Seccoes: O que e | Demo (screenshot + URL producao) | Arquitetura |
  Capacidades | Como rodar | Testes/Evals | Protocolos abertos (MCP/A2A)
  | Stack.
- Tom: direto, bullets, numeros concretos (15 modelos, 20 politicas,
  4 tools MCP, p95 etc.).

## Fora de escopo (V2)

- README bilingue
- Video/gif da demo
