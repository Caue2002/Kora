// Endpoint /api/caso
// GET  /api/caso?conversaId=...  -> retorna o estado estruturado do caso
// POST /api/caso { conversaId, mensagens } -> extrai o estado da conversa via LLM
//      e persiste na tabela casos (upsert por conversa_id)
// POST /api/caso { conversaId, encerrar: true } -> marca o caso como encerrado
//      sem chamada ao modelo (usado pelo botao "Encerrar atendimento")

import { catalogoModelos } from '../shared/env.js';
import { chamarLLM, ErroLimiteModelo, type MensagemChat } from '../shared/llm.js';
import { verificarLimite } from '../shared/ratelimit.js';
import { consultar, upsert } from '../shared/supabase.js';

interface CorpoRequisicao {
  conversaId?: unknown;
  mensagens?: unknown;
  encerrar?: unknown;
}

interface EstadoCaso {
  conversa_id: string;
  etapa: string;
  categoria: string | null;
  status: string;
  fatos: string[];
  evidencias: string[];
  pendencias: string[];
  resumo: string | null;
  atualizado_em: string;
}

const ETAPAS = ['triagem', 'coleta_evidencias', 'analise', 'parecer', 'encerrado'] as const;
const CATEGORIAS = ['quantidade', 'troca_item', 'qualidade', 'prazo_roteamento', 'outro'] as const;
const STATUS = ['em_andamento', 'resolvido', 'encerrado'] as const;

const MAX_MENSAGENS = 16;
const MAX_CHARS_MENSAGEM = 1500;
// Ids de conversa sao gerados no frontend como `${timestamp}-${aleatorio}`
const CONVERSA_ID_VALIDO = /^[A-Za-z0-9_-]{10,80}$/;

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizarMensagens(mensagens: unknown): MensagemChat[] {
  if (!Array.isArray(mensagens)) return [];
  return mensagens
    .filter(
      (m): m is { role: string; content: string } =>
        typeof m === 'object' &&
        m !== null &&
        typeof (m as { role?: unknown }).role === 'string' &&
        typeof (m as { content?: unknown }).content === 'string',
    )
    .map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as MensagemChat['role'],
      content: m.content.slice(0, MAX_CHARS_MENSAGEM),
    }))
    .slice(-MAX_MENSAGENS);
}

const PROMPT_EXTRACAO = `Voce analisa conversas de atendimento de disputas de delivery do Kora.
Extraia o estado atual do caso a partir da conversa entre USUARIO e NORI.

Responda APENAS com JSON valido, sem markdown e sem comentarios, no formato:
{"etapa":"...","categoria":"...|null","status":"...","resumo":"...","fatos":["..."],"evidencias":["..."],"pendencias":["..."]}

Regras:
- etapa: um de [triagem, coleta_evidencias, analise, parecer, encerrado]
- categoria: um de [quantidade, troca_item, qualidade, prazo_roteamento, outro] ou null
- status: um de [em_andamento, resolvido, encerrado]
- resumo: 1 frase curta descrevendo o estado do caso (string vazia se nao houver caso)
- fatos: SOMENTE informacoes confirmadas pelo usuario (nunca hipoteses ou suposicoes da NORI)
- evidencias: provas relatadas (fotos, prints, protocolo, horarios)
- pendencias: informacoes que ainda faltam para concluir o atendimento
- Se a conversa for apenas saudacao/pergunta casual sem caso de disputa, use etapa "triagem", categoria null, status "em_andamento" e listas vazias`;

// Chama o primeiro modelo disponivel com chave; tenta o proximo em limite de cota
async function extrairEstado(mensagens: MensagemChat[]): Promise<Record<string, unknown> | null> {
  const catalogo = catalogoModelos()
    .filter((m) => m.apiKey)
    .sort((a, b) => a.prioridade - b.prioridade);

  const transcricao = mensagens
    .map((m) => `${m.role === 'assistant' ? 'NORI' : 'USUARIO'}: ${m.content}`)
    .join('\n\n');

  for (const modelo of catalogo) {
    try {
      const r = await chamarLLM(
        modelo,
        [
          { role: 'system', content: PROMPT_EXTRACAO },
          { role: 'user', content: transcricao },
        ],
        { temperatura: 0, maxTokens: 900 },
      );
      return parseEstado(r.texto);
    } catch (erro) {
      if (erro instanceof ErroLimiteModelo) continue;
      console.warn(`[caso] extracao falhou no modelo ${modelo.provedor}:`, erro);
    }
  }
  return null;
}

// Extrai o objeto JSON da resposta do modelo de forma tolerante
function parseEstado(texto: string): Record<string, unknown> | null {
  const inicio = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');
  if (inicio < 0 || fim <= inicio) return null;
  try {
    const bruto = JSON.parse(texto.slice(inicio, fim + 1)) as Record<string, unknown>;
    return sanitizarEstado(bruto);
  } catch {
    return null;
  }
}

function listaStrings(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, 12);
}

