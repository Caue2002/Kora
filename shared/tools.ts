// Tools do agente Nori expostas ao LLM via function calling (Gemini).
// As mesmas capacidades aparecem como tools MCP em /api/mcp — uma unica
// definicao de "o que o agente sabe fazer" reutilizada nos dois protocolos.
// V1 somente leitura: consultar pedido e buscar politica. Nada grava dados.

import { detalhesPedido, pedidoFicticio } from './pedidos.js';
import { buscaHibrida } from '../rag/search.js';

// Declaracoes no formato functionDeclarations da API Gemini
export const TOOLS_GEMINI = {
  functionDeclarations: [
    {
      name: 'consultar_pedido',
      description:
        'Consulta um pedido da simulacao Kora pelo codigo e retorna loja, valor e itens de referencia deterministicos. Use quando o usuario informar um codigo de pedido ou pedir dados de um pedido especifico. ATENCAO: os itens retornados sao do catalogo ficticio — os itens reais do pedido sao os que o usuario descreveu na conversa; so use os da tool quando o usuario nao descreveu item nenhum.',
      parameters: {
        type: 'OBJECT',
        properties: {
          codigo: {
 type: 'STRING',
            description: 'Codigo do pedido informado pelo usuario (ex.: 156489, K7X9-AB)',
          },
        },
        required: ['codigo'],
      },
    },
    {
      name: 'buscar_politica',
      description:
        'Busca trechos das politicas de disputa do Kora (prazos, criterios de reembolso, evidencias exigidas) relevantes para uma pergunta. Use quando precisar confirmar uma regra do Kora que nao esteja no contexto atual.',
      parameters: {
        type: 'OBJECT',
        properties: {
          pergunta: {
            type: 'STRING',
            description: 'Pergunta ou descricao do problema de disputa (max 500 caracteres)',
          },
        },
        required: ['pergunta'],
      },
    },
  ],
};

// Limites de seguranca dos argumentos vindos do modelo
const CODIGO_VALIDO = /^[A-Za-z0-9-]{3,20}$/;
const MAX_PERGUNTA = 500;

export interface ChamadaTool {
  name: string;
  args: Record<string, unknown>;
}

// Executa uma tool chamada pelo modelo e devolve o resultado serializavel
// que volta ao LLM como functionResponse. Erros viram resultado textual
// para o modelo se recuperar em vez de derrubar a resposta
export async function executarTool(chamada: ChamadaTool): Promise<unknown> {
  try {
    if (chamada.name === 'consultar_pedido') {
      const codigo = typeof chamada.args.codigo === 'string' ? chamada.args.codigo.trim().toUpperCase() : '';
      if (!CODIGO_VALIDO.test(codigo)) {
        return { erro: 'Codigo de pedido invalido. Peca o codigo ao usuario.' };
      }
      return {
        pedido: pedidoFicticio(codigo),
        detalhes: detalhesPedido(codigo),
        nota: 'Itens retornados sao do catalogo de referencia da simulacao. Os itens reais do pedido sao os que o usuario descreveu na conversa — use os da tool apenas se o usuario nao descreveu nenhum item.',
      };
    }
    if (chamada.name === 'buscar_politica') {
      const pergunta = typeof chamada.args.pergunta === 'string' ? chamada.args.pergunta.trim().slice(0, MAX_PERGUNTA) : '';
      if (pergunta.length < 3) {
        return { erro: 'Pergunta invalida ou vazia.' };
      }
      const busca = await buscaHibrida(pergunta, 3);
      return {
        modo: busca.modo,
        trechos: busca.trechos.map((t) => ({
          titulo: t.titulo,
          categoria: t.categoria,
          conteudo: t.conteudo.slice(0, 800),
        })),
      };
    }
    return { erro: `Tool desconhecida: ${chamada.name}` };
  } catch (erro) {
    return { erro: `Falha ao executar a tool: ${String(erro).slice(0, 200)}` };
  }
}
