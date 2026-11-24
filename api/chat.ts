// Endpoint POST /api/chat
// Orquestra o fluxo do Nori: validacao, RAG, selecao de modelo com cota,
// geracao com temperatura levemente maior para conversa natural, validacao de coerencia e registro de consumo
// Aceita { stream: true } para resposta token a token (sem validacao pos-geracao)

import type { IncomingMessage, ServerResponse } from 'node:http';
import { tratarRequisicaoNode } from '../shared/http.js';
import { catalogoModelos, janelaHistorico, timeoutLlmMs } from '../shared/env.js';
import { chamarLLM, ErroLimiteModelo, streamLLM, type MensagemChat } from '../shared/llm.js';
import type { ModeloConfig } from '../shared/env.js';
import { estimarMensagens, estimarTokens } from '../shared/tokens.js';
import { marcarEsgotado, registrarConsumo, selecionarModelo } from '../shared/models.js';
import { verificarLimite } from '../shared/ratelimit.js';
import { extrairCodigoPedido, pedidoConfirmadoNaHistorico, pedidoFicticio } from '../shared/pedidos.js';
import { buscaHibrida } from '../rag/search.js';
import { embedTexts } from '../rag/embeddings.js';
import { inserir, rpc, upsert } from '../shared/supabase.js';
import {
  carregarDiretrizes,
  montarContextoRAG,
  montarPromptSistema,
  validarComLLM,
  validarHeuristico,
  ehRespostaDeRecusa,
  ehMensagemCasual,
  ehPerguntaMeta,
} from '../coherence/index.js';

interface CorpoRequisicao {
  mensagem?: unknown;
  historico?: unknown;
  stream?: unknown;
  imagem?: unknown;
  perfil?: unknown;
  conversaId?: unknown;
}

// Perfis de usuario do marketplace: cada um recebe um contexto de solucao proprio
const PERFIS_VALIDOS = new Set(['cliente', 'parceiro', 'entregador']);

const CONTEXTO_PERFIL: Record<string, string> = {
  cliente:
    'O usuario e um CLIENTE final que recebeu um pedido com problema. Conduza como atendimento ao consumidor: colete dados do pedido, evidencias e aplique as politicas de disputa e reembolso.',
  parceiro:
    'O usuario e um VENDEDOR PARCEIRO (restaurante ou loja). Ajude com demandas do estabelecimento: pedido cancelado indevidamente, avaliacao contestada, divergencia de repasse, problema no cardapio. Aplique as mesmas regras de evidencia; nao prometa acoes no sistema.',
  entregador:
    'O usuario e um ENTREGADOR parceiro. Ajude com demandas de entrega: pedido nao entregue, dificuldade na retirada, pagamento da corrida, atraso. Aplique as mesmas regras de evidencia; nao prometa acoes no sistema.',
};

// Temperatura do chat: um pouco acima do minimo para conversa mais natural
// (validacao de coerencia e regeneracao continuam na temperatura padrao baixa)
const TEMPERATURA_CHAT = 0.4;

const TAMANHO_MAX_MENSAGEM = 4000;
const TAMANHO_MAX_HISTORICO = 24;
const MIMES_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TAMANHO_MAX_IMAGEM_B64 = 4_200_000; // ~3MB em base64 (body total fica abaixo do limite da Vercel)

// Ultima instancia quando o modelo nao consegue formular resposta nenhuma:
// avisa com educacao e lembra o que a Nori faz, em vez de uma recusa seca
const RESPOSTA_FALLBACK =
  'Tive uma dificuldade para formular essa resposta agora. Posso te ajudar com disputas de pedidos do Kora (item faltante, item errado, qualidade, atraso), confirmacao de pedido por codigo, orientacao sobre evidencias e parecer de conciliacao — e tambem respondo assuntos gerais. Como posso ajudar?';

// Ids de conversa gerados no frontend como `${timestamp}-${aleatorio}`
const CONVERSA_ID_VALIDO = /^[A-Za-z0-9_-]{10,80}$/;
const MAX_MENSAGENS_CONVERSA = 60;

// Cache semantico: so primeira mensagem (sem contexto), score minimo alto e
// perguntas temporais excluidas — respostas dependentes de data/hora nunca
// podem ser servidas dias depois
const CACHE_SCORE_MIN = 0.95;

