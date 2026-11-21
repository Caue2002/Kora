import { describe, expect, it } from 'vitest';
import { temFolga, type UsoModelo } from '../shared/models';

const usoZero: UsoModelo = { tokensMinuto: 0, tokensHora: 0, tokensDia: 0, esgotado: false };

describe('temFolga', () => {
  it('aprova modelo sem consumo', () => {
    expect(temFolga(usoZero, 100)).toBe(true);
  });

  it('reprova modelo marcado como esgotado', () => {
    expect(temFolga({ ...usoZero, esgotado: true }, 100)).toBe(false);
  });

  it('reprova quando a janela de minuto estoura', () => {
    const uso = { ...usoZero, tokensMinuto: 7999 };
    // 7999 + 100 + saida(600) > 8000
    expect(temFolga(uso, 100)).toBe(false);
  });
});
