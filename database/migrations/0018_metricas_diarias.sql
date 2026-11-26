-- Migration 0018: metricas do painel passam a ser DO DIA (reset diario)
-- Antes a RPC metricas_chat_resumo() agregava todo o historico de
-- metricas_chat; agora total, cache, latencias, tools, consumo por modelo e
-- traces recentes consideram apenas o dia corrente no fuso America/Sao_Paulo.
-- O grafico por_dia segue mostrando os ultimos 14 dias (visao historica) e
-- passa a agrupar pela data local de Sao Paulo para o dia de hoje bater
-- com os KPIs. A RPC tambem devolve 'dia' (a data corrente) para o painel
-- exibir o dia de referencia.

create or replace function metricas_chat_resumo() returns jsonb
language plpgsql stable as $$
declare
  r jsonb;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select jsonb_build_object(
    'dia', v_hoje,
    'total_geral', (select count(*) from metricas_chat
                    where (criado_em at time zone 'America/Sao_Paulo')::date = v_hoje),
    'ultimas_24h', (select count(*) from metricas_chat
                     where criado_em > now() - interval '24 hours'),
    'cache_hits', (select count(*) from metricas_chat
                   where cache_hit
                     and (criado_em at time zone 'America/Sao_Paulo')::date = v_hoje),
    'latencia_media_ms', (select avg(latencia_ms)::int from metricas_chat
                          where latencia_ms is not null
                            and (criado_em at time zone 'America/Sao_Paulo')::date = v_hoje),
    'latencia_p50_ms', (select percentile_cont(0.5) within group (order by latencia_ms)::int
                        from metricas_chat
                        where latencia_ms is not null
                          and (criado_em at time zone 'America/Sao_Paulo')::date = v_hoje),
    'latencia_p95_ms', (select percentile_cont(0.95) within group (order by latencia_ms)::int
                        from metricas_chat
                        where latencia_ms is not null
                          and (criado_em at time zone 'America/Sao_Paulo')::date = v_hoje),
    'tools_total', (select coalesce(sum(tools_usadas), 0) from metricas_chat
                    where (criado_em at time zone 'America/Sao_Paulo')::date = v_hoje),
    'por_modelo', coalesce((
      select jsonb_agg(x order by x.total desc) from (
        select modelo,
               count(*) as total,
               avg(latencia_ms)::int as latencia_media_ms,
               sum(tokens_total) as tokens_total
        from metricas_chat
        where (criado_em at time zone 'America/Sao_Paulo')::date = v_hoje
        group by modelo
      ) x
    ), '[]'::jsonb),
    'por_dia', coalesce((
      select jsonb_agg(x order by x.dia desc) from (
        select (criado_em at time zone 'America/Sao_Paulo')::date as dia,
               count(*) as total
        from metricas_chat
        where criado_em > now() - interval '14 days'
        group by (criado_em at time zone 'America/Sao_Paulo')::date
      ) x
    ), '[]'::jsonb),
    -- Traces do dia (ate 200): o painel tira a media por etapa no cliente
    'traces_recentes', coalesce((
      select jsonb_agg(t.trace) from (
        select trace from metricas_chat
        where trace is not null
          and (criado_em at time zone 'America/Sao_Paulo')::date = v_hoje
        order by criado_em desc
        limit 200
      ) t
    ), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

grant execute on function metricas_chat_resumo() to service_role;
