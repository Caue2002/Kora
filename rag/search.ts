// Busca hibrida de baixa latencia: lexical (termos/codigos) + vetorial (pgvector)
// Executada via funcao SQL buscar_conhecimento_hibrido no Supabase
// Sem embedding disponivel, degrada para busca puramente textual

import { rpc } from '../shared/supabase.js';
import { embedTexts } from './embeddings.js';

export interface TrechoConhecimento {
  id: string;
  origem: string;
  titulo: string;
  conteudo: string;
  categoria: string | null;
  score: number;
}

export interface ResultadoBusca {
  trechos: TrechoConhecimento[];
  modo: 'hibrido' | 'lexical';
}

const LIMITE_TRECHOS = 4;

// Converte vetor para o formato literal aceito pelo pgvector ('[1,2,3]')
function vetorParaTexto(v: number[]): string {
  return `[${v.join(',')}]`;
}

// Busca os trechos mais relevantes para a consulta do usuario
// embeddingOpcional: vetor ja calculado pelo chamador (evita embed duplicado)
export async function buscaHibrida(
  consulta: string,
  limite = LIMITE_TRECHOS,
  embeddingOpcional?: number[],
): Promise<ResultadoBusca> {
  const consultaLimpa = consulta.trim();
  if (consultaLimpa.length === 0) return { trechos: [], modo: 'lexical' };

  const vetores = embeddingOpcional ? null : await embedTexts([consultaLimpa]);
  const embedding = embeddingOpcional ?? vetores?.[0];

  try {
    const linhas = await rpc<TrechoConhecimento[]>('buscar_conhecimento_hibrido', {
      p_texto: consultaLimpa,
      p_embedding: embedding ? vetorParaTexto(embedding) : null,
      p_limite: limite,
    });
    // RPC respondeu vazio (ex.: embedding indisponivel e ranking lexical
    // sem match exato): tenta o fallback ILIKE antes de desistir
    if ((!linhas || linhas.length === 0) && !embedding) {
      return { trechos: await buscaLexical(consultaLimpa, limite), modo: 'lexical' };
    }
    return { trechos: linhas ?? [], modo: embedding ? 'hibrido' : 'lexical' };
  } catch {
    // Fallback: busca lexical simples via ILIKE nos termos da consulta
    return { trechos: await buscaLexical(consultaLimpa, limite), modo: 'lexical' };
  }
}

// Fallback textual quando a funcao hibrida ou embeddings estao indisponiveis
async function buscaLexical(consulta: string, limite: number): Promise<TrechoConhecimento[]> {
  const termos = consulta
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 5);
  if (termos.length === 0) return [];

  const filtro = termos.map((t) => `conteudo.ilike.*${t}*`).join(',');
  try {
    const { consultar } = await import('../shared/supabase.js');
    return await consultar<TrechoConhecimento>(
      'conhecimento_chunks',
      `ativo=eq.true&or=(${filtro})&select=id,origem,titulo,conteudo,categoria&order=updated_at.desc&limit=${limite}`,
    );
  } catch {
    return [];
  }
}
