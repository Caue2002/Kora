-- Migracao 0013: um id de cota por slot do catalogo (ids 1 a 10)
-- Antes os slots Gemini compartilhavam apenas os ids 1 e 3 em cotas_modelos:
-- um 429 em um modelo marcava esgotado para TODOS os irmaos na janela de
-- minuto e os contadores de tokens eram agregados entre modelos diferentes,
-- mesmo com cotas free-tier independentes por modelo no provedor.
-- O check de id e ampliado e modelos_ia passa a ter uma linha por slot
-- (id = prioridade do catalogo em shared/env.ts). Aplicar no SQL Editor
-- do Supabase; sem ela as RPCs de cota falham por FK e o sistema cai no
-- controle em memoria (funciona, mas sem persistencia entre instancias).

alter table modelos_ia drop constraint if exists modelos_ia_id_check;
alter table modelos_ia add constraint modelos_ia_id_check check (id between 1 and 10);

insert into modelos_ia (id, provedor, nome_modelo, prioridade) values
    (1,  'gemini',      'gemini-4-hydrogen',             1),
    (2,  'gemini',      'gemini-3.8-flash',              2),
    (3,  'gemini',      'gemini-3.6-flash',              3),
    (4,  'gemini',      'gemini-3.5-flash',              4),
    (5,  'gemini',      'gemini-3-flash-preview',        5),
    (6,  'groq',        'openai/gpt-oss-120b',           6),
    (7,  'gemini',      'gemini-3.5-flash-lite',         7),
    (8,  'gemini',      'gemini-3.1-flash-lite',         8),
    (9,  'gemini',      'gemini-3.1-flash-lite-preview', 9),
    (10, 'pollinations','openai',                        10)
on conflict (id) do update set
    provedor = excluded.provedor,
    nome_modelo = excluded.nome_modelo,
    prioridade = excluded.prioridade;
