// Cliente unificado de chamada aos modelos de LLM
// Suporta os provedores: Gemini (formato proprio) e Groq/Pollinations (formato OpenAI)
// Todas as chamadas usam temperatura baixa (0 a 0.1) conforme a especificacao

import type { ModeloConfig } from './env.js';
import { maxTokensSaida, timeoutLlmMs } from './env.js';
import { TOOLS_GEMINI, executarTool, type ChamadaTool } from './tools.js';

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

// Contents do Gemini a partir das mensagens internas (system vai separado)
function conteudosGemini(mensagens: MensagemChat[]): Array<Record<string, unknown>> {
  return mensagens
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: partesGemini(m),
    }));
}

// Extrai texto e function calls das parts de uma resposta Gemini
function partesRespostaGemini(json: {
  candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }>;
}): { texto: string; chamadas: ChamadaTool[] } {
  const partes = json.candidates?.[0]?.content?.parts ?? [];
  const texto = partes
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('');
  const chamadas: ChamadaTool[] = partes
    .map((p) => p.functionCall as { name?: string; args?: Record<string, unknown> } | undefined)
    .filter((fc): fc is { name: string; args: Record<string, unknown> } => typeof fc?.name === 'string')
    .map((fc) => ({ name: fc.name, args: fc.args ?? {} }));
  return { texto, chamadas };
}

// Maximo de rodadas de function calling por resposta: evita loop infinito
// se o modelo insistir em chamar tools sem produzir texto final
const MAX_TOOL_ROUNDS = 2;

// Anexa o resultado de uma tool como functionResponse nas contents do Gemini
function anexarFunctionResponse(
  contents: Array<Record<string, unknown>>,
  chamada: ChamadaTool,
  resultado: unknown,
): void {
  contents.push({
    role: 'user',
    parts: [
      {
        functionResponse: {
          name: chamada.name,
          response: { result: resultado },
        },
      },
    ],
  });
}

async function chamarGemini(modelo: ModeloConfig, mensagens: MensagemChat[], temperatura: number, maxTokens: number, jsonMode = false, comTools = false): Promise<RespostaLLM> {
  // Gemini usa systemInstruction + contents; o system vai separado das mensagens
  const system = mensagens.find((m) => m.role === 'system')?.content ?? '';
  const contents = conteudosGemini(mensagens);
  const url = `${modelo.endpoint}/${modelo.nomeModelo}:generateContent?key=${modelo.apiKey}`;

  // Loop de function calling: o modelo pode pedir tools ate MAX_TOOL_ROUNDS
  // vezes; na ultima iteracao as tools sao removidas para forcar texto final
  for (let rodada = 0; rodada <= MAX_TOOL_ROUNDS; rodada++) {
    const usarTools = comTools && rodada < MAX_TOOL_ROUNDS;
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
          // JSON mode: saida garantida como JSON valido (extracao estruturada)
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
        ...(usarTools
          ? { tools: [TOOLS_GEMINI], toolConfig: { functionCallingConfig: { mode: 'AUTO' } } }
          : {}),
      }),
    });
    const corpo = await res.text();
    if (!res.ok) {
      if (ehErroLimite(res.status, corpo)) throw new ErroLimiteModelo(`Gemini limite: ${corpo.slice(0, 200)}`);
      throw new Error(`Gemini ${res.status}: ${corpo.slice(0, 300)}`);
    }
    const json = JSON.parse(corpo) as Parameters<typeof partesRespostaGemini>[0] & {
      usageMetadata?: { totalTokenCount?: number };
    };
    const { texto, chamadas } = partesRespostaGemini(json);
    const tokensUso = json.usageMetadata?.totalTokenCount;

    // Sem function call (ou texto junto): resposta final
    if (chamadas.length === 0 || texto.trim().length > 0) {
      return { texto, tokensUso };
    }

    // Modelo pediu tools: executa localmente e devolve como functionResponse
    for (const chamada of chamadas) {
      const resultado = await executarTool(chamada);
      anexarFunctionResponse(contents, chamada, resultado);
    }
  }
  return { texto: '' };
}

async function chamarOpenAICompat(modelo: ModeloConfig, mensagens: MensagemChat[], temperatura: number, maxTokens: number, jsonMode = false): Promise<RespostaLLM> {
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
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
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
  opcoes?: { temperatura?: number; maxTokens?: number; jsonMode?: boolean; comTools?: boolean },
): Promise<RespostaLLM> {
  const temperatura = opcoes?.temperatura ?? 0.1;
  const maxTokens = opcoes?.maxTokens ?? maxTokensSaida();
  const jsonMode = opcoes?.jsonMode ?? false;
  const comTools = opcoes?.comTools ?? false;
  if (modelo.provedor === 'gemini') {
    return chamarGemini(modelo, mensagens, temperatura, maxTokens, jsonMode, comTools);
  }
  return chamarOpenAICompat(modelo, mensagens, temperatura, maxTokens, jsonMode);
}

// ===== Streaming de resposta token a token =====
// Bomba os deltas SSE do provedor para um ReadableStream de texto puro,
// permitindo que o frontend exiba a resposta conforme ela e gerada

