// Rate limit por chave (ex.: IP) com duas camadas:
// 1) Persistente no Postgres via RPC verificar_rate_limit (compartilhado entre
//    instancias serverless, janela fixa atomica)
// 2) Fallback em memoria por instancia quando o banco esta indisponivel
//    ou a migration 0008 ainda nao foi aplicada

import { rpc } from './supabase';

interface Entrada {
  timestamps: number[];
}

const store = new Map<string, Entrada>();

// Contador deslizante local, usado apenas como fallback
function verificarLimiteMemoria(chave: string, max: number, janelaMs: number): boolean {
  if (store.size > 5000) {
    const limite = Date.now() - 120_000;
    for (const [k, v] of store) {
      v.timestamps = v.timestamps.filter((t) => t > limite);
      if (v.timestamps.length === 0) store.delete(k);
    }
  }
  const agora = Date.now();
  const entrada = store.get(chave) ?? { timestamps: [] };
  entrada.timestamps = entrada.timestamps.filter((t) => t > agora - janelaMs);
  if (entrada.timestamps.length >= max) {
    store.set(chave, entrada);
    return false;
  }
  entrada.timestamps.push(agora);
  store.set(chave, entrada);
  return true;
}

// Retorna true se a requisicao esta dentro do limite de `max` por `janelaMs`
export async function verificarLimite(chave: string, max: number, janelaMs: number): Promise<boolean> {
  try {
    const ok = await rpc<boolean>('verificar_rate_limit', {
      p_chave: chave.slice(0, 200),
      p_janela_seg: Math.max(1, Math.round(janelaMs / 1000)),
      p_max: max,
    });
    if (typeof ok === 'boolean') return ok;
  } catch {
    // banco indisponivel ou funcao ausente: cai no contador local
  }
  return verificarLimiteMemoria(chave, max, janelaMs);
}
