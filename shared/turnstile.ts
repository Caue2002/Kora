// Verificacao de token Cloudflare Turnstile para o /api/chat.
//
// MODO OBSERVACAO (26/11/2026): a checagem NAO bloqueia mais requisicoes.
// Motivo: o widget parou de emitir tokens em producao (challenge da
// Cloudflare nunca concluia — provavel dominio nao liberado ou par
// sitekey/secret divergente no painel, fora do alcance do codigo) e
// todo POST /api/chat tomava 403. Ate a configuracao ser revista no
// dashboard da Cloudflare, o siteverify roda apenas para LOGAR o
// resultado (success/error-codes) — quando o widget voltar a emitir
// tokens, os logs mostram se a validacao esta saudavel e o bloqueio
// pode ser reativado.
//
// Protecao ativa nesse periodo: rate limit por IP no Postgres
// (shared/ratelimit.ts) + demais guardrails do /api/chat.
// DORMENTE por padrao: sem TURNSTILE_SECRET_KEY no ambiente, nem a
// chamada de observacao acontece.

import { turnstileSecretKey } from './env.js';

// Sempre devolve true (nunca bloqueia). Quando ha secret + token,
// valida na Cloudflare so para registrar o veredito no log.
export async function turnoLiberado(token: string | undefined, ip: string): Promise<boolean> {
  const secret = turnstileSecretKey();
  if (!secret) return true;
  if (!token) {
    console.warn('[turnstile] observacao: requisicao sem token (widget nao emitiu)');
    return true;
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const dados = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (dados.success === true) {
      console.log('[turnstile] observacao: token valido');
    } else {
      // error-codes (token-expired, invalid-input-secret, timeout-or-duplicate
      // etc.) sao a pista de por que o siteverify reprovaria
      console.warn('[turnstile] observacao: siteverify reprovaria:', dados['error-codes'] ?? 'sem detalhe');
    }
    return true;
  } catch (erro) {
    console.warn('[turnstile] observacao: siteverify inacessivel:', erro);
    return true;
  }
}
