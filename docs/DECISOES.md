# Registro de Decisoes Tecnicas

Registro curto das decisoes tecnicas tomadas no Projeto Kora e seus motivos.
Manter atualizado a cada decisao relevante para evitar reversoes indevidas.

## D01 - Hospedagem: Vercel + Supabase

- Decisao: frontend e funcoes serverless na Vercel; PostgreSQL no Supabase com pgvector.
- Motivo: camadas gratuitas amplas, deploy simples de serverless e pgvector nativo
  para busca semantica sem servico adicional.

## D02 - Modelos de IA: fila de 4 gratuitos, Gemini principal

- Decisao: roteamento Modelos 1 a 4 com Gemini como principal e 3 provedores
  gratuitos de contingencia; troca automatica ao atingir limite de tokens.
- Motivo: custo zero e resiliência; exigencia explicita da especificacao.

## D03 - Temperatura baixa e grounding estrito

- Decisao: temperatura 0 a 0.1 em todas as chamadas; respostas so podem afirmar
  o que estiver no contexto recuperado ou nos fatos informados pelo usuario.
- Motivo: dominio operacional exige determinismo e prevencao de alucinacao.

## D04 - Aprendizado por feedback, sem fine-tuning

- Decisao: evolucao do Nori via loop de feedback agregado (util, confuso, incompleto,
  prolixo) que ajusta diretrizes injetadas no prompt; resolucoes validadas entram
  na base RAG.
- Motivo: modelos gratuitos nao permitem treino de pesos; abordagem controlada
  e auditavel.

## D05 - Respostas 100% geradas por IA

- Decisao: nenhum texto estatico pre-escrito no codigo; ate esclarecimentos e
  recusas sao gerados pelo modelo ativo sob as diretrizes do Nori.
- Motivo: exigencia explicita da especificacao (secao 4).

## D06 - Esquema de conhecimento unificado

- Decisao: regras da Kora e resolucoes validadas compartilham a tabela
  conhecimento_chunks com coluna origem, simplificando o RAG.
- Motivo: uma unica base vetorial reduz complexidade de ingestao e busca.

## D07 - Stack: Vite + React + Vercel Functions (Node/TypeScript)

- Decisao: frontend estatico com Vite+React+TS; api/ com funcoes serverless
  Node em TypeScript na Vercel; modulos de servidor compartilhados em shared/.
- Motivo: separacao fiel a estrutura do PDF (frontend/ e api/ distintas),
  deploy simples e gratuito na Vercel, sem framework pesado no frontend.
- Observacao: na Vercel, todo arquivo .ts dentro de api/ vira endpoint publico;
  por isso a logica compartilhada fica em shared/ e api/ contem apenas os handlers.

## D08 - Modelos: Gemini principal + Groq/Gemini/Pollinations

- Decisao: fila de 4 modelos gratuitos configuravel por env; catalogo e limites
  tambem persistidos no PostgreSQL (modelos_ia, cotas_modelos).
- Motivo: exigencia da especificacao; todos possuem camadas gratuitas conhecidas.
- Ressalva: disponibilidade e limites dos free tiers devem ser confirmados
  manualmente; nomes de modelo podem ser ajustados via variaveis de ambiente
  sem alterar codigo.

## D09 - Embeddings: gemini-embedding-001 com 1536 dimensoes

- Decisao: coluna embedding vector(1536); chamadas usam outputDimensionality=1536.
- Motivo: free tier do Gemini e compatibilidade com a dimensao fixada no schema.

## D10 - Escopo ampliado do Nori e respostas concisas

- Decisao: Nori responde perguntas gerais/casuais alem das disputas de pedidos;
  operacionais; data/hora atuais injetadas no prompt; tom natural e direto;
  respostas curtas (2 a 5 frases); max_tokens_saida reduzido para 400;
  modelo padrao trocado para gemini-3.1-flash-lite por latencia.
- Motivo: feedback do usuario — agente estava restrito demais ao operacional,
  formal demais e lento; flash-lite responde em ~4s vs ~7-14s do flash.
  (Texto original citava "divergencias operacionais"; dominio depois pivotado.)

## D14 - Pivot de dominio: disputas de pedidos em app de delivery

- Decisao: o dominio ficticio mudou de "empresa de logistica (divergencias
  operacionais)" para "marketplace de delivery (disputas de pedidos entre
  cliente, restaurante e entregador)". O Kora agora e um app de delivery;
  as 4 categorias de divergencia foram ressignificadas para item faltante,
  item errado, qualidade e entrega/atraso.
- Motivo: objetivo do projeto e demonstrar dominio de GenAI em processo
  seletivo; disputas de pedido sao uma dor real e reconhecivel de marketplaces
  de entrega (referencia implicita ao ecossistema iFood), tornando a narrativa
  do agente mais relevante que logistica B2B generica.
- Impacto: apenas camada de dominio (prompt, seeds de conhecimento, textos de
  UI, categorias, cenario de testes); toda a engenharia (RAG, streaming,
  failover, cotas, feedback, UI) permanece inalterada.

## D11 - Streaming token a token nas respostas

- Decisao: /api/chat aceita { stream: true } e devolve texto puro via
  ReadableStream alimentado pelo SSE do provedor (streamGenerateContent?alt=sse
  no Gemini, stream:true no formato OpenAI); frontend preenche a bolha por deltas.
- Motivo: latencia percebida cai drasticamente; o usuario ve a resposta nascer.
- Ressalva: no modo streaming nao roda a validacao pos-geracao de coerencia
  (o texto ja foi entregue); modo JSON classico mantido com validacao completa.

## D12 - Rate limit em memoria por IP

- Decisao: shared/ratelimit.ts com janela deslizante em Map; /api/chat 20 req/min,
  /api/parecer 10 req/min, /api/feedback 30 req/min por IP (x-forwarded-for).
- Motivo: endpoints publicos sem protecao sao alvo de abuso; solucao sem custo.
- Ressalva: em serverless cada instancia tem contador proprio — best-effort,
  suficiente contra abuso casual; se precisar de limite global, migrar para
  tabela no Postgres ou Upstash.

## D13 - Parecer de conciliacao estruturado

- Decisao: POST /api/parecer recebe o historico da conversa e gera documento
  markdown com secoes fixas (Resumo, Fatos, Evidencias, Divergencia, Plano,
  Pendencias); frontend exporta como HTML formatado.
- Motivo: transforma o chat em entregavel operacional auditavel, conforme a
  proposta do agente de conciliacao.

## D15 - Fallback em camadas com crescimento organico pelo cache

- Decisao: quando a fila de modelos falha por completo, a resposta de
  emergencia e resolvida em cascata sem LLM (api/fallback.ts): cache
  semantico relaxado (score >= 0.80, qualquer escopo) -> banco canonico
  por intencao (tabela fallback_respostas, deteccao heuristica) -> pool
  de variantes genericas estaveis por conversa. cache_respostas ganhou
  coluna `escopo` ('geral' vs 'fallback'): respostas boas de turnos com
  historico sao gravadas como 'fallback' e so servem na emergencia —
  o cache hit normal filtra 'geral'.
- Motivo: a string unica de fallback nao respondia nada e nao melhorava
  com o uso; a camada de cache alimentada por turnos reais faz a rede de
  seguranca crescer organicamente sem poluir o cache normal.
- Ressalva: depende da migration 0016 (pendente de aprovacao); sem ela o
  resolverFallback degrada para banco/variantes silenciosamente.
