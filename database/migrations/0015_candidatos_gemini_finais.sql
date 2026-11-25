-- Migracao 0015: mais tres slots candidatos do Gemini entram no catalogo
-- (gemini-flash-latest, gemini-3.1-pro-preview e gemini-pro-latest,
-- prioridades 12 a 14) e o pollinations desce para prioridade 15 —
-- ultimo da fila. O id do pollinations continua 10 (referenciado por FK);
-- apenas sua prioridade muda. Os novos slots usam ids 13, 14 e 15, por
-- isso o check de modelos_ia.id e ampliado para 1-15.
-- Candidatos fracos: flash-latest/pro-latest sao aliases moveis e os
-- "pro" provavelmente nao tem free tier — servem de failover tardio e
-- serao reavaliados apos o reteste de cota. Aplicar no SQL Editor do
-- Supabase; sem ela as RPCs de cota falham por FK para os slots novos.

alter table modelos_ia drop constraint if exists modelos_ia_id_check;
alter table modelos_ia add constraint modelos_ia_id_check check (id between 1 and 15);

update modelos_ia set prioridade = 15 where id = 10;

insert into modelos_ia (id, provedor, nome_modelo, prioridade) values
    (13, 'gemini', 'gemini-flash-latest',      12),
    (14, 'gemini', 'gemini-3.1-pro-preview',   13),
    (15, 'gemini', 'gemini-pro-latest',        14)
on conflict (id) do update set
    provedor = excluded.provedor,
    nome_modelo = excluded.nome_modelo,
    prioridade = excluded.prioridade;
