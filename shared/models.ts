// Catalogo e controle de cotas dos 4 modelos gratuitos
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
const usoMemoria = new Map<number, UsoModelo>();

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

// Soma do consumo registrado nas janelas correntes para um modelo
async function consumoBanco(modeloId: number): Promise<UsoModelo | null> {
  const j = inicioJanelas();
  try {
    const linhas = await consultar<{ janela_tipo: string; tokens_estimados: number; esgotado: boolean }>(
      'cotas_modelos',
      `modelo_id=eq.${modeloId}&janela_inicio=in.("${j.minuto}","${j.hora}","${j.dia}")&select=janela_tipo,tokens_estimados,esgotado`,
    );
    const uso: UsoModelo = { tokensMinuto: 0, tokensHora: 0, tokensDia: 0, esgotado: false };
    for (const l of linhas) {
      if (l.esgotado) uso.esgotado = true;
      if (l.janela_tipo === 'minuto') uso.tokensMinuto += Number(l.tokens_estimados);
      if (l.janela_tipo === 'hora') uso.tokensHora += Number(l.tokens_estimados);
      if (l.janela_tipo === 'dia') uso.tokensDia += Number(l.tokens_estimados);
    }
    return uso;
  } catch {
    return null;
  }
}

function consumoMemoria(modeloId: number): UsoModelo {
  return usoMemoria.get(modeloId) ?? { tokensMinuto: 0, tokensHora: 0, tokensDia: 0, esgotado: false };
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

// Seleciona o primeiro modelo da fila (prioridade 1 a 4) com folga de cota
export async function selecionarModelo(tokensEntradaEstimados: number): Promise<ModeloConfig | null> {
  const catalogo = catalogoModelos().filter((m) => m.apiKey);
  const ordenados = catalogo.sort((a, b) => a.prioridade - b.prioridade);
  for (const modelo of ordenados) {
    const usoBanco = await consumoBanco(modelo.id);
    const uso = usoBanco ?? consumoMemoria(modelo.id);
    if (temFolga(uso, tokensEntradaEstimados)) return modelo;
  }
  return null;
}

// Marca o modelo como esgotado nas janelas correntes apos erro de limite
export async function marcarEsgotado(modeloId: number): Promise<void> {
  const j = inicioJanelas();
  const lim = limites();
  for (const janela_tipo of ['minuto', 'hora', 'dia'] as const) {
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
  const u = consumoMemoria(modeloId);
  u.esgotado = true;
  usoMemoria.set(modeloId, u);
}

// Registra o consumo de tokens apos a resposta (real quando informado, senao estimativa)
export async function registrarConsumo(modeloId: number, tokens: number): Promise<void> {
  if (tokens <= 0) return;
  const j = inicioJanelas();
  const lim = limites();
  for (const janela_tipo of ['minuto', 'hora', 'dia'] as const) {
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
  }
  const u = consumoMemoria(modeloId);
  u.tokensMinuto += tokens;
  u.tokensHora += tokens;
  u.tokensDia += tokens;
  usoMemoria.set(modeloId, u);
}
