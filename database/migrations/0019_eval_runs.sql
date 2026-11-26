-- Migracao 0019: persistencia de scores de eval
-- (spec/SPEC-metricas-qualidade.md, modulo metricas-qualidade)
--
-- Ate aqui os evals (tests/evals.test.ts e tests/evals-juiz.test.ts)
-- rodavam e os resultados se perdiam no log do vitest/CI. A tabela
-- eval_runs guarda 1 linha por execucao de suite para alimentar o
-- painel /metricas.html (bloco "qualidade") e o script
-- scripts/relatorio_qualidade.mjs — a camada que transforma "rodei os
-- testes" em evidencia de qualidade consultavel.
--
-- Aplicar no SQL Editor do Supabase ou via MCP com aprovacao do usuario.

create table if not exists eval_runs (
  id           bigint generated always as identity primary key,
  criado_em    timestamptz not null default now(),
  suite        text not null check (suite in ('rubricas', 'juiz')),
  total        int  not null default 0,
  aprovados    int  not null default 0,
  reprovados   int  not null default 0,
  nota_media   numeric(3,2),           -- so a suite juiz tem nota 1-5
  detalhes     jsonb,                  -- resultado por cenario
  origem       text not null default 'local' check (origem in ('local', 'ci'))
);

create index if not exists eval_runs_criado_em_idx on eval_runs (criado_em desc);

-- Tabelas criadas via SQL Editor nao herdam grants — sem isto o
-- PostgREST (service_role) toma 42501
-- (mesmo padrao das migrations 0009/0016)
grant select, insert, update, delete on eval_runs to service_role;
