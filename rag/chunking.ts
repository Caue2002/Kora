// Segmentacao de conteudo em chunks para o RAG
// Chunks curtos e com sobreposicao preservam contexto nas fronteiras

export interface Chunk {
  indice: number;
  conteudo: string;
}

const TAMANHO_MAX = 800;
const SOBREPOSICAO = 100;

// Divide o texto em paragrafos e agrupa em chunks de ate TAMANHO_MAX caracteres
export function chunkText(texto: string, tamanhoMax = TAMANHO_MAX, sobreposicao = SOBREPOSICAO): Chunk[] {
  const paragrafos = texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: Chunk[] = [];
  let atual = '';

  const fechar = () => {
    if (atual.trim().length === 0) return;
    chunks.push({ indice: chunks.length, conteudo: atual.trim() });
    // mantem a cauda do chunk anterior como sobreposicao para o proximo
    atual = atual.slice(-sobreposicao);
  };

  for (const paragrafo of paragrafos) {
    if (atual.length + paragrafo.length + 2 > tamanhoMax) {
      fechar();
    }
    if (paragrafo.length > tamanhoMax) {
      // paragrafo maior que o limite: fatia por janelas com sobreposicao
      for (let i = 0; i < paragrafo.length; i += tamanhoMax - sobreposicao) {
        chunks.push({ indice: chunks.length, conteudo: paragrafo.slice(i, i + tamanhoMax) });
      }
      atual = '';
      continue;
    }
    atual = atual ? `${atual}\n\n${paragrafo}` : paragrafo;
  }
  fechar();
  return chunks;
}
