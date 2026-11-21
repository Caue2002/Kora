# CONTEXTO_ATUAL.md

Arquivo dedicado ao estado atual do desenvolvimento do Projeto Kora (Agente Nori).
Atualizar obrigatoriamente ao final de cada tarefa concluída.

## Fase atual

Produto funcional com pivot de dominio concluido: o Nori agora e um agente de
conciliacao de **disputas de pedidos** em um app de delivery ficticio (Kora),
e nao mais um agente de divergencias logisticas. Motivacao: demonstrar
conhecimento de GenAI em processo seletivo com dor reconhecivel de marketplace
de entrega.

## O que esta pronto

- Estrutura de pastas: frontend/, api/, rag/, coherence/, database/, docs/, shared/
- frontend/: chat mobile-first (Vite+React+TS), sessionStorage, acoes copiar/exportar/feedback
- api/: POST /api/chat (orquestracao completa) e POST /api/feedback
- shared/: env, cliente Supabase, cliente LLM (Gemini/Groq/Cerebras/OpenRouter),
  tokens e controle de cotas com failover
- rag/: chunking, embeddings Gemini (1536 dims) e busca hibrida via RPC
- coherence/: prompt do Nori, diretrizes adaptativas por feedback, validacao de coerencia
- database/: migracao 0001 (schema pgvector), 0003 (RPCs de cota e busca), seed 0004 (modelos)
- Testes unitarios em tests/ (chunking, tokens, prompt, cotas, validacao)
- Validacao local concluida: 15 testes passando, tsc --noEmit limpo, vite build ok
- Configs: package.json raiz e frontend, tsconfig, vercel.json, .env.example, .gitignore
- Git inicializado com push para github.com/Caue2002/Kora
- Supabase criado e migracoes aplicadas (0000_instalacao_completa.sql) - verificado
- Chave Gemini validada; modelo padrao ajustado para gemini-3.6-flash (2.5-flash
  indisponivel para contas novas); embeddings gemini-embedding-001 testados (1536 dims)
- Regras de exemplo da Kora criadas em database/seeds/regras_kora.json
  (7 regras nas 4 categorias) + script scripts/ingerir_conhecimento.mjs
  para gerar embeddings e popular conhecimento_chunks
- .env configurado (Supabase + Gemini); chaves antigas revogadas e substituidas
- RAG populado: 7 chunks com embeddings 1536 dims em conhecimento_chunks
- Teste de integracao real do /api/chat passando (Gemini + Supabase + RAG)
- Servidor de dev local criado: scripts/dev-server.ts (npm run dev:api, porta 3000)
  + vite proxy; chat testado de ponta a ponta em http://localhost:5173
- Empresa ficticia renomeada de RotaLeve para Kora em todo o projeto (prompt, docs, seeds, banco)
- Interface do chat aprimorada: avatar do Nori, animacao de digitando, timestamps,
  badge de categoria, fontes do RAG expansivel, modelo+tokens por resposta,
  contador de tokens da sessao, chips de sugestao, acoes Resumir/Checklist,
  renderizacao leve de markdown (negrito, listas, checklist)
- Nori ampliado para conversa casual + data/hora injetada; respostas concisas
  (2-5 frases); modelo gemini-3.1-flash-lite (~4s); MAX_TOKENS_SAIDA=400
- Citacoes inline [n] ligadas as fontes do RAG (prompt instrui o modelo a citar)
- Tema escuro com toggle, animacao de entrada, icones SVG nas acoes,
  contador de ocorrencias, ditado por voz (Web Speech API) e PWA instalavel
- Historico estilo Gemini: sidebar fixa no desktop/overlay no mobile,
  persistencia em localStorage, titulo automatico, busca e renomear conversa;
  cabecalho exibe apenas "Nori" (sem nome da empresa)
