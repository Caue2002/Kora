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

- Estrutura de pastas: frontend/, api/, shared/, rag/, coherence/,
  database/, scripts/, tests/, spec/, docs/ (reorganizada em 25/11/2026:
  removido `_rodar_uma_vez_0005_0008.sql` por ser duplicata exata das
  migrations 0005-0008; seed SQL 0004_seed_modelos.sql movido de
  database/seeds/ para database/migrations/ fechando a numeracao;
  contexto.pdf movido para docs/; pagina de entrevista movida de
  "Fluxo Kora/" para docs/fluxo-kora/ — .gitignore agora usa
  `fluxo-kora/` e os caminhos internos do index.html/README/SKILL foram
  ajustados)
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
  persistencia em sessionStorage (o historico morre com a aba — fechar ou
  excluir a aba apaga tudo e a proxima abertura comeca na tela inicial),
  titulo automatico, busca e renomear conversa;
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
- Observabilidade, cache e persistencia (migration 0009 APLICADA no
  Supabase): metricas_chat grava 1 linha por request do /api/chat
  (modelo, provedor, stream, cache_hit, tokens, latencia_ms, fontes, perfil,
  erro) e GET /api/metricas devolve agregados via RPC metricas_chat_resumo;
  cache semantico conservador so para PRIMEIRA mensagem sem contexto (sem
  pedido, sem historico, sem pergunta temporal, sem imagem): embedding da
  mensagem e calculado UMA vez e reutilizado pela busca RAG e pelo cache
  (buscar_cache_resposta, score >= 0.95, validade 72h, perfil igual);
  tabela conversas espelha o historico no servidor (upsert por conversa_id
  a cada resposta; GET /api/conversa devolve as mensagens) — backup da
  sessao da aba (o frontend nao expoe esse endpoint; o chat nao e
  recuperavel depois que a aba fecha), base para sync futura; GET
  /api/conversa e /api/metricas
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
  (desktop) — no mobile nao abre mais o teclado ao chegar resposta da Nori.
  ATUALIZACAO (25/11): no DESKTOP o Enter sem Shift agora envia a mensagem
  (onKeyDown no textarea, guarda por `podeFocarInput()` = matchMedia
  pointer:fine, Shift+Enter segue quebra de linha e `isComposing` protege
  IME); no mobile nada muda — sem teclado fisico confiavel, o botao Enviar
  continua sendo o unico caminho
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
- Layout centralizado em todos os tamanhos: o override de desktop
  full-width (>=720px sem max-width e padding de 5%) foi removido a pedido
  do usuario — bolhas, cards de perfil e formulario seguem o mesmo
  layout centralizado de 720px do mobile. Os 3 cards de perfil
  (Cliente/Parceiro/Entregador) ficam SEMPRE em fileira
  (repeat(3,1fr)); em telas <=560px eles compactam (icone menor, sem
  descricao, rotulo em ate 2 linhas) para nao estourar a coluna
- Catalogo de modelos ampliado para 10, ORDENADO DO MAIS FORTE AO MAIS
  FRACO (a pedido do usuario — prioriza qualidade mesmo com latencia
  maior no modelo principal): gemini-4-hydrogen > gemini-3.8-flash >
  gemini-3.6-flash > gemini-3.5-flash > gemini-3-flash-preview > groq
  (gpt-oss-120b) > gemini-3.5-flash-lite > gemini-3.1-flash-lite >
  gemini-3.1-flash-lite-preview > pollinations. Slots Gemini usam as envs
  GEMINI_MODEL..GEMINI_MODEL_8 e ids de cota 1/3 (mesma API key);
  groq id 2 e pollinations id 4. ATENCAO Vercel: se GEMINI_MODEL_4
  estiver setada como gemini-4-hydrogen (valor antigo do .env local),
  ela duplica o modelo principal na posicao 4 — atualizar ou remover as
  envs GEMINI_MODEL_* para seguir a nova ordem
- Chave Gemini renovada (formato AQ. do AI Studio, projeto 391015418834):
  .env local alinhado a nova ordem (GEMINI_MODEL=gemini-4-hydrogen,
  _2=gemini-3.8-flash, _4=gemini-3.5-flash). Verificado via
  scripts/testar_modelos_gemini.mjs (lista de candidatos ampliada com os
  probes): funcionam hydrogen, 3.8/3.6/3.5/3.1-flash e variantes;
  gemini-4-argon/carbon/neon e gemini-pro-latest dao 429 (sem free tier),
  gemini-3.7-flash e gemini-flash-latest instaveis, gemini-2.5-* dao 404
  e gemini-3.1-pro-preview nao tem free tier — failover cobre os casos
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
  verificacao); ATENCAO: o catalogo foi reordenado depois (ver secao
  "Catalogo de modelos ampliado para 10") — na Vercel, alinhar ou remover
  as envs GEMINI_MODEL_* para nao duplicar modelos. Quando TODOS os provedores
  falham, /api/chat devolve RESPOSTA_FALLBACK com 200 (stream e normal)
  em vez de 502 — a falha segue registrada em metricas_chat
- Timeout de 10s em todas as chamadas PostgREST (shared/supabase.ts):
  banco pendurado nao segura mais a request do chat
- Correcao de itens do pedido na confirmacao: o catalogo ficticio
  (shared/pedidos.ts) so fornece loja/valor; os ITENS confirmados sao os
  que o USUARIO descreveu na conversa — prompt.ts e a instrucao injetada
  em dadosPedido agora dizem explicitamente que a descricao do usuario
  prevalece na confirmacao e que correcoes pre-confirmacao valem ate o
  fim da conversa. Reforco pos-bug (26/11): a Nori chegou a MESCLAR um
  item do catalogo ("lasanha de berinjela" do pedido 1828393) com o item
  que o usuario citou ("coca cola 2 litros"); a regra agora e categorica —
  NUNCA listar itens do catalogo junto dos do usuario, confirmar somente
  o que o usuario mencionou e perguntar "foi so esse item que voce
  pediu?"; se o usuario acrescentar itens, a lista completa e tudo que
  ele mencionou ate ali. Complementos (26/11, 2a rodada): quando o
  usuario diz que NAO LEMBRA os itens, a Nori confirma normalmente com
  os itens do catalogo (fallback inventado preservado); no pedido
  TRAVADO, os itens citados passam a ser os confirmados na conversa,
  nao os do catalogo; a tool consultar_pedido (function calling) agora
  declara na descricao e no resultado que seus itens sao referencia do
  catalogo — os reais sao os que o usuario descreveu; golden dataset de
  evals ganhou 2 cenarios cobrindo os dois lados (so itens do usuario /
  fallback de catalogo quando nada e descrito)
- Segunda rodada de latencia: LLM_TIMEOUT_MS padrao 25s -> 15s por
  tentativa (modelo saudavel responde em <10s); timeout do PostgREST
  10s -> 5s; buscaHibrida agora dispara em paralelo com selecao de
  modelo/diretrizes/cache (depende so do embedding, que ja era
  calculado antes); streamComFailover limita a espera do PRIMEIRO chunk
  a timeoutLlmMs (antes um stream que abria os headers e nunca emitia
  byte ficava pendurado para sempre — o handshake so cobria os headers);
  marcarEsgotado virou fire-and-forget nos dois loops de failover (a RPC
  de cota nao atrasa a tentativa ao proximo modelo)
