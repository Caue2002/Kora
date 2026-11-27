# Spec: Feedback loop documentado — V1

Status: implementado

## Objetivo

Fechar o ciclo "feedback -> aprendizado" com um relatorio consolidado:
endpoint/script que agrega feedback_respostas (avaliacao, comentario,
modelo, data) e mostra o que os usuarios acharam confuso/prolixo — base
para ajustar diretrizes de estilo.

## Decisoes

- `GET /api/feedback` (mesma auth MCP_API_KEY? nao — dados agregados
  sensiveis; usar MCP_API_KEY como nos demais endpoints de dados) OU
  script `scripts/relatorio_feedback.mjs` rodavel local. DECISAO: script
  local — zero superficie nova em producao, roda com service role do .env.
- Saida: contagens por avaliacao, distribuicao por dia, top comentarios
  confusos/prolixos, modelo mais avaliado.
- Documentar em docs/CONTEXTO_ATUAL + api/README que o loop e:
  usuario avalia -> feedback_respostas -> relatorio -> ajuste de
  diretrizes/prompt -> novo comportamento. (Nao ha fine-tuning de pesos —
  o "aprendizado" e em camadas, como ja documentado.)

## Fora de escopo (V2)

- Dashboard web do feedback
- Ajuste automatico de diretrizes baseado no relatorio
