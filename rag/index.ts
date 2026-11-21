// Modulo RAG do Projeto Kora
// Ingestao, chunking, embeddings e busca hibrida sobre o conhecimento da RotaLeve

export { chunkText } from './chunking.js';
export { embedTexts } from './embeddings.js';
export { buscaHibrida } from './search.js';
export type { TrechoConhecimento, ResultadoBusca } from './search.js';
export type { Chunk } from './chunking.js';
