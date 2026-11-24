// Testa quais modelos Gemini a API key atual consegue usar e mede a latencia
// real de cada um. Uso: node scripts/testar_modelos_gemini.mjs
// Le GEMINI_API_KEY do .env (ou do ambiente). Nao imprime a chave.

import { readFileSync, existsSync } from 'node:fs';

// Carrega .env manualmente (sem dependencia de dotenv)
if (existsSync('.env')) {
  for (const linha of readFileSync('.env', 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY nao encontrada no .env nem no ambiente.');
  process.exit(1);
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Candidatos: mesma ordem do catalogo (shared/env.ts) + modelos probe
// que podem ganhar cota no futuro. Gerar resposta curta mede latencia real.
const CANDIDATOS = [
  'gemini-4-hydrogen',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  // probes: sem cota free hoje (429) ou instaveis — revalidar periodicamente
  'gemini-3.7-flash',
  'gemini-4-argon',
  'gemini-4-carbon',
  'gemini-4-neon',
  'gemini-flash-latest',
  'gemini-pro-latest',
  'gemini-3.1-pro-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

const PROMPT = 'Responda apenas: ok';

for (const modelo of CANDIDATOS) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${ENDPOINT}/${modelo}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
        generationConfig: { maxOutputTokens: 10, temperature: 0 },
      }),
    });
    const ms = Date.now() - t0;
    const corpo = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = corpo?.error?.message ?? `HTTP ${res.status}`;
      console.log(`${modelo.padEnd(28)} FALHOU (${res.status}) ${ms}ms — ${String(msg).slice(0, 90)}`);
      continue;
    }
    const texto = corpo?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const tokens = corpo?.usageMetadata?.totalTokenCount;
    console.log(`${modelo.padEnd(28)} OK ${String(ms).padStart(5)}ms — "${texto.trim().slice(0, 40)}" (${tokens ?? '?'} tok)`);
  } catch (erro) {
    console.log(`${modelo.padEnd(28)} ERRO ${Date.now() - t0}ms — ${erro.message}`);
  }
}
