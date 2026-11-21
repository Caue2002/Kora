// Geracao de embeddings via tier gratuito do Gemini
// Retorna null quando nao ha chave configurada; a busca hibrida cai para lexical

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Embedda um lote de textos usando gemini-embedding-001
// A dimensao do vetor deve bater com a coluna embedding da tabela conhecimento_chunks
export async function embedTexts(textos: string[]): Promise<number[][] | null> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GEMINI_EMBEDDING_API_KEY;
  const modelo = process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001';
  if (!apiKey || textos.length === 0) return null;

  try {
    const res = await fetch(`${ENDPOINT}/${modelo}:batchEmbedContents?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: textos.map((t) => ({
          model: `models/${modelo}`,
          content: { parts: [{ text: t }] },
          // dimensao alinhada a coluna embedding vector(1536) da migracao
          outputDimensionality: 1536,
        })),
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      embeddings?: Array<{ values?: number[] }>;
    };
    const vetores = json.embeddings?.map((e) => e.values ?? []);
    return vetores && vetores.length === textos.length ? vetores : null;
  } catch {
    return null;
  }
}

