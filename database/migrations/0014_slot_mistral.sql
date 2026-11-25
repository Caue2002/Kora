-- Migracao 0014: slot 11 do catalogo (Mistral La Plateforme)
-- O catalogo em shared/env.ts ganhou um novo provedor OpenAI-compat
-- (Mistral, tier Experiment gratuito). Cada slot precisa de id de cota
-- proprio para nao dividir cotas com os irmaos — dai o id 11.
-- O check de id e ampliado e modelos_ia ganha a linha correspondente.
-- Aplicar no SQL Editor do Supabase; sem ela as RPCs de cota falham por
-- FK para o id 11 e o slot cai no controle em memoria (funciona, mas sem
-- persistencia entre instancias).

alter table modelos_ia drop constraint if exists modelos_ia_id_check;
alter table modelos_ia add constraint modelos_ia_id_check check (id between 1 and 11);

insert into modelos_ia (id, provedor, nome_modelo, prioridade) values
    (11, 'mistral', 'mistral-small-latest', 7)
on conflict (id) do update set
    provedor = excluded.provedor,
    nome_modelo = excluded.nome_modelo,
    prioridade = excluded.prioridade;
