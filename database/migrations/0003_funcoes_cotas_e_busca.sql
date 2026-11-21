-- Migracao 0003: funcoes RPC de cotas de tokens e busca hibrida do RAG
-- registrar_consumo_tokens acumula consumo de forma atomica por janela
-- marcar_modelo_esgotado sinaliza cota esgotada sem perder o historico
-- buscar_conhecimento_hibrido combina rank textual (tsvector) e similaridade vetorial (pgvector)

-- Acumula tokens consumidos por modelo em uma janela de tempo especifica
create or replace function registrar_consumo_tokens(
    p_modelo_id smallint,
    p_janela_tipo text,
    p_janela_inicio timestamptz,
    p_tokens bigint,
    p_limite bigint
) returns void
language plpgsql
as $$
begin
    insert into cotas_modelos (modelo_id, janela_tipo, janela_inicio, tokens_estimados, limite_tokens, esgotado, updated_at)
    values (p_modelo_id, p_janela_tipo, p_janela_inicio, p_tokens, p_limite, false, now())
    on conflict (modelo_id, janela_tipo, janela_inicio)
    do update set
        tokens_estimados = cotas_modelos.tokens_estimados + excluded.tokens_estimados,
        limite_tokens = excluded.limite_tokens,
        updated_at = now();
end;
$$;

-- Marca o modelo como esgotado nas janelas correntes sem zerar o consumo ja registrado
create or replace function marcar_modelo_esgotado(
    p_modelo_id smallint,
    p_janela_tipo text,
    p_janela_inicio timestamptz,
    p_limite bigint
) returns void
language plpgsql
as $$
begin
    insert into cotas_modelos (modelo_id, janela_tipo, janela_inicio, tokens_estimados, limite_tokens, esgotado, updated_at)
    values (p_modelo_id, p_janela_tipo, p_janela_inicio, 0, p_limite, true, now())
    on conflict (modelo_id, janela_tipo, janela_inicio)
    do update set
        esgotado = true,
        limite_tokens = excluded.limite_tokens,
        updated_at = now();
end;
$$;

-- Busca hibrida: score = 60% similaridade de cosseno + 40% rank textual
-- Quando p_embedding e nulo, executa apenas a perna lexical da busca
create or replace function buscar_conhecimento_hibrido(
    p_texto text,
    p_embedding vector default null,
    p_limite int default 4
) returns table (
    id uuid,
    origem text,
    titulo text,
    conteudo text,
    categoria text,
    score double precision
)
language sql
stable
as $$
    select
        c.id,
        c.origem,
        c.titulo,
        c.conteudo,
        c.categoria,
        (
            case
                when p_embedding is null or c.embedding is null then 0::double precision
                else (1 - (c.embedding <=> p_embedding))::double precision
            end * 0.6
            + ts_rank(
                to_tsvector('portuguese', c.conteudo),
                plainto_tsquery('portuguese', p_texto)
            ) * 0.4
        ) as score
    from conhecimento_chunks c
    where c.ativo
      and (
          p_embedding is null
          or c.embedding is not null
      )
      and (
          to_tsvector('portuguese', c.conteudo) @@ plainto_tsquery('portuguese', p_texto)
          or p_embedding is not null
      )
    order by score desc
    limit p_limite;
$$;

-- Restringe a execucao das funcoes ao service_role (uso exclusivo do servidor)
revoke all on function registrar_consumo_tokens(smallint, text, timestamptz, bigint, bigint) from public, anon, authenticated;
revoke all on function marcar_modelo_esgotado(smallint, text, timestamptz, bigint) from public, anon, authenticated;
revoke all on function buscar_conhecimento_hibrido(text, vector, int) from public, anon, authenticated;
grant execute on function registrar_consumo_tokens(smallint, text, timestamptz, bigint, bigint) to service_role;
grant execute on function marcar_modelo_esgotado(smallint, text, timestamptz, bigint) to service_role;
grant execute on function buscar_conhecimento_hibrido(text, vector, int) to service_role;