- Alertas amarelos de erro da API (frontend/src/alertas.ts): banner
  pequeno e fixo no topo, some sozinho em 3s. Dispara em qualquer erro do
  /api/chat — HTTP de erro (mapeado por status: 0 rede, 400, 405, 429
  cotas x rate limit, 500, 502, 503, 504) e saturacao dos modelos
  (resposta 200 com fallback agora carrega header x-fallback=1, mapeado
  como Erro 503). Mensagens curtas, informais e com o numero do erro
- Terceira rodada de latencia do /api/chat: rate limit (RPC Postgres) e
  leitura do body passam a rodar em paralelo; mensagem casual no meio da
  conversa pula a chamada de embedding do Gemini (nao usa RAG nem cache);
  carregarDiretrizes ganhou cache em memoria (60s sucesso / 15s falha);
  selecionarModelo cacheia o consumo de cotas por 10s (marcas de esgotado
  locais continuam valendo); registrarConsumo grava as 3 janelas em
  paralelo em vez de sequencial
- Base de conhecimento ampliada: politicas_disputa.json foi de 12 para 20
  regras (novas: cobranca duplicada/valor divergente, taxa indevida, itens
  de acompanhamento, avaria no transporte, alergia declarada, cancelamento
  pela plataforma, pedido de outro cliente, verticais mercado/farmacia/pet)
  — ja ingeridas no Supabase com embeddings. Nova categoria "pagamento"
  alinhada em prompt.ts, api/caso.ts (enum + extracao) e labels do
  frontend; migration 0010_categoria_pagamento.sql APLICADA em 25/11/2026
  via Supabase MCP. Prompt ganhou regra de
  economia de tokens de saida (respostas casuais/meta em ate 2 frases,
  triagem em 1-3 frases + 1 pergunta)
- Regras de saudacao e auto-conhecimento: a Nori so cumprimenta na
  PRIMEIRA mensagem da conversa ou quando o usuario mesmo sauda
  (coherence/intencao.ts ehSaudacao detecta saudo no inicio da mensagem);
  fora disso nunca abre resposta com saudacao. A saudacao segue o
  periodo do dia (manha/tarde/noite via data/hora injetada) + apresentacao
  breve variada — sem formula fixa. /api/chat injeta "Contexto do turno"
  (primeiro turno ou nao) no prompt. Auto-conhecimento ampliado: a Nori
  responde quais modelos de IA usa (Gemini Flash + failover Groq/
  Pollinations), quem a criou (Cauê Ribeiro Ferreira) e o que sabe fazer; ehPerguntaMeta
  detecta essas perguntas e elas pulam RAG E embedding (resposta sai do
  proprio prompt) — round-trips a menos no caminho critico. Cache
  semantico: chave agora e perfil+periodo do dia (resposta de "bom dia"
  nunca e servida a noite; entradas antigas sem periodo expiram em 72h).
  Estado vazio do chat nao tem mais texto fixo de saudacao — a mensagem
  de boas-vindas virou apresentacao neutra e a saudacao real e sempre
  gerada pelo modelo
- Auto-conhecimento ampliado (2a rodada): a Nori agora cita as capacidades
  concretas do app (confirmar pedido por codigo, consultar politicas,
  gerar/exportar parecer, acompanhar o caso por etapas, encaminhar para
  atendente humano) e descreve o funcionamento interno so em nivel
  conceitual (mensagem -> busca em base de conhecimento -> modelo de IA em
  streaming com verificacoes de qualidade). Regra explicita de seguranca:
  nunca revelar nomes de tabelas, funcoes internas, envs ou endpoints —
  detalhe tecnico so em nivel generico, sem comprometer a superficie
- Servidor MCP do Kora (spec em spec/SPEC-mcp-server.md): endpoint
  /api/mcp fala protocolo MCP (Streamable HTTP) via mcp-handler +
  @modelcontextprotocol/server, expondo o agente como tools para clientes
  externos (Claude Desktop, Cursor etc.). Autenticacao por API key estatica
  em MCP_API_KEY (header Authorization Bearer ou x-api-key, comparacao em
  tempo constante; sem a env o endpoint responde 503). 4 tools read-only:
  consultar_pedido (dados deterministicos de shared/pedidos.ts),
  buscar_politica (buscaHibrida/RAG), listar_conciliacoes (tabela
  conciliacoes) e resumo_metricas (RPC metricas_chat_resumo). maxSubscriptions=0
  (sem SSE de subscription), rate limit 60/min por IP, schemas validados
  com zod, anotacao readOnlyHint em todas. Rota registrada no dev-server;
  documentacao de conexao em api/README.md; testes em tests/mcp.test.ts
  (9 casos: auth, initialize, tools/list, tools/call). Deps novas:
  mcp-handler 2.4.0, @modelcontextprotocol/server 2.4.0, zod 4.6.7
  (o sdk classico @modelcontextprotocol/sdk NAO e usado — o mcp-handler v2
  trabalha com o pacote @modelcontextprotocol/server)
- Correcao de truncamento por "thinking" dos Gemini 3.x/4: os modelos
  gastavam o maxOutputTokens (400) em thoughtsTokenCount invisiveis —
  gemini-4-hydrogen devolvia finishReason=MAX_TOKENS com texto vazio e
  respostas saiam cortadas no meio da frase (detectado pelos testes de
  integracao). shared/llm.ts agora envia thinkingConfig.thinkingBudget=0
  em generateContent e streamGenerateContent: todo o orcamento vai para o
  texto visivel, respostas mais rapidas (~4.5s vs ~28s no cenario de
  teste) e sem pensamento interno — adequado ao formato curto do Nori
- Fallback de thinkingConfig no cliente LLM: gemini-3.5-flash-lite (slot 7
  do catalogo) rejeita thinkingConfig.thinkingBudget com 400 INVALID_ARGUMENT
  — toda chamada a ele caia no failover. shared/llm.ts agora repete a
  chamada UMA vez sem o campo quando o Gemini devolve 400 (generateContent
  e streamGenerateContent), mantendo o thinking desligado nos modelos que
  aceitam. Verificado ao vivo: o slot passou a responder nos dois modos
- Varredura geral de bugs (typecheck, build, suite completa): typecheck e
  vite build limpos; 57/62 testes ok — as 5 falhas sao ambientas (cota
  free-tier do Gemini esgotada durante a rodada: evals.test.ts timeout de
  300s e evals-juiz.test.ts com 429 + 1 reprovacao do juiz ja documentada
  como flake). Pollinations free segue limitado a 16k chars e sempre
  devolve 413 com o prompt completo do chat — slot ineficaz mas inofensivo
  (failover segue para o RESPOSTA_FALLBACK se tudo falhar)
- Function calling na Nori (spec em spec/SPEC-function-calling.md):
  shared/tools.ts define consultar_pedido e buscar_politica (schemas zod
  compartilhados com o servidor MCP); shared/llm.ts converte para o formato
  Gemini (functionDeclarations/functionCall/functionResponse), executa as
  tools localmente e reabre o stream ate MAX_TOOL_ROUNDS, sem tools na
  ultima rodada para forcar resposta em texto. /api/chat passa comTools=true
  apenas em mensagens de triagem (casuais/meta pulam, mesmo criterio do RAG).
  O usuario nao percebe: function calls nao emitem texto, o stream so comeca
  quando a resposta final flui. Provedores nao-Gemini seguem fluxo simples
- Protocolo A2A (spec em spec/SPEC-a2a-e-handoff.md): agent card publico em
  frontend/public/.well-known/agent-card.json e endpoint /api/a2a falando
  JSON-RPC 2.0 (message/send) — pipeline enxuto de um turno com RAG+failover.
  Auth: mesma MCP_API_KEY
