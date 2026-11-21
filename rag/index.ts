// Modulo RAG do Projeto Kora
// Ingestao, chunking, embeddings e busca hibrida sobre o conhecimento da Kora

export { chunkText } from './chunking';
export { embedTexts } from './embeddings';
export { buscaHibrida } from './search';
export type { TrechoConhecimento, ResultadoBusca } from './search';
export type { Chunk } from './chunking';
