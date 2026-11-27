import { describe, expect, it } from 'vitest';
import {
  inicioDiaEmFuso,
  prioridadeModeloLite,
  selecionarModelo,
  temFolga,
  type UsoModelo,
} from '../shared/models';

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

// SPEC-cota-reset-pacifico: a janela "dia" de cotas deve comecar no
// instante em que a cota diaria real do provedor renova — meia-noite de
// America/Los_Angeles para o Gemini (RPD) e meia-noite UTC para o Groq
describe('inicioDiaEmFuso', () => {
  it('UTC devolve a meia-noite UTC do dia civil corrente', () => {
    expect(inicioDiaEmFuso('UTC', new Date('2026-11-27T15:30:00Z'))).toBe('2026-11-27T00:00:00.000Z');
  });

  it('Pacific em horario de verao (PDT, UTC-7): meia-noite = 07:00 UTC', () => {
    // 15/07/2026 15:00 UTC = 08:00 PDT do mesmo dia
    expect(inicioDiaEmFuso('America/Los_Angeles', new Date('2026-07-15T15:00:00Z'))).toBe(
      '2026-07-15T07:00:00.000Z',
    );
  });

  it('Pacific em horario padrao (PST, UTC-8): meia-noite = 08:00 UTC', () => {
    // 27/11/2026 15:00 UTC = 07:00 PST do mesmo dia
    expect(inicioDiaEmFuso('America/Los_Angeles', new Date('2026-11-27T15:00:00Z'))).toBe(
      '2026-11-27T08:00:00.000Z',
    );
  });

  it('antes da meia-noite PT o dia ainda e o anterior', () => {
    // 28/11/2026 06:00 UTC = 27/11 22:00 PST — o dia civil PT ainda e 27/11
    expect(inicioDiaEmFuso('America/Los_Angeles', new Date('2026-11-28T06:00:00Z'))).toBe(
      '2026-11-27T08:00:00.000Z',
    );
  });
});
