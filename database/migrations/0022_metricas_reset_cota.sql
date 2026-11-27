-- Migration 0022: painel de metricas expoe o proximo reset de cota real
-- (spec/SPEC-cota-reset-pacifico.md)
--
-- Os KPIs do painel sao "uso do dia" no fuso America/Sao_Paulo (migration
-- 0018) — uma metrica de exibicao. A cota diaria do Gemini, porem, so
-- renova a meia-noite de America/Los_Angeles (RPD, doc oficial). Sem um
-- campo explicito o painel nao distingue os dois "dias" e parece que a
-- cota renova junto com os contadores. Este campo devolve o proximo
-- instante de meia-noite PT (reset diario do Gemini) para o painel
-- exibir o horario real.
--
-- Aplicar no SQL Editor do Supabase ou via MCP com aprovacao do usuario.

create or replace function metricas_chat_resumo() returns jsonb
language plpgsql stable as $$
declare
  r jsonb;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select jsonb_build_object(
    'dia', v_hoje,
    -- Proximo reset da cota diaria do Gemini: meia-noite do dia civil
    -- seguinte em America/Los_Angeles, devolvido como timestamptz
    'reset_cota_em', (
      select (( (now() at time zone 'America/Los_Angeles')::date + 1 )::timestamp
              at time zone 'America/Los_Angeles')
    ),
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
