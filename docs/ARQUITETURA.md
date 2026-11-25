# Arquitetura do Projeto Kora

Documento tecnico vivo do projeto. Atualizar a cada funcionalidade, mudanca de
arquitetura, criacao de tabela ou mudanca de regra de negocio.

## Visao geral

Sistema conversacional do agente de IA Nori para triagem, investigacao e
conciliacao de **disputas de pedidos** no Kora, aplicativo ficticio de delivery
que conecta clientes, restaurantes e entregadores. O Nori conduz o usuario por
perguntas objetivas, separa fatos de hipoteses, consulta as politicas de disputa
no PostgreSQL e estrutura um parecer de conciliacao com responsavel provavel
e compensacao sugerida.

## Estrutura de pastas

| Pasta | Responsabilidade |
|---|---|
| frontend/ | Interface responsiva mobile-first contendo apenas o chat, controle de sessao na aba (sessionStorage), envio de mensagens e acoes rapidas de resposta |
| api/ | Funcoes serverless na Vercel: validacao de entrada, controle de orcamento de tokens, alternancia automatica entre os 4 modelos gratuitos e orquestracao do fluxo |
| rag/ | Ingestao, segmentacao (chunking), geracao de embeddings e busca hibrida rapida (lexical + vetorial) no PostgreSQL |
| coherence/ | Camada de conducao conversacional, aprendizado adaptativo controlado por regras/feedback e validacao obrigatoria de coerencia logica antes da entrega |
| database/ | Scripts SQL, migracoes, indices e estrutura relacional/vetorial (pgvector) no Supabase |
| docs/ | Documentacao tecnica viva e CONTEXTO_ATUAL.md para continuidade entre sessoes; inclui material de entrevista local (fluxo-kora/, fora do git) e contexto.pdf de referencia |
| scripts/ | Scripts utilitarios locais: dev-server, ingestao de conhecimento, relatorio de feedback e teste de modelos Gemini |
| spec/ | Specs delta das funcionalidades (spec-driven development) |
| tests/ | Testes unitarios e de integracao (vitest), incluindo evals e cenarios fixos da Kora |
| shared/ | Modulos de servidor compartilhados (env, supabase, llm, tokens, models). Fora de api/ porque todo .ts dentro de api/ vira endpoint publico na Vercel |

### Estado da implementacao (V1)

- frontend/: chat mobile-first implementado (Vite+React+TS, historico no
  localStorage, sidebar estilo Gemini, streaming token a token, markdown
  completo, acoes copiar/exportar/feedback com comentario, PWA instalavel)
- api/: endpoints POST /api/chat (com modo stream), /api/feedback e /api/parecer
- shared/: config por env, cliente Supabase (PostgREST+RPC), cliente LLM dos
  4 provedores (com streaming SSE), estimativa/contabilidade de tokens,
  selecao de modelo por cota e rate limit em memoria por IP
- rag/: chunking, embeddings Gemini e busca hibrida (RPC buscar_conhecimento_hibrido)
- coherence/: prompt do Nori, diretrizes adaptativas por feedback e validacao de coerencia (heuristica + LLM)
- database/: migracoes 0000 a 0015 (schema, RPCs, casos, rate limit,
  observabilidade, categorias) com o seed SQL 0004 (modelos) em migrations/;
  seeds de conhecimento em JSON (politicas_disputa.json)
- Seeds de conhecimento: database/seeds/politicas_disputa.json (9 politicas de
  disputa de pedidos em delivery, ingeridas via scripts/ingerir_conhecimento.mjs)
- Pendente: aplicar migracoes 0005/0006 no Supabase e deploy na Vercel

## Interface (frontend/)

- Layout estilo Gemini: sidebar de historico (busca, renomear, excluir) + chat.
- Mobile-first: sidebar vira overlay no mobile; acoes rapidas compactas.
- Paleta delivery quente: fundo creme #FFF6F0; usuario em gradiente laranja
  #FF7A3D->#E8500F; agente em branco com borda pessego #F3E2D8; acentos
  #F04E23/#F72585; tema escuro quente; logo da sacola termica com sparkles.
