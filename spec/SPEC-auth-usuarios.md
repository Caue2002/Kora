# Spec: Autenticacao de Usuarios (Supabase Auth) — Fase 2

Status: proposto — aguardando aprovacao do usuario

Origem: `spec/capability-map.md` (modulo `auth-usuarios`, fase 2
deferida). Decisao do usuario em 26/11/2026: login NAO e obrigatorio —
a memoria anonima por `device_id` continua existindo; auth associa os
dados ao usuario quando ele quiser. Esta spec transforma essa decisao
em contrato implementavel.

## Objetivo

Permitir que o usuario crie conta (e-mail/senha) e passe a ter seus
dados de conversa vinculados a identidade persistente entre
dispositivos, sem quebrar o modo anonimo atual. Quem nao quiser login
continua usando o Kora exatamente como hoje.

Usuario: visitante do Kora Delivery que hoje perde o historico ao
trocar de aparelho/navegador. Sucesso = login opcional funcionando,
memorias e conversas acessiveis na conta, RLS efetiva nos dados do
usuario, e zero regressao no fluxo anonimo.

## Estado atual (o que ja existe)

- Frontend NUNCA fala com o Supabase diretamente: todo acesso a dados
  passa pelas functions `api/*` com `SUPABASE_SERVICE_ROLE_KEY`
  (service role ignora RLS). Identidade hoje = `device_id`
  (UUID em `localStorage kora-device-id`, `frontend/src/api.ts`).
- Tabelas com dados por "pessoa": `memorias` (device_id), `conversas`
  (conversa_id — hoje sem dono), `casos` (conversa_id), `conciliacoes`
  (conversa_id), `feedback_respostas`.
- `shared/memoria.ts` injeta as 5 memorias recentes do device no
  primeiro turno; `api/memoria.ts` grava resumo no encerramento.
- Catalogo de functions Vercel Hobby: api/ tem 11 files — cabe MAIS 1.

## Decisoes de arquitetura (proposta)

1. **Padrao BFF**: o frontend autentica via Supabase Auth
   (`supabase.auth.signUp/signInWithPassword`) usando a **anon key**
   (publica por design — nova env `VITE_SUPABASE_URL` +
   `VITE_SUPABASE_ANON_KEY` no build). As functions `api/*` recebem
   `Authorization: Bearer <access_token>` e validam o JWT no servidor
   (`supabase.auth.getUser(token)` — service role so no backend).
   Nenhuma chamada do frontend ao PostgREST com dados de usuario.
2. **Escopo por usuario no servidor**: as funcoes que leem/gravam
   dados pessoais (`/api/memoria`, `/api/chat` na injecao de memorias,
   `/api/conversa`, `/api/caso`, `/api/feedback`, `/api/parecer`,
   `/api/handoff`) passam a resolver `device_id OU user_id`: com token
   valido usam `user_id`; sem token mantem o fluxo anonimo atual.
3. **Coluna `user_id uuid`** (nullable, `references auth.users`) em
   `memorias`, `conversas`, `casos`, `conciliacoes`,
   `feedback_respostas`. `device_id`/`conversa_id` continuam — o modo
   anonimo nao muda.
4. **Vinculo de dados na primeira sessao autenticada**: ao login, as
   memorias do `device_id` atual ganham `user_id` (update unico,
   idempotente). Conversas antigas do dispositivo seguem acessiveis so
   no dispositivo — nao ha como enumerar conversas anonimas de forma
   segura; a conta comeca "limpa" de conversas mas herda as memorias.
5. **Um unico endpoint novo**: `api/auth.ts` dispatcher
   (`?acao=entrar|sair|sessao`) — conta como 1 function (ficamos com
   12/12 no Hobby, no limite). Alternativa sem endpoint novo:
   logout e sessao resolvidos no cliente Supabase; so `entrar` via
   Auth REST — avaliar na fase Plan qual e menor.
6. **RLS**: ligada nas tabelas de dados do usuario como defesa em
   profundidade (policy `user_id = auth.uid()`), MESMO o backend
   usando service role para queries escopadas — o RLS protege contra
   acesso direto via anon key que um bug futuro possa introduzir.
   Tabelas compartilhadas (conhecimento_chunks, modelos_ia,
   cotas_modelos, fallback_respostas, eval_runs, rate_limits,
   metricas_chat, cache_respostas) NAO levam RLS de usuario.
7. **UI**: entrada discreta no menu "..." do chat ("Entrar" /
   "Sair" + e-mail quando logado), tela/modal de login-cadastro
   (e-mail+senha, sem OAuth na V1), estados de loading com o
   `IndicadorCarregando` obrigatorio. Sessao via
   `supabase.auth` no cliente (persistida em localStorage pelo SDK).

## Fora de escopo (adiado)

- OAuth (Google/GitHub) — V2.
- Recuperacao de senha / confirmacao de e-mail — depende de SMTP;
  Supabase free tem limite baixo; avaliar na V2.
- Migrar conversas anonimas do dispositivo para a conta — impossivel
  enumerar com seguranca (conversa_id nao tem dono); so memorias.
- Sincronizar perfil de atendimento (Cliente/Parceiro/Entregador)
  entre dispositivos — device-scoped por design; V2.
- Admin/dashboard por usuario — /metricas.html segue global.

## Perguntas em aberto (resolver na aprovacao)

1. Login **opcional** confirmado? (assumido: sim, guest continua)
2. Vincular memorias do device ao primeiro login — ok? (assumido: sim)
3. Aceitar o projeto ficar com 12/12 functions (proximo endpoint
   exigira consolidacao)? (assumido: sim — alternativa e fundir
   `conversa`+`metricas` num dispatcher)

## Criterios de sucesso

- Signup/login/logout funcionando em producao com Supabase Auth.
- Com token valido, memorias e dados do caso usam `user_id`; sem token,
  fluxo anonimo identico ao atual (regressao zero — suite inteira verde).
- Migration versionada em `database/migrations/` (nunca so MCP) +
  RLS aplicada; `device_id` legado continua funcionando.
- Testes: unitarios do resolver de identidade, integracao do fluxo
  anonimo, e teste de auth mockado (sem conta real no CI).
- `npm run typecheck`, `npm test`, `npm --prefix frontend run build`
  verdes; spec atualizada para `implementado` ao final.

## Boundaries

- Always: PT-BR em comentarios/UI; `IndicadorCarregando` em todo
  loading; validacao estrita de token/entrada; nunca commitar
  `VITE_SUPABASE_ANON_KEY` errada — anon key e publica por design,
  service role JAMAIS no frontend.
- Ask first: mudancas de schema alem das colunas `user_id`; qualquer
  endpoint novo alem de `api/auth.ts`; mexer em RLS de tabelas
  compartilhadas.
- Never: service role key no bundle do frontend; aplicar migration via
  MCP sem aprovacao explicita (usar arquivo em database/migrations/);
  tornar login obrigatorio sem pedido do usuario.
