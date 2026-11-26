// Persistencia dos resultados dos evals na tabela eval_runs (migration 0019)
// para alimentar o painel /metricas.html e o scripts/relatorio_qualidade.mjs.
// Telemetria NUNCA pode reprovar um eval: qualquer falha de escrita vira warn.

import { inserir } from '../shared/supabase';

export interface ResultadoCenario {
  nome: string;
  passou: boolean;
  detalhe?: string;
  nota?: number; // apenas a suite juiz (nota 1-5 do LLM-as-judge)
}

// Grava 1 linha por execucao de suite. Suite sem resultados (ex.: testes
// pulados por falta de credenciais) nao gera linha — evita runs zerados.
export async function gravarEvalRun(
  suite: 'rubricas' | 'juiz' | 'retrieval',
  resultados: ResultadoCenario[],
): Promise<void> {
  if (resultados.length === 0) return;
  const aprovados = resultados.filter((r) => r.passou).length;
  const notas = resultados
    .map((r) => r.nota)
    .filter((n): n is number => typeof n === 'number');
  const notaMedia =
    notas.length > 0 ? Number((notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(2)) : null;
  const detalhes = Object.fromEntries(resultados.map((r) => [r.nome, r]));
  try {
    await inserir('eval_runs', {
      suite,
      total: resultados.length,
      aprovados,
      reprovados: resultados.length - aprovados,
      nota_media: notaMedia,
      detalhes,
      origem: process.env.CI ? 'ci' : 'local',
    });
    console.log(`[evals] eval_run gravado: ${suite} ${aprovados}/${resultados.length}`);
  } catch (erro) {
    console.warn('[evals] falha ao gravar eval_run (telemetria nao critica):', erro);
  }
}
