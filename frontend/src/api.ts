// Cliente da API do chat e persistencia da sessao na aba (sessionStorage)

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

export interface RespostaChat {
  resposta: string;
  modelo?: string;
  provedor?: string;
  aviso?: string;
  tokens?: number;
  fontes?: Fonte[];
  erro?: string;
}

const CHAVE_SESSAO = 'kora-chat-v1';

// Carrega o historico visual da aba; retorna vazio se nao houver ou estiver corrompido
export function carregarSessao(): Mensagem[] {
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO);
    if (!bruto) return [];
    const dados = JSON.parse(bruto) as Mensagem[];
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

export function salvarSessao(mensagens: Mensagem[]): void {
  try {
    sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(mensagens));
  } catch {
    // armazenamento cheio ou indisponivel: segue sem persistir
  }
}

export function limparSessao(): void {
  sessionStorage.removeItem(CHAVE_SESSAO);
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
