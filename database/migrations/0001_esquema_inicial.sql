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
