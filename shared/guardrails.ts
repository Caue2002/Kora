// Guardrails de saida: classificacao deterministica da resposta do LLM
// ANTES de chegar ao usuario. Complementa a protecao de entrada (prompt):
// aqui detectamos o que o modelo PORVENTURA geraria de errado — vazamento
// de instrucoes internas e dados pessoais (PII).
// Heuristico propositalmente conservador: falso positivo custa uma
// regeneracao, falso negativo custa um vazamento — na duvida, reprova.

export interface ResultadoGuardrail {
  ok: boolean;
  motivo?: string;
}

// Padroes de vazamento de prompt/instrucoes internas. Frases que o modelo
// legitimo nunca precisaria dizer ao usuario do Kora
const PADROES_VAZAMENTO: RegExp[] = [
  /minhas instru[çc][õo]es\s+(internas\s+)?(s[ãa]o|dizem|mandam)/i,
  /prompt\s+(do|de)\s+sistema/i,
  /system\s+prompt/i,
  /diretrizes?\s+internas?/i,
  /ignorando\s+(todas\s+)?(as\s+|suas\s+)?instru/i,
  /modo\s+desenvolvedor/i,
  /reveal\s+(your|the)\s+(system\s+)?prompt/i,
  /a\s+partir\s+de\s+agora[, ]+(voc[êe]|tu)\s+(ser[áa]|[eé])/i,
];

// PII: email e CPF formatado. Telefone NAO entra — o fluxo legitimo pode
// citar telefone de entregador/loja do pedido ficticio
const PADROES_PII: RegExp[] = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,
];

// Classifica o texto final do modelo. Retorna ok=false + motivo quando
// qualquer padrao reprova; o chamador decide regenerar ou usar fallback
export function classificarSaida(texto: string): ResultadoGuardrail {
  if (!texto || texto.trim().length === 0) {
    return { ok: false, motivo: 'resposta vazia' };
  }
  for (const padrao of PADROES_VAZAMENTO) {
    if (padrao.test(texto)) {
      return { ok: false, motivo: `possivel vazamento de instrucoes: ${padrao.source.slice(0, 40)}` };
    }
  }
  for (const padrao of PADROES_PII) {
    if (padrao.test(texto)) {
      return { ok: false, motivo: `possivel dado pessoal exposto: ${padrao.source.slice(0, 40)}` };
    }
  }
  return { ok: true };
}
