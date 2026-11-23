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
});