// Processa um corpo SSE e chama onDelta para cada trecho de texto recebido.
// No Gemini, parts podem trazer functionCall (function calling): repassa ao
// callback opcional sem emitir texto — o chamador decide o que fazer
async function bombearSSE(
  corpo: ReadableStream<Uint8Array>,
  ehGemini: boolean,
  onDelta: (texto: string) => void,
  onFunctionCall?: (chamada: ChamadaTool) => void,
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
        candidates?: Array<{
          content?: { parts?: Array<Record<string, unknown>> };
        }>;
        choices?: Array<{ delta?: { content?: string } }>;
      };
      if (ehGemini) {
        for (const parte of ev.candidates?.[0]?.content?.parts ?? []) {
          if (typeof parte.text === 'string' && parte.text) onDelta(parte.text);
          const fc = parte.functionCall as { name?: string; args?: Record<string, unknown> } | undefined;
          if (typeof fc?.name === 'string' && onFunctionCall) {
            onFunctionCall({ name: fc.name, args: fc.args ?? {} });
          }
        }
        return;
      }
      const t = ev.choices?.[0]?.delta?.content ?? '';
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

// Abre o stream SSE do Gemini com contents ja montadas (permite reinjetar
// functionResponse entre rodadas de tool calling)
async function abrirStreamGeminiConteudo(
  modelo: ModeloConfig,
  system: string,
  contents: Array<Record<string, unknown>>,
  temperatura: number,
  comTools: boolean,
): Promise<Response> {
  const handshake = sinalHandshake(timeoutLlmMs());
  try {
    const url = `${modelo.endpoint}/${modelo.nomeModelo}:streamGenerateContent?alt=sse&key=${modelo.apiKey}`;
    const res = await fetch(url, {
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
        ...(comTools
          ? { tools: [TOOLS_GEMINI], toolConfig: { functionCallingConfig: { mode: 'AUTO' } } }
          : {}),
      }),
    });
    // Headers recebidos: o corpo SSE pode fluir sem limite de tempo
    handshake.cancelar();
    return res;
  } catch (erro) {
    handshake.cancelar();
    throw erro;
  }
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
      const contents = conteudosGemini(mensagens);
      res = await abrirStreamGeminiConteudo(modelo, system, contents, temperatura, false);
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

// Streaming com function calling (somente Gemini): bombeia o SSE e, se o
// modelo responder com functionCall em vez de texto, executa as tools
// localmente e reabre o stream com os functionResponse — ate MAX_TOOL_ROUNDS.
// Na pratica o usuario nao percebe: function calls nao emitem texto, entao
// nada chega ao cliente ate a resposta final comecar a fluir
async function streamGeminiComTools(
  modelo: ModeloConfig,
  mensagens: MensagemChat[],
  temperatura: number,
): Promise<ReadableStream<Uint8Array>> {
  const system = mensagens.find((m) => m.role === 'system')?.content ?? '';
  const contents = conteudosGemini(mensagens);
  const encoder = new TextEncoder();

  // O primeiro stream abre FORA do ReadableStream para propagar erros de
  // handshake/cota ao failover, mesmo contrato do streamLLM
  const primeiro = await abrirStreamGeminiConteudo(modelo, system, contents, temperatura, true);
  if (!primeiro.ok || !primeiro.body) {
    const corpo = await primeiro.text().catch(() => '');
    if (ehErroLimite(primeiro.status, corpo)) throw new ErroLimiteModelo(`stream ${modelo.provedor} limite`);
    throw new Error(`stream ${modelo.provedor} ${primeiro.status}: ${corpo.slice(0, 300)}`);
  }

  let corpoAtual = primeiro.body;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let rodada = 0; rodada <= MAX_TOOL_ROUNDS; rodada++) {
          const chamadas: ChamadaTool[] = [];
          let emitiuTexto = false;
          // Na ultima rodada as tools ja nao foram oferecidas: o modelo e
          // obrigado a responder em texto (evita loop de tool calls)
          await bombearSSE(
            corpoAtual,
            true,
            (texto) => {
              emitiuTexto = true;
              controller.enqueue(encoder.encode(texto));
            },
            (chamada) => chamadas.push(chamada),
          );

          // Resposta final: texto fluiu ou nenhuma tool foi chamada
          if (chamadas.length === 0 || emitiuTexto) return;

          // Tool calls puras: executa e devolve functionResponse ao modelo.
          // Antes de cada execucao emite um frame de controle \u001E<nome>\u001F
          // para o frontend mostrar "Consultando pedido..." durante a espera
          for (const chamada of chamadas) {
            controller.enqueue(encoder.encode('\u001E' + chamada.name + '\u001F'));
            const resultado = await executarTool(chamada);
            anexarFunctionResponse(contents, chamada, resultado);
          }
          if (rodada === MAX_TOOL_ROUNDS) return;

          const prox = await abrirStreamGeminiConteudo(
            modelo,
            system,
            contents,
            temperatura,
            rodada + 1 < MAX_TOOL_ROUNDS,
          );
          if (!prox.ok || !prox.body) return;
          corpoAtual = prox.body;
        }
      } catch {
        // stream interrompido ou rodada de tool falhou: encerra o que ja saiu
      } finally {
        controller.close();
      }
    },
    cancel() {
      void corpoAtual.cancel().catch(() => undefined);
    },
  });
}

// Gera a resposta em streaming real; lanca ErroLimiteModelo em falha de cota
export async function streamLLM(
  modelo: ModeloConfig,
  mensagens: MensagemChat[],
  opcoes?: { temperatura?: number; comTools?: boolean },
): Promise<ReadableStream<Uint8Array>> {
  // Function calling so existe no Gemini; demais provedores seguem o fluxo
  // simples (o modelo simplesmente nunca chama tools)
  if (modelo.provedor === 'gemini' && opcoes?.comTools) {
    return streamGeminiComTools(modelo, mensagens, opcoes?.temperatura ?? 0.1);
  }
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
