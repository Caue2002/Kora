// Tela exclusiva de chat com o agente Nori
// Mobile-first: area de mensagens + campo de envio fixo; sem menus ou widgets paralelos

import { useEffect, useRef, useState } from 'react';
import {
  carregarSessao,
  enviarFeedback,
  enviarMensagem,
  limparSessao,
  salvarSessao,
  type Mensagem,
} from './api';

const AVISOS = ['util', 'confuso', 'incompleto', 'prolixo'] as const;

function novoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [mensagens, setMensagens] = useState<Mensagem[]>(() => carregarSessao());
  const [entrada, setEntrada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persiste a conversa na aba e rola para a mensagem mais recente
  useEffect(() => {
    salvarSessao(mensagens);
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensagens]);

  // Mantem o foco no campo apos cada resposta
  useEffect(() => {
    if (!enviando) inputRef.current?.focus();
  }, [enviando]);

  async function enviar() {
    const texto = entrada.trim();
    if (!texto || enviando) return;
    setErro(null);
    setEntrada('');

    const doUsuario: Mensagem = { id: novoId(), role: 'user', content: texto };
    const historicoAtual = [...mensagens, doUsuario];
    setMensagens(historicoAtual);
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
            modelo: r.modelo,
          },
        ]);
      }
    } catch {
      setErro('Falha de conexao com o servidor. Tente novamente.');
    } finally {
      setEnviando(false);
    }
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

  return (
    <div className="chat">
      <header className="chat-topo">
        <span className="chat-titulo">Nori - Kora</span>
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
        {mensagens.length === 0 && !enviando && (
          <div className="chat-vazio">
            <p>Descreva a divergencia operacional encontrada.</p>
            <p className="chat-vazio-dica">
              Ex.: quantidade divergente na separacao, item trocado no pacote ou status
              inconsistente entre etapas.
            </p>
          </div>
        )}

        {mensagens.map((m) => (
          <div key={m.id} className={`msg msg-${m.role}`}>
            <div className="msg-balao">{m.content}</div>
            {m.role === 'assistant' && m === ultimaResposta && (
              <div className="msg-acoes">
                <button
                  className="btn-mini"
                  onClick={() => navigator.clipboard?.writeText(m.content)}
                >
                  Copiar
                </button>
                {AVISOS.map((a) => (
                  <button
                    key={a}
                    className="btn-mini"
                    onClick={() => enviarFeedback(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {enviando && (
          <div className="msg msg-assistant">
            <div className="msg-balao msg-digitando">Nori esta analisando...</div>
          </div>
        )}

        {erro && <div className="chat-erro">{erro}</div>}
        <div ref={fimRef} />
      </main>

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
          placeholder="Descreva a ocorrencia..."
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
