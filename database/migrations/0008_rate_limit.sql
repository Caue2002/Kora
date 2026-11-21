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
