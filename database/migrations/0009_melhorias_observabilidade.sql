-- Migration 0009: observabilidade, cache semantico, historico no servidor
-- e registro de conciliacoes
-- Todas as tabelas novas seguem o padrao: RLS ligado, sem policies —
-- acesso somente via service role no backend

-- ===== Metricas de uso do chat (observabilidade) =====
-- Uma linha por requisicao /api/chat processada (sucesso ou erro de geracao)
create table if not exists metricas_chat (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  modelo text,
  provedor text,
  stream boolean not null default false,
  cache_hit boolean not null default false,
  tokens_entrada int,
  tokens_saida int,
  tokens_total int,
  latencia_ms int,
  fontes int not null default 0,
  perfil text,
  erro text
);

create index if not exists idx_metricas_chat_criado_em on metricas_chat (criado_em desc);

-- ===== Cache semantico de respostas =====
-- So respostas de PRIMEIRA mensagem (sem historico) sao cacheadas — contexto
-- vazio torna a resposta deterministica o suficiente para reuso seguro.
-- Chave: embedding da pergunta (1536 dims) + perfil; validade de 72h.
create table if not exists cache_respostas (
  id uuid primary key default gen_random_uuid(),
  embedding vector(1536),
  pergunta text not null,
  perfil text not null default '',
  resposta text not null,
  fontes jsonb not null default '[]'::jsonb,
  modelo text,
  tokens_total int,
  criado_em timestamptz not null default now()
);

create index if not exists idx_cache_respostas_embedding
  on cache_respostas using hnsw (embedding vector_cosine_ops);

-- Busca o vizinho mais proximo no cache; retorna score de similaridade (0-1)
create or replace function buscar_cache_resposta(
  p_embedding vector,
  p_perfil text default ''
) returns table (
  id uuid,
  pergunta text,
  resposta text,
  fontes jsonb,
  modelo text,
  score double precision
) language sql stable as $$
  select
    c.id,
    c.pergunta,
    c.resposta,
    c.fontes,
    c.modelo,
    (1 - (c.embedding <=> p_embedding))::double precision as score
  from cache_respostas c
  where c.embedding is not null
    and c.perfil = p_perfil
    and c.criado_em > now() - interval '72 hours'
  order by c.embedding <=> p_embedding
  limit 1;
$$;

-- ===== Historico de conversas no servidor =====
-- Espelho textual do historico que o frontend ja mantem em localStorage:
-- serve de backup e base para futuras melhorias (sync entre dispositivos)
create table if not exists conversas (
  conversa_id text primary key,
  perfil text,
  mensagens jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now()
);

-- ===== Registro de conciliacoes =====
-- Toda disputa que chega a parecer/encerrado (ou gera parecer) vira um
-- registro persistente: a "acao real" do agente no fluxo de conciliacao
create table if not exists conciliacoes (
  id bigint generated always as identity primary key,
  conversa_id text not null,
  categoria text,
  status text,
  resumo text,
  parecer text,
  modelo text,
  criado_em timestamptz not null default now(),
  unique (conversa_id)
);

alter table metricas_chat enable row level security;
alter table cache_respostas enable row level security;
alter table conversas enable row level security;
alter table conciliacoes enable row level security;
-- Sem policies: acesso somente via service role no backend

-- Tabelas criadas via SQL Editor nao herdam os privilegios default do
-- projeto: sem estes grants o PostgREST (service_role) toma 42501
grant select, insert, update, delete on metricas_chat, cache_respostas, conversas, conciliacoes to service_role;

-- ===== Resumo de metricas para observabilidade =====
-- Agregados simples para acompanhamento de custo, latencia e uso de cache
create or replace function metricas_chat_resumo() returns jsonb
language plpgsql stable as $$
declare
  r jsonb;
begin
  select jsonb_build_object(
    'total_geral', (select count(*) from metricas_chat),
    'ultimas_24h', (select count(*) from metricas_chat
                     where criado_em > now() - interval '24 hours'),
    'cache_hits', (select count(*) from metricas_chat where cache_hit),
    'latencia_media_ms', (select avg(latencia_ms)::int from metricas_chat
                          where latencia_ms is not null),
    'por_modelo', coalesce((
      select jsonb_agg(x order by x.total desc) from (
        select modelo,
               count(*) as total,
               avg(latencia_ms)::int as latencia_media_ms,
               sum(tokens_total) as tokens_total
        from metricas_chat
        group by modelo
      ) x
    ), '[]'::jsonb),
    'por_dia', coalesce((
      select jsonb_agg(x order by x.dia desc) from (
        select criado_em::date as dia, count(*) as total
        from metricas_chat
        where criado_em > now() - interval '14 days'
        group by criado_em::date
      ) x
    ), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

grant execute on function buscar_cache_resposta(vector, text) to service_role;
grant execute on function metricas_chat_resumo() to service_role;
