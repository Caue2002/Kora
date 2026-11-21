import { describe, expect, it } from 'vitest';
import { chunkText } from '../rag/chunking';

describe('chunkText', () => {
  it('retorna vazio para texto vazio', () => {
    expect(chunkText('')).toEqual([]);
  });

  it('mantem texto curto em um unico chunk', () => {
    const chunks = chunkText('regra simples de teste');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.conteudo).toBe('regra simples de teste');
  });

  it('divide paragrafos longos em multiplos chunks dentro do limite', () => {
    const paragrafo = 'a'.repeat(500);
    const texto = `${paragrafo}\n\n${paragrafo}\n\n${paragrafo}`;
    const chunks = chunkText(texto);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.conteudo.length).toBeLessThanOrEqual(800);
    }
  });

  it('fatia paragrafo maior que o tamanho maximo', () => {
    const texto = 'b'.repeat(2000);
    const chunks = chunkText(texto);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.conteudo.length).toBeLessThanOrEqual(800);
    }
  });
});
