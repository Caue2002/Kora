// Testes do fallback em camadas (spec/SPEC-fallback-camadas)
// Cobre: deteccao de intencao, variantes estaveis, ehFallback e a cascata
// do resolverFallback com Supabase mockado

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  detectarIntencaoFallback,
  escolherVarianteFallback,
  ehFallback,
  resolverFallback,
  VARIANTES_FALLBACK,
} from '../coherence/fallback';

// Supabase mockado: cada teste define o que rpc/consultar devolvem
const rpcMock = vi.fn();
const consultarMock = vi.fn();
vi.mock('../shared/supabase.js', () => ({
  rpc: (...args: unknown[]) => rpcMock(...args),
  consultar: (...args: unknown[]) => consultarMock(...args),
}));

const embedding = [0.1, 0.2, 0.3];
const base = { mensagem: 'teste', embedding, chaveCache: 'cliente|manha|' };

describe('detectarIntencaoFallback', () => {
  it('reconhece cada intencao do dominio', () => {
    expect(detectarIntencaoFallback('oi, tudo bem?')).toBe('saudacao');
    expect(detectarIntencaoFallback('obrigado!')).toBe('saudacao');
    expect(detectarIntencaoFallback('qual modelo de ia voce usa?')).toBe('meta');
    expect(detectarIntencaoFallback('meu pedido KORA-1234 atrasou')).toBe('atraso');
    expect(detectarIntencaoFallback('confirmar pedido KORA-1234')).toBe('confirmacao_pedido');
    expect(detectarIntencaoFallback('faltou um item do meu pedido')).toBe('item_faltante');
    expect(detectarIntencaoFallback('veio o item errado no pedido')).toBe('item_errado');
    expect(detectarIntencaoFallback('o produto veio frio e estragado')).toBe('qualidade');
    expect(detectarIntencaoFallback('tenho foto da evidencia do problema')).toBe('evidencias');
    expect(detectarIntencaoFallback('quero reembolso do pedido')).toBe('conciliacao');
  });

  it('temporal e generico caem em geral', () => {
    expect(detectarIntencaoFallback('que dia e hoje?')).toBe('geral');
    expect(detectarIntencaoFallback('asdfghjkl zxcv')).toBe('geral');
  });

  it('disputa especifica vence evidencia generica', () => {
    expect(detectarIntencaoFallback('faltou refrigerante, segue foto')).toBe('item_faltante');
  });
});

describe('escolherVarianteFallback', () => {
  it('e estavel por conversaId', () => {
    const a = escolherVarianteFallback('conv-123');
    const b = escolherVarianteFallback('conv-123');
    expect(a).toBe(b);
    expect(VARIANTES_FALLBACK).toContain(a);
  });

  it('sem conversaId ainda devolve uma variante valida', () => {
    expect(VARIANTES_FALLBACK).toContain(escolherVarianteFallback());
  });
});

describe('ehFallback', () => {
  it('reconhece todas as variantes e rejeita texto normal', () => {
    for (const v of VARIANTES_FALLBACK) expect(ehFallback(v)).toBe(true);
    expect(ehFallback('  ' + VARIANTES_FALLBACK[1]! + '  ')).toBe(true);
    expect(ehFallback('Sua solicitacao foi registrada com sucesso.')).toBe(false);
    expect(ehFallback('')).toBe(false);
  });
});

describe('resolverFallback', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    consultarMock.mockReset();
  });

  it('camada 1: serve o cache relaxado quando ha vizinho bom', async () => {
    rpcMock.mockResolvedValue([
      { resposta: 'Resposta util cacheada', score: 0.85, fontes: [], escopo: 'fallback' },
    ]);
    const r = await resolverFallback({ ...base, mensagem: 'oi' });
    expect(r.camada).toBe('cache-fallback');
    expect(r.texto).toBe('Resposta util cacheada');
    expect(consultarMock).not.toHaveBeenCalled();
  });

  it('camada 1: ignora score abaixo do limiar e recusa cacheada', async () => {
    rpcMock.mockResolvedValue([{ resposta: 'Resposta util', score: 0.5, fontes: [] }]);
    consultarMock.mockResolvedValue([{ resposta: 'canon', prioridade: 1 }]);
    const r = await resolverFallback({ ...base, mensagem: 'item faltante' });
    expect(r.camada).toBe('banco-fallback');

    rpcMock.mockResolvedValue([{ resposta: 'nao consegui responder isso', score: 0.9, fontes: [] }]);
    consultarMock.mockResolvedValue([{ resposta: 'canon', prioridade: 1 }]);
    const r2 = await resolverFallback({ ...base, mensagem: 'item faltante' });
    expect(r2.camada).toBe('banco-fallback');
  });

  it('camada 2: usa o banco canonico pela intencao detectada', async () => {
    rpcMock.mockResolvedValue([]);
    consultarMock.mockResolvedValue([{ resposta: 'canon faltante', prioridade: 1 }]);
    const r = await resolverFallback({ ...base, mensagem: 'faltou item' });
    expect(r.camada).toBe('banco-fallback');
    expect(r.texto).toBe('canon faltante');
    expect(consultarMock).toHaveBeenCalledWith(
      'fallback_respostas',
      expect.stringContaining('intencao=eq.item_faltante'),
    );
  });

  it('camada 3: variante generica quando tudo falha', async () => {
    rpcMock.mockRejectedValue(new Error('banco fora'));
    consultarMock.mockRejectedValue(new Error('banco fora'));
    const r = await resolverFallback({ ...base, mensagem: 'oi' });
    expect(r.camada).toBe('generico-fallback');
    expect(VARIANTES_FALLBACK).toContain(r.texto);
  });

  it('sem embedding pula a camada de cache e vai ao banco', async () => {
    consultarMock.mockResolvedValue([{ resposta: 'canon', prioridade: 1 }]);
    const r = await resolverFallback({ mensagem: 'oi', chaveCache: 'c|' });
    expect(r.camada).toBe('banco-fallback');
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
