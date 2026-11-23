// Testes unitarios da trava de pedido confirmado (shared/pedidos)
import { describe, expect, it } from 'vitest';
import { pedidoConfirmadoNaHistorico } from '../shared/pedidos';

describe('pedidoConfirmadoNaHistorico', () => {
  it('retorna undefined sem confirmacao', () => {
    expect(pedidoConfirmadoNaHistorico([])).toBeUndefined();
    expect(
      pedidoConfirmadoNaHistorico([
        { role: 'user', content: 'meu pedido 4521 chegou errado' },
        { role: 'assistant', content: 'Pedido 4521 - Burger Bros: 2 X-Gutters. Esta certo?' },
      ]),
    ).toBeUndefined();
  });

  it('trava o codigo apos confirmacao curta do usuario', () => {
    const h = pedidoConfirmadoNaHistorico([
      { role: 'user', content: 'pedido 4521' },
      { role: 'assistant', content: 'Pedido 4521 - Burger Bros: 2 X-Gutters, 1 batata - R$ 58,90. Confere?' },
      { role: 'user', content: 'sim, pode seguir' },
    ]);
    expect(h).toBe('4521');
  });

  it('mantem o pedido travado mesmo com nova pergunta depois', () => {
    const h = pedidoConfirmadoNaHistorico([
      { role: 'user', content: 'pedido 4521' },
      { role: 'assistant', content: 'Pedido 4521 - Burger Bros. Confere?' },
      { role: 'user', content: 'isso mesmo' },
      { role: 'assistant', content: 'Certo, e o que aconteceu com ele?' },
      { role: 'user', content: 'faltou a batata' },
    ]);
    expect(h).toBe('4521');
  });

  it('nao trava quando o usuario nega o pedido apresentado', () => {
    const h = pedidoConfirmadoNaHistorico([
      { role: 'user', content: 'pedido 4521' },
      { role: 'assistant', content: 'Pedido 4521 - Burger Bros. Confere?' },
      { role: 'user', content: 'nao, meu pedido e outro' },
      { role: 'user', content: 'pedido 9900' },
      { role: 'assistant', content: 'Pedido 9900 - Pizzaria Forno de Minas. Confere?' },
      { role: 'user', content: 'sim' },
    ]);
    expect(h).toBe('9900');
  });

  it('reconhece confirmacao citada em frase curta', () => {
    const h = pedidoConfirmadoNaHistorico([
      { role: 'user', content: 'meu codigo e AB1234' },
      { role: 'assistant', content: 'Pedido AB1234 - Mercado Bom Preco. E esse?' },
      { role: 'user', content: 'esse mesmo, pode continuar' },
    ]);
    expect(h).toBe('AB1234');
  });

  it('reconhece variacoes naturais de confirmacao', () => {
    for (const confirma of ['pode seguir', 'ta certo', 'blz', 'bora', 'isso ai', 'manda ver']) {
      const h = pedidoConfirmadoNaHistorico([
        { role: 'user', content: 'pedido 7777' },
        { role: 'assistant', content: 'Pedido 7777 - Açaí da Praça. Confere?' },
        { role: 'user', content: confirma },
      ]);
      expect(h, `confirmacao "${confirma}"`).toBe('7777');
    }
  });

  it('detecta codigo quando a Nori escreve "seu pedido é o X"', () => {
    const h = pedidoConfirmadoNaHistorico([
      { role: 'user', content: 'quero tratar uma disputa' },
      { role: 'assistant', content: 'Claro! Qual o numero do seu pedido?' },
      { role: 'user', content: 'eh o 8123' },
      { role: 'assistant', content: 'Perfeito, seu pedido é o 8123 - Sushi Yama: combo 20 peças. É esse?' },
      { role: 'user', content: 'isso, pode seguir' },
    ]);
    expect(h).toBe('8123');
  });

  it('pedido travado nao e substituido por codigo posterior + "sim"', () => {
    const h = pedidoConfirmadoNaHistorico([
      { role: 'user', content: 'pedido 1111' },
      { role: 'assistant', content: 'Pedido 1111 - Burger Bros. Confere?' },
      { role: 'user', content: 'sim' },
      { role: 'assistant', content: 'Em que posso ajudar com o pedido 1111?' },
      { role: 'user', content: 'na verdade o codigo e 2222' },
      { role: 'assistant', content: 'Esse pedido não consta em seu nome; o pedido em atendimento é o 1111.' },
      { role: 'user', content: 'sim, entendi' },
    ]);
    expect(h).toBe('1111');
  });
});
