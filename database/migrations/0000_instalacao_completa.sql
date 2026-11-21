-- ============================================================
-- KORA - SCRIPT UNICO PARA SQL EDITOR DO SUPABASE
-- Execute este arquivo inteiro de uma vez
-- ============================================================

-- Migracao inicial do Projeto Kora (Agente Nori)
-- Banco: PostgreSQL no Supabase com extensao pgvector
-- Cria tabelas de conhecimento RAG, catalogo/cotas dos 4 modelos e feedback agregado

create extension if not exists vector;

-- Tabela unificada de conhecimento para o RAG
-- Guarda regras da Kora e resolucoes validadas, ambas com embedding vetorial
create table if not exists conhecimento_chunks (
    id uuid primary key default gen_random_uuid(),
    origem text not null check (origem in ('regra', 'resolucao')),
    referencia text,
    titulo text not null,
    conteudo text not null,
    categoria text,
    metadados jsonb not null default '{}'::jsonb,
    embedding vector(1536),
    ativo boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Indice vetorial para busca semantica via pgvector
create index if not exists idx_conhecimento_embedding
    on conhecimento_chunks using hnsw (embedding vector_cosine_ops);

-- Indice textual para a parte lexical da busca hibrida
create index if not exists idx_conhecimento_conteudo_fts
    on conhecimento_chunks using gin (to_tsvector('portuguese', conteudo));

-- Catalogo dos 4 modelos gratuitos na ordem de prioridade (1 a 4)
create table if not exists modelos_ia (
    id smallint primary key check (id between 1 and 4),
    provedor text not null,
    nome_modelo text not null,
    prioridade smallint not null,
    ativo boolean not null default true,
    created_at timestamptz not null default now(),
    unique (prioridade)
);

-- Contadores de tokens por modelo e janela de tempo (minuto, hora, dia)
create table if not exists cotas_modelos (
    modelo_id smallint not null references modelos_ia (id),
    janela_inicio timestamptz not null,
    janela_tipo text not null check (janela_tipo in ('minuto', 'hora', 'dia')),
    tokens_estimados bigint not null default 0,
    tokens_reais bigint,
    limite_tokens bigint not null,
    esgotado boolean not null default false,
    updated_at timestamptz not null default now(),
    primary key (modelo_id, janela_tipo, janela_inicio)
);

-- Avaliacoes de resposta dos usuarios (util, confuso, incompleto, prolixo)
create table if not exists feedback_respostas (
    id uuid primary key default gen_random_uuid(),
    avaliacao text not null check (avaliacao in ('util', 'confuso', 'incompleto', 'prolixo')),
    modelo_id smallint references modelos_ia (id),
    turno_id uuid,
    created_at timestamptz not null default now()
);

-- Visao agregada de feedback para alimentar o loop de aprendizado adaptativo
create or replace view v_feedback_resumo as
select avaliacao,
       count(*) as total,
       count(*) filter (where created_at >= now() - interval '7 days') as total_7d
from feedback_respostas
group by avaliacao;

-- Regra de negocio: categorias minimas de divergencia da Kora
-- Usada para classificar chunks e orientar a condução da triagem
create table if not exists categorias_divergencia (
    id smallint primary key,
    nome text not null,
    descricao text not null,
    created_at timestamptz not null default now()
);

insert into categorias_divergencia (id, nome, descricao) values
    (1, 'quantidade', 'Divergencia de quantidade entre pedido/registro, separacao e recebimento/destino'),
    (2, 'troca_item', 'Item trocado ou substituicao indevida no pacote'),
    (3, 'status_avaria', 'Inconsistencia de status ou avaria/falta entre etapas do fluxo operacional'),
    (4, 'prazo_roteamento', 'Excecao de prazo ou roteamento que exige conferencia antes do encerramento')
on conflict (id) do nothing;

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

-- Seed dos 4 modelos gratuitos na ordem de prioridade
-- Ajustar nome_modelo/provedor conforme os provedores efetivamente contratados
-- Os valores reais de modelo podem ser sobrescritos por env no codigo (ver shared/env.ts)

insert into modelos_ia (id, provedor, nome_modelo, prioridade) values
    (1, 'gemini',    'gemini-2.5-flash',                        1),
    (2, 'groq',      'llama-3.3-70b-versatile',                 2),
    (3, 'cerebras',  'llama-3.3-70b',                           3),
    (4, 'openrouter','meta-llama/llama-3.3-70b-instruct:free',  4)
on conflict (id) do nothing;