- Streaming de respostas token a token: shared/llm.ts (streamLLM + parser SSE
  Gemini/OpenAI), /api/chat aceita { stream: true }, frontend preenche a bolha
  por deltas; metadados (modelo/fontes) via headers x-modelo/x-fontes
- Rate limit em memoria por IP (shared/ratelimit.ts): chat 20/min,
  parecer 10/min, feedback 30/min
- Endpoint POST /api/parecer: parecer de conciliacao estruturado (markdown
  com secoes fixas) gerado sob demanda; frontend exporta HTML formatado
- Feedback com comentario opcional: migracao 0005_feedback_comentario.sql
  (coluna comentario em feedback_respostas), UI com campo inline
- Botao "Tentar novamente" em erros de envio; mensagem do usuario e removida
  da conversa em caso de falha para nao duplicar no retry
- CI no GitHub Actions (.github/workflows/testes.yml): typecheck + testes +
  build do frontend a cada push/PR
- Visual alinhado as principais IAs: markdown completo (tabelas, blocos de
  codigo, titulos, citacoes, checklist clicavel), acoes da mensagem no hover,
  popover de fontes consultadas sob demanda, status contextual no streaming
  ("Consultando a base..." / "Gerando resposta..."), icones nos chips de
  sugestao, botao voltar ao fim, contador de caracteres, timestamps relativos
  e modo foco (esconde sidebar/header para leitura)
- PIVOT DE DOMINIO (D14): Kora agora e app de delivery ficticio; Nori tria
  disputas de pedidos (item faltante, item errado, qualidade, atraso/nao
  recebido) e gera parecer com responsavel provavel e compensacao
- Novas politicas de disputa em database/seeds/politicas_disputa.json
  (9 regras) + migracao 0006 atualizando descricoes das categorias
- Script de ingestao agora e idempotente: remove seeds antigos antes de inserir
- Politicas de disputa ja ingeridas no Supabase (9 chunks, referencia
  politicas_disputa_exemplo); chunks de regras logisticas removidos
- Bug de cotas corrigido: marcarEsgotado marcava esgotado nas janelas de
  minuto+hora+dia (um 429 bloqueava o modelo ate o dia seguinte); agora marca
  apenas a janela de minuto. Limites internos de tokens elevados no .env
  (MINUTO=30000, HORA=300000, DIA=1000000) — sao orcamento proprio, nao os
  limites reais do Gemini
- Testes de integracao ganharam retry em 429 (espera 65s) e IPs unicos por
  chamada para nao trombar no rate limit nem no RPM do free tier
- Repaginacao visual delivery/IA: nova logo (sacola termica + sparkles + glow),
  paleta laranja-coral quente, titulo "Nori" em gradiente, botao enviar em
  gradiente, glow pulsante na logo, busca removida da sidebar e botao
  renomeado para "Novo chat"
- Conjunto fixo de cenarios de teste (tests/cenarios.test.ts): completo,
  incompleto/ambiguo, contraditorio e fora do escopo — 20 testes passando
- Validacao: typecheck limpo, 20 testes ok, vite build ok, streaming e
  /api/parecer testados ao vivo contra Gemini+Supabase
- Estado estruturado do caso (agentic workflow): migration 0007_casos.sql
  (tabela casos com etapa/categoria/status/fatos/evidencias/pendencias),
  endpoint /api/caso (GET consulta, POST extrai estado via LLM e faz upsert;
  {encerrar:true} marca encerrado sem custo de modelo), card "Caso" no
  frontend acima das acoes rapidas com etapa, pendencias e detalhes
  colapsaveis; extracao roda em segundo plano apos cada resposta do agente
- Ajustes finais de UX: status do streaming exibe "Pensando..."/"Gerando
  resposta..."; mensagem inicial se apresenta como "Nori, agente de IA do
  Kora delivery"; secao "Sobre voce" no prompt permite a Nori explicar sua
  arquitetura/busca/aprendizado quando perguntada; botao "Encerrar" encerra
  o caso e inicia chat limpo; espacamento das acoes rapidas acima do input
