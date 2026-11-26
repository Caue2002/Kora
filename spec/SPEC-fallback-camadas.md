# Spec: Fallback em camadas com crescimento pelo uso — V1

Status: implementado (migration 0016 aplicada no Supabase em 25/11/2026)

## Objetivo

Quando todos os modelos falham (fila de failover esgotada, provedor fora,
429 generalizado) ou a resposta e recusada/vazia/cai no guardrail, o Nori
hoje devolve sempre a MESMA `RESPOSTA_FALLBACK` fixa (`api/chat.ts`). O
usuario recebe uma mensagem generica que nao responde nada.

Objetivo: uma resposta de emergencia **util e variada**, resolvida em
camadas, que **melhora conforme o uso** — cada resposta boa gerada por um
modelo continua alimentando o cache semantico, inclusive a de turnos com
historico, que passam a servir exclusivamente como fallback.

## Decisoes

### Camadas do fallback (ordem de tentativa)

Quando o fluxo atual chegaria em `RESPOSTA_FALLBACK`, um helper
`resolverFallback(mensagem, embedding, chaveCache, perfil, conversaId)`
resolve em cascata:

1. **Cache semantico relaxado** — nova funcao `buscar_cache_fallback`:
   mesmo `cache_respostas`, mas com score minimo menor (`0.80`, vs `0.95`
   do caminho normal) e aceitando entradas de qualquer `escopo`
   (`geral` ou `fallback`). So serve linhas que ja passaram pelas regras
   de gravacao (sem recusa, sem guardrail). Prefere `escopo='geral'` em
   empate de score.
2. **Banco canonico por intencao** — tabela `fallback_respostas`
   (`intencao`, `resposta`, `prioridade`) com seeds curadas cobrindo o
   dominio fechado do Nori: saudacao/agradecimento, capacidades/meta,
   confirmacao de pedido por codigo, item faltante, item errado,
   qualidade, atraso/nao recebido, orientacao de evidencias,
   conciliacao/parecer, duvida geral. A intencao e detectada por
   heuristicas leves existentes (`ehMensagemCasual`, `ehPerguntaMeta`,
   `extrairCodigoPedido`, `PERGUNTA_TEMPORAL` + regex de categoria de
   disputa) — **sem chamada de LLM** (todos podem estar fora).
3. **Pool de variantes genericas** — `RESPOSTA_FALLBACK` vira um array
   de 4-6 variacoes equivalentes; escolha por hash estavel de
   `conversaId` (mesma conversa nao ve respostas diferentes em turnos
   seguidos) com fallback aleatorio sem `conversaId`.

Se todas falharem (banco fora, sem embedding, intencao desconhecida),
devolve a variante generica — nunca erro cru, como hoje.

### Onde o fallback em camadas e usado

Todos os pontos que hoje emitem `RESPOSTA_FALLBACK`:

- stream: `streamComFailover` retorna null (`api/chat.ts` ~657)
- stream: regeneracao de stream falha ou insiste em recusa (~746)
- nao-stream: `gerarComFailover` retorna null (~797)
- nao-stream: regeneracao de coerencia falha/recusa (~860-899)

### Crescimento pelo uso (o "conforme o uso")

- `cache_respostas` ganha coluna `escopo text not null default 'geral'`.
- **Gravacao normal inalterada**: primeira mensagem sem historico, sem
  codigo travado, sem pergunta temporal, sem imagem → `escopo='geral'`,
  servivel no caminho normal (score 0.95) e no fallback.
- **Nova gravacao de fallback**: turnos COM historico (e demais casos
  hoje inelegiveis para cache normal) gravam a resposta boa com
  `escopo='fallback'` — **nunca** servida como cache hit normal, apenas
  na camada 1 do fallback. Assim cada conversa real engorda o pool de
  emergencia organicamente.
- **Restricoes de gravacao** (mesmas do cache atual, estendidas): resposta
  so entra se passar `ehRespostaDeRecusa` + `classificarSaida` +
  `validarHeuristico`; nunca respostas `RESPOSTA_FALLBACK`/variantes;
  mensagens com imagem e perguntas temporais nao entram em nenhum escopo
  (contexto visual e dependencia de data nao sao reproduziveis depois).
- A funcao `buscar_cache_resposta` (caminho normal) passa a filtrar
  `escopo='geral'` — sem isso entradas de follow-up poderiam vazar para o
  cache hit normal e servir resposta dependente de contexto.

### Observabilidade

`registrarMetrica` passa a receber o `provedor`/`modelo` da camada que
atendeu (`cache-fallback`, `banco-fallback`, `generico-fallback`), para o
dashboard de metricas mostrar a origem da resposta de emergencia.
Header `x-fallback` mantido; novo header `x-fallback-camada` opcional.

