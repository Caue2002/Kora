// Catalogo e controle de cotas dos modelos gratuitos (10, do mais forte ao mais fraco)
// Le o estado das cotas no PostgreSQL e seleciona o proximo modelo disponivel
// Em caso de falha do banco, cai para selecao em memoria sem persistencia

import { consultar, rpc } from './supabase.js';
import { catalogoModelos, limitesJanela, maxTokensSaida } from './env.js';
import type { ModeloConfig } from './env.js';

export interface UsoModelo {
  tokensMinuto: number;
  tokensHora: number;
  tokensDia: number;
  esgotado: boolean;
}

// Consumo em memoria por modelo (fallback quando o banco esta indisponivel)
// Alem dos contadores, guarda o inicio da janela corrente de cada tipo:
// quando a janela vira (minuto/hora/dia), os contadores zeram e a marca de
// esgotado expira — sem isso um unico 429 bloqueava o modelo ate o
// processo reiniciar e as cotas nunca renovavam
interface UsoMemoria extends UsoModelo {
  janelaMinuto: string;
  janelaHora: string;
  janelaDia: string;
}
const usoMemoria = new Map<number, UsoMemoria>();

// Cache curto do consumo de cotas lido do banco: a consulta entrava no
// caminho critico de cada mensagem e o estado muda devagar. 10s de
// defasagem e seguro porque um 429 real ainda e tratado pelo failover;
// marcas de esgotado feitas nesta instancia continuam valendo na leitura
const TTL_CACHE_USOS_MS = 10_000;
let cacheUsos: { mapa: Map<number, UsoModelo>; expira: number } | null = null;

function limites(): { minuto: number; hora: number; dia: number } {
  const l = limitesJanela();
  return { minuto: l.minuto, hora: l.hora, dia: l.dia };
}

// Fuso de reset da janela "dia" por provedor (SPEC-cota-reset-pacifico):
// o Gemini renova a cota diaria (RPD) a meia-noite de America/Los_Angeles
// (doc oficial ai.google.dev/gemini-api/docs/rate-limits — "Requests per
// day quotas reset at midnight Pacific time"); o Groq renova as cotas
// diarias a meia-noite UTC; demais provedores usam UTC como bookkeeping
// (nao ha cota diaria formal conhecida). Antes a janela zerava a 00:00
// do fuso do servidor (UTC na Vercel) — horas depois do reset real do
// Gemini, o que gerava 429 evitaveis na virada do dia de cota.
// Minuto/hora nao entram aqui: sao janelas de duracao fixa, sem reset
// diario — o alinhamento de fuso so importa para a janela "dia".
function fusoResetDia(provedor: string): string {
  return provedor === 'gemini' ? 'America/Los_Angeles' : 'UTC';
}

// Mapa lazy id -> provedor do catalogo (env pode sobrescrever nomes,
// mas id/provedor sao estaveis)
let provedorPorId: Map<number, string> | null = null;
function provedorDoModelo(modeloId: number): string {
  if (!provedorPorId) {
    provedorPorId = new Map(catalogoModelos().map((m) => [m.id, m.provedor]));
  }
  return provedorPorId.get(modeloId) ?? '';
}

// Formatters Intl sao caros de criar — um par por fuso, reutilizado
const formatadoresPorFuso = new Map<
  string,
  { data: Intl.DateTimeFormat; partes: Intl.DateTimeFormat }
