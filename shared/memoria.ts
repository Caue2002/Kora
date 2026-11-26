// Memoria persistente do usuario (spec/SPEC-memoria-usuario.md):
// tabela `memorias` guarda resumos curtos de sessoes anteriores por
// dispositivo (UUID anonimo, sem login). A leitura injeta os fatos no
// prompt da primeira mensagem de cada conversa.

import { consultar } from './supabase.js';

export interface Memoria {
  resumo: string;
  criado_em: string;
}

// Busca as memorias mais recentes do dispositivo (max 5). Falha de
// leitura degrada para lista vazia — memoria nunca pode derrubar o chat
export async function buscarMemorias(deviceId: string): Promise<Memoria[]> {
  try {
    const linhas = await consultar<Memoria>(
      'memorias',
      `device_id=eq.${encodeURIComponent(deviceId)}&select=resumo,criado_em&order=criado_em.desc&limit=5`,
    );
    return linhas ?? [];
  } catch (erro) {
    console.warn('[memoria] leitura falhou:', erro);
    return [];
  }
}

// Formata as memorias para injecao no prompt do sistema. Retorna ''
// quando nao ha nada — o chamador simplesmente omite o bloco
export function montarBlocoMemoria(memorias: Memoria[]): string {
  if (memorias.length === 0) return '';
  const itens = memorias
    .map((m) => m.resumo.trim())
    .filter((r) => r.length > 0)
    .slice(0, 5)
    .map((r) => `- ${r}`);
  if (itens.length === 0) return '';
  return [
    'Memorias de sessoes anteriores deste usuario (fatos que ele mesmo contou; use com naturalidade quando relevante — nunca recite como lista nem mencione que voce "lembra de sessoes"):',
    ...itens,
  ].join('\n');
}
