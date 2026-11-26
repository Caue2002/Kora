# Spec: Cloudflare Turnstile anti-abuso no /api/chat — V1

Status: implementado — BLOQUEIO ATIVO desde 26/11/2026

> **Suspensao do bloqueio (26/11/2026, revogada no mesmo dia):** o
> widget parou de emitir tokens em producao — o challenge da Cloudflare
> nunca concluia (nem em Chrome real, testado via Playwright) e todo
> POST /api/chat tomava 403. Causa raiz confirmada via console: o
> service worker (sw.js) interceptava a requisicao cross-origin do
> api.js do Turnstile e o fetch interno obedecia a CSP antiga do worker
> (connect-src 'self'). sw.js passou a ignorar origens externas
> (kora-v18) e o widget ganhou appearance 'interaction-only'. Com as
> correcoes deployadas, o widget voltou a emitir tokens — o bloqueio
> foi reativado em `turnoLiberado()` (sem token valido = 403; siteverify
> inacessivel segue falhando ABERTA com warn).

## Objetivo

Endurecer o endpoint publico `POST /api/chat` contra abuso (bots,
scraping, floods) com **Cloudflare Turnstile** — captcha invisivel/
gerenciado gratuito, sem login. Complementa o rate limit por IP ja
existente (20 req/min).

## Escopo

- **Backend** (`shared/turnstile.ts`, `api/chat.ts`, `shared/env.ts`):
  - `TURNSTILE_SECRET_KEY` liga a exigencia; sem ela `turnoLiberado()`
    e no-op (protecao desligada por padrao — zero friccao em dev/local)
  - Com a chave, todo POST /api/chat precisa de `turnstileToken` valido;
    falha retorna 403 antes de qualquer processamento
  - Verificacao via `siteverify` oficial; se a Cloudflare estiver
    inacessivel, falha ABERTA com warn (chat nao pode cair por
    indisponibilidade externa; rate limit segue valendo)
- **Frontend** (`App.tsx`, `api.ts`, `styles.css`):
  - Widget so renderiza quando `VITE_TURNSTILE_SITE_KEY` esta definida
    no build — sem ela nada aparece no DOM
  - Token e de uso unico: cada tentativa de envio consome o token e o
    widget e resetado para emitir um novo (retry automatico tambem
    recebe token fresco)
  - Script carregado sob demanda (`render=explicit`), tema `auto`,
    `appearance: 'interaction-only'` (widget oculto; so aparece se a
    Cloudflare exigir interacao — token segue sendo gerado)

## Fora de escopo

- Turnstile nos demais endpoints (/api/mcp, /api/a2a, /api/handoff tem
  auth propria; /api/tts, /api/caso etc. ficam para iteracao futura)
- CORS: a API nao emite `Access-Control-Allow-Origin`, entao leitura
  cross-origin ja e bloqueada pelo browser; a lista de dominios
  permitidos so faria sentido se o site fosse embutido — reavaliar se
  isso mudar

## Ativacao

1. Painel Cloudflare > Turnstile: criar site (dominios de producao +
   localhost), copiar par de chaves
2. Vercel: `TURNSTILE_SECRET_KEY` (server) + rebuild do frontend com
   `VITE_TURNSTILE_SITE_KEY` (build-time)
3. `.env.example` documenta ambas as variaveis
