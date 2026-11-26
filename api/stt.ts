// Endpoint POST /api/stt — fala para texto (STT) com Whisper da Groq
// (whisper-large-v3, pt-BR, gratuito no free tier). Recebe o audio bruto
// no body (Content-Type audio/*) e devolve { texto }.
// Usado pelo ditado neural do chat (spec SPEC-voz-whisper.md). Sem auth:
// endpoint publico com rate limit por IP e tamanho maximo de audio.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { tratarRequisicaoNode } from '../shared/http.js';
import { verificarLimite } from '../shared/ratelimit.js';
import { groqApiKey } from '../shared/env.js';

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

async function webHandler(req: Request): Promise<Response> {
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

// Extensao do arquivo enviada a Groq conforme o mime do MediaRecorder
function extensaoDe(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

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
  if (res) {
    await tratarRequisicaoNode(req as IncomingMessage, res, webHandler);
    return;
  }
  return webHandler(req as Request);
}
