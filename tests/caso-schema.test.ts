import { describe, expect, it } from 'vitest';
import { EstadoCasoSchema, parseEstadoExtraido } from '../shared/caso';

// Extracao estruturada do caso (SPEC-caso-estruturado): schema zod
// substitui o sanitizador manual — defaults tolerantes por campo

describe('parseEstadoExtraido', () => {
  it('devolve null sem JSON', () => {
    expect(parseEstadoExtraido('sem json aqui')).toBeNull();
    expect(parseEstadoExtraido('{')).toBeNull();
  });

  it('faz parse de JSON valido completo', () => {
    const r = parseEstadoExtraido(
      'Aqui esta: {"etapa":"parecer","categoria":"quantidade","status":"resolvido","resumo":"ok","fatos":["f1"],"evidencias":["e1"],"pendencias":[]}',
    );
    expect(r?.etapa).toBe('parecer');
    expect(r?.categoria).toBe('quantidade');
    expect(r?.fatos).toEqual(['f1']);
  });

  it('tolera JSON embrulhado em texto', () => {
    const r = parseEstadoExtraido('resultado: {"etapa":"analise"} fim');
    expect(r?.etapa).toBe('analise');
    expect(r?.status).toBe('em_andamento'); // default do schema
  });

  it('campo fora do enum cai no default, nao derruba o objeto', () => {
    const r = parseEstadoExtraido(
      '{"etapa":"inventada","categoria":"foo","status":"hacked","resumo":"x","fatos":"nao-lista","evidencias":[1,2],"pendencias":null}',
    );
    expect(r?.etapa).toBe('triagem');
    expect(r?.categoria).toBeNull();
    expect(r?.status).toBe('em_andamento');
    expect(r?.fatos).toEqual([]);
  });

  it('resumo longo e truncado em 300 chars', () => {
    const r = EstadoCasoSchema.parse({ resumo: 'a'.repeat(400) });
    expect(r.resumo).toHaveLength(300);
  });

  it('listas acima de 12 itens sao cortadas', () => {
    const r = EstadoCasoSchema.parse({ fatos: Array.from({ length: 20 }, (_, i) => `f${i}`) });
    expect(r.fatos).toHaveLength(12);
  });
});
