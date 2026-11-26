// Eval de RETRIEVAL (spec/SPEC-eval-retrieval.md): mede a primeira etapa
// do pipeline do Nori — se a buscaHibrida traz o trecho de politica certo
// para cada tipo de disputa — em vez de so medir a resposta final.
// Metricas: hit@4 por cenario (o titulo esperado esta entre os 4 trechos
// retornados) e recall agregado. Roda contra Supabase+Gemini reais;
// pula sem credenciais. Resultado persiste em eval_runs (suite
// 'retrieval', migration 0020).
// Rode isolado com: npx vitest run tests/evals-retrieval.test.ts

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buscaHibrida } from '../rag/search';
import { gravarEvalRun, type ResultadoCenario } from './eval_runs';

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

// Normaliza para comparacao: minusculas e sem acentos — o titulo do chunk
// e a consulta do usuario variam em acentuacao e caixa
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

interface CenarioRetrieval {
  nome: string;
  consulta: string;
  // substring esperada no titulo do trecho retornado (ver
  // database/seeds/politicas_disputa.json — titulo de cada regra)
  esperado: string;
}

// Golden dataset de retrieval: mensagens realistas de disputa -> regra
// de politica que a busca DEVERIA trazer no top-4
const DATASET: CenarioRetrieval[] = [
  { nome: 'item faltante', consulta: 'chegou faltando 2 itens do meu pedido', esperado: 'item faltante' },
  { nome: 'conferencia na retirada', consulta: 'o entregador nao conferiu a sacola antes de sair do restaurante', esperado: 'retirada' },
  { nome: 'item errado', consulta: 'pedi pizza de calabresa e veio de frango', esperado: 'item errado' },
  { nome: 'qualidade/reembolso', consulta: 'a pizza chegou quebrada e fria, quero meu dinheiro de volta', esperado: 'reembolsa' },
  { nome: 'prazo de contestacao', consulta: 'fiz o pedido ha 3 dias, ainda posso contestar?', esperado: 'contestacao' },
  { nome: 'evidencias exigidas', consulta: 'quais fotos eu preciso mandar para provar o problema?', esperado: 'evidencias' },
  { nome: 'nao recebido', consulta: 'o app marca como entregue mas nao chegou nada em casa', esperado: 'nao recebido' },
  { nome: 'atraso', consulta: 'meu pedido atrasou 1 hora, de quem e a responsabilidade?', esperado: 'atraso' },
  { nome: 'cancelado pelo restaurante', consulta: 'o restaurante cancelou meu pedido na hora do almoco', esperado: 'restaurante' },
  { nome: 'cobranca duplicada', consulta: 'fui cobrado duas vezes pelo mesmo pedido no cartao', esperado: 'cobranca duplicada' },
  { nome: 'taxa indevida', consulta: 'cobraram uma taxa de entrega que nao estava no app', esperado: 'taxa' },
  { nome: 'itens de acompanhamento', consulta: 'faltou o ketchup e as sacolas descartaveis', esperado: 'acompanhamento' },
  { nome: 'avaria no transporte', consulta: 'o suco veio vazando dentro da mochila do entregador', esperado: 'avaria' },
  { nome: 'alergia alimentar', consulta: 'tenho alergia a castanha e o lanche nao avisou nada', esperado: 'alergia' },
  { nome: 'cancelado pela plataforma', consulta: 'o pedido foi cancelado pelo app do nada, sem eu pedir', esperado: 'plataforma' },
  { nome: 'pedido de outro cliente', consulta: 'recebi por engano o pedido de outra pessoa na minha porta', esperado: 'outro cliente' },
  // disputa tipica das verticais de produto (mercado/farmacia/pet):
  // produto vencido e o caso que a regra de verticais cobre — "item
  // errado" generico corretamente cai na regra de troca_item
  { nome: 'vertical mercado', consulta: 'o leite que comprei no mercado pelo app chegou vencido', esperado: 'mercado' },
  { nome: 'reembolso por pagamento', consulta: 'em quanto tempo cai o reembolso no pix?', esperado: 'forma de pagamento' },
];

describe('Eval de retrieval do Nori (hit@4 no RAG)', () => {
  beforeAll(carregarEnv);

  // Resultado por cenario para persistir em eval_runs (migration 0020):
  // suite 'retrieval' — aprovados = trechos esperados encontrados
  const resultados: ResultadoCenario[] = [];

  for (const cenario of DATASET) {
    it(cenario.nome, async () => {
      if (!temCredenciais()) return;
      try {
        const { trechos, modo } = await buscaHibrida(cenario.consulta);
        expect(trechos.length, 'busca nao retornou trechos').toBeGreaterThan(0);

        const alvo = norm(cenario.esperado);
        const achou = trechos.some((t) => norm(t.titulo).includes(alvo));
        const top = trechos[0];
        console.log(
          `\n  [retrieval] ${cenario.nome}: ${achou ? 'OK' : 'FALHOU'} ` +
            `(esperava "${cenario.esperado}"; top1="${top?.titulo}" score=${top?.score?.toFixed(3)} modo=${modo})`,
        );
        resultados.push({
          nome: cenario.nome,
          passou: achou,
          detalhe: `top1="${top?.titulo ?? ''}" score=${top?.score?.toFixed(3)} modo=${modo}`,
        });
        expect(achou, `trecho "${cenario.esperado}" nao apareceu no top-4`).toBe(true);
      } catch (erro) {
        resultados.push({
          nome: cenario.nome,
          passou: false,
          detalhe: String(erro).slice(0, 300),
        });
        throw erro;
      }
    }, 120000);
  }

  afterAll(async () => {
    await gravarEvalRun('retrieval', resultados);
  });
});
