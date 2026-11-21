// Tela principal do chat com o agente Nori
// Layout com barra lateral de historico (estilo Gemini) + area de chat mobile-first

import { useEffect, useRef, useState } from 'react';
import {
  enviarFeedback,
  enviarMensagem,
  listarConversas,
  salvarConversas,
  tituloDe,
  type Conversa,
  type Fonte,
  type Mensagem,
} from './api';
import { renderMarkdown } from './markdown';
import Sidebar from './Sidebar';

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
const iconeMenu = (
  <Icone>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
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
  const [conversas, setConversas] = useState<Conversa[]>(() => listarConversas());
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [entrada, setEntrada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [escuro, setEscuro] = useState<boolean>(() => localStorage.getItem(CHAVE_TEMA) === 'escuro');
  const [ouvindo, setOuvindo] = useState(false);
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reconhecimentoRef = useRef<ReconhecimentoVoz | null>(null);
  const conversasRef = useRef(conversas);
  conversasRef.current = conversas;

  // Na primeira carga, abre a conversa mais recente se existir
  useEffect(() => {
    if (conversaId === null && conversas.length > 0) {
      const maisRecente = [...conversas].sort((a, b) => b.atualizadoEm - a.atualizadoEm)[0]!;
      setConversaId(maisRecente.id);
      setMensagens(maisRecente.mensagens);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aplica o tema escuro/claro no elemento raiz e persiste a escolha
  useEffect(() => {
    document.documentElement.dataset.theme = escuro ? 'escuro' : 'claro';
    localStorage.setItem(CHAVE_TEMA, escuro ? 'escuro' : 'claro');
  }, [escuro]);

  // Persiste a conversa atual na lista de conversas a cada mudanca de mensagens
  useEffect(() => {
    if (!conversaId || mensagens.length === 0) return;
    const conversa: Conversa = {
      id: conversaId,
      titulo: tituloDe(mensagens),
      mensagens,
      atualizadoEm: Date.now(),
    };
    setConversas((atual) => {
      const demais = atual.filter((c) => c.id !== conversaId);
      const nova = [conversa, ...demais];
      salvarConversas(nova);
      return nova;
    });
  }, [mensagens, conversaId]);

  // Rola para a mensagem mais recente
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensagens, enviando]);

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
    setSidebarAberta(false);

    // garante um id de conversa antes do primeiro envio
    const cid = conversaId ?? novoId();
    if (!conversaId) setConversaId(cid);

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

  // Abre uma conversa existente do historico
  function selecionarConversa(c: Conversa) {
    setConversaId(c.id);
    setMensagens(c.mensagens);
    setErro(null);
    setSidebarAberta(false);
  }

  // Inicia uma conversa nova (a anterior fica salva no historico)
  function novaConversa() {
    setConversaId(novoId());
    setMensagens([]);
    setErro(null);
    setSidebarAberta(false);
  }

  // Exclui uma conversa do historico
  function excluirConversa(id: string) {
    const restante = conversasRef.current.filter((c) => c.id !== id);
    setConversas(restante);
    salvarConversas(restante);
    if (id === conversaId) novaConversa();
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
    <div className="layout">
      <Sidebar
        conversas={conversas}
        atualId={conversaId}
        aberta={sidebarAberta}
        onSelecionar={selecionarConversa}
        onNova={novaConversa}
        onExcluir={excluirConversa}
        onFechar={() => setSidebarAberta(false)}
      />

      <div className="chat">
        <header className="chat-topo">
          <div className="chat-titulo-bloco">
            <button
              className="btn-icon"
              onClick={() => setSidebarAberta((v) => !v)}
              title="Historico de conversas"
              aria-label="Historico"
            >
              {iconeMenu}
            </button>
            <img src="/logo.svg" alt="Nori" className="chat-logo" />
            <span className="chat-titulo">Nori</span>
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
          </div>
        </header>

        <main className="chat-mensagens">
          {conversaVazia && (
            <div className="chat-vazio">
              <img src="/logo.svg" alt="Nori" className="chat-vazio-logo" />
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
                <img src="/logo.svg" alt="" className="msg-avatar" />
                <div className="msg-assistant-corpo">
                  <div className="msg-balao">{renderMarkdown(m.content)}</div>
                  {m.categoria && (
                    <span className={`msg-badge badge-${m.categoria}`}>
                      {CATEGORIAS[m.categoria] ?? m.categoria}
                    </span>
                  )}
                  <div className="msg-meta">
                    {m.modelo}
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
              <img src="/logo.svg" alt="" className="msg-avatar" />
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
              {iconeResumo}
              <span className="quick-label">Resumir caso</span>
            </button>
            <button className="btn-quick" onClick={() => processarEnvio(ACAO_CHECKLIST)} disabled={enviando}>
              {iconeChecklist}
              <span className="quick-label">Checklist</span>
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
    </div>
  );
}