// Periodo do dia em America/Sao_Paulo: a saudacao da Nori depende do horario,
// entao a chave do cache semantico inclui o periodo — nunca se serve um
// "bom dia" gerado de manha para quem pergunta a noite
function periodoDoDia(): 'manha' | 'tarde' | 'noite' {
  const hora = Number(
    new Date().toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false,
    }),
  ) % 24;
  if (hora < 12) return 'manha';
  if (hora < 18) return 'tarde';
  return 'noite';
}
const PERGUNTA_TEMPORAL = /que dia|dia é hoje|dia e hoje|que horas|hora agora|horas agora|data de hoje|clima|previsão do tempo|previsao do tempo|temperatura fora/i;

// Valida o anexo de imagem opcional (evidencia fotografica da disputa)
function normalizarImagem(imagem: unknown): { base64: string; mime: string } | undefined {
  if (typeof imagem !== 'object' || imagem === null) return undefined;
  const { base64, mime } = imagem as { base64?: unknown; mime?: unknown };
  if (typeof base64 !== 'string' || typeof mime !== 'string') return undefined;
  if (!MIMES_IMAGEM.has(mime)) return undefined;
  if (base64.length === 0 || base64.length > TAMANHO_MAX_IMAGEM_B64) return undefined;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) return undefined;
  return { base64, mime };
}

// Normaliza o historico recebido do cliente para o formato interno
function normalizarHistorico(historico: unknown): MensagemChat[] {
  if (!Array.isArray(historico)) return [];
  return historico
    .filter(
      (m): m is { role: string; content: string } =>
        typeof m === 'object' &&
        m !== null &&
        typeof (m as { role?: unknown }).role === 'string' &&
        typeof (m as { content?: unknown }).content === 'string',
    )
    .map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user') as MensagemChat['role'],
      content: m.content.slice(0, 2000),
    }))
    .slice(-TAMANHO_MAX_HISTORICO);
}

function json(status: number, corpo: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

// ===== Observabilidade, cache semantico e persistencia =====
// Tudo fire-and-forget: nunca bloqueia nem quebra a resposta do chat

// Converte vetor para o literal aceito pelo pgvector ('[1,2,3]')
function vetorParaTexto(v: number[]): string {
  return `[${v.join(',')}]`;
}

interface LinhaCache {
  pergunta: string;
  resposta: string;
  fontes: Array<{ titulo: string; categoria?: string | null }>;
  modelo: string | null;
  score: number;
}

// Busca o vizinho mais proximo no cache de respostas; null se indisponivel
async function buscarCache(embedding: number[], perfil: string): Promise<LinhaCache | null> {
  try {
    const linhas = await rpc<LinhaCache[]>('buscar_cache_resposta', {
      p_embedding: vetorParaTexto(embedding),
      p_perfil: perfil,
    });
    const linha = linhas?.[0];
    // Respostas de recusa nunca sao servidas do cache: uma entrada envenenada
    // faria o agente repetir a falha para sempre na mesma pergunta
    return linha && linha.score >= CACHE_SCORE_MIN && !ehRespostaDeRecusa(linha.resposta) ? linha : null;
  } catch {
    return null; // migration 0009 ainda nao aplicada ou banco fora
  }
}

// Grava a resposta no cache (somente primeira mensagem sem contexto)
function guardarCache(
  embedding: number[] | undefined,
  pergunta: string,
  perfil: string,
  resposta: string,
  fontes: Array<{ titulo: string; categoria?: string | null }>,
  modelo: string | undefined,
  tokensTotal: number | undefined,
): void {
  if (!embedding) return;
  void inserir('cache_respostas', {
    embedding: vetorParaTexto(embedding),
    pergunta: pergunta.slice(0, 500),
    perfil,
    resposta: resposta.slice(0, 8000),
    fontes,
    modelo: modelo ?? null,
    tokens_total: tokensTotal ?? null,
  }).catch(() => undefined);
}

interface MetricaChat {
  modelo?: string;
  provedor?: string;
  stream: boolean;
  cacheHit?: boolean;
  tokensEntrada?: number;
  tokensSaida?: number;
  tokensTotal?: number;
  latenciaMs: number;
  fontes?: number;
  perfil?: string;
  erro?: string;
}

// Uma linha por requisicao em metricas_chat; resumo via GET /api/metricas
function registrarMetrica(m: MetricaChat): void {
  void inserir('metricas_chat', {
    modelo: m.modelo ?? null,
    provedor: m.provedor ?? null,
    stream: m.stream,
    cache_hit: m.cacheHit ?? false,
    tokens_entrada: m.tokensEntrada ?? null,
    tokens_saida: m.tokensSaida ?? null,
    tokens_total: m.tokensTotal ?? null,
    latencia_ms: m.latenciaMs,
    fontes: m.fontes ?? 0,
    perfil: m.perfil ?? null,
    erro: m.erro ?? null,
  }).catch(() => undefined);
}

// Historico completo da conversa no formato persistido (user/assistant)
function montarHistoricoConversa(
  historico: MensagemChat[],
  mensagem: string,
  resposta: string,
  temImagem: boolean,
): Array<{ role: string; content: string }> {
  const msgs = historico.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));
  msgs.push({
    role: 'user',
    content: mensagem + (temImagem ? '\n[O usuario anexou uma foto como evidencia.]' : ''),
  });
  msgs.push({ role: 'assistant', content: resposta });
  return msgs.slice(-MAX_MENSAGENS_CONVERSA);
}

