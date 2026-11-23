import { describe, expect, it } from 'vitest';
import { validarHeuristico, ehRespostaDeRecusa } from '../coherence/validacao';

describe('validacao heuristica de coerencia', () => {
  it('aprova resposta normal', () => {
    expect(validarHeuristico('Qual etapa da ocorrencia?').ok).toBe(true);
  });

  it('reprova resposta vazia', () => {
    expect(validarHeuristico('   ').ok).toBe(false);
  });

  it('sinaliza acusacao sem evidencia', () => {
    const r = validarHeuristico('O operador foi o culpado pela divergencia.');
    expect(r.ok).toBe(false);
    expect(r.problemas.length).toBeGreaterThan(0);
  });
});

describe('deteccao de recusa generica', () => {
  it('detecta frases de incapacidade do modelo', () => {
    expect(ehRespostaDeRecusa('Desculpe, não consegui responder essa pergunta agora.')).toBe(true);
    expect(ehRespostaDeRecusa('Nao tenho como te ajudar com isso.')).toBe(true);
    expect(ehRespostaDeRecusa('Nao foi possivel gerar uma resposta.')).toBe(true);
    expect(ehRespostaDeRecusa('Nao entendi sua pergunta, pode reformular?')).toBe(true);
  });

  it('nao confunde limite legitimo com recusa', () => {
    // Limites honestos sobre acoes do Kora sao respostas validas, nao falhas
    expect(ehRespostaDeRecusa('Eu nao posso cancelar pedidos nem emitir reembolsos diretamente.')).toBe(false);
    expect(ehRespostaDeRecusa('Para confirmar o reembolso preciso de mais evidencias, como foto do item.')).toBe(false);
    expect(ehRespostaDeRecusa('Qual etapa da ocorrencia?')).toBe(false);
  });

  it('respostas longas nao sao classificadas como recusa', () => {
    const longa = 'Desculpe, '.repeat(80) + 'mas aqui esta uma resposta detalhada sobre o pedido.';
    expect(ehRespostaDeRecusa(longa)).toBe(false);
  });
});
