// Endpoint POST /api/tts — texto para fala (TTS) com voz neural da Microsoft
// Edge (pt-BR-FranciscaNeural, gratuita). Recebe { texto } e devolve audio/mpeg.
// Usado pelo botao "ouvir" das respostas da Nori no chat. Sem autenticacao:
// endpoint publico com rate limit por IP e tamanho maximo de texto.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { tratarRequisicaoNode } from '../shared/http.js';
import { verificarLimite } from '../shared/ratelimit.js';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const TAMANHO_MAX_TEXTO = 1200;
const VOZ_PADRAO = 'pt-BR-FranciscaNeural';

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Limpa markdown/emoji para o TTS nao ler "asterisco" ou "hashtag"
function limparParaFala(texto: string): string {
  return texto
    .replace(/[*_`#>~]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/\s+/g, ' ')
    .trim();
}

async function webHandler(req: Request): Promise<Response> {
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
