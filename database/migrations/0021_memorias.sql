-- Migracao 0021: memoria persistente do usuario (anonima)
-- (spec/SPEC-memoria-usuario.md, modulo memoria-usuario do capability-map)
--
-- A Nori passa a lembrar fatos de sessoes anteriores sem login: o
-- frontend gera um UUID anonimo por dispositivo (localStorage) e o
-- backend grava 1 linha por conversa encerrada com um resumo curto dos
-- fatos do usuario (preferencias, pedidos tratados, pendencias).
--
-- Aplicar no SQL Editor do Supabase ou via MCP com aprovacao do usuario.

create table if not exists memorias (
  id         bigint generated always as identity primary key,
  device_id  text not null,
  resumo     text not null,
  criado_em  timestamptz not null default now()
);

create index if not exists memorias_device_idx on memorias (device_id, criado_em desc);

-- Tabelas criadas via SQL Editor nao herdam grants — sem isto o
-- PostgREST (service_role) toma 42501 (padrao das migrations anteriores)
grant select, insert, update, delete on memorias to service_role;
