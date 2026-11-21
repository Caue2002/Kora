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
}

// Conversa completa persistida para o historico lateral
export interface Conversa {
  id: string;
  titulo: string;
  mensagens: Mensagem[];
  atualizadoEm: number;
}

export interface RespostaChat {
  resposta: string;
  modelo?: string;
  provedor?: string;
  aviso?: string;
  tokens?: number;
  fontes?: Fonte[];
  erro?: string;
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

// Envia a mensagem ao endpoint /api/chat com a janela recente do historico
export async function enviarMensagem(mensagem: string, historico: Mensagem[]): Promise<RespostaChat> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mensagem,
      historico: historico.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  const dados = (await res.json()) as RespostaChat;
  if (!res.ok) {
    return { resposta: '', erro: dados.erro ?? 'Falha ao contatar o agente.' };
  }
  return dados;
}

// Registra a avaliacao do usuario sobre uma resposta do agente
export async function enviarFeedback(
  avaliacao: 'util' | 'confuso' | 'incompleto' | 'prolixo',
  modeloId?: number,
): Promise<void> {
  await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avaliacao, modeloId }),
  }).catch(() => undefined);
}
