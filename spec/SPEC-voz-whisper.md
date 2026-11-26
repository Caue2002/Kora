# Spec: Ditado Neural (Groq Whisper) — V1

Status: implementado

Modulo `voz-whisper` do capability-map (`spec/capability-map.md`).

## Objetivo

O ditado hoje usa a Web Speech API do navegador: qualidade irregular por
dispositivo/navegador e sem controle. Trocar a transcricao por Whisper
(Groq, free tier — a chave GROQ_API_KEY ja existe para o modelo de chat)
fecha a historia de voz de ponta a ponta: ditado neural pt-BR + TTS
neural Edge na mesma arquitetura de endpoints.

## Decisoes

- **Novo endpoint `POST /api/stt`**: recebe o audio bruto (body binario,
  Content-Type audio/*) e repassa ao Groq
  `audio/transcriptions` (modelo whisper-large-v3, language=pt,
  response_format=json). Devolve `{ texto }`. Sem auth; rate limit
  20/min por IP; corpo limitado a ~4.5MB (limite da Vercel) — ~60s de
  audio webm/opus cabe folgado.
- **Frontend**: botao de microfone passa a gravar com MediaRecorder
  (getUserMedia) e envia o blob ao /api/stt ao parar. Toggle manual:
  aperta para gravar, aperta de novo para transcrever e inserir no
  campo. Auto-stop em 60s. Enquanto transcreve, o botao mostra o
  IndicadorCarregando (padrao obrigatorio do projeto).
- **Fallback**: se MediaRecorder/getUserMedia nao existir ou falhar,
  volta ao fluxo atual da Web Speech API — nenhum usuario perde o
  ditado.
- **Envio durante gravacao**: processarEnvio para a gravacao antes de
  enviar (mesmo comportamento atual com o SpeechRecognition).

## Fora de escopo (V2)

- Streaming de transcricao parcial (Whisper e batch; interim results
  continuam sendo territorio da Web Speech fallback)
- Selecao de idioma (fixo pt-BR)
- Push-to-talk vs toggle (toggle mantido, mesmo gesto de hoje)

## Boundaries

- Always: rate limit; tamanho maximo de audio; GROQ_API_KEY so no
  servidor; IndicadorCarregando em qualquer espera; typecheck+testes+
  build antes de commitar.
- Ask first: aplicar migrations no Supabase (esta spec nao tem).
- Never: enviar audio para servico sem rate limit; logar conteudo de
  audio; quebrar o ditado Web Speech para quem nao tem MediaRecorder.

## Criterios de sucesso

- Ditar uma frase em pt-BR no Chrome e ver o texto no campo, com a
  mesma precisao do Whisper.
- Navegador sem MediaRecorder (ou permissao negada) cai no fluxo Web
  Speech sem erro visivel.
- POST /api/stt sem audio ou com GROQ_API_KEY ausente: erro controlado,
  nunca 500 cru.
