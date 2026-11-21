-- Seed dos 4 modelos gratuitos na ordem de prioridade
-- Ajustar nome_modelo/provedor conforme os provedores efetivamente contratados
-- Os valores reais de modelo podem ser sobrescritos por env no codigo (ver shared/env.ts)

insert into modelos_ia (id, provedor, nome_modelo, prioridade) values
    (1, 'gemini',    'gemini-2.5-flash',                        1),
    (2, 'groq',      'llama-3.3-70b-versatile',                 2),
    (3, 'cerebras',  'llama-3.3-70b',                           3),
    (4, 'openrouter','meta-llama/llama-3.3-70b-instruct:free',  4)
on conflict (id) do nothing;
