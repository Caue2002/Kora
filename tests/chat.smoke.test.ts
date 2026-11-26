// Teste de integracao do endpoint /api/chat
// Executa o handler real contra Supabase e Gemini quando o .env esta configurado
// Rode com: npm test (pula automaticamente se faltar credenciais)

import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import handler from '../api/chat';

// Carrega o .env local no process.env para o teste
function carregarEnv() {
  try {
    const linhas = readFileSync(join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/);
    for (const l of linhas) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2];
    }
  } catch {
    // sem .env: teste sera pulado
  }
  // Turnstile fica desligado nos testes: sem token valido todo POST /api/chat
  // tomaria 403 — a protecao e coberta por verificacao manual em producao
  delete process.env.TURNSTILE_SECRET_KEY;
}

const temCredenciais = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.GEMINI_API_KEY);

describe('POST /api/chat (integracao real)', () => {
  beforeAll(carregarEnv);

  it('responde uma triagem basica usando RAG e Gemini', async () => {
    if (!temCredenciais()) return; // skip silencioso sem credenciais

    // Request nao pode ser reutilizado (body e consumido); recria a cada tentativa
    const novaReq = () =>
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '10.98.0.1',
        },
        body: JSON.stringify({
          mensagem: 'Pedi 2 burgers e chegou so 1. O que faco?',
          historico: [],
        }),
      });

    let res = await handler(novaReq());
    // Free tier do Gemini tem RPM baixo: aguarda a virada da janela em caso de 429
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 65_000));
      res = await handler(novaReq());
    }
    expect(res.status).toBe(200);
    const dados = (await res.json()) as { resposta?: string; erro?: string };
    expect(dados.resposta).toBeTruthy();
    expect(dados.resposta!.length).toBeGreaterThan(20);
  }, 150000);
});