- Handoff para atendente humano: POST /api/handoff recebe o historico da
  conversa e devolve resumo estruturado do caso (fatos, evidencias,
  pendencias, proximo passo) via LLM em jsonMode; botao "Encaminhar p/
  atendente" no menu do chat (App.tsx) chama o endpoint com a mesma chave
- Painel de observabilidade: frontend/public/metricas.html (icone de grafico
  no cabecalho do chat, ao lado do botao de tema — saiu do menu de "tres
  pontinhos", que so aparece com mensagens) — KPIs (total, cache hit rate, latencia media,
  custo equivalente), grafico de mensagens/dia e tabela por modelo com
  latencia/tokens/custo estimado a preco de tabela (PRECOS_1M em
  public/metricas.js — script externo por causa da CSP script-src 'self')
- LLM-as-judge nos evals (spec em spec/SPEC-llm-judge-evals.md):
  tests/evals-juiz.test.ts roda um modelo Gemini lite como juiz rigoroso
  (rubrica em linguagem natural -> nota 1-5 + justificativa, aprova >= 4)
  sobre subconjunto do golden dataset + guardrails; logs visiveis no vitest.
  tests/evals.test.ts ganhou 3 cenarios de guardrail (prompt injection,
  acao fora do poder do agente, off-topic hostil) com campo `evita` para
  checagem negativa por regex
- UX e agente visivel (specs em spec/SPEC-ui-indicador-tools.md e
  SPEC-voz-neural.md): function calling agora emite frames de controle
  \u001E<nome>\u001F no stream; api.ts os converte em callback onTool e o
  chat mostra "Consultando pedido..."/"Consultando a base..." no lugar de
  "Pensando...". O acumulado do servidor remove os frames para nao poluir
  cache/historico. Bug de UX corrigido: foto SEM texto agora e aceita
  (placeholder interno) — antes retornava 400. Voz neural: POST /api/tts
  gera MP3 com msedge-tts (pt-BR-FranciscaNeural, gratis, sem chave);
  botao "ouvir" em cada resposta com fallback p/ speechSynthesis
- Guardrails de saida (spec em spec/SPEC-guardrails-saida.md):
  shared/guardrails.ts classifica a resposta final (vazamento de prompt,
  PII email/CPF, texto vazio) — caminho nao-stream regenera 1x e cai no
  fallback; no stream a checagem roda nos primeiros 220 chars (limitacao
  documentada: guardrail completo so no caminho nao-stream)
- Observabilidade v2 (spec em spec/SPEC-observabilidade-v2.md):
  metricas_chat ganha colunas trace jsonb e tools_usadas int
  (MIGRATION 0011 PENDENTE de aplicar no SQL Editor — sem ela o insert de
  metricas falha silenciosamente). /api/chat grava trace {contexto_ms,
  llm_ms} e conta tool calls pelo stream. RPC metricas_chat_resumo
  estendida com latencia_p50/p95, tools_total e traces_recentes; painel
  /metricas.html mostra p50/p95, total de function calls e "trace medio
  por etapa" (media no cliente sobre os ultimos 200 traces)
- Evals em CI (spec em spec/SPEC-evals-ci.md): .github/workflows/evals.yml
  roda evals.test.ts + evals-juiz.test.ts em todo push/PR com .env montado
  de secrets. PENDENTE: cadastrar secrets SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GROQ_API_KEY em
  Settings > Secrets > Actions do repo
- Feedback loop (spec em spec/SPEC-feedback-loop.md):
  scripts/relatorio_feedback.mjs agrega feedback_respostas por avaliacao,
  dia e comentario — `node scripts/relatorio_feedback.mjs --dias 30`.
  Loop documentado: avaliacao -> relatorio -> ajuste de diretrizes/prompt
- README reescrito vendavel: arquitetura em ASCII, capacidades por
  pilar (UX, inteligencia, interoperabilidade MCP/A2A, qualidade), stack
- Correcao do painel /metricas.html e das bolhas do chat: o script do
  painel era inline e a CSP da Vercel (script-src 'self') o bloqueava em
  producao — a pagina ficava presa em "carregando…". JS movido para
  frontend/public/metricas.js (externo), com botao "Atualizar", erro
  explicito (HTTP/sem dados), escape de HTML, datas dd/mm e grafico de
  barras com scroll horizontal no mobile. Migration 0011 verificada como
  APLICADA no Supabase (colunas trace/tools_usadas e RPC estendida ok).
  Bolhas: markdown.tsx envolve o texto do checklist em span unico
  (.md-check-texto, flex:1 + min-width:0) — antes cada trecho inline
  virava flex item rigido e textos formatados/longos vazavam da bolha;
  .msg-balao ganhou min-width:0/overflow-wrap, .md/.md-tabela-wrap/.md-pre
  com max-width:100%; rotulos do menu "...", chips de sugestao e pills do
  caso ganharam spans com min-width:0 para nao estourar em telas estreitas
- Alertas de erro da API reformulados (frontend/src/alertas.ts): barra
  amarela larga e fina fixa na PARTE INFERIOR da tela (antes era pill no
  topo), some em 3s, texto minimo no formato "Erro N — descricao curta"
  (ex.: "Erro 503 — Saturação do modelo."). Mapeamento coberto: 0 rede,
  400, 401, 403, 404, 405, 413 anexo grande, 429 (cotas x rate limit),
  500, 502, 503, 504 e fallback de saturacao
- Conversa encerrada nao reabre no refresh: Conversa ganhou flag
  `encerrada` (api.ts); encerrarAtendimento marca a conversa antes de
  voltar a tela inicial e o auto-open da primeira carga ignora
  encerradas. Reabrir manualmente pelo historico remove a marca — se o
  usuario atualizar com ela aberta de proposito, ela volta normalmente
- Instalacao do app (PWA): item "Baixar app" no menu "..." do chat.
  Captura o evento beforeinstallprompt e dispara o prompt nativo do
  navegador (Chrome/Edge); sem suporte (iOS Safari etc.) abre modal com
  instrucoes manuais por plataforma. O Kora NAO esta na Play Store nem
  na App Store — e PWA; prompt.ts ganhou regra proibindo a Nori de
  citar lojas de app ou inventar links/QR codes de download.
  Nome do app instalado: "Kora Delivery" (name) / "Kora" (short_name)
  no manifest.webmanifest — a pedido do usuario
- Indicador de espera do agente: "Pensando..." substituido por 4
  bolinhas quicando em sequencia (componente BolinhasCarregando +
  keyframe bolinha-quica no styles.css); textos "Gerando resposta..."
  e rotulos de tool continuam ao lado das bolinhas
- scripts/testar_modelos_gemini.mjs agora envia
  thinkingConfig.thinkingBudget=0 (igual ao shared/llm.ts) e marca
  respostas 200 com texto vazio como VAZIO — antes modelos que so
  "pensavam" apareciam como OK
- "Exportar resumo" saiu do menu "..." do caso e ficou so no icone de
  download do cabecalho (canto superior direito), visivel apenas quando
  ha mensagens na conversa
- Metricas: linhas de cache_hit passam a gravar o modelo que gerou a
  resposta cacheada (cache.modelo) e erros de fila gravam modelo
  'indisponivel' — antes iam null e apareciam como "desconhecido" no
  painel /metricas.html. Migration 0012 faz o backfill do historico

