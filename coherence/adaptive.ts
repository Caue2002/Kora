// Loop de aprendizado adaptativo controlado por feedback
// Sem treino de pesos: avaliacoes agregadas ajustam diretrizes de estilo injetadas no prompt
// Limiares: minimo de volume para evitar ajuste por ruido

import { consultar } from '../shared/supabase';
import { DIRETRIZES_PADRAO, type DiretrizesEstilo } from './prompt';

const VOLUME_MINIMO = 20;
const LIMIAR_DOMINANTE = 0.3;

interface LinhaFeedback {
  avaliacao: string;
  total: number;
}

// Agrega o feedback dos ultimos 7 dias e deriva diretrizes de estilo
// Retorna diretrizes padrao quando o volume e insuficiente ou o banco falha
export async function carregarDiretrizes(): Promise<DiretrizesEstilo> {
  let linhas: LinhaFeedback[] = [];
  try {
    linhas = await consultar<LinhaFeedback>('v_feedback_resumo', 'select=avaliacao,total');
  } catch {
    return DIRETRIZES_PADRAO;
  }

  const total = linhas.reduce((acc, l) => acc + Number(l.total), 0);
  if (total < VOLUME_MINIMO) return DIRETRIZES_PADRAO;

  const proporcao = (nome: string) =>
    linhas.filter((l) => l.avaliacao === nome).reduce((acc, l) => acc + Number(l.total), 0) / total;

  const diretrizes = { ...DIRETRIZES_PADRAO };

  // Feedback "prolixo" dominante: reduz o nivel de detalhe
  if (proporcao('prolixo') > LIMIAR_DOMINANTE) {
    diretrizes.nivelDetalhe = 'baixo';
    diretrizes.objetivoPorTurno = 'resposta curta: um paragrafo, uma pergunta objetiva';
  }

  // Feedback "confuso" dominante: perguntas mais diretas e uma por vez
  if (proporcao('confuso') > LIMIAR_DOMINANTE) {
    diretrizes.ordemPerguntas = 'uma pergunta objetiva por vez, começando pela etapa da ocorrencia';
    diretrizes.objetivoPorTurno = 'confirmar o entendimento do usuario antes de avancar';
  }

  // Feedback "incompleto" dominante: reforca a coleta de evidencias
  if (proporcao('incompleto') > LIMIAR_DOMINANTE) {
    diretrizes.ordemPerguntas = 'etapa da ocorrencia, quantidade/item afetado, evidencias disponiveis';
    diretrizes.objetivoPorTurno = 'nao concluir sem evidencias; sempre pedir o que falta';
  }

  return diretrizes;
}
