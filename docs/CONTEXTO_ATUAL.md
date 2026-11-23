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
- shared/: env, cliente Supabase, cliente LLM (Gemini/Groq/Pollinations),
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
- Rate limit por IP em duas camadas (shared/ratelimit.ts): persistente no
  Postgres via RPC verificar_rate_limit (migration 0008, janela fixa
  atomica compartilhada entre instancias) com fallback em memoria;
  chat 20/min, caso-get 60/min, caso 30/min, parecer 10/min, feedback 30/min
- Camadas de seguranca: validacao estrita de entrada (tamanho, enums,
  whitelist de MIME/tamanho de imagem ~3MB), conversaId validado por regex,
  prompt do sistema com regra anti-injecao, saida do LLM sanitizada por
  dominio, segredos apenas server-side, headers de seguranca no vercel.json
  (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy)
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
  (emblema azul glossy, fundo transparente); microfone de ditado movido
  para a esquerda do input
- Afinidade com o atendimento real do iFood: politicas de disputa
  reescritas no estilo das regras publicas do iFood (12 regras: tabela
  reembolsa/nao-reembolsa por seguranca alimentar, prazo de contestacao
  48h restaurantes / 7 dias demais verticais, evidencias exigidas —
  foto do item + embalagem + nota fiscal — e prazos de estorno por forma
  de pagamento); upload de foto como evidencia: botao clipe no input envia
  imagem base64 ao /api/chat, Gemini analisa visualmente (inline_data),
  provedores OpenAI-compat recebem nota textual; marcador de imagem entra
  na extracao do caso
- Seletor de perfil no chat vazio: Cliente / Vendedor parceiro / Entregador
  (cards com icone, persistido em localStorage); /api/chat aceita campo
  perfil e injeta contexto de solucao especifico por papel no prompt
- Acoes da mensagem (fontes, copiar, avaliar, ouvir) dentro da bolha em
  todas as respostas, menores e sempre visiveis a direita; voz do TTS
  prioriza vozes pt-BR naturais (Google/Microsoft/Amazon)
- Pedidos ficticios deterministicos: shared/pedidos.ts gera um pedido por
  hash do codigo informado (catalogo variado de 14 lojas); /api/chat responde
  a confirmacao sem LLM quando a mensagem e so o codigo, e injeta os dados
  no prompt quando ha relato de problema junto