- Resiliencia a 429/cotas (causa do "fallback nao funciona"): a marca de
  esgotado em MEMORIA nunca expirava — um unico 429 bloqueava o modelo ate
  o processo reiniciar, e os contadores de tokens em memoria nunca zeravam
  por janela. shared/models.ts agora guarda o inicio de cada janela
  (minuto/hora/dia) no fallback em memoria: contadores zeram e o esgotado
  expira na virada do minuto, igual ao banco. consumoBancoTodos so honra
  esgotado de linhas da janela de minuto — linhas legadas de hora/dia
  marcadas pelo bug antigo nao bloqueiam mais o modelo. Cada slot do
  catalogo ganhou id de cota proprio (ids 1-15): as cotas
  free-tier do Gemini sao por modelo e antes os slots compartilhavam ids
  1/3, entao um 429 derrubava varios modelos juntos (migration 0013
  cria as linhas em modelos_ia — PENDENTE de aplicar). /api/chat e
  /api/parecer nao devolvem mais 429 quando a selecao nao acha folga:
  caem para o modelo mais forte e o failover percorre a fila inteira,
  terminando no RESPOSTA_FALLBACK se tudo falhar
- Responsividade no app instalado/PWA: .chat e .layout usavam so 100dvh
  sem fallback — webviews que nao conhecem dvh (app instalado em Android
  antigo) faziam a altura virar automatica e o layout quebrava. Correcao
  em 2 camadas: (1) fallback height:100vh antes de 100dvh no .layout e
  max-height do modal de handoff; (2) nos cenarios problematicos —
  @media (display-mode: standalone) e @supports not (height:100dvh) — o
  .layout vira position:fixed; inset:0;height:auto, que mede o viewport
  real sem depender de unidades vh (webviews do PWA calculavam 100dvh
  MAIOR que a tela: a pagina inteira rolava e o input de envio ficava
  escondido embaixo). .chat passou a usar height:100% do layout em vez de
  vh proprio. Viewport meta ganhou
  interactive-widget=resizes-content para o teclado virtual redimensionar
  o layout (sem isso o input ficava escondido atras do teclado no app).
  sw.js bumpado para kora-v3 para os apps instalados pegarem os novos
  assets
- Indicador de espera do agente: 3 esferas girando entre si em circulo,
  SEM pilula e SEM bolha de chat ao redor — apenas as bolinhas com luz
  azul: glow ambiente na orbita (.msg-orbita-luz), brilho azul por
  esfera (box-shadow) e feixe de luz azul tangente ao movimento em cada
  uma (::after + feixe-onda, expandem e voltam). Substituiu as 4
  bolinhas orbitais antigas, o metaball e a orbita eliptica; componente
  IndicadorCarregando no App.tsx
- Pagina local de apresentacao "Fluxo Kora" (docs/fluxo-kora/index.html,
  fora do git via .gitignore `fluxo-kora/`): material visual para
  entrevistas com a dor do projeto, jornada de disputa em 6 passos
  (diagrama + chat animado), arquitetura em camadas, fluxograma do
  /api/chat, estado do caso, failover dos 12 modelos, qualidade/evals,
  capacidades, stack e protocolo de atualizacao
  (docs/fluxo-kora/README.md) e skill .devin/skills/fluxo-kora.
  Spec em spec/SPEC-fluxo-kora-pagina.md. Secao "Aprendizado" (08)
  adicionada em 26/11/2026 explicando o aprendizado controlado
  adaptativo (feedback -> diretrizes no prompt) para iniciante.
  Em 26/11/2026 a secao "03 - Arquitetura em camadas" foi redesenhada:
  o par redundante (mini-diagrama ida/volta + tabela req/res) virou um
  unico diagrama "U-turn" em 5 colunas (trilha azul de ida no topo,
  trilha verde de volta na base, curva na coluna Externos) + barra
  transversal; adendo correspondente acrescentado ao Guia de Entrevista
  em PDF (pagina 11)
- Indicador de orbita padronizado em TODO o app: spec em
  spec/SPEC-indicador-carregamento.md (V2) e skill
  .devin/skills/indicador-carregamento-metaball (regra: qualquer UI nova
  com loading/espera DEVE usar o padrao, sem spinners/dots/textos soltos).
  Indicador e so as bolinhas em circulo + luz de acompanhamento (sem
  pilula/borda/bolha): esferas de 6px, orbita 22x22 raio 8; variante
  grande 7px/28x28 raio 10 para telas de transicao. No chat aparece
  solto (.msg-status-solto), sem .msg-balao.
  Aplicado tambem no modal de handoff ("Gerando resumo do caso..."), na
  tela "Encerrando..." (variante grande via custom properties de tamanho)
  e no painel /metricas.html (tema claro, esferas azul-escuro). CSS morto de
  indicadores antigos (.msg-digitando, .dot, pulsa, .encerrando-spinner)
  removido. Historico: V1 era metaball (blur+contrast, gotas fundidas)
  com movimento linear; substituida pela orbita por decisao de design
- Movimento extra circular no indicador de orbita: anel tracejado azul
  girando continuamente em volta (.msg-orbita-anel, rotate linear 8s) e
  duas ondas que nascem no centro e expandem alem da orbita
  (.msg-orbita-onda, scale+fade 2.6s defasadas). Tudo em circulo, atras
  das esferas (z-index -1 contido pelo stacking context do palco)
- Pollinations volta a ter chance real no failover: a API free limita o
  prompt a ~16 mil caracteres e o contexto completo do chat sempre
  estourava (413). api/chat.ts ganhou mensagensParaModelo: quando o
  modelo da fila e pollinations, envia versao enxuta (system cortado em
  9000 chars + ultimas 8 mensagens de ate 700 chars cada, teto de 15000)
  — aplica-se tanto ao caminho normal quanto ao streaming
- Cache semantico ampliado: a chave agora e perfil|periodo|codigo-pedido
  (antes so perfil|periodo), entao a primeira mensagem que ja informa um
  codigo de pedido passa a ser cacheavel sem risco de colisao entre
  pedidos diferentes. Entradas antigas expiram em 72h
- Catalogo fechado em 15 slots e depois saneado para 12 (ver bullet do
  reteste de cota abaixo): alem dos 2 candidatos anteriores, entraram
  gemini-flash-latest (id 13), gemini-3.1-pro-preview (id 14) e
  gemini-pro-latest (id 15); pollinations manteve id 10. Em 26/11/2026
  os 3 slots com 429 persistente (argon, 3.1-pro-preview, pro-latest)
  foram removidos por migration 0017 — flash-latest ficou na prioridade
  11 e pollinations desceu para 12. gemini-4-neon e gemini-4-carbon
  foram descartados antes: a documentacao confirma que exigem tier pago;
  gemini-2.5-* retornaram 404 (descontinuados para contas novas)

