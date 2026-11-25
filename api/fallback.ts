// Fallback em camadas do /api/chat (spec/SPEC-fallback-camadas.md)
// Quando a fila de modelos falha por completo, a resposta de emergencia e
// resolvida em cascata, SEM nenhuma chamada de LLM (todos podem estar fora):
//   1. cache semantico relaxado (score >= 0.80, qualquer escopo)
//   2. banco canonico por intencao (tabela fallback_respostas)
//   3. variantes genericas rotacionadas por conversa
// Toda camada falha silenciosamente para a proxima — o usuario nunca recebe
// erro cru, no maximo a variante generica

import { consultar, rpc } from '../shared/supabase.js';
import { extrairCodigoPedido } from '../shared/pedidos.js';
import { ehMensagemCasual, ehPerguntaMeta } from '../coherence/index.js';
import { ehRespostaDeRecusa } from '../coherence/validacao.js';

// Variantes genericas da ultima instancia: mesma mensagem de hoje,
// reescritas com ritmos diferentes para nao soar repetitiva
export const VARIANTES_FALLBACK: readonly string[] = [
  'Tive uma dificuldade para formular essa resposta agora. Posso te ajudar com disputas de pedidos do Kora (item faltante, item errado, qualidade, atraso), confirmacao de pedido por codigo, orientacao sobre evidencias e parecer de conciliacao — e tambem respondo assuntos gerais. Como posso ajudar?',
  'Estou com uma instabilidade tecnica no momento e nao consegui processar direito o que voce disse. Enquanto isso: para disputas de pedido preciso do codigo, da descricao do problema e de fotos ou prints. Me conta o que aconteceu?',
  'Nao consegui gerar uma resposta adequada agora. Mas ja adianto: sou a Nori e cuido de triagem de pedidos do Kora — item faltante, item errado, qualidade e entrega. Pode repetir ou detalhar sua situacao?',
  'Tive um problema tecnico ao responder. Se for sobre um pedido com problema, me passe o codigo dele e o que aconteceu (faltou item, veio errado, qualidade, atraso) que eu te oriento.',
  'Minha resposta falhou por um erro interno. Tenta de novo em instantes ou, se preferir, me diga o codigo do pedido e a descricao do problema que eu sigo por aqui.',
];

const CONJUNTO_VARIANTES = new Set(VARIANTES_FALLBACK);

// True quando o texto e uma resposta de fallback generica (qualquer
// variante). Respostas vindas do cache ou do banco canonico NAO entram
// aqui — elas sao conteudo util e podem ser re-cacheadas se fizer sentido
export function ehFallback(texto: string): boolean {
  return CONJUNTO_VARIANTES.has(texto.trim());
}

// Score minimo do cache na camada de emergencia: bem abaixo dos 0.95 do
// caminho normal — aqui o objetivo e alguma resposta util, nao a perfeita
const CACHE_FALLBACK_SCORE_MIN = 0.8;

interface LinhaCacheFallback {
  pergunta: string;
  resposta: string;
  fontes: Array<{ titulo: string; categoria?: string | null }>;
  modelo: string | null;
  escopo: string;
  score: number;
}

// Intencoes do banco canonico. A ordem importa: a primeira que casar vence.
// Reflete os tipos de disputa do dominio Kora mais os casos fora dela
const INTENCOES_FALLBACK = [
  'meta',
  'saudacao',
  'confirmacao_pedido',
  'evidencias',
  'atraso',
  'item_faltante',
  'item_errado',
  'qualidade',
  'conciliacao',
  'geral',
] as const;
export type IntencaoFallback = (typeof INTENCOES_FALLBACK)[number];

// Pergunta dependente de data/hora: respostas assim nunca devem ser
// servidas como emergencia dias depois — espelha PERGUNTA_TEMPORAL do chat
const PERGUNTA_TEMPORAL_FALLBACK =
  /que dia|dia é hoje|dia e hoje|que horas|hora agora|horas agora|data de hoje|clima|previsão do tempo|previsao do tempo|temperatura fora/i;

const RE_ITEM_FALTANTE = /faltou|faltante|nao veio|não veio|sumiu|veio menos|faltaram|nao recebi|não recebi|nao chegou tudo/;
const RE_ITEM_ERRADO = /errado|trocaram|trocado|veio outro|outro item|produto errado|sabor errado|tamanho errado/;
const RE_QUALIDADE = /frio|estragad|qualidade|mole|duro|velho|avaria|sujo|gostoso|higiene|derretid/;
const RE_ATRASO = /atras|demor|nao chegou|não chegou|nao foi entregue|não foi entregue|ainda nao chegou|ainda não chegou|cancelou|cancelado/;
const RE_EVIDENCIA = /foto|fotografia|print|comprovante|nota fiscal|evidencia|evidência|recibo|cupom/;
const RE_CONCILIACAO = /reembolso|estorno|devolucao|devolução|dinheiro de volta|parecer|conciliacao|conciliação|resolver|resolucao|resolução|reclama|procon/;
const RE_PEDIDO_CODIGO = /codigo|código|pedido|pedido numero|numero do pedido/;

