// Cliente unificado de chamada aos modelos de LLM
// Suporta os 4 provedores: Gemini (formato proprio) e Groq/Cerebras/OpenRouter (formato OpenAI)
// Todas as chamadas usam temperatura baixa (0 a 0.1) conforme a especificacao

import type { ModeloConfig } from './env.js';
import { maxTokensSaida } from './env.js';

export interface MensagemChat {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface RespostaLLM {
  texto: string;
  tokensUso?: number;
}

export class ErroLimiteModelo extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroLimiteModelo';
  }
}

// Detecta erro de cota/limite do provedor pela mensagem ou status HTTP
function ehErroLimite(status: number, corpo: string): boolean {
  const c = corpo.toLowerCase();
  return (
    status === 429 ||
    c.includes('rate limit') ||
    c.includes('quota') ||
    c.includes('resource_exhausted') ||
    c.includes('tokens per day') ||
    c.includes('insufficient_quota')
  );
}

async function chamarGemini(modelo: ModeloConfig, mensagens: MensagemChat[], temperatura: number, maxTokens: number): Promise<RespostaLLM> {
  // Gemini usa systemInstruction + contents; o system vai separado das mensagens
  const system = mensagens.find((m) => m.role === 'system')?.content ?? '';
  const contents = mensagens
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  const url = `${modelo.endpoint}/${modelo.nomeModelo}:generateContent?key=${modelo.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: { temperature: temperatura, maxOutputTokens: maxTokens },
    }),
  });
  const corpo = await res.text();
  if (!res.ok) {
    if (ehErroLimite(res.status, corpo)) throw new ErroLimiteModelo(`Gemini limite: ${corpo.slice(0, 200)}`);
    throw new Error(`Gemini ${res.status}: ${corpo.slice(0, 300)}`);
  }
  const json = JSON.parse(corpo) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { totalTokenCount?: number };
  };
  const texto = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return { texto, tokensUso: json.usageMetadata?.totalTokenCount };
}

async function chamarOpenAICompat(modelo: ModeloConfig, mensagens: MensagemChat[], temperatura: number, maxTokens: number): Promise<RespostaLLM> {
  // Groq, Cerebras e OpenRouter usam o formato chat/completions compativel com OpenAI
  const res = await fetch(modelo.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${modelo.apiKey}`,
    },
    body: JSON.stringify({
      model: modelo.nomeModelo,
      messages: mensagens,
      temperature: temperatura,
      max_tokens: maxTokens,
    }),
  });
  const corpo = await res.text();
  if (!res.ok) {
    if (ehErroLimite(res.status, corpo)) throw new ErroLimiteModelo(`${modelo.provedor} limite: ${corpo.slice(0, 200)}`);
    throw new Error(`${modelo.provedor} ${res.status}: ${corpo.slice(0, 300)}`);
  }
  const json = JSON.parse(corpo) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  return {
    texto: json.choices?.[0]?.message?.content ?? '',
    tokensUso: json.usage?.total_tokens,
  };
}

// Ponto unico de chamada: despacha para o formato correto do provedor
export async function chamarLLM(
  modelo: ModeloConfig,
  mensagens: MensagemChat[],
  opcoes?: { temperatura?: number; maxTokens?: number },
): Promise<RespostaLLM> {
  const temperatura = opcoes?.temperatura ?? 0.1;
  const maxTokens = opcoes?.maxTokens ?? maxTokensSaida();
  if (modelo.provedor === 'gemini') {
    return chamarGemini(modelo, mensagens, temperatura, maxTokens);
  }
  return chamarOpenAICompat(modelo, mensagens, temperatura, maxTokens);
}