- Pedido confirmado fica TRAVADO ate o fim da conversa: shared/pedidos.ts
  ganhou pedidoConfirmadoNaHistorico (detecta o codigo que o usuario confirmou
  com "sim"/"esse mesmo" apos a Nori apresenta-lo); /api/chat injeta os dados
  deterministicos do pedido travado com proibicao de troca e, se o usuario
  informar outro codigo, diretiva explicita de recusa ("esse pedido nao consta
  em seu nome"); prompt atualizado — correcao de pedido so e aceita ANTES da
  confirmacao final. Testes unitarios em tests/pedidos.test.ts
- Melhoria do pedido travado: o PRIMEIRO pedido confirmado pelo usuario
  vence (codigos posteriores nunca o substituem — evita falso positivo se o
  usuario disser "sim" apos uma recusa de troca); regex de confirmacao
  ampliado ("pode seguir", "ta certo", "blz", "bora", "manda ver"...) e de
  negacao ("errei", "outro pedido", "mentira"); Nori escrevendo "seu pedido
  e o X" tambem e detectado. Testes em tests/pedidos.test.ts (8 casos)
- Observabilidade, cache e persistencia (migration 0009 PENDENTE de aplicar
  no Supabase): metricas_chat grava 1 linha por request do /api/chat
  (modelo, provedor, stream, cache_hit, tokens, latencia_ms, fontes, perfil,
  erro) e GET /api/metricas devolve agregados via RPC metricas_chat_resumo;
  cache semantico conservador so para PRIMEIRA mensagem sem contexto (sem
  pedido, sem historico, sem pergunta temporal, sem imagem): embedding da
  mensagem e calculado UMA vez e reutilizado pela busca RAG e pelo cache
  (buscar_cache_resposta, score >= 0.95, validade 72h, perfil igual);
  tabela conversas espelha o historico no servidor (upsert por conversa_id
  a cada resposta; GET /api/conversa devolve as mensagens) — backup do
  localStorage, base para sync futura; GET /api/conversa e /api/metricas
  registradas no dev-server
- Acao real da conciliacao: quando o caso chega a etapa parecer/encerrado,
  /api/caso faz upsert em conciliacoes (conversa_id, categoria, status,
  resumo); /api/parecer aceita conversaId opcional e grava o texto do
  parecer na mesma tabela (unique por conversa_id)
- Retry de stream invisivel: streamComFailover agora le o PRIMEIRO chunk
  antes de responder — stream que abre e morre sem emitir byte aciona o
  proximo modelo da fila; o texto do stream e acumulado para alimentar
  cache/historico/metricas no fechamento
- Golden dataset de evals (tests/evals.test.ts): 6 cenarios com rubricas
  objetivas (item faltante, item errado, nao recebido, fora de escopo,
  politica, pedido travado) rodando contra a API real com credenciais
- Fluxo de encerramento conversacional: o prompt instrui a Nori a perguntar
  "Podemos encerrar a conversa?" quando o caso conclui; o frontend detecta a
  pergunta, mostra dica de timeout, intercepta respostas afirmativas ("sim",
  "pode encerrar"...) sem chamar o modelo e exibe o botao "Encerrar conversa";
  sem resposta em 3 minutos o caso encerra automaticamente. Ao encerrar
  (botao ou timeout), o app volta a tela inicial de escolha de perfil; a
  bolha do caso concluido fica salva na conversa e aparece no fim ao reabri-la
  pelo historico. O card do caso (timeline
  triagem>coleta>analise>parecer>encerrado, resumo, pendencias) so renderiza
  quando caso.etapa === 'encerrado' — durante a conversa ficam so as
  mensagens. Item "Encerrar atendimento" removido do menu "..."
- Input do chat virou textarea: Enter/tecla de enviar do teclado so insere
  quebra de linha; o envio acontece apenas pelo botao Enviar. Placeholder:
  "Fale com a Nori...". Foco automatico do input restrito a pointer:fine
  (desktop) — no mobile nao abre mais o teclado ao chegar resposta da Nori
- Botao de som removido do header (icone, estado kora-som e WebAudio)
- Otimizacao de latencia do /api/chat: selecionarModelo agora busca o consumo
  das cotas de todos os modelos em UMA query (antes era sequencial por
  modelo) e roda em paralelo com buscaHibrida + carregarDiretrizes usando
  estimativa antecipada de tokens; historico injetado no prompt limitado a
  2000 chars por mensagem. Deteccao da pergunta de encerramento tolera '?'
  em qualquer ponto da mensagem da Nori
- Skill .devin/skills/atualizar-documentacao: protocolo obrigatorio de
  atualizar docs/CONTEXTO_ATUAL.md (e docs relevantes) antes de commitar
- Comando direto de encerramento: mensagens como "encerre o chat", "quero
  encerrar", "pode encerrar" encerram a conversa na hora (sem botao e sem
  chamada ao modelo) e voltam a tela de perfis. Todo pedido de encerramento
  (comando, botao "Encerrar conversa" ou timeout de 3min) passa por uma tela
  "Encerrando..." com contagem regressiva de 3s antes de voltar a tela inicial
- Encerramento prematuro marcado como incompleto: POST /api/caso {encerrar}
  preserva pendencias/fatos/evidencias extraidos (antes zerava pendencias) e
  grava status "incompleto" quando a etapa anterior nao era parecer/encerrado;
  o card de encerrado exibe badge "Triagem incompleta" (ambar) ou "Encerrado"
- Foto como evidencia simplificada: o frontend nao envia mais a imagem ao
  modelo (sem analise visual); gera miniatura ~520px JPEG para exibir na bolha
  do usuario (campo Mensagem.imagem) e permite envio so com foto — o texto
  vira "Enviei uma foto como evidencia." O prompt instrui a Nori a pedir foto
  dizendo "envie qualquer imagem ou escreva enviei" e a apenas confirmar o
  recebimento, sem analisar o conteudo
- Regra de ouro no prompt: dados do Kora (politicas, prazos, valores, pedidos)
  so vem do contexto recuperado ou dos fatos do usuario — proibido inventar
- Conversa mais natural: temperatura do chat subiu para 0.4 (validacao de
  coerencia segue em 0.1); atalho deterministico de confirmacao de pedido
  removido — o modelo sempre confirma o pedido via LLM com dados injetados;
  prompt reescrito para tom caloroso, respostas adaptativas ao contexto e
  secao de mensagem final estruturada (decisao, motivo, proxima acao, pendencias)
