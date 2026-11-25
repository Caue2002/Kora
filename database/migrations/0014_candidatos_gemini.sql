-- Migracao 0014: dois slots candidatos do Gemini entram no catalogo
-- (gemini-3.7-flash e gemini-4-argon, prioridades 10 e 11), e o
-- pollinations desce para prioridade 12 — ultimo da fila.
-- O id do pollinations continua 10 (referenciado por FK em cotas_modelos
-- e metricas); apenas sua prioridade muda. Os novos slots usam ids 11
-- e 12, por isso o check de modelos_ia.id e ampliado para 1-12.
-- Aplicar no SQL Editor do Supabase; sem ela as RPCs de cota falham
-- por FK para os slots novos e o sistema cai no controle em memoria.

alter table modelos_ia drop constraint if exists modelos_ia_id_check;
alter table modelos_ia add constraint modelos_ia_id_check check (id between 1 and 12);

update modelos_ia set prioridade = 12 where id = 10;

insert into modelos_ia (id, provedor, nome_modelo, prioridade) values
    (11, 'gemini', 'gemini-3.7-flash', 10),
    (12, 'gemini', 'gemini-4-argon',   11)
on conflict (id) do update set
    provedor = excluded.provedor,
    nome_modelo = excluded.nome_modelo,
    prioridade = excluded.prioridade;
