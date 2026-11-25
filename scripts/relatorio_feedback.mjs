// Relatorio do loop de feedback: agrega feedback_respostas do Supabase e
// mostra o que os usuarios acharam das respostas da Nori — base para ajustar
// diretrizes de estilo, prompt e politicas. Roda local com as credenciais do
// .env: node scripts/relatorio_feedback.mjs
// Uso: node scripts/relatorio_feedback.mjs [--dias 30]

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Carrega o .env (mesmo padrao dos testes)
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

const dias = Number(process.argv[process.argv.indexOf('--dias') + 1]) || 30;
const desde = new Date(Date.now() - dias * 86400_000).toISOString();

const res = await fetch(
  `${url}/rest/v1/feedback_respostas?criado_em=gte.${desde}&select=avaliacao,comentario,modelo_id,criado_em&order=criado_em.desc&limit=1000`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
if (!res.ok) {
  console.error('Falha ao consultar feedback_respostas:', res.status, await res.text());
  process.exit(1);
}
const rows = await res.json();

if (rows.length === 0) {
  console.log(`Nenhum feedback nos ultimos ${dias} dias.`);
  process.exit(0);
}

const porAvaliacao = {};
const porDia = {};
const comentarios = { confuso: [], incompleto: [], prolixo: [] };
for (const r of rows) {
  porAvaliacao[r.avaliacao] = (porAvaliacao[r.avaliacao] ?? 0) + 1;
  const dia = String(r.criado_em).slice(0, 10);
  porDia[dia] = (porDia[dia] ?? 0) + 1;
  if (comentarios[r.avaliacao] && r.comentario) comentarios[r.avaliacao].push(r.comentario);
}

const ROTULO = { util: 'Util', confuso: 'Confuso', incompleto: 'Incompleto', prolixo: 'Prolixo' };
console.log(`\n=== Feedback dos ultimos ${dias} dias (${rows.length} avaliacoes) ===\n`);
for (const [k, v] of Object.entries(porAvaliacao).sort((a, b) => b[1] - a[1])) {
  const pct = ((v / rows.length) * 100).toFixed(0);
  console.log(`  ${ROTULO[k] ?? k}: ${v} (${pct}%)`);
}

console.log('\n--- Por dia ---');
for (const [dia, total] of Object.entries(porDia).sort()) {
  console.log(`  ${dia}: ${total}`);
}

for (const [k, lista] of Object.entries(comentarios)) {
  if (lista.length === 0) continue;
  console.log(`\n--- Comentarios "${ROTULO[k]}" (${lista.length}) ---`);
  for (const c of lista.slice(0, 15)) console.log(`  - ${c}`);
}

console.log('\nDica: comentarios "confuso"/"incompleto"/"prolixo" apontam onde ajustar');
console.log('diretrizes de estilo (coherence/) e o prompt da Nori.');
