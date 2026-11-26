// Endpoint unificado de voz — POST /api/tts e POST /api/stt atendidos
// pela MESMA function para caber no limite de 12 Serverless Functions
// do plano Hobby da Vercel (eram 13 arquivos em api/ e o deploy
// falhava). Em producao, rewrites no vercel.json mapeiam:
//   /api/tts -> /api/voz?rota=tts
//   /api/stt -> /api/voz?rota=stt
// O dispatcher tambem aceita o caminho original no pathname, o que
// mantem dev-server e testes funcionando sem query.
//
// TTS: texto -> audio/mpeg com voz neural Microsoft Edge pt-BR
// (botao "ouvir" das respostas; spec SPEC-voz-neural).
// STT: audio bruto -> { texto } com Whisper large-v3 da Groq
// (ditado neural do chat; spec SPEC-voz-whisper).
// Ambos publicos, com rate limit por IP e tamanho maximo de entrada.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { tratarRequisicaoNode } from '../shared/http.js';
import { verificarLimite } from '../shared/ratelimit.js';
import { groqApiKey } from '../shared/env.js';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const TAMANHO_MAX_TEXTO = 1200;
const VOZ_PADRAO = 'pt-BR-FranciscaNeural';
// ~60s de audio webm/opus fica bem abaixo disso; o limite real da Vercel
// para o body de uma function e ~4.5MB
const TAMANHO_MAX_AUDIO = 4_500_000;
const TIMEOUT_MS = 30_000;
const MODELO_WHISPER = 'whisper-large-v3';

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Decide a rota de voz: query ?rota= (rewrites da Vercel) tem
// prioridade; sem ela, cai no sufixo do pathname (/api/tts|/api/stt)
function rotaDeVoz(urlBruta: string): 'tts' | 'stt' | null {
  try {
    const u = new URL(urlBruta, 'http://local');
    const q = u.searchParams.get('rota');
    if (q === 'tts' || q === 'stt') return q;
    if (u.pathname.endsWith('/tts')) return 'tts';
    if (u.pathname.endsWith('/stt')) return 'stt';
  } catch {
    // url invalida: cai no 404 abaixo
  }
  return null;
}

// ---------- TTS ----------

// Limpa markdown/emoji para o TTS nao ler "asterisco" ou "hashtag"
function limparParaFala(texto: string): string {
  return texto
    .replace(/[*_`#>~]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/\s+/g, ' ')
    .trim();
}

async function webHandlerTts(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { erro: 'Metodo nao permitido' });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await verificarLimite(`tts:${ip}`, 30, 60_000))) {
    return json(429, { erro: 'Muitas requisicoes de audio. Aguarde um instante.' });
  }

  let corpo: { texto?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return json(400, { erro: 'JSON invalido' });
  }

  const texto = typeof corpo.texto === 'string' ? limparParaFala(corpo.texto).slice(0, TAMANHO_MAX_TEXTO) : '';
  if (texto.length < 2) return json(400, { erro: 'Texto ausente ou muito curto' });

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOZ_PADRAO, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream, metadataStream } = tts.toStream(texto);
    void metadataStream; // metadados do audio nao sao necessarios aqui

    // Junta os chunks em um unico buffer: respostas curtas geram poucos KB
    const partes: Buffer[] = [];
    for await (const chunk of audioStream) {
      partes.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const audio = Buffer.concat(partes);
    if (audio.length === 0) return json(502, { erro: 'Falha ao gerar audio' });

    return new Response(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.length),
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (erro) {
    console.error('[tts] falha:', erro);
    return json(502, { erro: 'Servico de voz indisponivel no momento' });
  }
}

// ---------- STT ----------

// Extensao do arquivo enviada a Groq conforme o mime do MediaRecorder
function extensaoDe(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

async function webHandlerStt(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { erro: 'Metodo nao permitido' });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await verificarLimite(`stt:${ip}`, 20, 60_000))) {
    return json(429, { erro: 'Muitas requisicoes de audio. Aguarde um instante.' });
  }

  const mime = (req.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (!mime.startsWith('audio/')) {
    return json(400, { erro: 'Envie o audio no body com Content-Type audio/*' });
  }

  const audio = await req.arrayBuffer().catch(() => null);
  if (!audio || audio.byteLength === 0) return json(400, { erro: 'Audio vazio' });
  if (audio.byteLength > TAMANHO_MAX_AUDIO) {
    return json(413, { erro: 'Audio muito longo. Fale em partes menores.' });
  }

  // Chave so e exigida depois de validar a entrada: requisicao malformada
  // recebe 4xx mesmo sem GROQ_API_KEY configurada
  const chave = groqApiKey();
  if (!chave) return json(503, { erro: 'Servico de voz indisponivel no momento' });

  try {
    // Multipart para a API de transcriptions da Groq (mesmo formato do SDK)
    const form = new FormData();
    form.append('file', new Blob([audio], { type: mime }), `audio.${extensaoDe(mime)}`);
    form.append('model', MODELO_WHISPER);
    form.append('language', 'pt');
    form.append('response_format', 'json');
    form.append('temperature', '0');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const corpo = await res.text().catch(() => '');
      console.warn(`[stt] groq ${res.status}: ${corpo.slice(0, 200)}`);
      return json(502, { erro: 'Nao foi possivel transcrever o audio agora' });
    }
    const dados = (await res.json()) as { text?: string };
    return json(200, { texto: (dados.text ?? '').trim() });
  } catch (erro) {
    console.error('[stt] falha:', erro);
    return json(502, { erro: 'Servico de voz indisponivel no momento' });
  }
}

// ---------- Despacho ----------

const HANDLERS = { tts: webHandlerTts, stt: webHandlerStt } as const;

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
  const urlBruta = res ? (req as IncomingMessage).url ?? '' : (req as Request).url;
  const rota = rotaDeVoz(urlBruta);
  if (!rota) return json(404, { erro: 'Rota de voz desconhecida' });
  const webHandler = HANDLERS[rota];

  if (res) {
    await tratarRequisicaoNode(req as IncomingMessage, res, webHandler);
    return;
  }
  return webHandler(req as Request);
}
