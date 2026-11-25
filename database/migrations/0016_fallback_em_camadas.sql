-- Migracao 0016: fallback em camadas com crescimento pelo uso
-- (spec/SPEC-fallback-camadas.md)
--
-- 1) cache_respostas ganha `escopo`: 'geral' (primeira mensagem, servivel
--    no cache hit normal) ou 'fallback' (gravada de turnos com historico,
--    servivel APENAS como ultima instancia quando os modelos falham).
--    O caminho normal nunca ve escopo='fallback': buscar_cache_resposta
--    passa a filtrar escopo='geral'.
-- 2) buscar_cache_fallback: mesmo vizinho mais proximo, mas com janela
--    maior de score (o limiar numerico e aplicado no codigo, 0.80) e
--    aceitando qualquer escopo — respostas boas de follow-ups viram
--    rede de seguranca organica.
-- 3) fallback_respostas: banco canonico de respostas de emergencia por
--    intencao do dominio do Nori (sem LLM envolvido — todos os modelos
--    podem estar fora quando ele e consultado).
--
-- Aplicar no SQL Editor do Supabase ou via MCP com aprovacao do usuario.

alter table cache_respostas
  add column if not exists escopo text not null default 'geral';

-- Caminho normal: somente entradas 'geral' (primeira mensagem). Sem o
-- filtro, respostas dependentes de contexto de conversa poderiam vazar
-- para o cache hit de outro usuario
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
    and c.escopo = 'geral'
    and c.perfil = p_perfil
    and c.criado_em > now() - interval '72 hours'
  order by c.embedding <=> p_embedding
  limit 1;
$$;

-- Camada de emergencia: melhor candidato de QUALQUER escopo na mesma
-- chave (perfil|periodo|codigo). Empate de score prefere 'geral' —
-- respostas de primeira mensagem sao as mais autonomas
create or replace function buscar_cache_fallback(
  p_embedding vector,
  p_perfil text default ''
) returns table (
  id uuid,
  pergunta text,
  resposta text,
  fontes jsonb,
  modelo text,
  escopo text,
  score double precision
) language sql stable as $$
  select
    c.id,
    c.pergunta,
    c.resposta,
    c.fontes,
    c.modelo,
    c.escopo,
    (1 - (c.embedding <=> p_embedding))::double precision as score
  from cache_respostas c
  where c.embedding is not null
    and c.perfil = p_perfil
    and c.criado_em > now() - interval '72 hours'
  order by
    c.embedding <=> p_embedding,
    case when c.escopo = 'geral' then 0 else 1 end
  limit 1;
$$;

-- Banco canonico de respostas de emergencia por intencao. Consultado
-- somente quando o cache falha; prioridade menor = preferida
create table if not exists fallback_respostas (
  id uuid primary key default gen_random_uuid(),
  intencao text not null,
  resposta text not null,
  prioridade int not null default 1,
  criado_em timestamptz not null default now()
);

create index if not exists idx_fallback_respostas_intencao
  on fallback_respostas (intencao, prioridade);

alter table fallback_respostas enable row level security;
-- Sem policies: acesso somente via service role no backend

grant select, insert, update, delete on fallback_respostas to service_role;
grant execute on function buscar_cache_fallback(vector, text) to service_role;

-- Seeds: falas canonicas da Nori por intencao. Textos curtos e honestos —
-- admitem a dificuldade tecnica sem prometer o que nao podem cumprir
insert into fallback_respostas (intencao, resposta, prioridade) values
  ('saudacao',
   'Oi! Sou a Nori, da equipe do Kora. Posso te ajudar com disputas de pedidos — item faltante, item errado, qualidade, atraso — confirmar pedido pelo codigo e orientar sobre evidencias. No que posso ajudar?',
   1),
  ('meta',
   'Sou a Nori, a assistente do Kora: triagem disputas de pedidos (item faltante, item errado, qualidade, atraso), confirmo pedidos por codigo, oriento sobre evidencias e ajudo na conciliacao. Neste momento estou com uma dificuldade tecnica, mas essas sao as coisas que eu faco.',
   1),
  ('confirmacao_pedido',
   'Consigo confirmar seu pedido pelo codigo — me envie o codigo que aparece no pedido e eu localizo loja, itens e valor para voce conferir.',
   1),
  ('item_faltante',
   'Entendi — item faltante e um dos casos que eu mais trato. Para abrir a disputa eu preciso do codigo do pedido, de qual item faltou e, se tiver, uma foto do pedido ou do produto. Voce tem esses dados?',
   1),
  ('item_errado',
   'Entendi — item errado tambem e coberto pela disputa. Para eu te orientar preciso do codigo do pedido, do que veio no lugar e, se possivel, foto do produto recebido. Pode me enviar?',
   1),
  ('qualidade',
   'Para contestar qualidade — produto frio, estragado ou avariado — preciso do codigo do pedido, da sua descricao do problema e de uma foto da evidencia. Pode me mandar?',
   1),
  ('atraso',
   'Para atraso ou pedido nao recebido preciso do codigo do pedido, do horario previsto e, se possivel, print do rastreio ou foto do local. Me passa esses dados?',
   1),
  ('evidencias',
   'As evidencias que mais ajudam na conciliacao sao: foto do produto ou do problema, print do pedido com o valor pago e o codigo do pedido. Fotos claras aumentam bastante a chance de resolucao.',
   1),
  ('conciliacao',
   'O parecer de conciliacao compara a sua descricao com as evidencias e as regras do Kora, e indica o desfecho provavel — reembolso total, parcial ou nao procedente. Quando tivermos os dados do pedido eu consigo te ajudar com isso.',
   1),
  ('geral',
   'Tive uma dificuldade para formular essa resposta agora. Posso te ajudar com disputas de pedidos do Kora (item faltante, item errado, qualidade, atraso), confirmacao de pedido por codigo, orientacao sobre evidencias e parecer de conciliacao — e tambem respondo assuntos gerais. Como posso ajudar?',
   1),
  ('geral',
   'Estou com uma instabilidade tecnica no momento. Enquanto isso, posso adiantar: para qualquer disputa de pedido preciso do codigo dele, da descricao do problema e de evidencias (fotos ou prints). Me conta o que aconteceu?',
   1);
