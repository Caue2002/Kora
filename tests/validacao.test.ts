import { describe, expect, it } from 'vitest';
import { validarHeuristico } from '../coherence/validacao';

describe('validacao heuristica de coerencia', () => {
  it('aprova resposta normal', () => {
    expect(validarHeuristico('Qual etapa da ocorrencia?').ok).toBe(true);
  });

  it('reprova resposta vazia', () => {
    expect(validarHeuristico('   ').ok).toBe(false);
  });

  it('sinaliza acusacao sem evidencia', () => {
    const r = validarHeuristico('O operador foi o culpado pela divergencia.');
    expect(r.ok).toBe(false);
    expect(r.problemas.length).toBeGreaterThan(0);
  });
});
