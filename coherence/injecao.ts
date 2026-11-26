// Deteccao heuristica de injecao de prompt (spec SPEC-guardrails-injecao).
// Conservadora de proposito: so padroes inequivocos de ataque — na duvida
// retorna false e a mensagem segue o fluxo normal. Um falso positivo aqui
// injetaria a diretiva de recusa numa disputa legitima, entao cada regex
// exige o verbo de ataque JUNTO do alvo (instrucoes/prompt/regras internas).

// Normaliza para minusculas sem acento, igual ao restante do coherence
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PADROES_INJECAO = [
  // "ignore todas as instrucoes", "desconsidere as regras anteriores"
  /\b(ignore|ignorar|desconsidere|desconsiderar|esqueca|esquecer|esqueça|descart[ae]|abandon[ae]|override|sobrescreva|anule|anular)\b[^.?!]{0,60}\b(instru[cç][oõ]es|regras|diretrizes|prompt|programa[cç][aã]o|configura[cç][aã]o|comandos?)\b/,
  // "repita/revele/mostre seu prompt", "qual e o seu system prompt"
  /\b(repita|repetir|reproduza|revele|revelar|mostre|mostrar|diga|dizer|invente|inventar|imprima|imprimir|exiba|exibir|compartilhe|compartilhar|me de|me passa|me passa|qual|quais)\b[^.?!]{0,50}\b(prompt|instru[cç][oõ]es|regras internas|system prompt|prompt do sistema|prompt interno)\b/,
  // "system prompt", "prompt do sistema", "instrucoes internas" como termo
  /\b(system prompt|prompt do sistema|prompt interno|instru[cç][oõ]es internas|regras internas|prompt original|seu prompt)\b/,
  // jailbreak / modos especiais
  /\b(jailbreak|dan mode|developer mode|modo desenvolvedor|do anything now|sem restri[cç][oõ]es|sem filtro|ignore (all |todas )?(previous|anteriores)|act as|finge ser|finja ser)\b/,
];

// True quando a mensagem tenta extrair, revelar ou manipular as
// instrucoes internas do agente. Roda em toda mensagem — e regex local,
// custo desprezivel
export function detectarInjecaoPrompt(texto: string): boolean {
  const limpo = normalizar(texto);
  if (limpo.length === 0) return false;
  return PADROES_INJECAO.some((re) => re.test(limpo));
}
