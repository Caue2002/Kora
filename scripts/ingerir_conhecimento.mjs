// Script de ingestao de conhecimento para o RAG do Kora
// Le database/seeds/politicas_disputa.json, gera embeddings via Gemini e
// insere/atualiza os chunks na tabela conhecimento_chunks do Supabase
// Remove chunks da referencia anterior antes de inserir (idempotente)
// Uso: node scripts/ingerir_conhecimento.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

// Le o arquivo .env local sem dependencia externa
function lerEnv() {
  try {
    const linhas = readFileSync(join(raiz, '.env'), 'utf8').split(/\r?\n/);
    const env = {};
    for (const l of linhas) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2];
    }
    return env;
  } catch {
    return {};
  }
}

const env = lerEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = env.GEMINI_API_KEY;
const EMBED_MODEL = env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

if (!SUPABASE_URL || !SERVICE_KEY || !GEMINI_KEY) {
  console.error('Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e GEMINI_API_KEY no arquivo .env');
  process.exit(1);
}

// Divide textos longos em chunks de ate ~800 caracteres com sobreposicao
function chunkSimples(texto, max = 800, overlap = 100) {
  if (texto.length <= max) return [texto];
  const chunks = [];
  for (let i = 0; i < texto.length; i += max - overlap) {
    chunks.push(texto.slice(i, i + max));
  }
  return chunks;
}

async function embedar(textos) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: textos.map((t) => ({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text: t }] },
          outputDimensionality: 1536,
        })),
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini embeddings ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  return json.embeddings.map((e) => e.values);
}

async function inserirChunk(dados) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/conhecimento_chunks`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(dados),
  });
  if (!res.ok) {
    throw new Error(`Supabase insert ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

// Remove chunks de referencias antigas de seed para evitar duplicatas no RAG
async function limparSeedsAnteriores() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/conhecimento_chunks?origem=eq.regra&metadados->>fonte=eq.seed_exemplo`,
    {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    },
  );
  if (!res.ok) {
    console.warn(`Aviso: nao foi possivel limpar seeds anteriores (${res.status})`);
  }
}

const { regras } = JSON.parse(readFileSync(join(raiz, 'database/seeds/politicas_disputa.json'), 'utf8'));

console.log(`Ingerindo ${regras.length} politicas de disputa...`);
await limparSeedsAnteriores();

// Gera um chunk por regra (conteudos ja estao curtos) com embedding vetorial
const textos = regras.map((r) => `${r.titulo}\n\n${r.conteudo}`);
const vetores = await embedar(textos);

for (let i = 0; i < regras.length; i++) {
  const r = regras[i];
  const pedacos = chunkSimples(textos[i]);
  // para cada pedaco do chunk, reutiliza o mesmo embedding do texto completo
  for (const pedaco of pedacos) {
    await inserirChunk({
      origem: 'regra',
      referencia: 'politicas_disputa_exemplo',
      titulo: r.titulo,
      conteudo: pedaco,
      categoria: r.categoria,
      metadados: { fonte: 'seed_exemplo', versao: 1 },
      embedding: `[${vetores[i].join(',')}]`,
      ativo: true,
    });
    console.log(`  ok: ${r.titulo}`);
  }
}

console.log('Ingestao concluida.');