>();
function formatadoresDo(fuso: string): { data: Intl.DateTimeFormat; partes: Intl.DateTimeFormat } {
  let par = formatadoresPorFuso.get(fuso);
  if (!par) {
    par = {
      data: new Intl.DateTimeFormat('en-CA', {
        timeZone: fuso,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
      partes: new Intl.DateTimeFormat('en-US', {
        timeZone: fuso,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
    formatadoresPorFuso.set(fuso, par);
  }
  return par;
}

// Offset em ms entre o relogio do fuso e o UTC no instante t:
// o wall clock do fuso lido como se fosse UTC, menos o instante UTC
function offsetFusoMs(fuso: string, t: Date): number {
  const { partes } = formatadoresDo(fuso);
  const pedacos = partes.formatToParts(t);
  const v = (tipo: string) => Number(pedacos.find((p) => p.type === tipo)?.value ?? 0);
  const paredeComoUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour') % 24, v('minute'), v('second'));
  return paredeComoUtc - Math.floor(t.getTime() / 1000) * 1000;
}

// ISO do inicio (meia-noite mais recente) do dia civil corrente no fuso
// informado — e o valor de janela_inicio da janela "dia". A segunda
// passada de offset cobre os dias de virada de horario de verao, em que
// o offset na meia-noite difere do offset do chute inicial.
export function inicioDiaEmFuso(fuso: string, agora = new Date()): string {
  if (fuso === 'UTC') {
    return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())).toISOString();
  }
  const { data } = formatadoresDo(fuso);
  const partes = data.format(agora).split('-').map(Number);
  const [ano = 0, mes = 1, dia = 1] = partes;
  const chuteUtc = Date.UTC(ano, mes - 1, dia);
  const instante = chuteUtc - offsetFusoMs(fuso, new Date(chuteUtc));
  return new Date(chuteUtc - offsetFusoMs(fuso, new Date(instante))).toISOString();
}

// Consumo nas janelas correntes: minuto/hora seguem o relogio do
// servidor (duracao fixa); dia usa o fuso de reset do provedor do modelo
function inicioJanelas(provedor = 'UTC'): { minuto: string; hora: string; dia: string } {
  const agora = new Date();
  const minuto = new Date(agora);
  minuto.setSeconds(0, 0);
  const hora = new Date(agora);
  hora.setMinutes(0, 0, 0);
  return {
    minuto: minuto.toISOString(),
    hora: hora.toISOString(),
    dia: inicioDiaEmFuso(fusoResetDia(provedor), agora),
  };
}

// Consumo das janelas correntes para varios modelos em uma unica consulta
// (antes era uma query por modelo, em sequencia — atrasava a escolha do modelo).
// A janela "dia" tem um janela_inicio por provedor (PT p/ Gemini, UTC
// p/ demais): a query pede todos os candidatos e cada linha so conta se
// o janela_inicio bater com o esperado para o provedor daquele modelo —
// linhas orfas de fusos antigos (ex.: dia-UTC gravado antes desta
// mudanca) sao ignoradas em vez de inflar o consumo.
async function consumoBancoTodos(modeloIds: number[]): Promise<Map<number, UsoModelo>> {
  const mapa = new Map<number, UsoModelo>();
  const j = inicioJanelas();
  const diaEsperado = new Map<number, string>();
  const candidatos = new Set([j.minuto, j.hora]);
  for (const id of modeloIds) {
    const dia = inicioDiaEmFuso(fusoResetDia(provedorDoModelo(id)));
    diaEsperado.set(id, dia);
    candidatos.add(dia);
  }
  const janelaInicioIn = [...candidatos].map((v) => `"${v}"`).join(',');
  try {
    const linhas = await consultar<{
      modelo_id: number;
      janela_tipo: string;
      janela_inicio: string;
      tokens_estimados: number;
      esgotado: boolean;
    }>(
      'cotas_modelos',
      `modelo_id=in.(${modeloIds.join(',')})&janela_inicio=in.(${janelaInicioIn})&select=modelo_id,janela_tipo,janela_inicio,tokens_estimados,esgotado`,
    );
    for (const l of linhas) {
      const uso = mapa.get(l.modelo_id) ?? { tokensMinuto: 0, tokensHora: 0, tokensDia: 0, esgotado: false };
      // So a janela de minuto marca esgotado: linhas de hora/dia com a flag
      // sao restos do bug antigo (que marcava as 3 janelas) e bloqueariam o
      // modelo ate o fim do dia sem motivo
      if (l.esgotado && l.janela_tipo === 'minuto') uso.esgotado = true;
      // Confere o inicio da janela antes de somar: um registro de "dia"
      // gravado com a fronteira antiga nao pode contar na janela nova
      const esperado =
        l.janela_tipo === 'minuto' ? j.minuto : l.janela_tipo === 'hora' ? j.hora : diaEsperado.get(l.modelo_id);
      if (esperado && new Date(l.janela_inicio).getTime() !== new Date(esperado).getTime()) continue;
      if (l.janela_tipo === 'minuto') uso.tokensMinuto += Number(l.tokens_estimados);
      if (l.janela_tipo === 'hora') uso.tokensHora += Number(l.tokens_estimados);
      if (l.janela_tipo === 'dia') uso.tokensDia += Number(l.tokens_estimados);
      mapa.set(l.modelo_id, uso);
    }
  } catch {
    // banco indisponivel: cada modelo cai no consumo em memoria
  }
  return mapa;
}

// Retorna o registro interno de memoria ja com as janelas renovadas:
// contadores de janelas que viraram voltam a zero e o esgotado (que so vale
// para a janela de minuto) expira junto — mesmo comportamento do banco
function usoMemoriaInterno(modeloId: number): UsoMemoria {
  const j = inicioJanelas(provedorDoModelo(modeloId));
  let u = usoMemoria.get(modeloId);
  if (!u) {
    u = {
      tokensMinuto: 0,
      tokensHora: 0,
      tokensDia: 0,
      esgotado: false,
      janelaMinuto: '',
      janelaHora: '',
      janelaDia: '',
    };
    usoMemoria.set(modeloId, u);
  }
  if (u.janelaMinuto !== j.minuto) {
    u.tokensMinuto = 0;
    u.janelaMinuto = j.minuto;
    u.esgotado = false;
  }
  if (u.janelaHora !== j.hora) {
    u.tokensHora = 0;
    u.janelaHora = j.hora;
  }
  if (u.janelaDia !== j.dia) {
    u.tokensDia = 0;
    u.janelaDia = j.dia;
  }
  return u;
}

function consumoMemoria(modeloId: number): UsoModelo {
  const u = usoMemoriaInterno(modeloId);
  return {
    tokensMinuto: u.tokensMinuto,
    tokensHora: u.tokensHora,
    tokensDia: u.tokensDia,
    esgotado: u.esgotado,
  };
}

// Verifica se o modelo tem folga nas 3 janelas de cota
export function temFolga(uso: UsoModelo, tokensEntrada: number): boolean {
  if (uso.esgotado) return false;
  const lim = limites();
  const teto = maxTokensSaida();
  return (
    uso.tokensMinuto + tokensEntrada + teto <= lim.minuto &&
    uso.tokensHora + tokensEntrada + teto <= lim.hora &&
    uso.tokensDia + tokensEntrada + teto <= lim.dia
  );
}

// Prioridade do modelo lite mais forte do catalogo (menor numero entre os
// 'lite'): base do roteamento por intencao — mensagens casuais/meta comecam
// aqui em vez do modelo principal. null quando nao ha lite configurado
export function prioridadeModeloLite(): number | null {
  const prioridades = catalogoModelos()
    .filter((m) => m.nomeModelo.includes('lite'))
    .map((m) => m.prioridade);
  return prioridades.length > 0 ? Math.min(...prioridades) : null;
}

// Seleciona o primeiro modelo da fila com folga de cota.
// prioridadeMinima permite o roteamento por intencao (SPEC-roteamento-
// modelos): mensagens casuais/meta comecam nos modelos lite (prioridade
// alta = modelo mais fraco), triagem comeca no mais forte (padrao = 1).
// O numero MAIOR de prioridade indica modelo mais fraco no catalogo
export async function selecionarModelo(
  tokensEntradaEstimados: number,
  prioridadeMinima = 1,
): Promise<ModeloConfig | null> {
  const catalogo = catalogoModelos()
    .filter((m) => m.apiKey && m.prioridade >= prioridadeMinima)
    .sort((a, b) => a.prioridade - b.prioridade);

  let usos = cacheUsos && cacheUsos.expira > Date.now() ? cacheUsos.mapa : null;
  if (!usos) {
    usos = await consumoBancoTodos(catalogo.map((m) => m.id));
    cacheUsos = { mapa: usos, expira: Date.now() + TTL_CACHE_USOS_MS };
  }

  for (const modelo of catalogo) {
    const base = usos.get(modelo.id) ?? consumoMemoria(modelo.id);
    // Esgotamento marcado nesta instancia (apos um 429) vale mesmo quando
    // o cache/DB ainda mostra o modelo como disponivel
    const usoMem = consumoMemoria(modelo.id);
    const uso = usoMem.esgotado && !base.esgotado ? { ...base, esgotado: true } : base;
    if (temFolga(uso, tokensEntradaEstimados)) return modelo;
  }
  return null;
}

// Marca o modelo como esgotado na janela de minuto apos erro de limite
// Somente a janela de minuto e marcada: um 429 transitorio (RPM do provedor)
// nao deve bloquear o modelo por uma hora ou um dia; as cotas maiores sao
// controladas pelos contadores de tokens de cada janela
export async function marcarEsgotado(modeloId: number): Promise<void> {
  const j = inicioJanelas(provedorDoModelo(modeloId));
  const lim = limites();
  for (const janela_tipo of ['minuto'] as const) {
    try {
      await rpc('marcar_modelo_esgotado', {
        p_modelo_id: modeloId,
        p_janela_tipo: janela_tipo,
        p_janela_inicio: j[janela_tipo],
        p_limite: lim[janela_tipo],
      });
    } catch {
      // segue para a proxima janela mesmo se uma falhar
    }
  }
  usoMemoriaInterno(modeloId).esgotado = true;
}

// Registra o consumo de tokens apos a resposta (real quando informado, senao estimativa)
export async function registrarConsumo(modeloId: number, tokens: number): Promise<void> {
  if (tokens <= 0) return;
  const j = inicioJanelas(provedorDoModelo(modeloId));
  const lim = limites();
  // As 3 janelas sao independentes: registram em paralelo em vez de
  // somar 3 round-trips sequenciais ao caminho da resposta
  await Promise.all(
    (['minuto', 'hora', 'dia'] as const).map(async (janela_tipo) => {
      try {
        await rpc('registrar_consumo_tokens', {
          p_modelo_id: modeloId,
          p_janela_tipo: janela_tipo,
          p_janela_inicio: j[janela_tipo],
          p_tokens: tokens,
          p_limite: lim[janela_tipo],
        });
      } catch {
        // consumo em memoria como fallback
      }
    }),
  );
  const u = usoMemoriaInterno(modeloId);
  u.tokensMinuto += tokens;
  u.tokensHora += tokens;
  u.tokensDia += tokens;
}