// Detecta a intencao da mensagem para escolher a resposta canonica.
// Heuristico deterministico de proposito: roda quando TODOS os modelos
// podem estar fora — nao pode depender de LLM. Conservador: na duvida,
// 'geral' (a resposta canonica generica cobre qualquer assunto)
export function detectarIntencaoFallback(mensagem: string): IntencaoFallback {
  const t = mensagem.trim();
  if (t.length === 0) return 'geral';
  // Temporal nunca tem resposta canonica segura: cai na generica
  if (PERGUNTA_TEMPORAL_FALLBACK.test(t)) return 'geral';
  if (ehPerguntaMeta(t)) return 'meta';
  if (ehMensagemCasual(t)) return 'saudacao';
  // Disputas especificas vem antes de confirmacao de pedido: "meu pedido
  // KORA-1 atrasou" e um caso de atraso, nao um pedido de confirmacao.
  // Evidencias e conciliacao ficam depois das categorias de disputa:
  // "faltou item, segue foto" e item faltante, nao so envio de evidencia
  if (RE_ATRASO.test(t)) return 'atraso';
  if (RE_ITEM_FALTANTE.test(t)) return 'item_faltante';
  if (RE_ITEM_ERRADO.test(t)) return 'item_errado';
  if (RE_QUALIDADE.test(t)) return 'qualidade';
  if (RE_EVIDENCIA.test(t)) return 'evidencias';
  if (RE_CONCILIACAO.test(t)) return 'conciliacao';
  // Codigo de pedido explicito ou pedido de localizacao/status sem
  // descricao de problema: intencao de confirmacao/rastrelro
  if (extrairCodigoPedido(t) || RE_PEDIDO_CODIGO.test(t)) {
    if (extrairCodigoPedido(t) || /confirm|localiz|rastre|status|onde esta|onde está/.test(t.toLowerCase())) {
      return 'confirmacao_pedido';
    }
  }
  return 'geral';
}

// Hash simples e estavel (djb2) para escolher variante/resposta por
// conversa: a mesma conversa ve a mesma resposta em turnos seguidos,
// conversas diferentes veem versoes diferentes
function hashTexto(texto: string): number {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) {
    h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Escolhe uma variante generica de forma estavel por conversaId;
// sem conversaId (chamadas avulsas) o indice varia a cada chamada
export function escolherVarianteFallback(conversaId?: string): string {
  const base = conversaId ?? `${Date.now()}-${Math.random()}`;
  return VARIANTES_FALLBACK[hashTexto(base) % VARIANTES_FALLBACK.length]!;
}

export type CamadaFallback = 'cache-fallback' | 'banco-fallback' | 'generico-fallback';

export interface ResultadoFallback {
  texto: string;
  camada: CamadaFallback;
  fontes?: Array<{ titulo: string; categoria?: string | null }>;
}

// Camada 1: vizinho mais proximo no cache semantico com limiar relaxado.
// Serve qualquer escopo ('geral' ou 'fallback') — respostas de follow-up
// gravadas como escopo='fallback' sao exatamente a rede de seguranca
// que cresce conforme o uso. Devolve null em qualquer falha
async function buscarCacheFallback(
  embedding: number[],
  chaveCache: string,
): Promise<ResultadoFallback | null> {
  try {
    const linhas = await rpc<LinhaCacheFallback[]>('buscar_cache_fallback', {
      p_embedding: `[${embedding.join(',')}]`,
      p_perfil: chaveCache,
    });
    const linha = linhas?.[0];
    if (!linha || linha.score < CACHE_FALLBACK_SCORE_MIN) return null;
    // Mesma higiene do cache normal: recusa e fallback nunca sao servidos
    if (ehRespostaDeRecusa(linha.resposta) || ehFallback(linha.resposta)) return null;
    return {
      texto: linha.resposta,
      camada: 'cache-fallback',
      fontes: linha.fontes ?? [],
    };
  } catch {
    return null; // funcao ainda nao existe ou banco fora
  }
}

interface LinhaFallbackBanco {
  intencao: string;
  resposta: string;
  prioridade: number;
}

// Camada 2: resposta canonica da intencao detectada. Quando a intencao tem
// mais de uma seed com a mesma prioridade, a escolha e estavel por
// conversa — mesmo criterio das variantes genericas
async function buscarFallbackBanco(
  intencao: IntencaoFallback,
  conversaId?: string,
): Promise<ResultadoFallback | null> {
  try {
    const linhas = await consultar<LinhaFallbackBanco>(
      'fallback_respostas',
      `intencao=eq.${intencao}&order=prioridade.asc&limit=8`,
    );
    if (!linhas || linhas.length === 0) return null;
    const melhorPrioridade = linhas[0]!.prioridade;
    const candidatas = linhas.filter((l) => l.prioridade === melhorPrioridade);
    const base = conversaId ?? `${Date.now()}-${Math.random()}`;
    const escolhida = candidatas[hashTexto(base) % candidatas.length]!;
    return { texto: escolhida.resposta, camada: 'banco-fallback' };
  } catch {
    return null; // tabela ainda nao existe ou banco fora
  }
}

// Resolve a resposta de emergencia em cascata. `chaveCache` e a mesma
// chave do cache normal (perfil|periodo|codigo): entradas de fallback
// gravadas com ela sao encontradas aqui sem colisao com outros contextos
export async function resolverFallback(opts: {
  mensagem: string;
  embedding?: number[];
  chaveCache: string;
  conversaId?: string;
}): Promise<ResultadoFallback> {
  const { mensagem, embedding, chaveCache, conversaId } = opts;
  if (embedding) {
    const doCache = await buscarCacheFallback(embedding, chaveCache);
    if (doCache) return doCache;
  }
  const doBanco = await buscarFallbackBanco(detectarIntencaoFallback(mensagem), conversaId);
  if (doBanco) return doBanco;
  return { texto: escolherVarianteFallback(conversaId), camada: 'generico-fallback' };
}