// Espelha a conversa no Postgres (backup do localStorage; base p/ sync futura)
function persistirConversa(
  conversaId: string | undefined,
  perfil: string | undefined,
  mensagens: Array<{ role: string; content: string }>,
): void {
  if (!conversaId) return;
  void upsert(
    'conversas',
    {
      conversa_id: conversaId,
      perfil: perfil ?? '',
      mensagens,
      atualizado_em: new Date().toISOString(),
    },
    'conversa_id',
  ).catch((erro) => console.warn('[chat] persistir conversa falhou:', erro));
}

// Tenta gerar a resposta percorrendo a fila de modelos na ordem de prioridade
// Em limite de cota ou falha transitoria, marca esgotado e passa ao proximo
async function gerarComFailover(
  modeloInicial: ModeloConfig,
  mensagens: MensagemChat[],
  comTools = false,
): Promise<{ texto: string; modelo: ModeloConfig; tokensUso?: number } | null> {
  const catalogo = catalogoModelos()
    .filter((m) => m.apiKey)
    .sort((a, b) => a.prioridade - b.prioridade);
  const fila = catalogo.filter((m) => m.prioridade >= modeloInicial.prioridade);

  for (const modelo of fila) {
    try {
      const r = await chamarLLM(modelo, mensagens, { temperatura: TEMPERATURA_CHAT, comTools });
      return { texto: r.texto, modelo, tokensUso: r.tokensUso };
    } catch (erro) {
      if (erro instanceof ErroLimiteModelo) {
        // fire-and-forget: a RPC de cota nao pode atrasar o failover
        void marcarEsgotado(modelo.id);
        continue;
      }
      // falha transitoria: tenta o proximo modelo preservando a conversa
      console.warn(`[chat] falha no modelo ${modelo.provedor}:`, erro);
      continue;
    }
  }
  return null;
}

// Ultima instancia quando TODOS os provedores falham: em vez de um erro 502
// ("tentar novamente"), o usuario recebe o fallback educado com 200 — a falha
// continua registrada nas metricas para observabilidade
function respostaFallbackStream(): Response {
  const codificador = new TextEncoder();
  const fluxo = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < RESPOSTA_FALLBACK.length; i += 400) {
        controller.enqueue(codificador.encode(RESPOSTA_FALLBACK.slice(i, i + 400)));
      }
      controller.close();
    },
  });
  return new Response(fluxo, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-modelo': 'fallback',
      'x-fontes': '[]',
      // Sinaliza ao frontend que a resposta e o fallback de saturacao (todos
      // os modelos falharam), mesmo com HTTP 200 — dispara o alerta amarelo
      'x-fallback': '1',
    },
  });
}