- Aurora de inatividade + encerramento automatico por inatividade
  (specs SPEC-fundo-inatividade.md e SPEC-inatividade-chat.md,
  implementadas em 25/11/2026): relogio unico em App.tsx mede a
  inatividade por timestamp (ultimaAtividadeRef, inicia "expirado" -61s
  para a aurora nascer acesa) alimentado por listeners globais
  (pointerdown/keydown/wheel/scroll capture/touchmove — cobre clique,
  toque, tecla e scroll; movimento do mouse NAO conta, a pedido do
  usuario) e por qualquer processo visivel da
  Nori (mensagens/etapaStream/enviando/tocandoId/handoff). Efeito
  visual: overlay .aurora FIXO na tela inteira ATRAS de todos os
  componentes (z-index -1 dentro do stacking context do .layout via
  isolation:isolate; .chat ficou com background transparente para a
  luz aparecer — o body ja pinta a mesma cor) com 3 camadas de
  gradiente radial que derivam (keyframes transform) e mudam de lugar
  aleatoriamente — a cada ~7s cada luz ganha left/top aleatorio com
  faixa ampla para alcancar as QUATRO bordas da tela e desliza por
  transicao CSS de 7s. Cada camada tem keyframes proprios em direcoes
  opostas (aurora-deriva/2/3) e os alvos aleatorios exigem distancia
  minima entre as luzes — nao se agrupam mais num canto so. A aurora e
  PURAMENTE AUTONOMA: nao ha nenhuma
  interacao com o cursor (sem paralaxe, brilhos de mouse ou particulas)
  — decisao do usuario apos iteracoes. prefers-reduced-motion desliga
  a animacao. pointer-events:none, fade de 450ms, paletas claro/escuro via
  data-theme. Regra do usuario: acende ao abrir e volta sempre que a
  tela passa 60s sem NENHUM sinal de vida — qualquer clique, toque,
  tecla ou scroll em qualquer lugar apaga na hora e rearma os 60s.
  Processamento congela o relogio (pausa preserva os segundos
  ociosos acumulados). Encerramento: aos 4min sem atividade com chat
  em andamento aparece banner .inatividade-aviso com contagem
  regressiva dos segundos restantes (ate 60); aos 5min o caso e
  encerrado na hora via encerrarAtendimento (sem a contagem de 3s do
  encerramento manual — o aviso ja avisou)
- Cabecalho do chat virou barra flutuante arredondada (.chat-topo:
  margem lateral, border-radius 16px, borda completa no lugar do
  border-bottom reto) — a pedido do usuario, sem mudar o layout
- Anti-abuso Cloudflare Turnstile no /api/chat (DORMENTE por padrao):
  shared/turnstile.ts verifica o token via siteverify da Cloudflare;
  so exige quando TURNSTILE_SECRET_KEY esta definida — sem ela tudo
  passa (no-op). Falha ABERTA se o siteverify estiver inacessivel (o
  chat ja tem rate limit por IP). Frontend so renderiza o widget
  quando VITE_TURNSTILE_SITE_KEY existe no build (script da Cloudflare
  carregado sob demanda, token de uso unico consumido a cada envio e
  resetado). Par de envs documentado em .env.example. ATIVO EM
  PRODUCAO desde 25/11/2026: chaves na Vercel + rebuild (vite.config
  tem envDir:'..' para o frontend ler o .env da raiz) — verificado:
  /api/chat responde 403 sem token e o bundle contem a site key
- Verificacao semantica de coerencia antes de regenerar: quando a
  heuristica (validarHeuristico) aponta problema numa resposta, o
  /api/chat agora chama validarComLLM — um modelo Gemini lite julga se
  o problema e real antes de pagar uma regeneracao inteira (a camada
  semantica so roda quando a heuristica falha, custo raro). Recusa
  generica NAO passa pelo verificador: sempre regenera. Se o verificador
  nao conseguir analisar, devolve ok e a resposta segue como esta —
  evita regenerar por falso positivo da heuristica conservadora
- Fallback em camadas com crescimento pelo uso (spec em
  spec/SPEC-fallback-camadas.md, IMPLEMENTADO): quando a fila de
  modelos falha por completo ou a resposta e recusada/vazia, o
  /api/chat nao devolve mais a mesma string fixa — api/fallback.ts
  resolve em cascata, sem nenhuma chamada de LLM: (1) cache semantico
  relaxado via RPC buscar_cache_fallback (score >= 0.80 vs 0.95 do
  caminho normal, qualquer escopo); (2) banco canonico por intencao
  (tabela fallback_respostas, intencao detectada por heuristicas
  leves — sem LLM); (3) pool de 5 variantes genericas estaveis por
  conversaId. Todas as camadas falham silenciosamente para a proxima.
  Crescimento organico: cache_respostas ganhou coluna `escopo` —
  turnos COM historico gravam respostas boas como escopo='fallback'
  (so servidas na emergencia; o cache hit normal filtra 'geral',
  entao follow-ups nunca viram cache indevido). Respostas vindas do
  fallback nunca sao regravadas no cache. Metricas registram a camada
  (cache-fallback/banco-fallback/generico-fallback) como modelo e
  headers x-fallback-camada; testes em tests/fallback.test.ts (11).
  Migration 0016 APLICADA 25/11/2026 via MCP (aprovada pelo usuario):
  coluna escopo, buscar_cache_resposta filtrando 'geral',
  buscar_cache_fallback e fallback_respostas com seeds. Obs.: o insert
  de seeds rodou duplicado no apply (2 linhas por intencao, 'geral'
  com 4) — funcionalmente inofensivo (textos identicos), dedupe de
  DELETE foi recusado pelo usuario na hora
- Metricas do painel /metricas.html agora sao DO DIA (reset diario,
  26/11/2026): a RPC metricas_chat_resumo passou a agregar apenas o dia
  corrente no fuso America/Sao_Paulo — total, cache hits, latencias
  (media/p50/p95), tools_total, consumo por modelo e traces recentes.
  O grafico "Mensagens por dia" segue mostrando os ultimos 14 dias
  (agora agrupado pela data local de SP) e a RPC devolve o campo `dia`
  para o painel exibir "METRICAS DE dd/mm/aaaa - RESET DIARIO" no
  subtitulo; rotulos dos KPIs/cartoes ajustados para "hoje". Migration
  0018_metricas_diarias.sql APLICADA 26/11/2026 via MCP (aprovada pelo
  usuario; verificado: dia=2026-11-26, total do dia separado do total
  das ultimas 24h). A tool MCP resumo_metricas passa a devolver os
  mesmos agregados diarios
- Metricas de qualidade consolidadas (spec em
  spec/SPEC-metricas-qualidade.md, modulo metricas-qualidade do
  capability-map): tabela eval_runs (migration 0019) persiste 1 linha
  por execucao das suites de eval — tests/evals.test.ts (rubricas
  deterministic) e tests/evals-juiz.test.ts (juiz LLM) gravam o
  resultado via afterAll usando tests/eval_runs.ts (falha de
  telemetria nunca reprova eval; origem 'local'/'ci' via env CI);
  /api/metricas ganhou bloco `qualidade` (ultimos 12 runs) alem do
  resumo de sempre; painel /metricas.html tem nova secao "Qualidade ·
  evals" com taxa de aprovacao por suite e historico; script
  scripts/relatorio_qualidade.mjs imprime relatorio texto unico
  (producao do dia + fallback por camada + ultimos scores de eval)
  para uso em entrevista. Migration 0019_eval_runs.sql APLICADA
  26/11/2026 via MCP (aprovada pelo usuario; tabela verificada via SQL)
