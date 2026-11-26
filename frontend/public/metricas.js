// Painel de observabilidade do Nori (metricas_chat)
// Arquivo externo (e nao inline) porque a CSP da Vercel usa script-src 'self'
// e bloquearia qualquer <script> embutido na pagina

// Precos aproximados por 1M de tokens (entrada+saida misturados) para estimar
// "quanto custaria" se os mesmos modelos rodassem pagos — os valores sao
// referencias de tabela publica e servem so para comparacao relativa.
const PRECOS_1M = {
  'gemini-4-hydrogen': 1.50,
  'gemini-3.8-flash': 0.50,
  'gemini-3.6-flash': 0.30,
  'gemini-3.5-flash': 0.30,
  'gemini-3-flash-preview': 0.30,
  'gemini-3.5-flash-lite': 0.10,
  'gemini-3.1-flash-lite': 0.10,
  'gemini-3.1-flash-lite-preview': 0.10,
  'gemini-3.7-flash': 0.30,
  'gemini-4-argon': 2.00,
  'gemini-flash-latest': 0.50,
  'gemini-3.1-pro-preview': 1.25,
  'gemini-pro-latest': 1.50,
  'gpt-oss-120b': 0.15,
  'openai': 0.20,
};

const fmt = (n, d = 0) => (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const usd = (n) => 'US$ ' + (n ?? 0).toFixed(4);

function kpi(rot, val, det) {
  return `<div class="kpi"><div class="rot">${rot}</div><div class="val">${val}</div><div class="det">${det ?? ''}</div></div>`;
}

function custoTotal(m) {
  return (m.por_modelo ?? []).reduce(
    (acc, x) => acc + ((x.tokens_total ?? 0) / 1e6) * (PRECOS_1M[x.modelo] ?? 0.20),
    0,
  );
}

function escapar(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// "2026-11-25" -> "25/11"; aceita Date ou string ISO
function formatarDia(dia) {
  const s = String(dia ?? '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  return s.slice(5) || s;
}

// "2026-11-25" -> "25/11/2026" (data completa para o subtitulo do painel)
function formatarDiaCompleto(dia) {
  const s = String(dia ?? '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
  return s;
}

function render(m) {
  // Todos os agregados sao do dia corrente (fuso America/Sao_Paulo) — a RPC
  // devolve 'dia' para o painel deixar explicito qual dia esta sendo medido
  const sub = document.querySelector('.sub');
  if (sub) sub.textContent = `PROJETO KORA — MÉTRICAS DE ${formatarDiaCompleto(m.dia)} · RESET DIÁRIO`;

  const total = m.total_geral ?? 0;
  const cacheHits = m.cache_hits ?? 0;
  const hitRate = total > 0 ? (cacheHits / total) * 100 : 0;
  const lat = m.latencia_media_ms ?? 0;
  const p50 = m.latencia_p50_ms ?? 0;
  const p95 = m.latencia_p95_ms ?? 0;

  document.getElementById('kpis').innerHTML = [
    kpi('Mensagens hoje', fmt(total), `${fmt(m.ultimas_24h)} nas últimas 24h`),
    kpi('Cache hit rate', hitRate.toFixed(1) + '%', `${fmt(cacheHits)} respostas reutilizadas`),
    kpi('Latência média', fmt(lat) + ' ms', `p50 ${fmt(p50)} ms · p95 ${fmt(p95)} ms`),
    kpi('Function calls', fmt(m.tools_total ?? 0), 'tools executadas pelo agente'),
    kpi('Custo equivalente', usd(custoTotal(m)), 'se pago, por 1M tokens mistos'),
  ].join('');

  // trace medio: media por etapa sobre os traces recentes
  const traces = Array.isArray(m.traces_recentes) ? m.traces_recentes : [];
  const etapas = {};
  for (const t of traces) {
    if (!t || typeof t !== 'object') continue;
    for (const [k, v] of Object.entries(t)) {
      etapas[k] = etapas[k] ?? { soma: 0, n: 0 };
      etapas[k].soma += Number(v) || 0;
      etapas[k].n += 1;
    }
  }
  const ROTULOS = { contexto_ms: 'Contexto (RAG+modelo+cache)', llm_ms: 'LLM (geração)' };
  const maxEtapa = Math.max(1, ...Object.values(etapas).map((e) => e.soma / e.n));
  document.getElementById('trace-medio').innerHTML = Object.keys(etapas).length
    ? Object.entries(etapas)
        .map(([k, e]) => {
          const media = e.soma / e.n;
          return `<div class="trace-item">
            <div class="topo"><b>${escapar(ROTULOS[k] ?? k)}</b><span>${fmt(media)} ms médio · ${e.n} reqs</span></div>
            <div class="barra"><div style="width:${Math.max(2, (media / maxEtapa) * 100)}%"></div></div>
          </div>`;
        })
        .join('')
    : '<div class="vazio">Sem traces ainda — chegam com as próximas mensagens.</div>';

  // por dia (cronologico, do mais antigo ao mais recente)
  const dias = (Array.isArray(m.por_dia) ? m.por_dia : []).slice().reverse();
  const maxDia = Math.max(1, ...dias.map((d) => Number(d.total) || 0));
  const pico = dias.find((d) => (Number(d.total) || 0) === maxDia && maxDia > 0);
  document.getElementById('por-dia').innerHTML = dias.length
    ? dias
        .map((d) => {
          const totalDia = Number(d.total) || 0;
          const ehPico = pico && d.dia === pico.dia && totalDia === maxDia;
          return `<div class="col${ehPico ? ' mais' : ''}"><div class="v" data-v="${totalDia}" style="height:${Math.max(3, (totalDia / maxDia) * 100)}%" title="${escapar(formatarDia(d.dia))}: ${totalDia}"></div><div class="d">${escapar(formatarDia(d.dia))}</div></div>`;
        })
        .join('')
    : '<div class="vazio">Sem dados ainda.</div>';

  // por modelo
  const modelos = Array.isArray(m.por_modelo) ? m.por_modelo : [];
  const maxTok = Math.max(1, ...modelos.map((x) => Number(x.tokens_total) || 0));
  document.getElementById('por-modelo').innerHTML = modelos.length
    ? modelos
        .map((x) => {
          const tokens = Number(x.tokens_total) || 0;
          const preco = PRECOS_1M[x.modelo] ?? 0.2;
          const custo = (tokens / 1e6) * preco;
          const pct = maxTok > 0 ? Math.max(2, (tokens / maxTok) * 100) : 0;
          return `<tr>
            <td><span class="tag">${escapar(x.modelo ?? '(sem modelo)')}</span></td>
            <td>${fmt(x.total)}</td>
            <td>${fmt(x.latencia_media_ms)} ms</td>
            <td>${fmt(tokens)}<div class="barra-mini" style="margin-top:5px"><div style="width:${pct}%"></div></div></td>
            <td>${usd(custo)}</td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="5" class="vazio">Sem dados ainda.</td></tr>';
}

async function carregar() {
  const kpis = document.getElementById('kpis');
  const btn = document.getElementById('btn-atualizar');
  const orbita = document.getElementById('orbita-status');
  try {
    btn.disabled = true;
    if (orbita) orbita.style.display = 'inline-flex';
    const res = await fetch('/api/metricas', { cache: 'no-store' });
    if (!res.ok) throw new Error(`API respondeu HTTP ${res.status}`);
    const dados = await res.json().catch(() => null);
    const m = dados && dados.metricas;
    if (!m) throw new Error('API nao retornou metricas (banco indisponivel ou sem dados)');
    render(m);
    document.getElementById('atualizado').textContent = 'atualizado ' + new Date().toLocaleTimeString('pt-BR');
  } catch (e) {
    kpis.innerHTML =
      kpi('Status', 'indisponível', escapar(e && e.message ? e.message : e)) +
      `<div class="kpi erro-caixa"><div class="rot">Detalhe</div><div class="det" style="margin-top:4px">Verifique se a API esta no ar e se a migration 0009/0011 foi aplicada no Supabase.</div></div>`;
    document.getElementById('atualizado').textContent = '';
  } finally {
    btn.disabled = false;
    if (orbita) orbita.style.display = 'none';
  }
}

document.getElementById('btn-atualizar').addEventListener('click', carregar);
carregar();
setInterval(carregar, 30000);
