import { describe, expect, it } from 'vitest';
import { montarBlocoMemoria } from '../shared/memoria';
import handler from '../api/memoria';

// Memoria persistente (SPEC-memoria-usuario): bloco de prompt e validacoes
// do endpoint que nao dependem de LLM/Supabase

describe('montarBlocoMemoria', () => {
  it('devolve vazio sem memorias', () => {
    expect(montarBlocoMemoria([])).toBe('');
  });

  it('devolve vazio quando todos os resumos sao vazios', () => {
    expect(montarBlocoMemoria([{ resumo: '  ', criado_em: '' }])).toBe('');
  });

  it('monta bloco com instrucoes de uso natural', () => {
    const bloco = montarBlocoMemoria([
      { resumo: 'Prefere reembolso em creditos', criado_em: '2026-01-01' },
      { resumo: 'Pedido #A1B2 com item faltante resolvido', criado_em: '2026-01-02' },
    ]);
    expect(bloco).toContain('Memorias de sessoes anteriores');
    expect(bloco).toContain('- Prefere reembolso em creditos');
    expect(bloco).toContain('- Pedido #A1B2');
  });

  it('limita a 5 memorias', () => {
    const memorias = Array.from({ length: 8 }, (_, i) => ({
      resumo: `fato ${i}`,
      criado_em: '',
    }));
    const bloco = montarBlocoMemoria(memorias);
    expect(bloco.match(/^- fato/gm)).toHaveLength(5);
    expect(bloco).not.toContain('fato 5');
  });
});

describe('POST /api/memoria — validacoes sem LLM/Supabase', () => {
  function post(corpo: unknown): Promise<Response> {
    return handler(
      new Request('http://localhost/api/memoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      }),
    );
  }

  it('rejeita metodo GET', async () => {
    const res = await handler(new Request('http://localhost/api/memoria'));
    expect(res.status).toBe(405);
  });

  it('rejeita dispositivoId invalido', async () => {
    const res = await post({ dispositivoId: 'x', historico: [] });
    expect(res.status).toBe(400);
  });

  it('historico curto responde ok sem gravar (sem chamar LLM)', async () => {
    const res = await post({
      dispositivoId: '550e8400-e29b-41d4-a716-446655440000',
      historico: [
        { role: 'user', content: 'oi' },
        { role: 'assistant', content: 'ola!' },
      ],
    });
    expect(res.status).toBe(200);
    const dados = (await res.json()) as { ok: boolean; gravado: boolean };
    expect(dados).toEqual({ ok: true, gravado: false });
  });
});
