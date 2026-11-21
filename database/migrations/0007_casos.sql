-- Migration 0007: estado estruturado do caso de disputa
-- Permite que o Nori maintain progresso real do atendimento (etapa, fatos,
-- evidencias e pendencias) em vez de depender apenas do historico de chat

create table if not exists casos (
  conversa_id text primary key,
  etapa text not null default 'triagem',
  categoria text,
  status text not null default 'em_andamento',
  fatos jsonb not null default '[]'::jsonb,
  evidencias jsonb not null default '[]'::jsonb,
  pendencias jsonb not null default '[]'::jsonb,
  resumo text,
  atualizado_em timestamptz not null default now()
);

alter table casos enable row level security;
-- Sem policies: acesso somente via service role no backend
