// Estimativa e contabilidade de tokens
// Regra da especificacao: estimar antes da chamada, registrar consumo real ou estimativa consolidada depois

// Estimativa heuristica: ~4 caracteres por token para texto em portugues
// Suficiente para o teto de seguranca; a contagem real do provedor prevalece quando disponivel
export function estimarTokens(texto: string): number {
  if (!texto) return 0;
  return Math.ceil(texto.length / 4);
}

export function estimarMensagens(mensagens: Array<{ role: string; content: string }>): number {
  // overhead fixo por mensagem (metadados do formato) + conteudo estimado
  return mensagens.reduce((acc, m) => acc + estimarTokens(m.content) + 4, 0);
}