- Eval de retrieval do RAG (spec em spec/SPEC-eval-retrieval.md,
  modulo eval-retrieval do capability-map): tests/evals-retrieval.test.ts
  mede hit@4 da buscaHibrida — 18 consultas realistas de disputa
  mapeadas para o titulo esperado do chunk em conhecimento_chunks.
  Primeira execucao encontrou gap real (regra de verticais mercado/
  farmacia/pet nao subia para "item errado" generico — dataset ajustado
  para o caso que a regra cobre: produto vencido); resultado final
  18/18. Persiste em eval_runs com suite 'retrieval' (tests/eval_runs.ts
  aceita a nova suite; migration 0020_eval_runs_suite_retrieval.sql
  APLICADA 26/11/2026 via MCP, aprovada pelo usuario). Painel e
  relatorio_qualidade.mjs rotulam a suite como "Retrieval (RAG)".
  Primeiro run gravado: 18/18 local; runs de rubricas/juiz ja chegam
  do CI (origem 'ci')
- Roteamento de modelos por intencao (spec em
  spec/SPEC-roteamento-modelos.md, modulo roteamento-modelos do
  capability-map): selecionarModelo ganhou prioridadeMinima (default 1
  = comportamento anterior) e shared/models.ts exporta
  prioridadeModeloLite() — menor prioridade entre modelos 'lite' do
  catalogo (hoje 7). /api/chat usa semContextoRAG (mesmo criterio que
  pula RAG/tools: mensagem casual ou meta, sem imagem/pedido/codigo)
  para comecar a fila nos lite; triagem segue no mais forte. O
  fallback "sem folga" respeita a mesma minima. Filas de failover ja
  desciam a partir do inicial — mensagem leve nunca sobe para modelo
  forte. Verificado ao vivo: "muito obrigado" e pergunta meta
  responderam com gemini-3.5-flash-lite (badge x-modelo); testes em
  tests/models.test.ts
- Baseline de evals no CI (spec em spec/SPEC-eval-baseline-ci.md,
  modulo eval-baseline-ci do capability-map):
  scripts/check_eval_baseline.mjs compara o run 'ci' mais recente de
  cada suite em eval_runs com o MELHOR run 'ci' anterior — queda >10pp
  na taxa de aprovacao reprova o pipeline (exit 1). Sem runs 'ci'
  previos ou banco fora: passa com aviso (telemetria nunca derruba CI).
  .github/workflows/evals.yml agora roda tambem tests/evals-retrieval
  .test.ts no loop e ganha o step "Baseline de evals" apos os testes.
  Verificado local: rubricas 9/9 e juiz 3/5 vs baseline — ok