## Migration

`database/migrations/0016_fallback_em_camadas.sql`:

- `alter table cache_respostas add column escopo text not null default 'geral'`
- recria `buscar_cache_resposta` filtrando `escopo='geral'`
- nova `buscar_cache_fallback(p_embedding, p_perfil)` retornando melhor
  candidato com `score >= 0.80`, qualquer escopo, janela de 72h
- `create table fallback_respostas` + seeds das respostas canonicas
- grants `service_role` nas novas funcoes/tabela

**Aplicacao remota exige aprovacao explicita do usuario** (regra
`SPEC-supabase-mcp-governanca`); o arquivo versionado e a fonte de
verdade e o `aplicar_migration` so roda com OK do usuario.

## Contrato de codigo

- Novo modulo `api/fallback.ts` (ou `shared/fallback.ts` se a heuristica
  de intencao for reutilizavel): `resolverFallback(...)`,
  `detectarIntencaoFallback(mensagem, contexto)`, `escolherVariante(...)`.
- `RESPOSTA_FALLBACK` sai de `api/chat.ts` e vira `VARIANTES_FALLBACK`
  no modulo novo; `ehRespostaDeRecusa` e as comparacoes
  `resposta !== RESPOSTA_FALLBACK` passam a usar helper
  `ehFallback(texto)` (detecta qualquer variante).
- Comentarios em portugues explicando o que cada funcao faz.

## Commands

- `npm run typecheck` — typecheck TS
- `npm test` — testes unitarios + integracao
- `npm --prefix frontend run build` — build do frontend (nao muda, mas
  e o gate do projeto)

## Testing Strategy

- Unitarios (`tests/`): `detectarIntencaoFallback` para cada categoria;
  `escolherVariante` estavel por `conversaId`; `resolverFallback` com
  mocks — ordem das camadas, threshold, fallback para variante generica
  quando banco/embedding indisponiveis; `ehFallback` reconhece todas as
  variantes.
- Integracao: simulacao de todos os modelos falhando e resposta servida
  do banco canonico (mock do RPC); gravacao com `escopo='fallback'` em
  turno com historico e nao-vazamento para `buscar_cache_resposta`.
- Convencao existente: Vitest, testes em `tests/*.test.ts`.

## Boundaries

- Always: rodar `npm run typecheck` + `npm test` antes de commitar;
  comentarios em portugues; atualizar `docs/CONTEXTO_ATUAL.md` e a
  pagina `docs/fluxo-kora/index.html` (comportamento visivel ao usuario
  mudou) no mesmo commit; commit+push em portugues.
- Ask first: aplicar a migration 0016 no Supabase remoto (escrita via
  MCP exige aprovacao explicita); aprovar o texto das seeds de
  `fallback_respostas` (sao falas da Nori para o usuario).
- Never: commitar segredos; servir entrada de cache com recusa ou
  resposta de fallback como se fosse cache hit normal; usar LLM na
  deteccao de intencao do fallback; quebrar o fluxo quando o banco
  estiver fora (toda camada falha silenciosamente para a proxima).

## Success Criteria

- Com todos os modelos indisponiveis, o usuario recebe uma resposta
  relacionada a intencao da mensagem (ou a melhor do cache), nunca a
  mesma string fixa; conversas diferentes podem ver variantes.
- Uma resposta boa gerada num turno com historico aparece depois como
  servida pela camada de cache do fallback (`provedor='cache-fallback'`
  nas metricas), e NUNCA como cache hit normal.
- O caminho feliz (modelos saudaveis) nao muda: mesmos thresholds,
  mesmos caches, nenhuma chamada extra no caminho critico alem das ja
  existentes (a busca de fallback so roda quando o fluxo ja falhou).
- Testes novos passam; typecheck e build verdes.

## Fora de escopo (V2)

- Classificador de intencao via LLM dedicado (custo/latencia; V1 e
  heuristico por decisao).
- Promocao automatica de respostas de fallback para `escopo='geral'`
  apos N usos bem-sucedidos.
- Feedback do usuario sobre respostas de fallback ("isso ajudou?") para
  ranquear o banco canonico.
- Fallback para o fluxo de voz (TTS) alem do texto ja existente.
- Expurgar/expirar `fallback_respostas` por uso (V1 e estatico + seeds).

## Perguntas em aberto

- Threshold do cache de fallback: `0.80` proposto — confirmar ou ajustar.
- As seeds de `fallback_respostas`: proponho redigir na fase de Tasks
  para revisao antes da migration ser aplicada.
- `escopo='fallback'` tambem para mensagens casuais/meta com historico?
  Proposta: sim (respostas leves sao seguras de reutilizar como
  emergencia), desde que passem nos mesmos guardrails.