// Garante que o estado retornado pelo modelo esteja dentro do dominio esperado
function sanitizarEstado(bruto: Record<string, unknown>): Record<string, unknown> {
  const etapa = typeof bruto.etapa === 'string' && (ETAPAS as readonly string[]).includes(bruto.etapa)
    ? bruto.etapa
    : 'triagem';
  const categoria = typeof bruto.categoria === 'string' && (CATEGORIAS as readonly string[]).includes(bruto.categoria)
    ? bruto.categoria
    : null;
  const status = typeof bruto.status === 'string' && (STATUS as readonly string[]).includes(bruto.status)
    ? bruto.status
    : 'em_andamento';
  return {
    etapa,
    categoria,
    status,
    resumo: typeof bruto.resumo === 'string' ? bruto.resumo.slice(0, 300) : '',
    fatos: listaStrings(bruto.fatos),
    evidencias: listaStrings(bruto.evidencias),
    pendencias: listaStrings(bruto.pendencias),
  };
}

async function buscarCaso(conversaId: string): Promise<EstadoCaso | null> {
  const linhas = await consultar<EstadoCaso>(
    'casos',
    `conversa_id=eq.${encodeURIComponent(conversaId)}&select=*&limit=1`,
  );
  return linhas[0] ?? null;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // ===== GET: consulta o estado persistido do caso =====
  if (req.method === 'GET') {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    if (!(await verificarLimite(`caso-get:${ip}`, 60, 60_000))) {
      return json(429, { erro: 'Muitas requisicoes. Aguarde um instante.' });
    }
    const conversaId = url.searchParams.get('conversaId') ?? '';
    if (!CONVERSA_ID_VALIDO.test(conversaId)) {
      return json(400, { erro: 'conversaId ausente ou invalido' });
    }
    try {
      return json(200, { caso: await buscarCaso(conversaId) });
    } catch (erro) {
      console.warn('[caso] falha ao consultar:', erro);
      return json(200, { caso: null });
    }
  }

  if (req.method !== 'POST') return json(405, { erro: 'Metodo nao permitido' });

  // Rate limit: a extracao roda apos cada resposta do agente
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await verificarLimite(`caso:${ip}`, 30, 60_000))) {
    return json(429, { erro: 'Muitas requisicoes. Aguarde um instante.' });
  }

  let corpo: CorpoRequisicao;
  try {
    corpo = (await req.json()) as CorpoRequisicao;
  } catch {
    return json(400, { erro: 'JSON invalido' });
  }

  const conversaId = typeof corpo.conversaId === 'string' ? corpo.conversaId.trim() : '';
  if (!CONVERSA_ID_VALIDO.test(conversaId)) {
    return json(400, { erro: 'conversaId ausente ou invalido' });
  }

  // Encerramento direto, sem custo de modelo
  if (corpo.encerrar === true) {
    const existente = await buscarCaso(conversaId).catch(() => null);
    try {
      await upsert(
        'casos',
        {
          conversa_id: conversaId,
          etapa: 'encerrado',
          categoria: existente?.categoria ?? null,
          status: 'encerrado',
          fatos: existente?.fatos ?? [],
          evidencias: existente?.evidencias ?? [],
          pendencias: [],
          resumo: existente?.resumo ?? 'Atendimento encerrado.',
          atualizado_em: new Date().toISOString(),
        },
        'conversa_id',
      );
    } catch (erro) {
      console.warn('[caso] encerramento nao persistido:', erro);
    }
    return json(200, { caso: await buscarCaso(conversaId).catch(() => null) });
  }

  const mensagens = normalizarMensagens(corpo.mensagens);
  if (mensagens.length === 0) {
    return json(400, { erro: 'mensagens ausentes ou invalidas' });
  }

  const estado = await extrairEstado(mensagens);
  if (!estado) {
    return json(502, { erro: 'Nao foi possivel extrair o estado do caso no momento.' });
  }

  try {
    await upsert(
      'casos',
      {
        conversa_id: conversaId,
        etapa: estado.etapa,
        categoria: estado.categoria,
        status: estado.status,
        fatos: estado.fatos,
        evidencias: estado.evidencias,
        pendencias: estado.pendencias,
        resumo: estado.resumo,
        atualizado_em: new Date().toISOString(),
      },
      'conversa_id',
    );
    return json(200, { caso: await buscarCaso(conversaId) });
  } catch (erro) {
    // Se a migration 0007 ainda nao foi aplicada, devolve o estado extraido
    // sem persistir para nao quebrar a interface
    console.warn('[caso] persistencia falhou (migration 0007 pendente?):', erro);
    return json(200, {
      caso: {
        conversa_id: conversaId,
        etapa: estado.etapa,
        categoria: estado.categoria,
        status: estado.status,
        fatos: estado.fatos,
        evidencias: estado.evidencias,
        pendencias: estado.pendencias,
        resumo: estado.resumo,
        atualizado_em: new Date().toISOString(),
      },
    });
  }
}
