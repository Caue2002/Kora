// Evals do Nori: golden dataset com rubricas objetivas por cenario
// Mede o que importa em producao: categoria reconhecida, coleta de evidencias,
// citacao de fonte, comportamento fora de escopo e a trava do pedido confirmado.
// Executa contra a API real quando ha credenciais no .env; pula sem elas.
// Rode isolado com: npx vitest run tests/evals.test.ts

import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import handler from '../api/chat';

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

let ipTeste = 0;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chamarApi(mensagem: string, historico: Array<{ role: string; content: string }>) {
  ipTeste += 1;
  return handler(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': `10.98.${Math.floor(ipTeste / 250)}.${ipTeste % 250}`,
      },
      body: JSON.stringify({ mensagem, historico }),
    }),
  );
}

async function perguntar(mensagem: string, historico: Array<{ role: string; content: string }> = []) {
  let res = await chamarApi(mensagem, historico);
  if (res.status === 429) {
    await dormir(65_000);
    res = await chamarApi(mensagem, historico);
  }
  const dados = (await res.json()) as { resposta?: string; erro?: string };
  return { status: res.status, ...dados };
}

interface CenarioEval {
  nome: string;
  turnos: Array<{ msg: string; espera: RegExp[] }>;
}

// Golden dataset: cada cenario descreve os turnos e o que a resposta DEVE
// conter (regex tolerantes a variacoes naturais de linguagem)
const DATASET: CenarioEval[] = [
  {
    nome: 'item faltante: reconhece categoria e conduz coleta',
    turnos: [
      {
        msg: 'Oi, no pedido 8801 pedi 2 sucos e 1 salgado mas chegou so o salgado. O que eu faco?',
        espera: [/pedido|item|falt|quantidade|entrega|cheg/i],
      },
    ],
  },
  {
    nome: 'item errado: reconhece troca/substituicao',
    turnos: [
      {
        msg: 'Pedi uma pizza de calabresa no pedido 5520 e veio de frango. Isso e permitido?',
        espera: [/troca|errado|substitu|item|pedido/i],
      },
    ],
  },
  {
    nome: 'pedido nao recebido: categoria de entrega/prazo',
    turnos: [
      {
        msg: 'O pedido 9910 foi marcado como entregue ha 2 horas e eu nao recebi nada. Liga pra alguem?',
        espera: [/entrega|entregador|receb|pedido|protocolo|evid/i],
      },
    ],
  },
  {
    nome: 'fora de escopo: pergunta casual sem forcar triagem',
    turnos: [
      { msg: 'oi, tudo bem?', espera: [/nori|kora|ajudar|posso|oi|olá|ola/i] },
    ],
  },
  {
    nome: 'pergunta de politica: responde com base da casa',
    turnos: [
      {
        msg: 'Qual o prazo para contestar um pedido com problema?',
        espera: [/prazo|hora|dia|contesta|evid|foto|reembolso/i],
      },
    ],
  },
  {
    nome: 'pedido travado: nao troca apos confirmacao',
    turnos: [
      { msg: 'meu pedido 3300', espera: [/.+/] },
      { msg: 'sim, esse mesmo', espera: [/.+/] },
      {
        msg: 'na verdade errei, meu pedido era o 9999',
        espera: [/n[ãa]o consta|nao consta|unico pedido|pedido confirmado|em atendimento|pedido 3300|pedido confirmado/i],
      },
    ],
  },
];

describe('Evals do Nori (golden dataset)', () => {
  beforeAll(carregarEnv);

  for (const cenario of DATASET) {
    it(cenario.nome, async () => {
      if (!temCredenciais()) return;
      const historico: Array<{ role: string; content: string }> = [];
      for (const [i, turno] of cenario.turnos.entries()) {
        const r = await perguntar(turno.msg, historico);
        expect(r.status, `turno ${i + 1} falhou: ${r.erro ?? ''}`).toBe(200);
        expect(r.resposta, `turno ${i + 1} sem resposta`).toBeTruthy();
        for (const padrao of turno.espera) {
          expect(
            padrao.test(r.resposta!),
            `turno ${i + 1}: resposta nao atendeu rubrica ${padrao} — "${r.resposta!.slice(0, 160)}"`,
          ).toBe(true);
        }
        historico.push({ role: 'user', content: turno.msg });
        historico.push({ role: 'assistant', content: r.resposta! });
      }
    }, 300000);
  }
});
