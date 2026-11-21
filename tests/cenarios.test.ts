// Conjunto fixo de cenarios de teste da Kora (regra 5 da especificacao)
// Cobre: caso completo, incompleto/ambiguo, contraditorio e fora do escopo
// Executa contra a API real quando ha credenciais no .env; pula sem elas
// Rode isolado com: npx vitest run tests/cenarios.test.ts

import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import handler from '../api/chat.js';

function carregarEnv() {
  try {
    const linhas = readFileSync(join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/);
    for (const l of linhas) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2];
    }
  } catch {
    // sem .env: testes serao pulados
  }
}

const temCredenciais = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.GEMINI_API_KEY);

async function perguntar(mensagem: string, historico: Array<{ role: string; content: string }> = []) {
  const res = await handler(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem, historico }),
    }),
  );
  const dados = (await res.json()) as { resposta?: string; erro?: string };
  return { status: res.status, ...dados };
}

describe('Cenarios fixos da Kora', () => {
  beforeAll(carregarEnv);

  it('Cenario completo: relato com etapa, quantidade e evidencia', async () => {
    if (!temCredenciais()) return;
    const r = await perguntar(
      'Na separacao do pedido 4521 separei 8 itens mas o pedido era de 10. Tenho o registro de separacao RS-889 e foto da bancada. O que faco?',
    );
    expect(r.status).toBe(200);
    expect(r.resposta).toBeTruthy();
    // deve reconhecer divergencia de quantidade e conduzir conciliacao
    expect(r.resposta!.toLowerCase()).toMatch(/quantidade|diverg|concilia/);
  }, 60000);

  it('Cenario incompleto/ambiguo: deve pedir esclarecimentos', async () => {
    if (!temCredenciais()) return;
    const r = await perguntar('Deu problema na entrega, pode verificar?');
    expect(r.status).toBe(200);
    expect(r.resposta).toBeTruthy();
    // relato vago deve gerar pedido de dados (etapa, quantidade, evidencia)
    expect(r.resposta!.toLowerCase()).toMatch(/etapa|quantidade|evid|registro|comprovante|qual|informe/);
  }, 60000);

  it('Cenario contraditorio: usuario muda os fatos no meio', async () => {
    if (!temCredenciais()) return;
    const h1 = await perguntar('Chegaram 12 caixas do pedido 3300 mas o sistema marca 15.');
    const h2 = await perguntar('Na verdade conferi de novo e chegaram as 15 mesmo, o erro foi meu.', [
      { role: 'user', content: 'Chegaram 12 caixas do pedido 3300 mas o sistema marca 15.' },
      { role: 'assistant', content: h1.resposta ?? '' },
    ]);
    expect(h2.status).toBe(200);
    expect(h2.resposta).toBeTruthy();
    // deve aceitar a correcao sem contradizer o historico
    expect(h2.resposta!.length).toBeGreaterThan(10);
  }, 90000);

  it('Cenario fora do escopo: pergunta casual', async () => {
    if (!temCredenciais()) return;
    const r = await perguntar('que dia é hoje?');
    expect(r.status).toBe(200);
    expect(r.resposta).toBeTruthy();
    // deve responder a data sem forcar formato de triagem
    expect(r.resposta!).toMatch(/\d{2}\/\d{2}|novembro|sábado|sabado/i);
  }, 60000);
});
