// Baseline de evals no CI (spec/SPEC-eval-baseline-ci.md): depois que as
// suites de eval gravam o resultado em eval_runs, compara o run 'ci' mais
// recente de cada suite com o MELHOR run 'ci' anterior. Se a taxa de
// aprovacao cair mais que TOLERANCIA_PP pontos percentuais, sai com erro
// e reprova o pipeline — qualidade vira gate, nao so metrica.
// Uso: node scripts/check_eval_baseline.mjs   (CI ja exporta as envs)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// .env e opcional aqui: no GitHub Actions as vars ja vem dos secrets;
// localmente o arquivo da as credenciais
try {
  const linhas = readFileSync(join(process.cwd(), '.env'), 'utf8').split(/\r?\n/);
  for (const l of linhas) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // sem .env: segue so com as envs do processo
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log('[baseline] SUPABASE_URL/SERVICE_ROLE ausentes — baseline pulado');
  process.exit(0);
}

const TOLERANCIA_PP = 10; // pontos percentuais de queda permitidos

const res = await fetch(
  `${url}/rest/v1/eval_runs?origem=eq.ci&select=suite,total,aprovados,reprovados,criado_em&order=criado_em.desc&limit=50`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
if (!res.ok) {
  // Telemetria nunca derruba o CI: banco fora do ar vira aviso, nao falha
  console.warn(`[baseline] falha ao ler eval_runs (HTTP ${res.status}) — baseline pulado`);
  process.exit(0);
}
const runs = await res.json();

// Agrupa por suite mantendo a ordem desc (mais recente primeiro)
const porSuite = {};
for (const r of runs) (porSuite[r.suite] ??= []).push(r);

const suites = Object.keys(porSuite);
if (suites.length === 0) {
  console.log('[baseline] nenhum run de CI em eval_runs — baseline pendente');
  process.exit(0);
}

let reprovou = false;
for (const suite of suites) {
  const lista = porSuite[suite];
  const atual = lista[0];
  // Baseline = melhor taxa de aprovacao entre os runs ANTERIORES ao atual
  const anteriores = lista.slice(1);
  if (anteriores.length === 0) {
    const taxa = atual.total ? (atual.aprovados / atual.total) * 100 : 0;
    console.log(`[baseline] ${suite}: primeiro run de CI (${atual.aprovados}/${atual.total} = ${taxa.toFixed(0)}%) — baseline estabelecido`);
    continue;
  }
  const melhor = anteriores.reduce((acc, r) => {
    const t = r.total ? r.aprovados / r.total : 0;
    return t > (acc.total ? acc.aprovados / acc.total : 0) ? r : acc;
  }, anteriores[0]);
  const taxaAtual = atual.total ? (atual.aprovados / atual.total) * 100 : 0;
  const taxaBase = melhor.total ? (melhor.aprovados / melhor.total) * 100 : 0;
  const delta = taxaAtual - taxaBase;
  const status = delta < -TOLERANCIA_PP ? 'REPROVOU' : delta < 0 ? 'queda dentro da tolerancia' : 'ok';
  console.log(
    `[baseline] ${suite}: atual ${atual.aprovados}/${atual.total} (${taxaAtual.toFixed(0)}%) ` +
      `vs baseline ${melhor.aprovados}/${melhor.total} (${taxaBase.toFixed(0)}%) ` +
      `→ ${delta >= 0 ? '+' : ''}${delta.toFixed(0)}pp — ${status}`,
  );
  if (status === 'REPROVOU') reprovou = true;
}

if (reprovou) {
  console.error('[baseline] REGRESSAO de qualidade detectada — evals reprovaram o pipeline');
  process.exit(1);
}
console.log('[baseline] nenhuma regressao alem da tolerancia');
