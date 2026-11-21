-- Migracao 0005: coluna de comentario livre nas avaliacoes de feedback
-- Permite que o usuario explique a avaliacao (util, confuso, incompleto, prolixo)

alter table feedback_respostas
    add column if not exists comentario text;

-- ===== fim de 0005_feedback_comentario =====

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

-- ===== fim de 0006_categorias_disputa =====

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

-- ===== fim de 0007_casos =====

-- Rate limit persistente por janela fixa (compartilhado entre instancias serverless)
-- A funcao verificar_rate_limit incrementa o contador da janela corrente e
-- retorna false quando o limite e excedido. Executada via RPC pelo backend.

create table if not exists rate_limits (
  chave text not null,
  janela_inicio timestamptz not null,
  contagem integer not null default 0,
  primary key (chave, janela_inicio)
);

alter table rate_limits enable row level security;

-- Limpa janelas antigas ocasionalmente para a tabela nao crescer sem limite
create or replace function verificar_rate_limit(
  p_chave text,
  p_janela_seg integer,
  p_max integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz;
  v_contagem integer;
begin
  v_inicio := to_timestamp(
    floor(extract(epoch from now()) / p_janela_seg) * p_janela_seg
  );

  insert into rate_limits (chave, janela_inicio, contagem)
  values (p_chave, v_inicio, 1)
  on conflict (chave, janela_inicio)
  do update set contagem = rate_limits.contagem + 1
  returning contagem into v_contagem;

  if random() < 0.01 then
    delete from rate_limits where janela_inicio < now() - interval '1 day';
  end if;

  return v_contagem <= p_max;
end;
$$;

-- ===== fim de 0008_rate_limit =====

