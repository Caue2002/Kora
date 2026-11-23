// Deteccao de intencao simples da mensagem do usuario
// Mensagens casuais (agradecimento, saudacao, despedida) nao precisam de
// busca no RAG: pular a consulta reduz latencia e evita fontes irrelevantes

// Palavras de cortesia aceitas (normalizadas, sem acento). A mensagem so e
// considerada casual quando TODAS as palavras estao nesta lista — qualquer
// termo fora dela ("pedido", "item", "codigo"...) desliga o atalho
const PALAVRAS_CASUAIS = new Set([
  // saudos e cortesia
  'oi', 'ola', 'oie', 'eae', 'eai', 'hey', 'hi', 'hello', 'bom', 'dia',
  'tarde', 'noite', 'tudo', 'bem', 'hj', 'hoje',
  // agradecimento e despedida
  'obrigado', 'obrigada', 'obrigados', 'obrigadas', 'valeu', 'valew',
  'vlw', 'brigado', 'brigada', 'thanks', 'thank', 'you', 'tchau', 'tchao',
  'adeus', 'ate', 'mais', 'falou', 'flw', 'falo', 'bye',
  // confirmacoes e reacoes leves
  'sim', 'nao', 'ok', 'okay', 'certo', 'beleza', 'blz', 'top', 'show',
  'uhum', 'aham', 'hm', 'hmm', 'perfeito', 'otimo', 'otima', 'legal',
  'massa', 'demais', 'fixed', 'fechado', 'combinado',
  // pedidos de cortesia
  'por', 'favor', 'gentileza', 'pf', 'pfv', 'please', 'obg',
  // intensificadores comuns em agradecimentos
  'muito', 'mts', 'realmente', 'serio',
]);

const MAX_PALAVRAS_CASUAIS = 6;

// Remove acentos e normaliza para minusculas
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// True quando a mensagem inteira e composta so de cortesia/reacao leve.
// Conservador de proposito: na duvida, a mensagem segue o fluxo completo
// com busca RAG — nunca se perde contexto de disputa por engano
export function ehMensagemCasual(texto: string): boolean {
  const limpo = normalizar(texto);
  if (limpo.length === 0) return false;
  const palavras = limpo.split(' ');
  if (palavras.length > MAX_PALAVRAS_CASUAIS) return false;
  return palavras.every((p) => PALAVRAS_CASUAIS.has(p));
}
