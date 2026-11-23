// Validacao obrigatoria de coerencia antes da entrega da resposta
// Verifica consistencia logica da resposta contra fatos do usuario e regras recuperadas
// Duas camadas: heuristica local (rapida, sem custo) e verificacao via LLM (opcional)

import { chamarLLM } from '../shared/llm.js';
import type { ModeloConfig } from '../shared/env.js';
import type { MensagemChat } from '../shared/llm.js';

export interface ResultadoValidacao {
  ok: boolean;
  problemas: string[];
}

// Checagens heuristicas rapidas e sem custo de tokens
export function validarHeuristico(resposta: string): ResultadoValidacao {
  const problemas: string[] = [];
  const texto = resposta.trim();

  if (texto.length === 0) problemas.push('resposta vazia');
  if (texto.length > 4000) problemas.push('resposta excessivamente longa');
  // padroes que indicam quebra de grounding ou acusacao indevida
  if (/\b(culpado|culpada|responsavel foi|foi comprovado que)\b/i.test(texto)) {
    problemas.push('possivel acusacao sem evidencia');
  }
  if (/\b(nunca|sempre|com certeza absoluta|garantidamente)\b/i.test(texto)) {
    problemas.push('linguagem de certeza absoluta incompativel com evidencia parcial');
  }
  return { ok: problemas.length === 0, problemas };
}

// Frases de incapacidade generica que o modelo as vezes emite em vez de
// responder (ex.: perguntas meta ou de conhecimento geral). Diferente dos
// limites legitimos ("nao posso cancelar pedidos"), estas indicam que a
// resposta inteira falhou e deve ser regenerada ou substituida.
const PADROES_RECUSA = [
  /\b(n[aã]o|nao)\s+(consegui|consigo|conseguiu|pude|posso)\s+(te\s+|lhe\s+)?(responder|ajudar|atender)\b/i,
  // "nao tenho como responder/ajudar" — o verbo vem logo apos "como",
  // entao limites legitimos ("nao tenho como reembolsar") nao disparam
  /\bn[aã]o\s+(tenho|ha|há)\s+como\s+(te\s+|lhe\s+)?(responder|ajudar|atender|concluir)\b/i,
  /\bn[aã]o\s+(tenho|ha|há)\s+(informacoes|informações|dados|capacidade|condicoes|condições)\b[^.]{0,30}?\b(responder|ajudar|atender|concluir)\b/i,
  /\b(desculpe|desculpa|sinto muito)[,.]?\s+(mas\s+)?n[aã]o\s+(consegui|consigo|entendi|compreendi|posso)/i,
  /\bn[aã]o\s+(entendi|compreendi)\s+(sua|o que|a sua)\s+(mensagem|pergunta|solicitacao|solicitação)/i,
  /\b(n[aã]o|nao)\s+foi\s+possivel\s+(gerar|obter|processar|responder|concluir)/i,
  /\bfora\s+do\s+meu\s+(alcance|escopo|conhecimento)\b/i,
];

// Detecta se o texto e uma recusa/incapacidade generica em vez de resposta.
// Usado para regenerar a resposta ou aplicar o fallback de ultima instancia.
export function ehRespostaDeRecusa(texto: string): boolean {
  const t = texto.trim();
  if (t.length === 0) return false;
  // Respostas longas que apenas mencionam um limite legitimo nao sao recusa
  if (t.length > 600) return false;
  return PADROES_RECUSA.some((p) => p.test(t));
}

// Verificacao semantica via LLM: compara resposta com historico e contexto
// Usa o modelo de menor prioridade disponivel para economizar tokens do principal
export async function validarComLLM(
  modelo: ModeloConfig,
  resposta: string,
  historico: MensagemChat[],
  contexto: string,
): Promise<ResultadoValidacao> {
  const mensagens: MensagemChat[] = [
    {
      role: 'system',
      content:
        'Voce e um verificador de coerencia. Analise se a resposta do agente contradiz fatos do usuario, conflita com as regras do contexto ou afirma conclusoes sem base. Responda APENAS com JSON: {"ok": true|false, "problemas": ["..."]}.',
    },
    {
      role: 'user',
      content: [
        `Contexto de regras:\n${contexto.slice(0, 2000)}`,
        `Historico recente:\n${historico.slice(-6).map((m) => `${m.role}: ${m.content}`).join('\n')}`,
        `Resposta do agente:\n${resposta}`,
      ].join('\n\n'),
    },
  ];

  try {
    const { texto } = await chamarLLM(modelo, mensagens, { temperatura: 0, maxTokens: 200 });
    const match = texto.match(/\{[\s\S]*\}/);
    if (!match) return { ok: true, problemas: [] };
    const json = JSON.parse(match[0]) as { ok?: boolean; problemas?: string[] };
    return { ok: json.ok !== false, problemas: json.problemas ?? [] };
  } catch {
    // Falha na verificacao nao deve bloquear a resposta; heuristica ja rodou
    return { ok: true, problemas: [] };
  }
}