// Tenta abrir o stream percorrendo a fila; retorna stream + modelo ou null.
// Valida o PRIMEIRO chunk antes de responder: stream que abre e morre sem
// emitir nenhum byte aciona o proximo modelo da fila (retry transparente)
async function streamComFailover(
  modeloInicial: ModeloConfig,
  mensagens: MensagemChat[],
  comTools = false,
): Promise<{ stream: ReadableStream<Uint8Array>; modelo: ModeloConfig } | null> {
  const catalogo = catalogoModelos()
    .filter((m) => m.apiKey)
    .sort((a, b) => a.prioridade - b.prioridade);
  const fila = catalogo.filter((m) => m.prioridade >= modeloInicial.prioridade);

  for (const modelo of fila) {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const bruto = await streamLLM(modelo, mensagens, { temperatura: TEMPERATURA_CHAT, comTools });
      reader = bruto.getReader();
      // O handshake so cobre os headers HTTP: um stream que abre e nunca
      // emite o primeiro byte ficaria pendurado para sempre. Limitamos a
      // espera do primeiro chunk ao mesmo timeout dos demais LLMs
      let primeiro: { done: boolean; value?: Uint8Array };
      try {
        primeiro = await Promise.race([
          reader.read(),
          new Promise<never>((_, rej) => {
            const t = setTimeout(() => rej(new Error('primeiro chunk timeout')), timeoutLlmMs());
            // nao segura o event loop em testes/scripts
            if (typeof t === 'object' && 'unref' in t) (t as { unref: () => void }).unref();
          }),
        ]);
      } catch {
        void reader.cancel().catch(() => undefined);
        throw new Error('stream sem primeiro chunk no prazo');
      }
      if (primeiro.done || !primeiro.value || primeiro.value.length === 0) {
        // Stream vazio ou morto antes do primeiro byte: proximo modelo
        void reader.cancel().catch(() => undefined);
        continue;
      }
      const primeiroChunk = primeiro.value;
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(primeiroChunk);
          try {
            while (true) {
              const { done, value } = await reader!.read();
              if (done) break;
              if (value && value.length > 0) controller.enqueue(value);
            }
          } catch {
            // Stream interrompido no meio: mantem o que ja foi enviado
          } finally {
            controller.close();
          }
        },
        cancel() {
          void reader?.cancel().catch(() => undefined);
        },
      });
      return { stream, modelo };
    } catch (erro) {
      if (erro instanceof ErroLimiteModelo) {
        void marcarEsgotado(modelo.id);
        continue;
      }
      console.warn(`[chat] stream falhou no modelo ${modelo.provedor}:`, erro);
      continue;
    }
  }
  return null;
}

