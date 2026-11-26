import { describe, expect, it } from 'vitest';
import handler from '../api/voz';

// Ditado neural (SPEC-voz-whisper): validacoes do /api/stt que nao
// dependem da Groq — caminho feliz e coberto por uso real.
// O handler mora em api/voz.ts (function unificada p/ o limite de 12
// do plano Hobby); o dispatcher resolve a rota pelo pathname.

describe('POST /api/stt — validacoes', () => {
  it('rejeita metodo GET', async () => {
    const res = await handler(new Request('http://localhost/api/stt'));
    expect(res.status).toBe(405);
  });

  it('rejeita content-type que nao e audio', async () => {
    const res = await handler(
      new Request('http://localhost/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.77.1.1' },
        body: '{}',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('rejeita body vazio com content-type de audio', async () => {
    const res = await handler(
      new Request('http://localhost/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/webm', 'x-forwarded-for': '10.77.1.2' },
      }),
    );
    expect(res.status).toBe(400);
    const dados = (await res.json()) as { erro?: string };
    expect(dados.erro).toContain('vazio');
  });
});
