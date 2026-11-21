// Adaptador Node <-> Web Request/Response para as functions da Vercel
// A Vercel invoca handlers com (req: IncomingMessage, res: ServerResponse),
// enquanto o dev-server local e os testes usam o padrao Web (Request/Response).
// Este helper converte a requisicao Node em Request, executa o handler web
// e devolve a resposta preservando streaming quando houver.

import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Converte uma requisicao Node em Web Request e devolve a resposta do handler
export async function tratarRequisicaoNode(
  req: IncomingMessage,
  res: ServerResponse,
  handler: (req: Request) => Promise<Response>,
): Promise<void> {
  const host = req.headers.host ?? 'localhost';
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);

  const metodo = req.method ?? 'GET';
  const temCorpo = metodo !== 'GET' && metodo !== 'HEAD' && chunks.length > 0;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(', '));
  }

  const request = new Request(`${proto}://${host}${req.url}`, {
    method: metodo,
    headers,
    body: temCorpo ? Buffer.concat(chunks) : undefined,
  });

  try {
    const response = await handler(request);

    res.statusCode = response.status;
    response.headers.forEach((valor, chave) => res.setHeader(chave, valor));

    if (response.body) {
      // pipe preserva o streaming token a token da resposta do chat
      Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).pipe(res);
    } else {
      res.end();
    }
  } catch (erro) {
    // Evita FUNCTION_INVOCATION_FAILED: devolve 500 legivel e loga o stack real
    console.error('[api] erro nao tratado:', erro);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify({ erro: 'Erro interno do servidor' }));
  }
}