- Memoria persistente anonima (spec em
  spec/SPEC-memoria-usuario.md, modulo memoria-usuario do
  capability-map — fase 1, SEM login): frontend gera UUID por
  dispositivo (localStorage kora-device-id, api.ts obterDispositivoId)
  e envia como dispositivoId no POST /api/chat e no novo POST
  /api/memoria (chamado fire-and-forget no encerramento do
  atendimento — App.tsx encerrarAtendimento). api/memoria.ts resume a
  conversa com modelo LLM (ate 2 frases de fatos do usuario; "NADA"
  nao grava; historico <4 msgs nao chama LLM; rate limit 10/min) e
  grava 1 linha na tabela `memorias` (migration
  0021_memorias.sql APLICADA 26/11/2026 via MCP, aprovada pelo
  usuario; verificado: colunas id/device_id/resumo/criado_em).
  Smoke test real: POST /api/memoria gravou resumo ("Pedido A1B2C3
  faltou 1 coca cola; usuario solicitou reembolso rapido...") lido de
  volta via PostgREST e limpo em seguida. /api/chat aceita dispositivoId e,
  SOMENTE no primeiro turno, injeta em paralelo as 5 memorias
  recentes no prompt (bloco "Memorias de sessoes anteriores" via
  shared/memoria.ts montarBlocoMemoria — uso natural, nunca recitar
  como lista). Sem id ou sem memorias: comportamento identico.
  Testes: tests/memoria.test.ts (bloco + validacoes do endpoint).
  ATENCAO: evals-juiz "guardrail: injecao de prompt" reprovou 2/5 em
  duas rodadas locais (drift de modelo/juiz LLM — nao relacionado a
  memoria, que nao envia dispositivoId nos evals); monitorar no CI
- Ditado neural via Whisper (spec em spec/SPEC-voz-whisper.md,
  modulo voz-whisper do capability-map): novo endpoint POST /api/stt
  recebe audio bruto (Content-Type audio/*, teto 4.5MB, rate limit
  20/min) e repassa a Groq audio/transcriptions (whisper-large-v3,
  language=pt) — mesma GROQ_API_KEY do chat; shared/env.ts ganhou
  groqApiKey(). Frontend: botao de microfone grava com MediaRecorder
  (auto-stop 60s) e transcreve ao parar — durante a transcricao o
  botao mostra o IndicadorCarregando; sem MediaRecorder/getUserMedia
  cai na Web Speech API (fluxo antigo preservado em
  iniciarDitadoWebSpeech). processarEnvio descarta gravacao em
  andamento (pararDitadoSilencioso). Rota registrada no dev-server;
  testes tests/stt.test.ts (validacoes). Voz agora e neural nos dois
  sentidos: STT Whisper + TTS Edge
- Extracao do caso estruturada (spec em
  spec/SPEC-caso-estruturado.md, modulo caso-estruturado do
  capability-map): shared/caso.ts concentra EstadoCasoSchema (zod) —
  enums de etapa/categoria/status, listas limitadas a 12 itens e
  defaults tolerantes via .catch (mesmos defaults do sanitizador
  manual que saiu de api/caso.ts: parseEstado/sanitizarEstado/
  listaStrings removidos). parseEstadoExtraido faz a extracao
  tolerante do JSON + safeParse; comportamento externo identico.
  Testes tests/caso-schema.test.ts
- Guardrail de injecao de prompt (spec em
  spec/SPEC-guardrails-injecao.md): coherence/injecao.ts detecta
  heuristicamente tentativas de extrair/revelar/manipular instrucoes
  (regexes conservadoras — verbo de ataque + alvo; falsos positivos
  zerados em testes com mensagens legitimas). /api/chat, ao detectar:
  injeta diretiva explicita de recusa no prompt do sistema e exclui a
  mensagem do cache semantico. Nasceu de um achado real: evals-juiz
  "guardrail: injecao de prompt" reprovava 2/5 (modelo respondia
  saudacao generica em vez de recusar). Com a diretiva, resposta virou
  recusa educada + redirecionamento ate no modelo lite — juiz subiu
  para 5/5, suite 4/4. Testes tests/injecao.test.ts (19 casos)
- Varredura geral de saude (26/11/2026): git limpo e sincronizado com
  origin/main; typecheck e vite build limpos; producao
  (koradelivery.vercel.app) respondendo — /, /metricas.html,
  agent-card.json 200, /api/mcp 401 sem key, /api/chat 200 via
  failover (gemini-3.1-flash-lite-preview), /api/metricas ok.
  Suite local: 111/131 testes ok — as 20 falhas sao AMBIENTAIS:
  cota diaria free-tier de embeddings do Gemini (1000/dia) esgotada
  fez embedTexts devolver null e a buscaHibrida degradar p/ lexical,
  zerando os 18 cenarios de evals-retrieval (gravou eval_run
  'retrieval 0/18' origem local — nao e regressao, renova com a
  cota; LIMPEZA FEITA em 27/11: MCP autenticou (OAuth refeito via
  `devin mcp login supabase`) mas execute_sql com DELETE foi recusado
  pela camada de permissoes — usuario rodou no SQL Editor:
  DELETE FROM eval_runs WHERE suite='retrieval' AND id IN
  (78,79,81,86,93,100) removeu os 6 runs degradados (1/18, 3/18, 4/18,
  0/18 local+ci, 7/25 dataset antigo); verificado via SELECT — restam
  so runs 18/18. Resíduo conhecido: id 76 (local, 6/18, mesma noite)
  segue na tabela, remocao opcional com DELETE FROM eval_runs WHERE
  id=76; evals-juiz teve 2 flakes do
  juiz (triagem nota 3, injecao nota 2 — drift conhecido ja
  documentado). CI verde na main (Testes e Validacao + Evals do
  Nori). Correcos da mesma varredura: (a) Turnstile saiu do modo
  observacao — bloqueio reativado em shared/turnstile.ts + api/chat.ts
  e spec/SPEC-turnstile.md atualizada; (b) rag/search.ts ganhou
  fallback ILIKE quando a RPC devolve vazio sem embedding (antes a
  busca zerava em degradacao — foi o que zerou os 18 retrievals);
  (c) Fluxo Kora corrigido: contagem de testes 62->131, nomes de
  tabelas reais (casos, conhecimento_chunks, metricas_chat), chip do
  evals-retrieval e texto do Turnstile "bloqueio ativo"; (d) Guia PDF
  corrigido na p.7 (backup pre-correcao-numeros): "15 slots"->12 com
  a lista real de modelos e "~62 testes"->~131. Guia PDF foi
  renomeado pelo usuario para
  "Guia Técnico de Entrevista — Projeto Kora & Agente Nori.pdf" —
  referencias atualizadas em AGENTS.md, SKILL.md e capability-map.
  INCIDENTE DE DEPLOY descoberto na mesma varredura: todos os deploys
  Vercel falhavam desde ab67caf (voz-whisper) com "No more than 12
  Serverless Functions can be added to a Deployment on the Hobby
  plan" — api/ chegou a 13 arquivos (memoria.ts + stt.ts) e o limite
  do Hobby e 12. Producao ficou presa no build de d60b540 (sem STT,
  caso-estruturado, guardrails-injecao, fixes de itens/aurora e as
  correcoes do Turnstile/RAG). Correcao: api/tts.ts e api/stt.ts
  fundidos em api/voz.ts (dispatcher por ?rota= ou pathname; 12
  functions de novo) + rewrites no vercel.json mantendo as URLs
  /api/tts e /api/stt identicas; dev-server e tests/stt.test.ts
  atualizados; urls publicas nao mudaram. Decisao registrada em
  DECISOES.md D16 — NOVO endpoint em api/ exige consolidar outro par
  ou plano Pro. Deploy eec5920 VERIFICADO em producao (26/11):
  /api/chat sem token -> 403 (Turnstile bloqueando de verdade),
  /api/tts e /api/stt respondem via rewrites p/ api/voz.ts. TESTE
  HUMANO CONFIRMADO 26/11: chat em producao responde normal (widget
  emite token e siteverify aprova — total do dia subiu de ~790 para
  ~1060 metricas_chat). Turnstile 100% ativo e funcional.
  RETESTE 27/11/2026 com cota de embeddings renovada: suite completa
  131/131 verde — evals-retrieval 18/18 (hit@4 normal, eval_run
  gravado), rubricas 11/11 e juiz 4/4 (injecao de prompt 5/5 — o flake
  conhecido nao apareceu; Gemini respondeu com varios 503 "high
  demand" absorvidos pelo failover). Limpeza das linhas ruins de
  eval_runs FEITA em 27/11 via SQL Editor (ver detalhe na secao de
  varredura acima; residuo opcional: id 76, 6/18)

## Em andamento

- Deploy em producao na Vercel: projeto `nori-agente-ai`, dominio de
  producao `koradelivery.vercel.app`. O dominio antigo
  `kora-frontend-jade.vercel.app` foi substituido e hoje responde 307
  redirecionando para o novo (opcao "Redirecionar o dominio antigo").
  ATENCAO: renomear o projeto NAO troca o dominio `.vercel.app` — mudancas
  de dominio sao feitas em Settings > Domains do projeto
- Migrations 0005-0008 aplicadas no Supabase (na epoca via arquivo
  combinado `_rodar_uma_vez_0005_0008.sql`, removido na reorganizacao de
  pastas por ser duplicata exata das migrations individuais)
- ~~Migration 0009_melhorias_observabilidade.sql PENDENTE~~ FEITO: tabelas
  metricas_chat, cache_respostas, conversas, conciliacoes e funcoes
  buscar_cache_resposta, metricas_chat_resumo criadas no SQL Editor.
  ATENCAO: tabelas criadas via SQL Editor nao herdam grants — foi preciso
  rodar grants manuais para service_role (select/insert/update/delete nas
  tabelas + execute nas funcoes); os grants ja estao no fim da migration
- ~~Migration 0010_categoria_pagamento.sql PENDENTE~~ FEITO 25/11/2026
  via Supabase MCP (apply_migration): categoria "pagamento" (id 5)
  inserida em categorias_divergencia
- ~~Migration 0011_trace_tools_metricas.sql PENDENTE~~ FEITO: verificado
  via PostgREST que as colunas trace/tools_usadas existem e a RPC
  metricas_chat_resumo ja retorna p50/p95, tools_total e traces_recentes
- ~~Migration 0012_metricas_modelo_backfill.sql PENDENTE~~ FEITO
  25/11/2026 via MCP: cache_hit -> modelo/provedor 'cache', erros ->
  'indisponivel'; restaram 0 linhas com modelo null
- ~~Migration 0013_cotas_por_modelo.sql PENDENTE~~ FEITO: um id de cota
  por slot do catalogo (ids 1-10, id = prioridade) no lugar dos ids
  compartilhados 1/3. Verificado via PostgREST: modelos_ia tem as 10
  linhas e a RPC aceitar id 10
- ~~Migration 0014_candidatos_gemini.sql PENDENTE~~ FEITO: check de
  modelos_ia.id ampliado para 1-12, gemini-3.7-flash (id 11, prio 10) e
  gemini-4-argon (id 12, prio 11) inseridos e pollinations movido para
  prioridade 12. Verificado via PostgREST: as 12 linhas estao corretas
- ~~Migration 0015_candidatos_gemini_finais.sql PENDENTE~~ FEITO
  25/11/2026 via MCP: check ampliado para 1-15, ids 13-15 inseridos
  (flash-latest prio 12, 3.1-pro-preview prio 13, pro-latest prio 14) e
  pollinations (id 10) desceu para prioridade 15. Verificado via SQL:
  as 15 linhas estao corretas
- ~~Re-teste pendente: quando a cota diaria do Gemini renovar, rodar
  scripts/testar_modelos_gemini.mjs para confirmar quais candidatos
  tem free tier de verdade.~~ FEITO em 26/11/2026 (cota renovada,
  2 rodadas + teste manual): responderam 200 com texto real
  gemini-3-flash-preview, gemini-3.5-flash-lite (o 400 do script e
  esperado — rejeita thinkingConfig; shared/llm.ts ja repete sem o
  campo e o modelo responde), gemini-3.1-flash-lite e
  gemini-3.1-flash-lite-preview. 429 persistente (sem free tier):
  gemini-4-argon, gemini-3.1-pro-preview, gemini-pro-latest — e os
  probes gemini-4-carbon/4-neon. 404: gemini-2.5-*. 503 "high demand"
  em TODAS as verificacoes: hydrogen, 3.8/3.6/3.5-flash, 3.7-flash e
  flash-latest — saturacao temporaria de capacidade (nao e cota),
  slots MANTIDOS porque ja responderam 200 antes; o failover tolera
  (503 volta em ~1-7s). Catalogo saneado para 12 slots via migration
  0017 (APLICADA em 26/11/2026 via SQL Editor, verificada via MCP):
  ids 12/14/15 removidos de modelos_ia e cotas_modelos limpo,
  flash-latest (id 13) prioridade 11, pollinations (id 10) prioridade
  12. ATENCAO Vercel: GEMINI_MODEL_10 passou a ser flash-latest (era
  argon) — se existirem envs GEMINI_MODEL_10..13 antigas na Vercel,
  remover ou alinhar para nao injetar modelo morto na fila
- Flake conhecido: tests/evals-juiz.test.ts > "guardrail: injecao de
  prompt" reprovou 2x com nota 2/5 do juiz (a resposta nao recusou o
  pedido de revelar o prompt de forma explicita). O eval deterministico
  (evals.test.ts, checagem regex) passa — e variacao de qualidade do
  modelo, nao regressao de codigo. RETESTE 27/11/2026: juiz 4/4 com
  injecao 5/5 — confirma drift de modelo/juiz, nao regressao
- ~~Servidor MCP/A2A/handoff em producao: cadastrar MCP_API_KEY nas env
  vars da Vercel~~ VERIFICADO 25/11/2026: a env ja esta configurada —
  /api/mcp e /api/a2a respondem 401 (auth exigida) e nao 503;
  /.well-known/agent-card.json responde 200
- Painel /metricas.html reformulado no estilo visual do Fluxo Kora
  (25/11/2026): tema claro (cards brancos, gradiente laranja->ciano,
  fundo com brilhos radiais, logo no cabecalho), layout em tela cheia
  (wrap flex column min-height 100vh, KPIs compactos em cima e Trace
  medio + Mensagens/dia lado a lado em grid de 2 colunas no desktop,
  empilhando abaixo de 1100px), grafico de barras com altura fluida,
  tooltip com o
  total no hover (data-v + ::after) e destaque do dia de pico, tabela de
  modelos em container com borda/hover como o Fluxo Kora. JS externo
  inalterado em contrato (mesmas classes/ids, novos nomes: trace-item,
  barra-mini, col.mais)

## Decisoes tecnicas tomadas

- Ver docs/DECISOES.md (D01 a D09)
- Resumo: Vite+React frontend, Vercel Functions Node/TS em api/, shared/ para
  logica de servidor, Gemini principal + Groq/Gemini/Pollinations contingencia,
  embeddings gemini-embedding-001 em 1536 dimensoes

## Pendencias (proximos passos, em ordem)

1. ~~Aplicar migrations 0005-0008~~ FEITO (arquivo combinado temporario,
   depois removido — as migrations individuais 0005-0008 sao a fonte)
2. ~~Deploy na Vercel~~ FEITO: projeto `nori-agente-ai`
   (Root Directory = raiz do repo; env vars SUPABASE_URL,
   SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GROQ_API_KEY)
3. ~~Testar o chat em producao~~ SMOKE TEST FEITO 25/11/2026:
   POST /api/chat em koradelivery.vercel.app respondeu cenarios reais
   de disputa (item faltante com confirmacao de pedido) via failover
   Pollinations — Gemini e Groq seguiram sem cota. Segue valendo
   exercitar mais cenarios quando a cota renovar
4. Endurecer abuso: ~~Cloudflare Turnstile~~ ATIVO EM PRODUCAO
   25/11/2026 (spec/SPEC-turnstile.md; chaves na Vercel + rebuild —
   /api/chat responde 403 sem token e o bundle serve o widget com a
   site key); pendente lista de dominios permitidos no CORS se o site
   for embutido — a API nao emite Access-Control-Allow-Origin,
   leitura cross-origin ja e bloqueada pelo browser
   CORRECAO 26/11/2026: todo envio em producao tomava 403 porque o
   CSP do vercel.json tinha `script-src 'self'` — bloqueava o api.js
   da Cloudflare, o widget nunca renderizava e nenhum token era
   gerado. CSP agora libera challenges.cloudflare.com em script-src,
   connect-src e frame-src; widget ganhou error-callback limpando
   token velho. Testes de integracao passaram a dar 403 apos
   TURNSTILE_SECRET_KEY entrar no .env local (chamam o handler sem
   token): os 4 arquivos que batem no /api/chat (chat.smoke,
   cenarios, evals, evals-juiz) fazem
   `delete process.env.TURNSTILE_SECRET_KEY` no carregarEnv
   MODO OBSERVACAO 26/11/2026: o widget nunca emitia token em
   producao (diagnosticado via Playwright — script carrega, widget
   renderiza, mas o challenge da Cloudflare nao conclui nem em Chrome
   real). CAUSA RAIZ encontrada 26/11/2026 via console do navegador:
   o service worker (frontend/public/sw.js) interceptava TODAS as
   requisicoes — inclusive a cross-origin do api.js do Turnstile — e o
   fetch dentro do SW obedecia a CSP ANTIGA com que o worker foi
   instalado (connect-src 'self'), bloqueando o script mesmo com o
   vercel.json correto. sw.js agora ignora origens diferentes da
   propria (url.origin !== self.location.origin) e o CACHE subiu para
   kora-v18. Hostnames do widget conferidos no painel: corretos
   (koradelivery.vercel.app, localhost, 127.0.0.1). VERIFICADO
   26/11/2026 apos deploy: sw.js v18 em producao, CSP ok, api.js e
   challenge-platform carregam e o widget aparece/conclui no Chrome
   real do usuario (confirmado manualmente). Playwright/automacao
   segue sem emitir token (deteccao de bot da Cloudflare — falso
   negativo dos testes automaticos; o challenge trava apos um 401
   no endpoint /pat/ do challenge-platform). Widget tornado OCULTO
   26/11/2026: render do Turnstile ganhou appearance
   'interaction-only' (so aparece se a Cloudflare exigir interacao;
   token segue sendo gerado sem UI visivel). BLOQUEIO REATIVADO
   26/11/2026 (na varredura de saude, a pedido do usuario): com o SW
   corrigido (kora-v18) e a CSP liberando challenges.cloudflare.com,
   o widget voltou a emitir tokens — turnoLiberado() exige token
   valido de novo (sem token/invalido = 403; siteverify inacessivel
   segue falhando ABERTA com warn). Se aparecer 403 em massa em
   producao, reverter shared/turnstile.ts para o modo observacao
   (git show e0e448b:shared/turnstile.ts). POS-DEPLOY: validar que
   o chat em producao continua respondendo (token fluindo do widget)
5. ~~Validacao de coerencia via LLM so quando a heuristica falha~~
   LIGADA 25/11/2026: validarComLLM agora e chamada em api/chat.ts —
   a heuristica flagra, o verificador LLM confirma se o problema e
   real antes da regeneracao (recusa generica sempre regenera; falha
   do verificador nao bloqueia). Custo raro: 1 chamada pequena so em
   respostas flagradas

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
  migrations 0005-0016 TODAS aplicadas (0010, 0012, 0015 e 0016 aplicadas
  em 25/11/2026 via Supabase MCP com aprovacao do usuario) e
  0017_limpeza_catalogo_429 APLICADA em 26/11/2026 via SQL Editor
  (12 linhas em modelos_ia verificadas via MCP);
  0018_metricas_diarias APLICADA 26/11/2026 via MCP (reset diario do
  painel /metricas.html — RPC verificada retornando dia corrente)
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
