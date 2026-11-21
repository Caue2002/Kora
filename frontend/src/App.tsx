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

const CHAVE_TEMA = 'kora-tema';

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

// Icones SVG inline para as acoes, sem dependencia externa
function Icone({ children, size = 14 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const iconeCopiar = (
  <Icone>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Icone>
);
const iconeDownload = (
  <Icone>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </Icone>
);
const iconeMicrofone = (
  <Icone>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
  </Icone>
);
const iconeSol = (
  <Icone size={16}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </Icone>
);
const iconeLua = (
  <Icone size={16}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Icone>
);
const iconeResumo = (
  <Icone size={13}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </Icone>
);
const iconeChecklist = (
  <Icone size={13}>
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </Icone>
);

// Tipo minimo da Web Speech API para o ditado por voz
interface ReconhecimentoVoz {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function App() {
  const [mensagens, setMensagens] = useState<Mensagem[]>(() => carregarSessao());
  const [entrada, setEntrada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [escuro, setEscuro] = useState<boolean>(() => localStorage.getItem(CHAVE_TEMA) === 'escuro');
  const [ouvindo, setOuvindo] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reconhecimentoRef = useRef<ReconhecimentoVoz | null>(null);

  const totalTokens = mensagens.reduce((acc, m) => acc + (m.tokens ?? 0), 0);
  // conta ocorrencias relatadas (exclui as acoes rapidas de resumo/checklist)
  const totalOcorrencias = mensagens.filter(
    (m) => m.role === 'user' && m.content !== ACAO_RESUMO && m.content !== ACAO_CHECKLIST,
  ).length;

  // Aplica o tema escuro/claro no elemento raiz e persiste a escolha
  useEffect(() => {
    document.documentElement.dataset.theme = escuro ? 'escuro' : 'claro';
    localStorage.setItem(CHAVE_TEMA, escuro ? 'escuro' : 'claro');
  }, [escuro]);

  // Persiste a conversa na aba e rola para a mensagem mais recente
  useEffect(() => {
    salvarSessao(mensagens);
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensagens]);

  // Mantem o foco no campo apos cada resposta
  useEffect(() => {
    if (!enviando) inputRef.current?.focus();
  }, [enviando]);

  // Inicia ou para o ditado por voz usando a Web Speech API do navegador
  function alternarDitado() {
    const w = window as unknown as {
      SpeechRecognition?: new () => ReconhecimentoVoz;
      webkitSpeechRecognition?: new () => ReconhecimentoVoz;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setErro('Ditado por voz nao suportado neste navegador.');
      return;
    }
    if (ouvindo) {
      reconhecimentoRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.onresult = (e) => {
      const texto = e.results[0]?.[0]?.transcript;
      if (texto) setEntrada((atual) => (atual ? `${atual} ${texto}` : texto));
    };
    rec.onend = () => setOuvindo(false);
    rec.onerror = () => setOuvindo(false);
    reconhecimentoRef.current = rec;
    setOuvindo(true);
    rec.start();
  }

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
          {totalOcorrencias > 0 && <span className="chat-tokens">{totalOcorrencias} ocorrências</span>}
          {totalTokens > 0 && <span className="chat-tokens">{formatarTokens(totalTokens)} tokens</span>}
        </div>
        <div className="chat-acoes">
          <button
            className="btn-icon"
            onClick={() => setEscuro((v) => !v)}
            title={escuro ? 'Modo claro' : 'Modo escuro'}
            aria-label="Alternar tema"
          >
            {escuro ? iconeSol : iconeLua}
          </button>
          {mensagens.length > 0 && (
            <button className="btn-icon" onClick={exportarParecer} title="Exportar parecer" aria-label="Exportar">
              {iconeDownload}
            </button>
          )}
          <button className="btn-icon" onClick={novoCaso} title="Novo caso" aria-label="Novo caso">
            <Icone>
              <path d="M12 5v14M5 12h14" />
            </Icone>
          </button>
        </div>
      </header>

      <main className="chat-mensagens">
        {conversaVazia && (
          <div className="chat-vazio">
            <div className="chat-vazio-avatar">N</div>
            <p>Descreva a divergência operacional encontrada.</p>
            <p className="chat-vazio-dica">Ou comece por uma das situações abaixo:</p>
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
            <div key={m.id} className="msg msg-user msg-entra">
              <div className="msg-balao">{m.content}</div>
              <span className="msg-hora">{formatarHora(m.ts)}</span>
            </div>
          ) : (
            <div key={m.id} className="msg msg-assistant msg-entra">
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
                    <ol>
                      {m.fontes.map((f, i) => (
                        <li key={i}>
                          {f.titulo}
                          {f.categoria ? ` · ${CATEGORIAS[f.categoria] ?? f.categoria}` : ''}
                        </li>
                      ))}
                    </ol>
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
                      title="Copiar resposta"
                    >
                      {iconeCopiar}
                    </button>
                    {AVISOS.map((a) => (
                      <button key={a} className="btn-mini" onClick={() => enviarFeedback(a)} title={`Avaliar: ${a}`}>
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
            {iconeResumo} Resumir caso
          </button>
          <button className="btn-quick" onClick={() => processarEnvio(ACAO_CHECKLIST)} disabled={enviando}>
            {iconeChecklist} Checklist
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
        <button
          type="button"
          className={`btn-mic ${ouvindo ? 'ouvindo' : ''}`}
          onClick={alternarDitado}
          title="Ditar mensagem"
          aria-label="Ditar mensagem"
        >
          {iconeMicrofone}
        </button>
        <button className="chat-enviar" type="submit" disabled={enviando || entrada.trim().length === 0}>
          Enviar
        </button>
      </form>
    </div>
  );
}
