import { describe, expect, it } from 'vitest';
import { ehMensagemCasual } from '../coherence/intencao';

describe('deteccao de mensagem casual', () => {
  it('reconhece agradecimentos, saudos e reacoes leves', () => {
    expect(ehMensagemCasual('muito obrigado')).toBe(true);
    expect(ehMensagemCasual('obrigada!')).toBe(true);
    expect(ehMensagemCasual('oi, tudo bem?')).toBe(true);
    expect(ehMensagemCasual('bom dia')).toBe(true);
    expect(ehMensagemCasual('valeu, flw')).toBe(true);
    expect(ehMensagemCasual('ok')).toBe(true);
    expect(ehMensagemCasual('perfeito, obrigado')).toBe(true);
  });

  it('nao confunde mensagem com pedido ou duvida', () => {
    expect(ehMensagemCasual('obrigado, e o meu pedido?')).toBe(false);
    expect(ehMensagemCasual('oi, meu pedido nao chegou')).toBe(false);
    expect(ehMensagemCasual('sim, pode seguir com o reembolso')).toBe(false);
    expect(ehMensagemCasual('qual o prazo para reembolso?')).toBe(false);
    expect(ehMensagemCasual('')).toBe(false);
  });

  it('ignora acentos e pontuacao', () => {
    expect(ehMensagemCasual('OBRIGADO, TCHAU!')).toBe(true);
    expect(ehMensagemCasual('valeu demais')).toBe(true);
  });

  it('mensagens longas nao sao casuais', () => {
    const longa = Array(8).fill('obrigado').join(' ');
    expect(ehMensagemCasual(longa)).toBe(false);
  });
});
