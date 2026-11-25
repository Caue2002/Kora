# Spec: Guardrails de saida — V1

Status: aprovado

## Objetivo

Classificar a resposta do LLM ANTES de enviar ao usuario/stream: detectar
vazamento de prompt/instrucoes internas, PII, tom inadequado e recusa
generica disfarçada. Hoje a protecao e so no prompt de entrada.

## Decisoes

- Modulo `shared/guardrails.ts` com `classificarSaida(texto): { ok, motivo? }`
  — heuristico deterministico + regras (sem chamada extra de LLM no caminho
  feliz; LLM so como fallback opcional fica fora da V1 por custo/latencia).
- Regras V1: (a) vazamento de instrucoes internas — padroes como "minhas
  instrucoes dizem", "system prompt", "diretrizes internas"; (b) PII —
  emails, CPF/CNPJ, telefones completos fora de contexto de pedido
  (telefone de entregador pode aparecer no pedido, entao regra conservadora:
  so email/CPF); (c) resposta vazia/so pontuacao.
- No /api/chat: no caminho nao-stream, resposta reprovada dispara UMA
  regeneracao com instrucao corretiva (reusa fluxo de correcao de
  coerencia); se falhar de novo, envia fallback seguro.
- No streaming: guardrail roda no buffer acumulado APOS o stream — se
  reprovado, o frontend ja recebeu... entao V1 aplica guardrail apenas no
  caminho nao-stream e no primeiro-chunk heuristic ja existente; documentar
  limitacao. Alternativa: checar o texto completo antes de iniciar stream
  quando cache elegivel — fora da V1.
- Log de reprovacoes em console.warn (observabilidade futura via metricas).

## Fora de escopo (V2)

- Classificador via LLM dedicado
- Guardrail no meio do stream SSE (exigiria bufferizar = mata streaming)
- Lista de dominios/profanity pt-BR completa
