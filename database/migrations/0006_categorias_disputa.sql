-- Migracao 0006: atualiza descricoes das categorias para o dominio de
-- disputas de pedidos em app de delivery (pivot do projeto)

update categorias_divergencia set descricao = 'Item faltante ou quantidade divergente entre o pedido e o que chegou'
  where id = 1;
update categorias_divergencia set descricao = 'Item errado ou substituido sem aviso ao cliente'
  where id = 2;
update categorias_divergencia set descricao = 'Problema de qualidade do alimento ou status do pedido inconsistente'
  where id = 3;
update categorias_divergencia set descricao = 'Atraso na entrega, cancelamento indevido ou pedido nao recebido'
  where id = 4;
