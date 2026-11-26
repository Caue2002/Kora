# Spec: Voz neural da Nori (TTS) — V1

Status: aprovado

## Objetivo

Substituir o TTS robotico (speechSynthesis do navegador) por vozes neurais
gratuitas da Microsoft Edge (pt-BR-FranciscaNeural / pt-BR-AntonioNeural)
via pacote msedge-tts, exposto num endpoint /api/tts que devolve MP3.

## Decisoes

- Backend: `api/voz.ts` (function unificada — o plano Hobby limita a 12
  Serverless Functions; rewrites do vercel.json mapeiam /api/tts e
  /api/stt para ela com ?rota=) POST { texto } -> audio/mpeg stream.
  Rate limit por
  IP (30/min), tamanho max do texto (~1200 chars; frontend fatia respostas
  longas em paragrafos e toca em sequencia ou so o primeiro paragrafo —
  decidir: V1 toca a resposta INTEIRA em paragrafos sequenciais).
- msedge-tts roda em Node — compativel com Vercel functions (Node runtime).
  Testar timeout: geracao de ~30s de audio e rapida (<2s handshake).
- Frontend: botao "ouvir" (icone auto-falante) em cada resposta da Nori;
  toca /api/tts, com fallback para speechSynthesis se o endpoint falhar.
  Botao vira "parar" durante reproducao.
- STT (ditado) continua Web Speech API — ja funciona.
- Custo zero, sem chave nova.

## Fora de escopo (V2)

- Voz escolhida pelo usuario
- Cache de audio no Supabase/CDN
- Voz em tempo real durante o stream (V1: ouve depois de pronta)
