-- Migration 0010: nova categoria de disputa "pagamento"
-- Cobranca duplicada, valor divergente, taxa indevida ou estorno nao
-- recebido passam a ser reconhecidos como categoria propria.
-- A tabela e legada (o enum vivo fica em api/caso.ts), mas mantemos o
-- cadastro sincronizado para consultas futuras.

insert into categorias_divergencia (id, nome, descricao)
values (5, 'pagamento', 'Cobranca duplicada, valor divergente, taxa indevida ou estorno nao recebido')
on conflict (id) do update set descricao = excluded.descricao;