- Streaming token a token com status contextual ("Consultando a base...",
  "Gerando resposta..."); markdown completo (tabelas, codigo, checklist
  clicavel, citacoes); popover de fontes do RAG sob demanda.
- Historico persistente em localStorage; PWA instalavel; ditado por voz;
  modo foco para leitura; timestamps relativos.

## RAG e prevencao de alucinacao (rag/)

- Busca hibrida de baixa latencia: pesquisa textual exata (codigos de pedido,
  palavras-chave) combinada com busca semantica via pgvector.
- Retorna apenas trechos curtos e relevantes das regras da Kora.
- Temperatura baixa (0 a 0.1) em todas as chamadas de LLM.
- Grounding estrito: o Nori so afirma regras, prazos e criterios presentes no
  contexto recuperado ou nos fatos informados pelo usuario.
- Nenhuma resposta estatica pre-escrita: tudo gerado dinamicamente pelo modelo ativo.

## Conducao, aprendizado e coerencia (coherence/)

- Conducao ativa: a cada turno o Nori sintetiza o confirmado, identifica lacunas
  criticas (etapa da falha, quantidade divergente, evidencia) e formula perguntas
  diretas. Assunto novo limpa o contexto pendente do caso anterior.
- Aprendizado adaptativo sem fine-tuning: avaliacoes (util, confuso, incompleto,
  prolixo) agregadas no Supabase; ao atingir limiares, ajustam diretrizes de
  estilo, detalhe e ordem de perguntas injetadas no prompt. Resolicoes validadas
  podem ser incorporadas a base RAG.
- Coerencia obrigatoria: toda resposta e verificada contra mensagens anteriores,
  regras recuperadas e evidencias antes de ser exibida; contradicoes ou falta de
  base sao ajustadas e sinalizadas.

## Modelos e controle de tokens (api/)

- 4 modelos gratuitos; Gemini como principal, demais na fila de contingencia.
- Ordem de prioridade Modelo 1 a 4; ao atingir limite da janela (minuto/hora/dia),
  o modelo e marcado como esgotado e a requisicao passa ao proximo.
- Estimativa de tokens antes da chamada com teto de seguranca; registro do consumo
  real (ou estimativa consolidada) apos a resposta, atualizado no PostgreSQL.
- Janela curta de historico (ultimas 4 a 6 interacoes), resumo enxuto dos fatos
  confirmados na troca de modelo ou proximidade do teto.
- Esgotamento total dos 4 modelos: informar temporariamente com clareza, sem inventar.
- Economia: cache no Supabase para contextos repetidos, limites de tamanho por
  turno, compressao de historico, observabilidade/evals em plano gratuito,
  GitHub Actions dentro da cota gratuita.

## Banco de dados (database/)

- PostgreSQL no Supabase com extensao pgvector.
- Tabelas: conhecimento_chunks (regras e resolucoes com embeddings),
  modelos_ia (catalogo dos 4 modelos), cotas_modelos (contadores por janela),
  feedback_respostas (avaliacoes) e de agregacao.
- Migracao inicial: database/migrations/0001_esquema_inicial.sql

## Regras operacionais do agente de codigo (Devin)

1. docs/ obrigatoriamente atualizada a cada funcionalidade, mudanca de arquitetura,
   tabela ou regra de negocio.
2. Commits em portugues, titulo claro e descricao objetiva e resumida.
3. Comentarios crus em portugues explicando o que cada funcao faz, sem formatacao
   decorativa.
4. Validacao obrigatoria antes de cada commit: testes do que foi alterado,
   integracao dos fluxos, ausencia de bugs e documentacao atualizada.
5. Manter registro de decisoes tecnicas (docs/DECISOES.md) e executar o conjunto
   fixo de cenarios de teste da Kora (completos, incompletos/ambiguos,
   contraditorios e fora do escopo) apos mudancas relevantes.
