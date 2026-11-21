# CONTEXTO_ATUAL.md

Arquivo dedicado ao estado atual do desenvolvimento do Projeto Kora (Agente Nori).
Atualizar obrigatoriamente ao final de cada tarefa concluída.

## Fase atual

Scaffold V1 implementado: estrutura completa do projeto com frontend de chat,
endpoints de API, modulos RAG/coherence/shared e schema do banco.
Aguardando validacao local (npm install/test/build) e configuracao de credenciais.

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
- Conjunto fixo de cenarios de teste (tests/cenarios.test.ts): completo,
  incompleto/ambiguo, contraditorio e fora do escopo — 20 testes passando
- Validacao: typecheck limpo, 20 testes ok, vite build ok, streaming e
  /api/parecer testados ao vivo contra Gemini+Supabase

## Em andamento

- Nenhuma implementacao em curso; aguardando migration 0005 no Supabase e deploy

## Decisoes tecnicas tomadas

- Ver docs/DECISOES.md (D01 a D09)
- Resumo: Vite+React frontend, Vercel Functions Node/TS em api/, shared/ para
  logica de servidor, Gemini principal + Groq/Cerebras/OpenRouter contingencia,
  embeddings gemini-embedding-001 em 1536 dimensoes

## Pendencias (proximos passos, em ordem)

1. Aplicar database/migrations/0005_feedback_comentario.sql no SQL Editor do Supabase
2. Deploy na Vercel: criar projeto, configurar as mesmas variaveis de ambiente
   do .env no painel da Vercel e fazer deploy do repositorio
   (verificar se streaming e /api/parecer funcionam no ambiente serverless)
3. Obter chaves de API opcionais (Groq, Cerebras, OpenRouter) se quiser failover
4. Testar o chat no navegador com cenarios reais da Kora e ajustar prompt/regras
5. Se necessario, substituir rate limit em memoria por limitador persistente
   (tabela Postgres ou Upstash) para cobrir multiplas instancias serverless
6. Validacao de coerencia via LLM esta implementada mas so roda quando a heuristica falha;
   avaliar ativacao permanente conforme custo de tokens
7. Substituir as 7 regras de exemplo pelas politicas operacionais reais da Kora
   quando disponiveis (atualizar conhecimento_chunks via script de ingestao)

## Protocolo de handoff (troca de modelo/sessao)

Ao iniciar uma nova sessao, o agente deve:

1. Ler este arquivo e os documentos relevantes em docs/
2. Conferir o que esta pronto, em andamento, decisoes tomadas e pendencias
3. Retomar exatamente do proximo passo registrado, sem refazer etapas concluidas