- Layout desktop full-width: em telas >=720px o chat nao tem mais max-width
  de 720px e o padding lateral das mensagens caiu de 20% para 5%; mobile
  (<720px) permanece identico
- Catalogo de modelos ampliado para 6: dois Gemini extras de fallback
  (GEMINI_MODEL_3=gemini-2.5-flash, GEMINI_MODEL_4=gemini-2.0-flash) reusando
  os ids de cota 1 e 3 por compartilharem a mesma API key/quota; Pollinations
  virou prioridade 6. Ordem: gemini-3.1-flash-lite > groq > gemini-3.5-flash >
  gemini-2.5-flash > gemini-2.0-flash > pollinations
- Respostas longas da Nori colapsadas por padrao (>1100 chars) com botao
  "Ver mais/Ver menos" (componente TextoAssistente em App.tsx); ao fim do
  streaming a tela alinha o TOPO da ultima mensagem da Nori para leitura
  comecar do inicio
- Anti-recusa do agente: o modelo as vezes respondia perguntas meta
  ("o que voce sabe fazer?") ou de conhecimento geral com frases de
  incapacidade ("nao consegui responder agora"). Correcao em 3 camadas:
  prompt ganhou secao de capacidades, escopo de conhecimento geral
  respondido com o proprio conhecimento do modelo (a REGRA DE OURO passa
  a valer so para dados do Kora) e instrucao de identificar a intencao da
  mensagem antes de responder; coherence/validacao.ts ganhou
  ehRespostaDeRecusa (regex de incapacidade generica, ignora limites
  legitimos como "nao posso cancelar pedidos"); /api/chat trata recusa
  como falha de validacao — regenera uma vez com instrucao especifica e,
  se persistir, devolve RESPOSTA_FALLBACK (aviso de dificuldade + o que a
  Nori faz). Cache semantico nao serve nem grava respostas de recusa nem
  o fallback (inclusive entradas ja envenenadas sao ignoradas na leitura).
  Streaming nao tem validacao pos-geracao — a correcao depende do prompt
- Resiliencia a provedores pendurados: chamadas LLM e de embedding ganharam
  timeout (AbortSignal.timeout, LLM_TIMEOUT_MS=25s padrao; handshake do
  stream aborta so se os headers nao chegarem, sem limitar a duracao do
  SSE). Antes um fetch sem timeout podia segurar a request por 300s ate o
  undici desistir — na Vercel a function morria antes e o usuario via
  "Tentar novamente". Embedding tem timeout fixo de 10s
- Mensagens casuais pulam o RAG: coherence/intencao.ts (ehMensagemCasual)
  detecta mensagens compostas so de cortesia/reacao leve ("muito obrigado",
  "oi, tudo bem?", "valeu, flw") por whitelist de palavras normalizadas;
  quando casual e sem pedido/codigo/imagem, /api/chat nao chama
  buscaHibrida (menos uma round-trip, sem fontes irrelevantes na bolha) e
  injeta instrucao de resposta leve no lugar do contexto RAG
- Frontend: falha transitoria de rede/stream na primeira tentativa dispara
  um retry silencioso automatico (~1.2s) limpando o stream parcial antes
  de exibir o erro — cobre streams que morrem no meio por timeout da
  function
- Varredura de resiliencia (causa do "nao consegue responder" persistente):
  o frontend SEMPRE usa stream:true, entao a guarda anti-recusa so valia
  no modo nao-stream — o stream agora retem os primeiros ~220 bytes e, se
  detectar recusa generica ou resposta vazia, descarta e regenera via
  failover antes de enviar ao usuario (respostas normais seguem token a
  token sem latencia extra). Catalogo de modelos saneado: gemini-2.5-flash
  e gemini-2.0-flash retornavam 404 (descontinuados) — defaults agora sao
  gemini-3.8-flash e gemini-3.5-flash-lite (unico que respondeu 200 na
  verificacao); ATENCAO: se GEMINI_MODEL_3/4 estiverem definidos na Vercel
  com nomes antigos, atualizar para os novos. Quando TODOS os provedores
  falham, /api/chat devolve RESPOSTA_FALLBACK com 200 (stream e normal)
  em vez de 502 — a falha segue registrada em metricas_chat
- Timeout de 10s em todas as chamadas PostgREST (shared/supabase.ts):
  banco pendurado nao segura mais a request do chat
