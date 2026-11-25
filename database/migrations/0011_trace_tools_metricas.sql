-- Migration 0011: observabilidade v2 — trace por request + contagem de tool calls
-- Adiciona colunas em metricas_chat e estende metricas_chat_resumo() com
-- percentis de latencia (p50/p95), total de tool calls e traces recentes
-- para o painel /metricas.html calcular o "trace medio" por etapa.

alter table metricas_chat add column if not exists trace jsonb;
alter table metricas_chat add column if not exists tools_usadas int not null default 0;

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
    'latencia_p50_ms', (select percentile_cont(0.5) within group (order by latencia_ms)::int
                        from metricas_chat where latencia_ms is not null),
    'latencia_p95_ms', (select percentile_cont(0.95) within group (order by latencia_ms)::int
                        from metricas_chat where latencia_ms is not null),
    'tools_total', (select coalesce(sum(tools_usadas), 0) from metricas_chat),
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
    ), '[]'::jsonb),
    -- Ultimos 200 traces nao-nulos: o painel tira a media por etapa no cliente
    'traces_recentes', coalesce((
      select jsonb_agg(t.trace) from (
        select trace from metricas_chat
        where trace is not null
        order by criado_em desc
        limit 200
      ) t
    ), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

grant execute on function metricas_chat_resumo() to service_role;
