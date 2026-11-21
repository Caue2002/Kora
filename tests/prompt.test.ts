import { describe, expect, it } from 'vitest';
import { montarPromptSistema, montarContextoRAG } from '../coherence/prompt';

describe('prompt do Nori', () => {
  it('contem persona, categorias e limites obrigatorios', () => {
    const prompt = montarPromptSistema();
    expect(prompt).toContain('Nori');
    expect(prompt).toContain('Kora');
    expect(prompt).toContain('nao inventa dados');
    expect(prompt).toContain('quantidade');
  });

  it('contexto RAG vazio instrui a nao afirmar regras', () => {
    const ctx = montarContextoRAG([]);
    expect(ctx).toContain('Nenhuma politica');
  });

  it('contexto RAG formata trechos com titulo e categoria', () => {
    const ctx = montarContextoRAG([
      { titulo: 'Regra de avaria', conteudo: 'Registrar avaria na hora.', categoria: 'status_avaria' },
    ]);
    expect(ctx).toContain('Regra de avaria');
    expect(ctx).toContain('status_avaria');
  });
});
