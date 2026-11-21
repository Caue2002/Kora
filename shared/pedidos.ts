// Geracao deterministica de pedidos ficticios para a simulacao do Kora
// Cada codigo de pedido gera sempre o MESMO pedido (hash do codigo),
// garantindo consistencia na conversa sem custo de LLM extra

interface PedidoModelo {
  loja: string;
  itens: string[];
  valor: string;
}

// Catalogo variado de pedidos ficticios: delivery, farmacia, mercado, etc.
const CATALOGO: PedidoModelo[] = [
  { loja: 'Burger Bros', itens: ['2 X-Gutters', '1 batata frita grande'], valor: 'R$ 58,90' },
  { loja: 'Pizzaria Forno de Minas', itens: ['1 pizza grande de calabresa', '1 refrigerante 2L'], valor: 'R$ 74,50' },
  { loja: 'Açaí da Praça', itens: ['2 açaí 500ml (1 morango, 1 chocolate)', '1 topping granola'], valor: 'R$ 39,80' },
  { loja: 'Sushi Yama', itens: ['1 combo 20 peças (salmão e atum)', '1 missoshiro'], valor: 'R$ 96,00' },
  { loja: 'Farmácia Saúde+', itens: ['1 paracetamol 750mg (20cp)', '1 Vitamina C 1g (10cp)'], valor: 'R$ 42,30' },
  { loja: 'Mercado Bom Preço', itens: ['1 arroz 5kg', '2 feijões 1kg', '1 café 500g'], valor: 'R$ 68,75' },
  { loja: 'Doceria Mel', itens: ['1 fatia de torta de limão', '2 brigadeiros gourmet'], valor: 'R$ 28,40' },
  { loja: 'Taco Loco', itens: ['3 tacos de frango', '1 guacamole', '2 aguas de coco'], valor: 'R$ 52,10' },
  { loja: 'Massas da Vó', itens: ['1 lasanha de berinjela (porção familiar)', '1 refrigerante lata'], valor: 'R$ 61,20' },
  { loja: 'Padaria Pão Quente', itens: ['6 pães de queijo', '1 bolo de cenoura fatia'], valor: 'R$ 33,60' },
  { loja: 'Frango Frito Prime', itens: ['1 balde de 8 peças de frango', '2 porções de batata rústica'], valor: 'R$ 79,90' },
  { loja: 'Café Aroma', itens: ['2 cafés expressos', '1 croissant de queijo'], valor: 'R$ 24,80' },
  { loja: 'Veggie Garden', itens: ['1 bowl de quinoa e grão-de-bico', '1 suco verde 500ml'], valor: 'R$ 47,50' },
  { loja: 'Lanchonete Sabor', itens: ['1 parmegiana de frango', '1 refrigerante lata', '1 fritas porção'], valor: 'R$ 45,90' },
];

// Hash simples e estavel do codigo para escolher o pedido do catalogo
function hashCodigo(codigo: string): number {
  let h = 0;
  for (let i = 0; i < codigo.length; i++) {
    h = (h * 31 + codigo.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Reconhece um codigo de pedido na mensagem do usuario
// Aceita numeros, letras ou misto; exige digito, CAIXA ALTA ou contexto de pedido
const CONTEXTO_PEDIDO = /pedido|c[oó]digo|pedido n|n[ºo°]?\s*\d|#\s*[a-z0-9]/i;
const TOKEN_CODIGO = /\b[A-Za-z0-9][A-Za-z0-9-]{3,19}\b/g;

export function extrairCodigoPedido(mensagem: string): string | undefined {
  const temContexto = CONTEXTO_PEDIDO.test(mensagem);
  const tokens = mensagem.match(TOKEN_CODIGO) ?? [];
  for (const token of tokens) {
    const temDigito = /\d/.test(token);
    const ehCaixaAlta = /^[A-Z0-9-]{4,}$/.test(token) && /[A-Z]/.test(token);
    const ehLongo = token.length >= 6 && temDigito;
    if (temDigito || ehCaixaAlta || (temContexto && ehLongo)) {
      // ignora palavras comuns do dominio
      if (/^(pedido|entrega|cliente|parceiro|entregador|ajuda|obrigad[oa])$/i.test(token)) continue;
      return token.toUpperCase();
    }
  }
  return undefined;
}

// Monta a descricao textual do pedido ficticio para injetar no prompt
// Ex.: "Pedido 156489 - Burger Bros: 2 X-Gutters, 1 batata frita grande - R$ 58,90"
export function pedidoFicticio(codigo: string): string {
  const modelo = CATALOGO[hashCodigo(codigo) % CATALOGO.length]!;
  return `Pedido ${codigo} - ${modelo.loja}: ${modelo.itens.join(', ')} - ${modelo.valor}`;
}

// Retorna os detalhes estruturados do pedido ficticio (para a confirmacao direta)
export function detalhesPedido(codigo: string): { loja: string; itens: string; valor: string } {
  const modelo = CATALOGO[hashCodigo(codigo) % CATALOGO.length]!;
  return { loja: modelo.loja, itens: modelo.itens.join(', '), valor: modelo.valor };
}
