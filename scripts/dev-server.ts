// Servidor de desenvolvimento local para as funcoes de api/
// Em producao a Vercel hospeda essas funcoes; localmente usamos este servidor
// para o frontend (vite) consumir /api/chat e /api/feedback sem login na Vercel
// Uso: npm run dev:api  (escuta em http://localhost:3000)

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chatHandler from '../api/chat';
import feedbackHandler from '../api/feedback';
import parecerHandler from '../api/parecer';
import casoHandler from '../api/caso';
import conversaHandler from '../api/conversa';
import metricasHandler from '../api/metricas';
import mcpHandler from '../api/mcp';
import a2aHandler from '../api/a2a';
import handoffHandler from '../api/handoff';
import ttsHandler from '../api/tts';
import memoriaHandler from '../api/memoria';
import sttHandler from '../api/stt';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

// Carrega o .env no process.env
try {
  const linhas = readFileSync(join(raiz, '.env'), 'utf8').split(/\r?\n/);
  for (const l of linhas) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2];
  }
} catch {
  console.warn('.env nao encontrado; variaveis de ambiente devem vir do sistema');
}

const rotas: Record<string, (req: Request) => Promise<Response>> = {
  '/api/chat': chatHandler,
  '/api/feedback': feedbackHandler,
  '/api/parecer': parecerHandler,
  '/api/caso': casoHandler,
  '/api/conversa': conversaHandler,
  '/api/metricas': metricasHandler,
  '/api/mcp': mcpHandler,
  '/api/a2a': a2aHandler,
  '/api/handoff': handoffHandler,
  '/api/tts': ttsHandler,
  '/api/memoria': memoriaHandler,
  '/api/stt': sttHandler,
};

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const handler = rotas[url.pathname];
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ erro: 'Rota nao encontrada' }));
    return;
  }

  // Monta um Request web a partir do IncomingMessage do Node
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const corpo = chunks.length ? Buffer.concat(chunks) : undefined;

  const request = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: corpo && req.method !== 'GET' ? corpo : undefined,
  });

  try {
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    // Encaminha o body em streaming quando presente (respostas token a token)
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } else {
      res.end(Buffer.from(await response.arrayBuffer()));
    }
  } catch (erro) {
    console.error('[dev-server] erro no handler:', erro);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ erro: String(erro) }));
  }
});

servidor.listen(3000, () => {
  console.log('API local em http://localhost:3000');
});
