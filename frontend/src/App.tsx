// Tela exclusiva de chat com o agente Nori
// Mobile-first: area de mensagens + campo de envio fixo; sem menus ou widgets paralelos

import { useEffect, useRef, useState } from 'react';
import {
  carregarSessao,
  enviarFeedback,
  enviarMensagem,
  limparSessao,
  salvarSessao,
  type Fonte,
  type Mensagem,
} from './api';
import { renderMarkdown } from './markdown';

const AVISOS = ['util', 'confuso', 'incompleto', 'prolixo'] as const;

// Sugestoes rapidas de primeiro contato, uma por categoria de divergencia
const SUGESTOES = [
  'Divergência de quantidade entre pedido e recebimento',
  'Item trocado ou substituído indevidamente no pacote',
  'Inconsistência de status ou avaria entre etapas',
  'Exceção de prazo ou roteamento',
];

// Acoes rapidas sobre o caso em andamento
const ACAO_RESUMO = 'Faça um resumo do que já foi confirmado neste caso até agora.';
const ACAO_CHECKLIST = 'Monte um checklist de conferência com os itens pendentes deste caso.';

// Rotulos amigaveis para as categorias de divergencia vindas do RAG
const CATEGORIAS: Record<string, string> = {
  quantidade: 'Quantidade',
  troca_item: 'Troca de item',
  status_avaria: 'Status/Avaria',
  prazo_roteamento: 'Prazo/Rota',
};

function novoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatarHora(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatarTokens(n?: number): string {
  if (!n) return '';
  return n >= 1000 ? `≈${(n / 1000).toFixed(1)}k` : `≈${n}`;
}

// Extrai a categoria mais frequente entre as fontes recuperadas pelo RAG
function categoriaPredominante(fontes?: Fonte[]): string | null {
  if (!fontes?.length) return null;
  const contagem = new Map<string, number>();
  for (const f of fontes) {
    if (f.categoria) contagem.set(f.categoria, (contagem.get(f.categoria) ?? 0) + 1);
  }
  let melhor: string | null = null;
  let max = 0;
  for (const [cat, qtd] of contagem) {
    if (qtd > max) {
      max = qtd;
      melhor = cat;
    }
  }
  return melhor;
}

export default function App() {
  const [mensagens, setMensagens] = useState<Mensagem[]>(() => carregarSessao());
  const [entrada, setEntrada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalTokens = mensagens.reduce((acc, m) => acc + (m.tokens ?? 0), 0);

  // Persiste a conversa na aba e rola para a mensagem mais recente
  useEffect(() => {
    salvarSessao(mensagens);
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensagens]);

  // Mantem o foco no campo apos cada resposta
  useEffect(() => {
    if (!enviando) inputRef.current?.focus();
  }, [enviando]);

  // Fluxo unico de envio: usado pelo campo, pelas sugestoes e pelas acoes rapidas
  async function processarEnvio(texto: string) {
    if (!texto || enviando) return;
    setErro(null);
    setEntrada('');

    const doUsuario: Mensagem = { id: novoId(), role: 'user', content: texto, ts: Date.now() };
    setMensagens((atual) => [...atual, doUsuario]);
    setEnviando(true);

    try {
      const r = await enviarMensagem(texto, mensagens);
      if (r.erro) {
        setErro(r.erro);
      } else {
        setMensagens((atual) => [
          ...atual,
          {
            id: novoId(),
            role: 'assistant',
            content: r.resposta,
            ts: Date.now(),
            modelo: r.modelo,
            categoria: categoriaPredominante(r.fontes),
            fontes: r.fontes,
            tokens: r.tokens,
          },
        ]);
      }
    } catch {
      setErro('Falha de conexao com o servidor. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  function enviar() {
    processarEnvio(entrada.trim());
  }

  function novoCaso() {
    limparSessao();
    setMensagens([]);
    setErro(null);
  }

  function exportarParecer() {
    const texto = mensagens
      .map((m) => `${m.role === 'user' ? 'USUARIO' : 'NORI'}:\n${m.content}`)
      .join('\n\n---\n\n');
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parecer-conciliacao.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  const ultimaResposta = [...mensagens].reverse().find((m) => m.role === 'assistant');
  const conversaVazia = mensagens.length === 0 && !enviando;

  return (
    <div className="chat">
      <header className="chat-topo">
        <div className="chat-titulo-bloco">
          <span className="chat-avatar-topo">N</span>
          <span className="chat-titulo">Nori</span>
          {totalTokens > 0 && <span className="chat-tokens">{formatarTokens(totalTokens)} tokens</span>}
        </div>
        <div className="chat-acoes">
          {mensagens.length > 0 && (
            <button className="btn-link" onClick={exportarParecer}>
              Exportar
            </button>
          )}
          <button className="btn-link" onClick={novoCaso}>
            Novo caso
          </button>
        </div>
      </header>

      <main className="chat-mensagens">
        {conversaVazia && (
          <div className="chat-vazio">
            <div className="chat-vazio-avatar">N</div>
            <p>Descreva a divergência operacional encontrada.</p>
            <p className="chat-vazio-dica">
              Ou comece por uma das situações abaixo:
            </p>
            <div className="chat-sugestoes">
              {SUGESTOES.map((s) => (
                <button key={s} className="chip-sugestao" onClick={() => processarEnvio(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="msg msg-user">
              <div className="msg-balao">{m.content}</div>
              <span className="msg-hora">{formatarHora(m.ts)}</span>
            </div>
          ) : (
            <div key={m.id} className="msg msg-assistant">
              <div className="msg-avatar">N</div>
              <div className="msg-assistant-corpo">
                <div className="msg-balao">{renderMarkdown(m.content)}</div>
                {m.categoria && (
                  <span className={`msg-badge badge-${m.categoria}`}>
                    {CATEGORIAS[m.categoria] ?? m.categoria}
                  </span>
                )}
                {m.fontes && m.fontes.length > 0 && (
                  <details className="msg-fontes">
                    <summary>Fontes consultadas ({m.fontes.length})</summary>
                    <ul>
                      {m.fontes.map((f, i) => (
                        <li key={i}>{f.titulo}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="msg-meta">
                  {m.modelo}
                  {m.tokens ? ` · ${formatarTokens(m.tokens)} tokens` : ''}
                  {' · '}
                  {formatarHora(m.ts)}
                </div>
                {m === ultimaResposta && (
                  <div className="msg-acoes">
                    <button
                      className="btn-mini"
                      onClick={() => navigator.clipboard?.writeText(m.content)}
                    >
                      Copiar
                    </button>
                    {AVISOS.map((a) => (
                      <button key={a} className="btn-mini" onClick={() => enviarFeedback(a)}>
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {enviando && (
          <div className="msg msg-assistant">
            <div className="msg-avatar">N</div>
            <div className="msg-balao msg-digitando">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}

        {erro && <div className="chat-erro">{erro}</div>}
        <div ref={fimRef} />
      </main>

      {mensagens.length > 0 && (
        <div className="chat-quick">
          <button className="btn-quick" onClick={() => processarEnvio(ACAO_RESUMO)} disabled={enviando}>
            Resumir caso
          </button>
          <button className="btn-quick" onClick={() => processarEnvio(ACAO_CHECKLIST)} disabled={enviando}>
            Checklist
          </button>
        </div>
      )}

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <input
          ref={inputRef}
          className="chat-input"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Descreva a ocorrência..."
          maxLength={4000}
          enterKeyHint="send"
        />
        <button className="chat-enviar" type="submit" disabled={enviando || entrada.trim().length === 0}>
          Enviar
        </button>
      </form>
    </div>
  );
}
