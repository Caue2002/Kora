// Cliente unificado de chamada aos modelos de LLM
// Suporta os provedores: Gemini (formato proprio) e Groq/Pollinations (formato OpenAI)
// Todas as chamadas usam temperatura baixa (0 a 0.1) conforme a especificacao

import type { ModeloConfig } from './env.js';
import { maxTokensSaida, timeoutLlmMs } from './env.js';

export interface ImagemAnexo {
  base64: string;
  mime: string;
}

export interface MensagemChat {
  role: 'system' | 'user' | 'assistant';
  content: string;
  imagem?: ImagemAnexo;
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

// Monta as partes de uma mensagem para o formato Gemini (texto + imagem inline)
function partesGemini(m: MensagemChat): Array<Record<string, unknown>> {
  const partes: Array<Record<string, unknown>> = [{ text: m.content }];
  if (m.imagem) {
    partes.push({ inline_data: { mime_type: m.imagem.mime, data: m.imagem.base64 } });
  }
  return partes;
}

// Provedores OpenAI-compat configurados sao textuais; a imagem vira uma nota textual
function mensagensOpenAI(mensagens: MensagemChat[]): Array<Record<string, unknown>> {
  return mensagens.map((m) => ({
    role: m.role,
    content: m.imagem ? `${m.content}\n[O usuario anexou uma imagem (${m.imagem.mime}) que este modelo nao consegue analisar visualmente.]` : m.content,
  }));
}

async function chamarGemini(modelo: ModeloConfig, mensagens: MensagemChat[], temperatura: number, maxTokens: number): Promise<RespostaLLM> {
  // Gemini usa systemInstruction + contents; o system vai separado das mensagens
  const system = mensagens.find((m) => m.role === 'system')?.content ?? '';
  const contents = mensagens
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: partesGemini(m),
    }));
  const url = `${modelo.endpoint}/${modelo.nomeModelo}:generateContent?key=${modelo.apiKey}`;
  // AbortSignal.timeout limita a chamada inteira: provedor pendurado falha
  // rapido e o failover tenta o proximo modelo em vez de travar a requisicao
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(timeoutLlmMs()),
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: {
        temperature: temperatura,
        maxOutputTokens: maxTokens,
        // Sem isso os modelos Gemini 3.x/4 gastam o maxOutputTokens em
        // "thoughts" invisiveis e a resposta visivel sai truncada/vazia.
        // As respostas do Nori sao curtas por design: thinking desligado.
        thinkingConfig: { thinkingBudget: 0 },
      },
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
  // Groq e Pollinations usam o formato chat/completions compativel com OpenAI
  const res = await fetch(modelo.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${modelo.apiKey}`,
    },
    signal: AbortSignal.timeout(timeoutLlmMs()),
    body: JSON.stringify({
      model: modelo.nomeModelo,
      messages: mensagensOpenAI(mensagens),
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

// ===== Streaming de resposta token a token =====
// Bomba os deltas SSE do provedor para um ReadableStream de texto puro,
// permitindo que o frontend exiba a resposta conforme ela e gerada

// Processa um corpo SSE e chama onDelta para cada trecho de texto recebido
async function bombearSSE(
  corpo: ReadableStream<Uint8Array>,
  ehGemini: boolean,
  onDelta: (texto: string) => void,
): Promise<void> {
  const reader = corpo.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const processarLinha = (linha: string) => {
    if (!linha.startsWith('data:')) return;
    const json = linha.slice(5).trim();
    if (!json || json === '[DONE]') return;
    try {
      const ev = JSON.parse(json) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const t = ehGemini
        ? (ev.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '')
        : (ev.choices?.[0]?.delta?.content ?? '');
      if (t) onDelta(t);
    } catch {
      // ignora linhas malformadas do stream
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const linhas = buffer.split('\n');
    buffer = linhas.pop() ?? '';
    for (const linha of linhas) processarLinha(linha);
  }
  if (buffer.trim()) processarLinha(buffer);
}

// Timeout apenas para o handshake HTTP do stream: se os headers nao chegarem
// a tempo, aborta e o failover tenta o proximo modelo. Uma vez recebidos os
// headers, o temporizador e cancelado — o corpo SSE pode durar o necessario
function sinalHandshake(ms: number): { signal: AbortSignal; cancelar: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  // nao segura o event loop em scripts/testes
  if (typeof t === 'object' && 'unref' in t) (t as { unref: () => void }).unref();
  return { signal: ctrl.signal, cancelar: () => clearTimeout(t) };
}

// Abre a conexao de streaming com o provedor
async function abrirStream(
  modelo: ModeloConfig,
  mensagens: MensagemChat[],
  temperatura = 0.1,
): Promise<Response> {
  const handshake = sinalHandshake(timeoutLlmMs());
  try {
    let res: Response;
    if (modelo.provedor === 'gemini') {
      const system = mensagens.find((m) => m.role === 'system')?.content ?? '';
      const contents = mensagens
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: partesGemini(m),
        }));
      const url = `${modelo.endpoint}/${modelo.nomeModelo}:streamGenerateContent?alt=sse&key=${modelo.apiKey}`;
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: handshake.signal,
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents,
          generationConfig: {
            temperature: temperatura,
            maxOutputTokens: maxTokensSaida(),
            // Mesmo motivo do generateContent: evita que o raciocinio interno
            // consuma o orcamento de tokens e trunque a resposta visivel
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
    } else {
      res = await fetch(modelo.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${modelo.apiKey}`,
        },
        signal: handshake.signal,
        body: JSON.stringify({
          model: modelo.nomeModelo,
          messages: mensagensOpenAI(mensagens),
          temperature: temperatura,
          max_tokens: maxTokensSaida(),
          stream: true,
        }),
      });
    }
    // Headers recebidos: o corpo SSE pode fluir sem limite de tempo
    handshake.cancelar();
    return res;
  } catch (erro) {
    handshake.cancelar();
    throw erro;
  }
}

// Gera a resposta em streaming real; lanca ErroLimiteModelo em falha de cota
export async function streamLLM(
  modelo: ModeloConfig,
  mensagens: MensagemChat[],
  opcoes?: { temperatura?: number },
): Promise<ReadableStream<Uint8Array>> {
  const res = await abrirStream(modelo, mensagens, opcoes?.temperatura ?? 0.1);
  if (!res.ok || !res.body) {
    const corpo = await res.text().catch(() => '');
    if (ehErroLimite(res.status, corpo)) throw new ErroLimiteModelo(`stream ${modelo.provedor} limite`);
    throw new Error(`stream ${modelo.provedor} ${res.status}: ${corpo.slice(0, 300)}`);
  }
  const encoder = new TextEncoder();
  const ehGemini = modelo.provedor === 'gemini';
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await bombearSSE(res.body!, ehGemini, (texto) => controller.enqueue(encoder.encode(texto)));
      } catch {
        // stream interrompido: encerra o que ja foi enviado
      } finally {
        controller.close();
      }
    },
  });
}