async function webHandler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { erro: 'Metodo nao permitido' });
  const t0 = Date.now();

  // Rate limit simples por IP: 20 requisicoes por minuto (best-effort em serverless)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  // Leitura do corpo e rate limit sao independentes: disparam juntos para
  // nao somar a round-trip do Postgres a latencia de cada mensagem
  const pCorpo = req.json().catch(() => undefined);
  if (!(await verificarLimite(`chat:${ip}`, 20, 60_000))) {
    return json(429, { erro: 'Muitas requisicoes. Aguarde um instante.' });
  }

  const corpoBruto = await pCorpo;
  if (corpoBruto === undefined) return json(400, { erro: 'JSON invalido' });
  const corpo = corpoBruto as CorpoRequisicao;

  const mensagem = typeof corpo.mensagem === 'string' ? corpo.mensagem.trim() : '';
  if (mensagem.length === 0 || mensagem.length > TAMANHO_MAX_MENSAGEM) {
    return json(400, { erro: 'Mensagem ausente ou acima do limite de tamanho' });
  }

  const historico = normalizarHistorico(corpo.historico);
  const imagem = normalizarImagem(corpo.imagem);
  const janela = janelaHistorico() * 2;
  const historicoJanela = historico.slice(-janela);

  const conversaId =
    typeof corpo.conversaId === 'string' && CONVERSA_ID_VALIDO.test(corpo.conversaId)
      ? corpo.conversaId
      : undefined;
  const perfil =
    typeof corpo.perfil === 'string' && PERFIS_VALIDOS.has(corpo.perfil) ? corpo.perfil : undefined;
  const perfilChave = perfil ?? '';
  // O cache so atende primeira mensagem, que sempre pode abrir com saudacao
  // dependente do horario: o periodo entra na chave para nao servir uma
  // resposta de manha a noite
  const chaveCache = `${perfilChave}|${periodoDoDia()}`;

  // Codigo de pedido informado: os dados deterministicos sao injetados no
  // prompt abaixo e o proprio modelo confirma o pedido com variacao natural
  const codigoPedido = extrairCodigoPedido(mensagem);

  // Pedido confirmado em turno anterior fica TRAVADO ate o fim da conversa:
  // os dados deterministicos dele sao injetados e o modelo e proibido de
  // troca-lo, mesmo que o usuario informe outro codigo ou descreva outro pedido
  const codigoTravado = pedidoConfirmadoNaHistorico(historico);
  const tentandoTrocar = !!codigoTravado && !!codigoPedido && codigoPedido !== codigoTravado;

  // Cache so em primeira mensagem sem contexto: sem pedido, sem historico e
  // sem pergunta temporal — a resposta nao depende de estado da conversa
  const cacheElegivel =
    !imagem &&
    historico.length === 0 &&
    !codigoPedido &&
    !codigoTravado &&
    !PERGUNTA_TEMPORAL.test(mensagem);

  // Estimativa antecipada de tokens de entrada (historico + mensagem + margem
  // para prompt de sistema e contexto RAG) permite escolher o modelo em
  // paralelo com a busca, sem esperar o RAG terminar — corta uma round-trip.
  // O embedding e calculado uma unica vez e reutilizado pela busca RAG e pelo
  // cache semantico (antes cada um embedava a mensagem separadamente)
  const tokensEntradaPrev = estimarMensagens(historicoJanela) + estimarTokens(mensagem) + 2600;

  // Mensagem puramente casual (agradecimento, saudacao, reacao leve) nao
  // precisa da base de conhecimento: pula o RAG e evita fontes irrelevantes.
  // Nunca se aplica a mensagem com pedido, codigo ou imagem — triagem intacta
  const mensagemCasual =
    !imagem && !codigoPedido && !codigoTravado && ehMensagemCasual(mensagem);

  // Pergunta sobre a propria agente (modelos, criador, capacidades): a
  // resposta sai do prompt, sem base de conhecimento — tambem pula o RAG
  const perguntaMeta = !imagem && ehPerguntaMeta(mensagem);
  const semContextoRAG = mensagemCasual || perguntaMeta;
  // Function calling so em mensagens de triagem: casuais/meta nao precisam
  // de tools (mesmo criterio do RAG). O modelo decide quando chamar
  const comTools = !semContextoRAG;

  // O embedding so e necessario para a busca RAG ou para o cache semantico.
  // Mensagem casual/meta no meio da conversa (sem historico vazio e sem
  // cache elegivel) nao usa nenhum dos dois: pula a chamada ao Gemini e
  // corta uma round-trip inteira do caminho critico
  const precisaEmbedding = !semContextoRAG || cacheElegivel;
  const pVetores = precisaEmbedding ? embedTexts([mensagem]) : Promise.resolve(null);
  // A busca RAG depende so do embedding: dispara em paralelo com a selecao
  // de modelo, diretrizes e cache — corta uma round-trip inteira do caminho
  const pBusca = semContextoRAG
    ? Promise.resolve({ trechos: [] as Awaited<ReturnType<typeof buscaHibrida>>['trechos'], modo: 'lexical' as const })
    : pVetores.then((v) => buscaHibrida(mensagem, undefined, v?.[0]));
  const [vetores, diretrizes, modelo, cache] = await Promise.all([
    pVetores,
    carregarDiretrizes(),
    selecionarModelo(tokensEntradaPrev),
    cacheElegivel
      ? pVetores.then((v) => (v?.[0] ? buscarCache(v[0], chaveCache) : null))
      : Promise.resolve(null),
  ]);
  const embedding = vetores?.[0];
  const busca = await pBusca;

  // Cache hit: resposta identica ja gerada para a mesma pergunta+perfil.
  // Economiza a chamada ao LLM inteira; vale mesmo com cotas esgotadas
  if (cache) {
    const fontesCache = cache.fontes ?? [];
    persistirConversa(
      conversaId,
      perfil,
      montarHistoricoConversa(historico, mensagem, cache.resposta, !!imagem),
    );
    registrarMetrica({
      stream: corpo.stream === true,
      cacheHit: true,
      latenciaMs: Date.now() - t0,
      fontes: fontesCache.length,
      perfil,
      tokensEntrada: tokensEntradaPrev,
    });
    const headers = {
      'x-modelo': cache.modelo ?? 'cache',
      'x-fontes': encodeURIComponent(JSON.stringify(fontesCache)),
    };
    if (corpo.stream === true) {
      const texto = cache.resposta;
      const codificador = new TextEncoder();
      const fluxo = new ReadableStream<Uint8Array>({
        start(controller) {
          for (let i = 0; i < texto.length; i += 400) {
            controller.enqueue(codificador.encode(texto.slice(i, i + 400)));
          }
          controller.close();
        },
      });
      return new Response(fluxo, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers },
      });
    }
    return json(200, {
      resposta: cache.resposta,
      modelo: cache.modelo ?? 'cache',
      provedor: 'cache',
      tokens: 0,
      fontes: fontesCache,
    });
  }

  if (!modelo) {
    // Esgotamento total dos modelos no ciclo vigente
    registrarMetrica({ stream: corpo.stream === true, latenciaMs: Date.now() - t0, perfil, erro: 'cotas_esgotadas' });
    return json(429, {
      erro: 'As cotas gratuitas dos modelos de IA estao temporariamente esgotadas. Tente novamente em instantes.',
    });
  }

  // Data e hora atuais permitem responder perguntas casuais sem inventar
  const agora = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Injeta o pedido ficticio deterministico sempre que um codigo for informado:
  // o modelo usa esses dados para confirmar o pedido de forma natural e variada
  let dadosPedido = '';
  if (codigoTravado) {
    dadosPedido = `\nPEDIDO CONFIRMADO E TRAVADO nesta conversa: ${pedidoFicticio(codigoTravado)}. Use SEMPRE estes dados; o pedido nao pode ser trocado. Se o usuario disser que errou, informar outro codigo ou descrever outro pedido, responda que esse pedido nao consta em seu nome e que o unico pedido em atendimento e o confirmado acima — cite loja, itens e valor dele.`;
    if (tentandoTrocar) {
      dadosPedido += `\nATENCAO: a mensagem atual informou o codigo ${codigoPedido}, que NAO substitui o pedido confirmado ${codigoTravado}. Recuse a troca de forma educada e mantenha o pedido ${codigoTravado}.`;
    }
  } else if (codigoPedido) {
    dadosPedido = `\nPedido localizado no sistema (dados da simulacao): ${pedidoFicticio(codigoPedido)}. REGRA DE CONFIRMACAO: os itens que o USUARIO descreveu na conversa (ex.: "uma coca cola", "2 burgers") sao os itens reais do pedido dele e DEVEM aparecer na confirmacao — o catalogo acima e apenas um modelo de loja/valor; se os itens do catalogo divergirem do que o usuario falou, use os do usuario. Se o usuario corrigir os itens antes de confirmar ("na verdade era X"), a ultima descricao dele vale ate o fim da conversa.`;
  }

  const promptSistema = [
    montarPromptSistema(diretrizes),
    '',
    `Data e hora atuais: ${agora}.`,
    // O turno define se a saudacao e obrigatoria (primeira mensagem) ou
    // proibida (demais turnos, salvo se o usuario tiver saudado)
    historicoJanela.length === 0
      ? 'Contexto do turno: esta e a PRIMEIRA mensagem desta conversa.'
      : 'Contexto do turno: ja existem mensagens anteriores nesta conversa.',
    perfil ? `Perfil do usuario: ${CONTEXTO_PERFIL[perfil]}` : '',
    dadosPedido,
    '',
    // Mensagens casuais e meta nao passam pelo RAG: instrui resposta leve
    // direto, em vez do texto de "nenhuma politica recuperada" (que empurra triagem)
    perguntaMeta
      ? 'A mensagem pergunta sobre voce mesma (capacidades, modelos de IA, criador ou limites). Responda de forma natural, curta e clara usando a secao "Sobre voce" do seu papel — sem triagem, sem citar regras e sem inventar detalhes tecnicos.'
      : semContextoRAG
        ? 'A mensagem do usuario e apenas um cumprimento, agradecimento ou reacao leve. Responda de forma breve, calorosa e natural, sem triagem, sem citar regras e sem forcar pergunta de coleta; uma pergunta curta e opcional.'
        : montarContextoRAG(busca.trechos),
  ].join('\n');

  const mensagens: MensagemChat[] = [
    { role: 'system', content: promptSistema },
    ...historicoJanela,
    { role: 'user', content: mensagem + (imagem ? '\n[O usuario anexou uma foto como evidencia.]' : ''), imagem },
  ];

  // Estimativa de entrada com teto de seguranca (o modelo ja foi escolhido
  // em paralelo com o RAG usando a estimativa antecipada)
  const tokensEntrada = estimarMensagens(mensagens);

  const fontes = busca.trechos.map((t) => ({ titulo: t.titulo, categoria: t.categoria }));

  // ===== Modo streaming: resposta token a token =====
  // Os primeiros bytes sao inspecionados: recusa generica ou resposta vazia
  // e substituida por regeneracao antes de chegar ao usuario. O restante do
  // fluxo segue token a token; no fechamento alimenta cache, historico e metricas
  if (corpo.stream === true) {
    const gerado = await streamComFailover(modelo, mensagens, comTools);
    if (!gerado) {
      registrarMetrica({ stream: true, latenciaMs: Date.now() - t0, perfil, erro: 'sem_modelo' });
      persistirConversa(conversaId, perfil, montarHistoricoConversa(historico, mensagem, RESPOSTA_FALLBACK, !!imagem));
      return respostaFallbackStream();
    }
    let acumulado = '';
    const decodificador = new TextDecoder();
    const codificador = new TextEncoder();
    // Os primeiros bytes ficam retidos para inspecao: no modo stream nao ha
    // validacao pos-geracao, entao uma recusa generica ("nao consegui
    // responder") ou resposta vazia e detectada no inicio do fluxo,
    // descartada e substituida por uma regeneracao antes de chegar ao usuario
    const LIMIAR_INSPECAO = 220;
    let textoFinal = '';
    const fluxo = new ReadableStream<Uint8Array>({
      async start(controller) {
        const leitor = gerado.stream.getReader();
        let segurando = true;
        let pendentes: Uint8Array[] = [];
        let substituido = false;
        const emitir = (bytes: Uint8Array) => controller.enqueue(bytes);
        try {
          while (true) {
            const { done, value } = await leitor.read();
            if (done) break;
            if (!value || value.length === 0) continue;
            acumulado += decodificador.decode(value, { stream: true });
            if (segurando) {
              pendentes.push(value);
              if (acumulado.length >= LIMIAR_INSPECAO) {
                segurando = false;
                if (ehRespostaDeRecusa(acumulado)) {
                  substituido = true;
                  void leitor.cancel().catch(() => undefined);
                  break;
                }
                for (const b of pendentes) emitir(b);
                pendentes = [];
              }
            } else {
              emitir(value);
            }
          }
          // Flush do decoder para nao perder caracteres multibyte no fim
          acumulado += decodificador.decode();
          // Stream terminou ainda segurando (resposta curta): decide com o todo
          if (segurando) {
            segurando = false;
            if (acumulado.trim().length === 0 || ehRespostaDeRecusa(acumulado)) {
              substituido = true;
            } else {
              for (const b of pendentes) emitir(b);
              pendentes = [];
            }
          }
          if (substituido || acumulado.trim().length === 0) {
            // So regenera quando a resposta e inutil (vazia ou recusa);
            // caso contrario o texto original ja foi enviado e nada muda
            const correcao: MensagemChat[] = [
              ...mensagens,
              { role: 'assistant', content: acumulado || '(resposta vazia)' },
              {
                role: 'user',
                content:
                  'Sua resposta anterior foi vazia ou uma recusa generica, sem responder a pergunta. Responda de verdade: para perguntas sobre suas capacidades, liste o que voce faz; para conhecimento geral, use seu proprio conhecimento de forma resumida; para dados do Kora, use apenas o contexto fornecido.',
              },
            ];
            let novo = '';
            try {
              // Failover na regeneracao tambem: o modelo original pode ter
              // sido o que falhou; a fila tenta os demais antes do fallback
              const r2 = await gerarComFailover(gerado.modelo, correcao, comTools);
              novo = (r2?.texto ?? '').trim();
            } catch (erroRegen) {
              console.warn('[chat] regeneracao de stream falhou:', erroRegen);
            }
            if (!novo || ehRespostaDeRecusa(novo)) novo = RESPOSTA_FALLBACK;
            textoFinal = novo;
            for (let i = 0; i < novo.length; i += 400) {
              emitir(codificador.encode(novo.slice(i, i + 400)));
            }
          } else {
            textoFinal = acumulado.trim();
          }
        } catch {
          // Cliente desconectou ou stream morreu: encerra o que ja saiu
        } finally {
          controller.close();
          const texto = textoFinal || acumulado.trim() || '[resposta interrompida]';
          if (cacheElegivel && texto && !ehRespostaDeRecusa(texto) && texto !== RESPOSTA_FALLBACK) {
            guardarCache(embedding, mensagem, chaveCache, texto, fontes, gerado.modelo.nomeModelo, undefined);
          }
          persistirConversa(
            conversaId,
            perfil,
            montarHistoricoConversa(historico, mensagem, texto || '[resposta interrompida]', !!imagem),
          );
          registrarMetrica({
            modelo: gerado.modelo.nomeModelo,
            provedor: gerado.modelo.provedor,
            stream: true,
            latenciaMs: Date.now() - t0,
            fontes: fontes.length,
            perfil,
            tokensEntrada,
          });
        }
      },
      cancel() {
        void gerado.stream.cancel().catch(() => undefined);
      },
    });
    return new Response(fluxo, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'x-modelo': gerado.modelo.nomeModelo,
        'x-fontes': encodeURIComponent(JSON.stringify(fontes)),
      },
    });
  }

  const gerado = await gerarComFailover(modelo, mensagens, comTools);
  if (!gerado) {
    registrarMetrica({ stream: false, latenciaMs: Date.now() - t0, perfil, erro: 'sem_modelo' });
    persistirConversa(conversaId, perfil, montarHistoricoConversa(historico, mensagem, RESPOSTA_FALLBACK, !!imagem));
    return json(
      200,
      {
        resposta: RESPOSTA_FALLBACK,
        modelo: 'fallback',
        provedor: 'sistema',
        tokens: 0,
        fontes,
      },
      { 'x-fallback': '1' },
    );
  }

  // Registra consumo real quando informado, senao a estimativa consolidada
  const tokensUso = gerado.tokensUso ?? estimarTokens(gerado.texto) + tokensEntrada;
  await registrarConsumo(gerado.modelo.id, tokensUso);

  // Validacao obrigatoria de coerencia antes da entrega.
  // Recusa generica do modelo ("nao consegui responder") conta como falha:
  // dispara a mesma regeneracao apontando o problema
  let resposta = gerado.texto;
  let aviso: string | undefined;
  const heuristica = validarHeuristico(resposta);
  const recusaInicial = ehRespostaDeRecusa(resposta);
  if (!heuristica.ok || recusaInicial) {
    console.warn(
      '[chat] validacao falhou:',
      recusaInicial ? 'resposta de recusa/incapacidade' : heuristica.problemas,
    );
    // Uma tentativa de regeneracao apontando os problemas detectados
    const motivo = recusaInicial
      ? 'Sua resposta anterior foi uma recusa generica, sem responder a pergunta. Responda de verdade: para perguntas sobre suas capacidades, liste o que voce faz; para conhecimento geral, use seu proprio conhecimento de forma resumida; para dados do Kora, use apenas o contexto fornecido.'
      : `Sua resposta anterior apresentou problemas de coerencia: ${heuristica.problemas.join('; ')}. Reescreva corrigindo esses pontos, sem inventar dados.`;
    const correcao: MensagemChat[] = [
      ...mensagens,
      { role: 'assistant', content: resposta },
      { role: 'user', content: motivo },
    ];
    try {
      const r2 = await gerarComFailover(gerado.modelo, correcao, comTools);
      const texto2 = (r2?.texto ?? '').trim();
      const h2 = validarHeuristico(texto2);
      if (r2 && h2.ok && !ehRespostaDeRecusa(texto2)) {
        resposta = texto2;
        await registrarConsumo(r2.modelo.id, r2.tokensUso ?? estimarTokens(texto2));
      } else if (ehRespostaDeRecusa(texto2) || !texto2) {
        // Modelo insistiu na recusa ou a fila inteira falhou: ultima instancia
        resposta = RESPOSTA_FALLBACK;
      } else {
        aviso = 'Resposta gerada com ressalvas de coerencia; confirme os pontos sinalizados.';
      }
    } catch (erro) {
      console.warn('[chat] regeneracao de coerencia falhou:', erro);
      if (recusaInicial) resposta = RESPOSTA_FALLBACK;
      else aviso = 'Resposta gerada com ressalvas de coerencia; confirme os pontos sinalizados.';
    }
  }

  // Recusas e o fallback nunca entram no cache semantico: evita perpetuar a falha
  const cacheavel = !ehRespostaDeRecusa(resposta) && resposta !== RESPOSTA_FALLBACK;
  if (cacheElegivel && cacheavel) {
    guardarCache(embedding, mensagem, chaveCache, resposta, fontes, gerado.modelo.nomeModelo, tokensUso);
  }
  persistirConversa(
    conversaId,
    perfil,
    montarHistoricoConversa(historico, mensagem, resposta, !!imagem),
  );
  registrarMetrica({
    modelo: gerado.modelo.nomeModelo,
    provedor: gerado.modelo.provedor,
    stream: false,
    latenciaMs: Date.now() - t0,
    fontes: fontes.length,
    perfil,
    tokensEntrada,
    tokensTotal: tokensUso,
  });

  return json(200, {
    resposta,
    modelo: gerado.modelo.nomeModelo,
    provedor: gerado.modelo.provedor,
    aviso,
    tokens: tokensUso,
    fontes,
  });
}

// Despacha: Vercel chama com (req Node, res); dev-server/testes chamam com Request Web
export default async function handler(req: Request): Promise<Response>;
export default async function handler(
  req: Request | IncomingMessage,
  res?: ServerResponse,
): Promise<Response | void>;
export default async function handler(
  req: Request | IncomingMessage,
  res?: ServerResponse,
): Promise<Response | void> {
  if (res) {
    await tratarRequisicaoNode(req as IncomingMessage, res, webHandler);
    return;
  }
  return webHandler(req as Request);
}