- Correcao de itens do pedido na confirmacao: o catalogo ficticio
  (shared/pedidos.ts) so fornece loja/valor; os ITENS confirmados sao os
  que o USUARIO descreveu na conversa — prompt.ts e a instrucao injetada
  em dadosPedido agora dizem explicitamente que a descricao do usuario
  prevalece na confirmacao e que correcoes pre-confirmacao valem ate o
  fim da conversa (antes a Nori podia "inventar" itens do catalogo ao
  confirmar um pedido que o usuario descreveu com outros itens)
- Segunda rodada de latencia: LLM_TIMEOUT_MS padrao 25s -> 15s por
  tentativa (modelo saudavel responde em <10s); timeout do PostgREST
  10s -> 5s; buscaHibrida agora dispara em paralelo com selecao de
  modelo/diretrizes/cache (depende so do embedding, que ja era
  calculado antes); streamComFailover limita a espera do PRIMEIRO chunk
  a timeoutLlmMs (antes um stream que abria os headers e nunca emitia
  byte ficava pendurado para sempre — o handshake so cobria os headers);
  marcarEsgotado virou fire-and-forget nos dois loops de failover (a RPC
  de cota nao atrasa a tentativa ao proximo modelo)
- Terceira rodada de latencia do /api/chat: rate limit (RPC Postgres) e
  leitura do body passam a rodar em paralelo; mensagem casual no meio da
  conversa pula a chamada de embedding do Gemini (nao usa RAG nem cache);
  carregarDiretrizes ganhou cache em memoria (60s sucesso / 15s falha);
  selecionarModelo cacheia o consumo de cotas por 10s (marcas de esgotado
  locais continuam valendo); registrarConsumo grava as 3 janelas em
  paralelo em vez de sequencial

## Em andamento

- Deploy em producao na Vercel: projeto renomeado para `nori-agente-ai`.
  ATENCAO: renomear o projeto NAO troca o dominio `.vercel.app` — o dominio
  de producao precisa ser removido/adicionado em Settings > Domains do
  projeto (kora-frontend-jade.vercel.app seguia ativo apos o rename)
- Migrations 0005-0008 aplicadas no Supabase via arquivo combinado
  `_rodar_uma_vez_0005_0008.sql`
- **Migration 0009_melhorias_observabilidade.sql PENDENTE**: criar no
  Supabase SQL Editor as tabelas metricas_chat, cache_respostas, conversas,
  conciliacoes e as funcoes buscar_cache_resposta, metricas_chat_resumo.
  Sem ela tudo degrada em silencio (cache/metricas/historico/conciliacao
  viram no-op com warn no log)

## Decisoes tecnicas tomadas

- Ver docs/DECISOES.md (D01 a D09)
- Resumo: Vite+React frontend, Vercel Functions Node/TS em api/, shared/ para
  logica de servidor, Gemini principal + Groq/Gemini/Pollinations contingencia,
  embeddings gemini-embedding-001 em 1536 dimensoes

## Pendencias (proximos passos, em ordem)

1. ~~Aplicar migrations 0005-0008~~ FEITO (via `_rodar_uma_vez_0005_0008.sql`)
2. ~~Deploy na Vercel~~ FEITO: projeto `nori-agente-ai`
   (Root Directory = raiz do repo; env vars SUPABASE_URL,
   SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GROQ_API_KEY)
3. Testar o chat em producao com cenarios de disputa reais e ajustar
   prompt/politicas conforme necessario
4. Endurecer abuso: Cloudflare Turnstile (gratuito, sem login) e/ou
   lista de dominios permitidos no CORS se o site for embutido
5. Validacao de coerencia via LLM esta implementada mas so roda quando a heuristica falha;
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
- Estado do banco: tabelas/modelos/cotas/feedback/casos/rate_limits ok;
  9 politicas de disputa ingeridas (politicas_disputa_exemplo);
  migrations 0005-0008 aplicadas via `_rodar_uma_vez_0005_0008.sql`
- Deploy Vercel: functions Node recebem (req,res); shared/http.ts adapta
  para Web Request/Response (imports relativos usam extensao .js pois a
  Vercel transpila TS->JS por arquivo sem bundlear)
- Para subir local: npm install + npm --prefix frontend install, preencher
  .env, rodar `npm run dev:api` (porta 3000) e `npm run dev:web` (porta 5173)

## Protocolo de handoff (troca de modelo/sessao)

Ao iniciar uma nova sessao, o agente deve:

1. Ler este arquivo e os documentos relevantes em docs/
2. Conferir o que esta pronto, em andamento, decisoes tomadas e pendencias
3. Retomar exatamente do proximo passo registrado, sem refazer etapas concluidas
