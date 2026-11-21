// Rate limit simples em memoria por chave (ex.: IP)
// Best-effort para serverless: cada instancia tem seu proprio contador;
// suficiente para conter abuso casual sem servico externo

interface Entrada {
  timestamps: number[];
}

const store = new Map<string, Entrada>();

// Limpa entradas antigas periodicamente para nao crescer sem limite
function limpar() {
  const limite = Date.now() - 120_000;
  for (const [k, v] of store) {
    v.timestamps = v.timestamps.filter((t) => t > limite);
    if (v.timestamps.length === 0) store.delete(k);
  }
}

// Retorna true se a requisicao esta dentro do limite de `max` por `janelaMs`
export function verificarLimite(chave: string, max: number, janelaMs: number): boolean {
  if (store.size > 5000) limpar();
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
