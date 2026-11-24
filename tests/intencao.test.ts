import { describe, expect, it } from 'vitest';
import { ehMensagemCasual, ehSaudacao, ehPerguntaMeta } from '../coherence/intencao';

describe('deteccao de mensagem casual', () => {
  it('reconhece agradecimentos, saudos e reacoes leves', () => {
    expect(ehMensagemCasual('muito obrigado')).toBe(true);
    expect(ehMensagemCasual('obrigada!')).toBe(true);
    expect(ehMensagemCasual('oi, tudo bem?')).toBe(true);
    expect(ehMensagemCasual('bom dia')).toBe(true);
    expect(ehMensagemCasual('valeu, flw')).toBe(true);
    expect(ehMensagemCasual('ok')).toBe(true);
    expect(ehMensagemCasual('perfeito, obrigado')).toBe(true);
  });

  it('nao confunde mensagem com pedido ou duvida', () => {
    expect(ehMensagemCasual('obrigado, e o meu pedido?')).toBe(false);
    expect(ehMensagemCasual('oi, meu pedido nao chegou')).toBe(false);
    expect(ehMensagemCasual('sim, pode seguir com o reembolso')).toBe(false);
    expect(ehMensagemCasual('qual o prazo para reembolso?')).toBe(false);
    expect(ehMensagemCasual('')).toBe(false);
  });

  it('ignora acentos e pontuacao', () => {
    expect(ehMensagemCasual('OBRIGADO, TCHAU!')).toBe(true);
    expect(ehMensagemCasual('valeu demais')).toBe(true);
  });

  it('mensagens longas nao sao casuais', () => {
    const longa = Array(8).fill('obrigado').join(' ');
    expect(ehMensagemCasual(longa)).toBe(false);
  });
});

describe('deteccao de saudacao', () => {
  it('reconhece saudos no inicio da mensagem', () => {
    expect(ehSaudacao('oi')).toBe(true);
    expect(ehSaudacao('Olá! Tudo bem?')).toBe(true);
    expect(ehSaudacao('bom dia, tudo joia?')).toBe(true);
    expect(ehSaudacao('boa tarde')).toBe(true);
    expect(ehSaudacao('boa noite, pode me ajudar?')).toBe(true);
    expect(ehSaudacao('eae, beleza?')).toBe(true);
    expect(ehSaudacao('tudo bem?')).toBe(true);
  });

  it('saudacao no meio ou ausente nao conta', () => {
    expect(ehSaudacao('meu pedido nao chegou, oi')).toBe(false);
    expect(ehSaudacao('qual o prazo para reembolso?')).toBe(false);
    expect(ehSaudacao('')).toBe(false);
  });

  it('mensagem com saudacao e disputa conta como saudada', () => {
    expect(ehSaudacao('oi, meu pedido veio sem um item')).toBe(true);
  });
});

describe('deteccao de pergunta meta', () => {
  it('reconhece perguntas sobre modelos, criador e capacidades', () => {
    expect(ehPerguntaMeta('quais modelos de IA voce usa?')).toBe(true);
    expect(ehPerguntaMeta('qual modelo voce utiliza?')).toBe(true);
    expect(ehPerguntaMeta('quem te criou?')).toBe(true);
    expect(ehPerguntaMeta('quem e o seu criador?')).toBe(true);
    expect(ehPerguntaMeta('o que voce sabe fazer?')).toBe(true);
    expect(ehPerguntaMeta('no que voce pode me ajudar?')).toBe(true);
    expect(ehPerguntaMeta('quem e voce?')).toBe(true);
    expect(ehPerguntaMeta('me fale sobre voce')).toBe(true);
  });

  it('nao confunde pergunta de disputa com meta', () => {
    expect(ehPerguntaMeta('qual o prazo para reembolso?')).toBe(false);
    expect(ehPerguntaMeta('meu pedido nao chegou, o que faco?')).toBe(false);
    expect(ehPerguntaMeta('quem foi o entregador do meu pedido?')).toBe(false);
    expect(ehPerguntaMeta('')).toBe(false);
  });
});
