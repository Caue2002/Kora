// Cliente da API do chat e persistencia das conversas no navegador (localStorage)
// Permite historico de chats estilo Gemini: varias conversas salvas localmente

export interface Fonte {
  titulo: string;
  categoria?: string | null;
}

export interface Mensagem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts?: number;
  modelo?: string;
  categoria?: string | null;
  fontes?: Fonte[];
  tokens?: number;
  // Miniatura (dataURL) da foto enviada como evidencia, exibida na bolha
  imagem?: string;
}

// Conversa completa persistida para o historico lateral
export interface Conversa {
  id: string;
  titulo: string;
  mensagens: Mensagem[];
  atualizadoEm: number;
}

const CHAVE_CONVERSAS = 'kora-conversas-v1';
const CHAVE_LEGADO = 'kora-chat-v1';

// Le as conversas salvas; na primeira vez migra o chat unico da versao anterior
export function listarConversas(): Conversa[] {
  try {
    const bruto = localStorage.getItem(CHAVE_CONVERSAS);
    if (bruto) {
      const dados = JSON.parse(bruto) as Conversa[];
      return Array.isArray(dados) ? dados : [];
    }
  } catch {
    // segue para a migracao legado
  }

  // Migracao: importa a conversa unica salva em sessionStorage pela versao anterior
  try {
    const antigo = sessionStorage.getItem(CHAVE_LEGADO);
    if (antigo) {
      const msgs = JSON.parse(antigo) as Mensagem[];
      if (Array.isArray(msgs) && msgs.length > 0) {
        const conversa: Conversa = {
          id: `${Date.now()}`,
          titulo: tituloDe(msgs),
          mensagens: msgs,
          atualizadoEm: Date.now(),
        };
        salvarConversas([conversa]);
        sessionStorage.removeItem(CHAVE_LEGADO);
        return [conversa];
      }
    }
  } catch {
    // ignora falha de migracao
  }
  return [];
}

export function salvarConversas(conversas: Conversa[]): void {
  try {
    localStorage.setItem(CHAVE_CONVERSAS, JSON.stringify(conversas));
  } catch {
    // armazenamento cheio ou indisponivel
  }
}

// Deriva o titulo da conversa a partir da primeira mensagem do usuario
export function tituloDe(mensagens: Mensagem[]): string {
  const primeira = mensagens.find((m) => m.role === 'user');
  if (!primeira) return 'Nova conversa';
  const t = primeira.content.replace(/\s+/g, ' ').trim();
  return t.length > 42 ? `${t.slice(0, 42)}...` : t;
}

// Envia a mensagem em modo streaming: chama onDelta a cada trecho recebido
// Retorna os metadados (modelo, fontes) lidos dos headers da resposta
export interface ImagemAnexo {
  base64: string;
  mime: string;
}

export async function enviarMensagemStream(
  mensagem: string,
  historico: Mensagem[],
  onDelta: (texto: string) => void,
  imagem?: ImagemAnexo,
  perfil?: string,
): Promise<{ modelo?: string; fontes?: Fonte[]; erro?: string }> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mensagem,
      historico: historico.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      imagem,
      perfil,
    }),
  });

  if (!res.ok || !res.body) {
    const dados = (await res.json().catch(() => ({}))) as { erro?: string };
    return { erro: dados.erro ?? 'Falha ao contatar o agente.' };
  }

  const modelo = res.headers.get('x-modelo') ?? undefined;
  const fontesBruto = res.headers.get('x-fontes');
  let fontes: Fonte[] | undefined;
  try {
    fontes = fontesBruto ? (JSON.parse(decodeURIComponent(fontesBruto)) as Fonte[]) : undefined;
  } catch {
    fontes = undefined;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onDelta(decoder.decode(value, { stream: true }));
  }
  return { modelo, fontes };
}

// ===== Estado estruturado do caso =====

export interface EstadoCaso {
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

// Extrai e persiste o estado do caso a partir da conversa (chamado apos cada resposta)
export async function atualizarCaso(conversaId: string, mensagens: Mensagem[]): Promise<EstadoCaso | null> {
  try {
    const res = await fetch('/api/caso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversaId,
        mensagens: mensagens.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) return null;
    const dados = (await res.json()) as { caso?: EstadoCaso | null };
    return dados.caso ?? null;
  } catch {
    return null;
  }
}

// Marca o caso como encerrado sem custo de modelo e devolve o estado persistido
export async function encerrarCaso(conversaId: string): Promise<EstadoCaso | null> {
  try {
    const res = await fetch('/api/caso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversaId, encerrar: true }),
    });
    if (!res.ok) return null;
    const dados = (await res.json()) as { caso?: EstadoCaso | null };
    return dados.caso ?? null;
  } catch {
    return null;
  }
}

// Busca o estado persistido do caso ao abrir uma conversa do historico
export async function buscarCaso(conversaId: string): Promise<EstadoCaso | null> {
  try {
    const res = await fetch(`/api/caso?conversaId=${encodeURIComponent(conversaId)}`);
    if (!res.ok) return null;
    const dados = (await res.json()) as { caso?: EstadoCaso | null };
    return dados.caso ?? null;
  } catch {
    return null;
  }
}

// Registra a avaliacao do usuario sobre uma resposta do agente
export async function enviarFeedback(
  avaliacao: 'util' | 'confuso' | 'incompleto' | 'prolixo',
  modeloId?: number,
  comentario?: string,
): Promise<void> {
  await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avaliacao, modeloId, comentario: comentario || undefined }),
  }).catch(() => undefined);
}
