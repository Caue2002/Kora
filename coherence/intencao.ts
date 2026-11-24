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

// Saudacao no inicio da mensagem ("oi", "ola", "bom dia", "boa tarde",
// "tudo bem", "e ai"...). Usada para decidir se a Nori deve saudar de volta
// e para incluir o periodo do dia na chave do cache semantico
const SAUDACAO_INICIAL =
  /^(oi+|ola|oie|eae|eai|hey|hi|hello|opa|salve|bom\s+dia|boa\s+(tarde|noite|madrugada)|tudo\s+bem|e\s+ai)\b/;

// True quando a mensagem comeca com uma saudacao — com ou sem texto depois
// ("oi, meu pedido nao chegou" tambem conta: o usuario foi educado)
export function ehSaudacao(texto: string): boolean {
  return SAUDACAO_INICIAL.test(normalizar(texto));
}

// Perguntas sobre a propria agente (modelos de IA, criador, capacidades,
// limites). A resposta sai da secao "Sobre voce" do prompt — nao depende
// da base de conhecimento, entao dispensam a busca RAG como as casuais
const META_RES = [
  // modelos de IA / provedores utilizados
  /\bmodelos?\b.*\b(usa|utiliza|voce|ia|inteligencia|funciona|sao)\b/,
  /\b(usa|utiliza|roda|funciona|e feito|esta feito|feita com)\b.*\b(modelos?|gemini|gpt|groq|pollinations|llm|provedores?)\b/,
  /\b(modelos?|ia)\s+de\s+(inteligencia|ia)\b/,
  // criador / desenvolvedor
  /\b(criador|criadora|desenvolvedor|desenvolvedora|autor|autora|dono|dona)\b/,
  /\b(criou|cria|desenvolveu|desenvolve|programou|construiu|inventou)\b.*\b(voce|vc|nori|te|lhe|app|kora)\b/,
  /\b(quem|qual|de quem)\b.*\b(criou|desenvolveu|programou|construiu|fez)\b/,
  // capacidades, identidade e limites
  /\bo que\b.*\b(voce|vc|nori)\b.*\b(sabe|pode|consegue|faz|funciona|serve)\b/,
  /\bno que\b.*\b(voce|vc|nori)\b.*\b(pode|sabe|consegue|ajudar|fazer)\b/,
  /\b(quem|o que)\s+(e|eh)\s+(voce|vc|a nori)\b/,
  /\b(voce|vc|a nori)\b.*\b(sabe|pode|consegue)\s+fazer\b/,
  /\b(me|nos)\s+(fale|conte|explique|diga|mostre)\b.*\b(sobre|de)\b.*\b(voce|vc|si|a nori)\b/,
  /\b(suas|tuas)\s+(funcoes|capacidades|habilidades|limitacoes)\b/,
];

// True quando a mensagem pergunta sobre a propria agente
export function ehPerguntaMeta(texto: string): boolean {
  const limpo = normalizar(texto);
  if (limpo.length === 0) return false;
  return META_RES.some((re) => re.test(limpo));
}