- Botoes Resumir/Checklist/Encerrar substituidos por menu "..." (estilo
  ChatGPT) com Resumir caso, Checklist de evidencias, Gerar parecer e
  Encerrar atendimento; card "Caso" ganhou timeline visual das etapas
  (Triagem > Coleta > Analise > Parecer > Encerrado); botao de ouvir
  resposta (TTS Web Speech API) nas mensagens da Nori; respostas encurtadas
  para 1-3 frases com no maximo uma pergunta por turno; paleta migrada de
  laranja para azul (#2563EB/#1D4ED8/#06B6D4) e logo aplicada em PNG
  (emblema azul glossy, fundo transparente)

## Em andamento

- Nenhuma implementacao em curso; aguardando migrations 0005/0006/0007 no
  Supabase e deploy

## Decisoes tecnicas tomadas

- Ver docs/DECISOES.md (D01 a D09)
- Resumo: Vite+React frontend, Vercel Functions Node/TS em api/, shared/ para
  logica de servidor, Gemini principal + Groq/Cerebras/OpenRouter contingencia,
  embeddings gemini-embedding-001 em 1536 dimensoes

## Pendencias (proximos passos, em ordem)

1. Aplicar database/migrations/0005_feedback_comentario.sql,
   0006_categorias_disputa.sql e 0007_casos.sql no SQL Editor do Supabase
   (sem a 0007 o card "Caso" funciona mas nao persiste entre sessoes)
3. Deploy na Vercel: criar projeto, configurar as mesmas variaveis de ambiente
   do .env no painel da Vercel e fazer deploy do repositorio
   (verificar se streaming e /api/parecer funcionam no ambiente serverless)
4. Obter chaves de API opcionais (Groq, Cerebras, OpenRouter) se quiser failover
5. Testar o chat no navegador com cenarios de disputa reais e ajustar prompt/politicas
6. Se necessario, substituir rate limit em memoria por limitador persistente
   (tabela Postgres ou Upstash) para cobrir multiplas instancias serverless
7. Validacao de coerencia via LLM esta implementada mas so roda quando a heuristica falha;
   avaliar ativacao permanente conforme custo de tokens

## Handoff para outra conta/sessao

- Repositorio: https://github.com/Caue2002/Kora
- Remote git configurado: `origin` -> https://github.com/Caue2002/Kora.git
- Branch de trabalho: `main` (commits diretos nela; nao ha PRs)
- **Ao final de qualquer tarefa: commitar e dar `git push origin main`.**
  Commits em portugues, titulo claro e descricao objetiva (padrao ja usado).
- Nunca commitar `.env` nem segredos; `.gitignore` ja cobre.
- CI: GitHub Actions roda typecheck + testes + build a cada push
  (.github/workflows/testes.yml) — push quebrado fica vermelho na aba Actions.
- Supabase: projeto `uzkiayjqcjztzrwestcg` — URL
  https://uzkiayjqcjztzrwestcg.supabase.co (Project Settings -> API)
- `.env` NAO vai para o Git (contem segredos): recriar a partir de
  `.env.example` com novas chaves de Supabase (service_role) e Gemini
- Estado do banco: tabelas/modelos/cotas/feedback ok; 9 politicas de disputa
  ingeridas (politicas_disputa_exemplo); migrations 0005, 0006 e 0007 pendentes
  de aplicacao manual no SQL Editor
- Para subir local: npm install + npm --prefix frontend install, preencher
  .env, rodar `npm run dev:api` (porta 3000) e `npm run dev:web` (porta 5173)

## Protocolo de handoff (troca de modelo/sessao)

Ao iniciar uma nova sessao, o agente deve:

1. Ler este arquivo e os documentos relevantes em docs/
2. Conferir o que esta pronto, em andamento, decisoes tomadas e pendencias
3. Retomar exatamente do proximo passo registrado, sem refazer etapas concluidas
