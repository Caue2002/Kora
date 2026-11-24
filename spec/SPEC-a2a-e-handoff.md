# Spec: A2A (Agent2Agent) + Handoff para Atendente — V1

Status: proposto

## Objetivo

1. **A2A**: expor o Nori como agente A2A (protocolo irmao do MCP, padrao
   emergente de agent-to-agent): agent card publico em
   `/.well-known/agent-card.json` + endpoint JSON-RPC `/api/a2a` com
   `message/send` que responde uma mensagem do usuario via pipeline
   simplificado do Nori.
2. **Handoff humano**: botao no frontend que gera um resumo estruturado do
   caso para um atendente humano (fatos confirmados, pendencias, historico
   resumido) — espelha o fluxo real de escalonamento do iFood.

## Decisoes

- Agent card estatico em `frontend/public/.well-known/agent-card.json`
  (Vite copia para o build; URL absoluta do deploy de producao).
- `/api/a2a`: JSON-RPC 2.0, metodo `message/send`, auth pela mesma
  `MCP_API_KEY` (Bearer/x-api-key); resposta como `Message` A2A com
  `parts: [{kind:'text'}]`. Pipeline enxuto: diretrizes + buscaHibrida +
  um chamarLLM com failover — sem historico, sem streaming, sem caso.
- Handoff: `POST /api/handoff { conversaId, mensagens }` gera resumo via
  LLM (jsonMode opcional) em formato fixo (resumo, fatos, pendencias,
  recomendacao); frontend exibe em modal/botao no menu "...". Sem mutacao
  de dados (read-only na geracao).
- Rate limit proprio por IP em ambos os endpoints.

## Fora de escopo (V2)

- Tasks A2A stateful (streaming SSE, push notifications)
- Handoff persistido em tabela propria / integracao com fila real
- Autenticacao OAuth no A2A
