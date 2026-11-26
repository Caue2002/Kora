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

function inicioJanelas(): { minuto: string; hora: string; dia: string } {
  const agora = new Date();
  const minuto = new Date(agora);
  minuto.setSeconds(0, 0);
  const hora = new Date(agora);
  hora.setMinutes(0, 0, 0);
  const dia = new Date(agora);
  dia.setHours(0, 0, 0, 0);
  return { minuto: minuto.toISOString(), hora: hora.toISOString(), dia: dia.toISOString() };
}

function limites(): { minuto: number; hora: number; dia: number } {
  const l = limitesJanela();
  return { minuto: l.minuto, hora: l.hora, dia: l.dia };
}

// Consumo das janelas correntes para varios modelos em uma unica consulta
// (antes era uma query por modelo, em sequencia — atrasava a escolha do modelo)
async function consumoBancoTodos(modeloIds: number[]): Promise<Map<number, UsoModelo>> {
  const mapa = new Map<number, UsoModelo>();
  const j = inicioJanelas();
  try {
    const linhas = await consultar<{
      modelo_id: number;
      janela_tipo: string;
      tokens_estimados: number;
      esgotado: boolean;
    }>(
      'cotas_modelos',
      `modelo_id=in.(${modeloIds.join(',')})&janela_inicio=in.("${j.minuto}","${j.hora}","${j.dia}")&select=modelo_id,janela_tipo,tokens_estimados,esgotado`,
    );
    for (const l of linhas) {
      const uso = mapa.get(l.modelo_id) ?? { tokensMinuto: 0, tokensHora: 0, tokensDia: 0, esgotado: false };
      // So a janela de minuto marca esgotado: linhas de hora/dia com a flag
      // sao restos do bug antigo (que marcava as 3 janelas) e bloqueariam o
      // modelo ate o fim do dia sem motivo
      if (l.esgotado && l.janela_tipo === 'minuto') uso.esgotado = true;
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
  const j = inicioJanelas();
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
  const j = inicioJanelas();
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
  const j = inicioJanelas();
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
