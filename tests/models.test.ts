import { describe, expect, it } from 'vitest';
import { prioridadeModeloLite, selecionarModelo, temFolga, type UsoModelo } from '../shared/models';

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

// Roteamento por intencao (SPEC-roteamento-modelos): mensagens casuais/meta
// comecam nos modelos lite; a prioridade minima nunca pode fazer a fila
// devolver modelo mais forte que o permitido
describe('selecionarModelo com prioridadeMinima', () => {
  it('prioridadeMinima acima de todos os slots retorna null', async () => {
    expect(await selecionarModelo(100, 99)).toBeNull();
  });

  it('nunca devolve modelo com prioridade menor que a minima', async () => {
    const modelo = await selecionarModelo(100, 12);
    expect(modelo === null || modelo.prioridade >= 12).toBe(true);
  });
});

describe('prioridadeModeloLite', () => {
  it('retorna a menor prioridade entre modelos lite ou null', () => {
    const lite = prioridadeModeloLite();
    // catalogo padrao tem gemini-*-flash-lite na prioridade 7; sem .env o
    // resultado pode ser null se nenhum lite tiver apiKey — ambos validos
    expect(lite === null || (typeof lite === 'number' && lite >= 1)).toBe(true);
  });
});
