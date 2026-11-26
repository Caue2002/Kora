// Verificacao de token Cloudflare Turnstile para o /api/chat.
//
// ATIVO EM PRODUCAO desde 26/11/2026 (fim do modo observacao): o widget
// voltou a emitir tokens depois das correcoes de SW (o service worker
// nao intercepta mais origens cross-origin) e de CSP (script/connect/
// frame-src liberam challenges.cloudflare.com). O widget roda com
// appearance 'interaction-only' — invisivel quando a Cloudflare nao
// exige interacao, token de uso unico gerado a cada envio.
//
// DORMENTE por padrao: sem TURNSTILE_SECRET_KEY no ambiente, tudo passa.
// Com a chave configurada, todo POST /api/chat precisa de um token
// valido emitido pelo widget no frontend (siteverify e a chamada
// oficial da Cloudflare; tokens sao de uso unico e expiram em ~5min).
//
// Se o siteverify estiver inacessivel, falha ABERTA com warn — o chat
// ja tem rate limit por IP e nao pode cair por indisponibilidade da
// Cloudflare; a janela de abuso sem verificacao e aceita e registrada.

import { turnstileSecretKey } from './env.js';

// Devolve true quando o turno esta liberado: sem secret configurado
// (protecao desligada) ou com token validado pela Cloudflare.
// Sem token ou com token invalido, devolve false (403 no /api/chat).
export async function turnoLiberado(token: string | undefined, ip: string): Promise<boolean> {
  const secret = turnstileSecretKey();
  if (!secret) return true;
  if (!token) {
    console.warn('[turnstile] requisicao sem token');
    return false;
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const dados = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (dados.success === true) return true;
    // error-codes (token-expired, invalid-input-secret, timeout-or-duplicate
    // etc.) ajudam a diagnosticar reprovacoes no log da funcao
    console.warn('[turnstile] siteverify reprovou:', dados['error-codes'] ?? 'sem detalhe');
    return false;
  } catch (erro) {
    console.warn('[turnstile] siteverify falhou, liberando sem verificacao:', erro);
    return true;
  }
}
