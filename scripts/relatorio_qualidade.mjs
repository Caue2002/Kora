// Relatorio de qualidade do Nori: consolida em um texto unico as metricas
// de producao (metricas_chat via RPC metricas_chat_resumo) e os scores dos
// evals (tabela eval_runs, migration 0019). E o artefato de entrevista:
// responde "como voce sabe que o sistema esta bom?" com numeros reais.
// Roda local com as credenciais do .env:
//   node scripts/relatorio_qualidade.mjs
//   node scripts/relatorio_qualidade.mjs --dias 30   (janela do grafico diario)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Carrega o .env (mesmo padrao dos testes e do relatorio_feedback)
try {
  const linhas = readFileSync(join(process.cwd(), '.env'), 'utf8').split(/\r?\n/);
  for (const l of linhas) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  console.error('.env nao encontrado');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no .env');
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const fmt = (n, d = 0) => (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '—');

async function buscar(caminho, init) {
  const res = await fetch(`${url}/rest/v1/${caminho}`, { headers, ...init });
  if (!res.ok) throw new Error(`${caminho}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

// --- metricas de producao (mesmo agregado do painel /metricas.html) ---
let resumo = null;
try {
  resumo = await buscar('rpc/metricas_chat_resumo', { method: 'POST', body: '{}' });
} catch (e) {
  console.warn('metricas_chat_resumo falhou:', e.message);
}

// --- scores de eval persistidos pelas suites (migration 0019) ---
let runs = [];
try {
  runs = await buscar(
    'eval_runs?select=suite,total,aprovados,reprovados,nota_media,criado_em,origem&order=criado_em.desc&limit=20',
  );
} catch (e) {
  console.warn('eval_runs indisponivel (migration 0019 aplicada?):', e.message);
}

console.log('\n================ RELATORIO DE QUALIDADE — KORA / NORI ================\n');

if (resumo) {
  const total = resumo.total_geral ?? 0;
  const cacheHits = resumo.cache_hits ?? 0;
  console.log('--- Producao (dia corrente, America/Sao_Paulo) ---');
  console.log(`  Mensagens hoje:        ${fmt(total)}  (${fmt(resumo.ultimas_24h)} em 24h)`);
  console.log(`  Latencia media:        ${fmt(resumo.latencia_media_ms)} ms`);
  console.log(`  Latencia p50 / p95:    ${fmt(resumo.latencia_p50_ms)} ms / ${fmt(resumo.latencia_p95_ms)} ms`);
  console.log(`  Cache hit rate:        ${pct(cacheHits, total)}  (${fmt(cacheHits)} reutilizadas)`);
  console.log(`  Function calls:        ${fmt(resumo.tools_total ?? 0)}`);

  // fallback por camada: os "modelos" de emergencia registrados em
  // metricas_chat (ver SPEC-fallback-camadas) — quanto do trafego precisou
  // da rede de seguranca e sinal de saude do failover
  const FALLBACKS = ['cache-fallback', 'banco-fallback', 'generico-fallback'];
  const porModelo = Array.isArray(resumo.por_modelo) ? resumo.por_modelo : [];
  const camadas = FALLBACKS.map((c) => ({ camada: c, n: porModelo.find((m) => m.modelo === c)?.total ?? 0 }));
  const totalFallback = camadas.reduce((a, c) => a + c.n, 0);
  if (totalFallback > 0) {
    console.log('  Fallback por camada:');
    for (const c of camadas) console.log(`    ${c.camada.padEnd(18)} ${fmt(c.n)} (${pct(c.n, totalFallback)} do fallback)`);
    console.log(`    ${'TOTAL'.padEnd(18)} ${fmt(totalFallback)} (${pct(totalFallback, total)} das mensagens)`);
  } else {
    console.log('  Fallback por camada:  nenhum uso hoje (failover nao precisou agir)');
  }
} else {
  console.log('--- Producao ---\n  (metricas_chat_resumo indisponivel)');
}

console.log('\n--- Evals (ultimas execucoes persistidas) ---');
if (runs.length === 0) {
  console.log('  Nenhum eval_run registrado ainda — rode tests/evals.test.ts e');
  console.log('  tests/evals-juiz.test.ts com credenciais (eles gravam sozinhos).');
} else {
  const ROTULO = { rubricas: 'rubricas', juiz: 'juiz LLM' };
  const ultimos = {};
  for (const r of runs) if (!ultimos[r.suite]) ultimos[r.suite] = r;
  for (const [suite, r] of Object.entries(ultimos)) {
    const nota = r.nota_media != null ? ` · nota media ${Number(r.nota_media).toFixed(1)}/5` : '';
    console.log(
      `  ${String(ROTULO[suite] ?? suite).padEnd(10)} ultimo run ${String(r.criado_em).slice(0, 16).replace('T', ' ')} UTC: ` +
        `${r.aprovados}/${r.total} aprovados (${pct(r.aprovados, r.total)})${nota} [${r.origem}]`,
    );
  }
  const reprovados = runs.filter((r) => r.reprovados > 0);
  if (reprovados.length > 0) {
    console.log('\n  Runs com reprovacao (mais recentes primeiro):');
    for (const r of reprovados.slice(0, 5)) {
      console.log(`    ${String(r.criado_em).slice(0, 16).replace('T', ' ')} ${ROTULO[r.suite] ?? r.suite}: ${r.reprovados}/${r.total} reprovaram`);
    }
  }
}

console.log('\n=====================================================================\n');
