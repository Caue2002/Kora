import { describe, expect, it } from 'vitest';
import { estimarMensagens, estimarTokens } from '../shared/tokens';

describe('estimacao de tokens', () => {
  it('estima aproximadamente 4 caracteres por token', () => {
    expect(estimarTokens('')).toBe(0);
    expect(estimarTokens('abcd')).toBe(1);
    expect(estimarTokens('a'.repeat(400))).toBe(100);
  });

  it('soma mensagens com overhead por turno', () => {
    const msgs = [
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: 'ola' },
    ];
    const total = estimarMensagens(msgs);
    expect(total).toBeGreaterThan(0);
  });
});
