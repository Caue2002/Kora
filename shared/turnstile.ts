// Verificacao de token Cloudflare Turnstile para o /api/chat.
// DORMENTE por padrao: sem TURNSTILE_SECRET_KEY no ambiente, tudo passa.
// Com a chave configurada, todo POST /api/chat precisa de um token
// valido emitido pelo widget no frontend (siteverify e a chamada
// oficial da Cloudflare; tokens sao de uso unico e expiram em ~5min).

import { turnstileSecretKey } from './env.js';

// Devolve true quando o turno esta liberado: sem secret configurado
// (protecao desligada) ou com token validado pela Cloudflare.
// Se o siteverify estiver inacessivel, falha ABERTA com warn — o chat
// ja tem rate limit por IP e nao pode cair por indisponibilidade da
// Cloudflare; a janela de abuso sem verificacao e aceita e registrada.
export async function turnoLiberado(token: string | undefined, ip: string): Promise<boolean> {
  const secret = turnstileSecretKey();
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const dados = (await res.json()) as { success?: boolean };
    return dados.success === true;
  } catch (erro) {
    console.warn('[turnstile] siteverify falhou, liberando sem verificacao:', erro);
    return true;
  }
}
