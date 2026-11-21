// Tela principal do chat com o agente Nori
// Layout com barra lateral de historico (estilo Gemini) + area de chat mobile-first
// Respostas em streaming token a token e resumo estruturado do caso

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  atualizarCaso,
  buscarCaso,
  encerrarCaso,
  enviarFeedback,
  enviarMensagemStream,
  listarConversas,
  salvarConversas,
  tituloDe,
  type Conversa,
  type EstadoCaso,
  type Fonte,
  type ImagemAnexo,
  type Mensagem,
} from './api';
import { formatarHoraMensagem } from './utils';
import { Markdown } from './markdown';
import Sidebar from './Sidebar';

const AVISOS = ['util', 'confuso', 'incompleto', 'prolixo'] as const;

// Sugestoes rapidas por perfil: cada papel do marketplace tem situacoes tipicas diferentes
const SUGESTOES_POR_PERFIL: Record<PerfilId, string[]> = {
  cliente: [
    'Chegou faltando item no meu pedido',
    'Veio item errado ou trocado',
    'Comida fria, derramada ou estragada',
    'Pedido atrasado ou não recebido',
  ],
  parceiro: [
    'Um pedido foi cancelado indevidamente',
    'Recebi uma avaliação injusta',
    'O repasse do pedido está divergente',
    'Problema com item do cardápio ou pedido',
  ],
  entregador: [
    'Não recebi o pagamento da corrida',
    'Pedido foi cancelado após a retirada',
    'Cliente não estava no endereço de entrega',
    'Tive problema com o pagamento ou a rota',
  ],
};

// Acoes rapidas sobre o caso em andamento
const ACAO_RESUMO = 'Faça um resumo do que já foi confirmado nesta disputa até agora.';
const ACAO_CHECKLIST = 'Monte um checklist de conferência com as evidências pendentes desta disputa.';

// Rotulos amigaveis para as categorias de disputa vindas do RAG
const CATEGORIAS: Record<string, string> = {
  quantidade: 'Item faltante',
  troca_item: 'Item errado',
  status_avaria: 'Qualidade',
  prazo_roteamento: 'Entrega',
};

// Rotulos do estado estruturado do caso (api/caso)
const ETAPAS_CASO: Record<string, string> = {
  triagem: 'Triagem',
  coleta_evidencias: 'Coleta de evidências',
  analise: 'Análise',
  parecer: 'Parecer',
  encerrado: 'Encerrado',
};

const CATEGORIAS_CASO: Record<string, string> = {
  quantidade: 'Item faltante',
  troca_item: 'Item errado',
  qualidade: 'Qualidade',
  prazo_roteamento: 'Entrega',
  outro: 'Outro',
};

// Ordem das etapas do atendimento para a timeline do card de caso
const ORDEM_ETAPAS = ['triagem', 'coleta_evidencias', 'analise', 'parecer', 'encerrado'];
const ETAPAS_CURTAS = ['Triagem', 'Coleta', 'Análise', 'Parecer', 'Encerrado'];

// Perfis de usuario atendidos pelo Nori, no estilo dos papeis do marketplace
const PERFIS = [
  {
    id: 'cliente',
    label: 'Cliente',
    descricao: 'Recebi um pedido com problema',
    icone: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
      </svg>
    ),
  },
  {
    id: 'parceiro',
    label: 'Vendedor parceiro',
    descricao: 'Tenho um problema com meu estabelecimento',
    icone: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l1.5-5h15L21 9" />
        <path d="M3 9h18v11H3z" />
        <path d="M9 20v-6h6v6" />
      </svg>
    ),
  },
  {
    id: 'entregador',
    label: 'Entregador',
    descricao: 'Tenho um problema com uma entrega',
    icone: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5.5" cy="17.5" r="3.5" />
        <circle cx="18.5" cy="17.5" r="3.5" />
        <path d="M15 6h2l3 6.5" />
        <path d="M5.5 17.5L9 10h5.5L15 6" />
      </svg>
    ),
  },
] as const;

type PerfilId = (typeof PERFIS)[number]['id'];
const CHAVE_PERFIL = 'kora-perfil';

const CHAVE_TEMA = 'kora-tema';

function novoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const formatarHora = formatarHoraMensagem;

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
const iconeBaixo = (
  <Icone size={16}>
    <polyline points="6 9 12 15 18 9" />
  </Icone>
);
const iconeEncerrar = (
  <Icone size={13}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </Icone>
);
const iconeMais = (
  <Icone size={18}>
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </Icone>
);
const iconeVolume = (
  <Icone size={16}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </Icone>
);
const iconeMudo = (
  <Icone size={16}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </Icone>
);
const iconeClipe = (
  <Icone size={16}>
    <path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </Icone>
);
const iconeFechar = (
  <Icone size={11}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
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
  const [erro, setErro] = useState<{ mensagem: string; retryTexto: string } | null>(null);
  const [exportando, setExportando] = useState(false);
  const [escuro, setEscuro] = useState<boolean>(() => localStorage.getItem(CHAVE_TEMA) === 'escuro');
  const [ouvindo, setOuvindo] = useState(false);
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [avaliacaoPendente, setAvaliacaoPendente] = useState<{ msgId: string; avaliacao: string } | null>(null);
  const [comentario, setComentario] = useState('');
  const [etapaStream, setEtapaStream] = useState<'contexto' | 'gerando' | null>(null);
  const [avaliacaoAberta, setAvaliacaoAberta] = useState<string | null>(null);
  const [mostrarScroll, setMostrarScroll] = useState(false);
  const [caso, setCaso] = useState<EstadoCaso | null>(null);
  const [menuAcoes, setMenuAcoes] = useState(false);
  const [somAtivo, setSomAtivo] = useState(() => localStorage.getItem('kora-som') === '1');
  const [anexo, setAnexo] = useState<{ imagem: ImagemAnexo; nome: string; preview: string } | null>(null);
  const [perfil, setPerfil] = useState<PerfilId | null>(() => {
    const salvo = localStorage.getItem(CHAVE_PERFIL);
    return PERFIS.some((p) => p.id === salvo) ? (salvo as PerfilId) : null;
  });
  const fimRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const comentarioRef = useRef<HTMLInputElement>(null);
  const reconhecimentoRef = useRef<ReconhecimentoVoz | null>(null);
  const conversasRef = useRef(conversas);
  conversasRef.current = conversas;
  const audioCtxRef = useRef<AudioContext | null>(null);

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
  // Preserva o titulo existente (permite renomear sem ser sobrescrito)
  useEffect(() => {
    if (!conversaId || mensagens.length === 0) return;
    setConversas((atual) => {
      const existente = atual.find((c) => c.id === conversaId);
      const conversa: Conversa = {
        id: conversaId,
        titulo: existente?.titulo ?? tituloDe(mensagens),
        mensagens,
        atualizadoEm: Date.now(),
      };
      const nova = [conversa, ...atual.filter((c) => c.id !== conversaId)];
      salvarConversas(nova);
      return nova;
    });
  }, [mensagens, conversaId]);

  // Rola para a mensagem mais recente
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensagens, enviando]);

  // Foca o campo de comentario quando uma avaliacao fica pendente
  useEffect(() => {
    if (avaliacaoPendente) comentarioRef.current?.focus();
  }, [avaliacaoPendente]);

  // Mantem o foco no campo apos cada resposta
  useEffect(() => {
    if (!enviando) inputRef.current?.focus();
  }, [enviando]);

  // Define o perfil do usuario (cliente, parceiro ou entregador) e persiste
  function escolherPerfil(p: PerfilId) {
    setPerfil(p);
    localStorage.setItem(CHAVE_PERFIL, p);
    inputRef.current?.focus();
  }

  // Inicia ou para o ditado por voz usando a Web Speech API do navegador
  function alternarDitado() {
    const w = window as unknown as {
      SpeechRecognition?: new () => ReconhecimentoVoz;
      webkitSpeechRecognition?: new () => ReconhecimentoVoz;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setErro({ mensagem: 'Ditado por voz nao suportado neste navegador.', retryTexto: '' });
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

  // Le uma imagem do dispositivo como evidencia do caso (base64 para a API)
  function selecionarAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErro({ mensagem: 'Envie apenas imagens (foto da evidencia).', retryTexto: '' });
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setErro({ mensagem: 'Imagem muito grande (maximo 6MB).', retryTexto: '' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const base64 = dataUrl.split(',')[1] ?? '';
      if (base64) setAnexo({ imagem: { base64, mime: file.type }, nome: file.name, preview: dataUrl });
    };
    reader.readAsDataURL(file);
  }

  // Som de feedback sutil (WebAudio): pop curto ao enviar e ao concluir a resposta
  function tocarSom(subindo: boolean) {
    if (!somAtivo) return;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      audioCtxRef.current ??= new Ctor();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = subindo ? 620 : 440;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {
      // audio indisponivel: segue sem som
    }
  }

  function alternarSom() {
    setSomAtivo((v) => {
      localStorage.setItem('kora-som', v ? '0' : '1');
      return !v;
    });
  }

  // Fluxo unico de envio com streaming: placeholder da resposta e preenchido por deltas
  async function processarEnvio(texto: string) {
    if (!texto || enviando) return;
    setErro(null);
    setEntrada('');
    setSidebarAberta(false);
    setAvaliacaoPendente(null);

    // garante um id de conversa antes do primeiro envio
    const cid = conversaId ?? novoId();
    if (!conversaId) setConversaId(cid);

    const doUsuario: Mensagem = { id: novoId(), role: 'user', content: texto, ts: Date.now() };
    const assistId = novoId();
    setMensagens((atual) => [
      ...atual,
      doUsuario,
      { id: assistId, role: 'assistant', content: '', ts: Date.now() },
    ]);
    setEnviando(true);
    setEtapaStream('contexto');
    tocarSom(true);
    let primeiroDelta = true;
    let textoStream = '';
    const imagemEnvio = anexo?.imagem;

    try {
      const r = await enviarMensagemStream(texto, mensagens, (delta) => {
        textoStream += delta;
        if (primeiroDelta) {
          primeiroDelta = false;
          setEtapaStream('gerando');
        }
        setMensagens((atual) =>
          atual.map((m) => (m.id === assistId ? { ...m, content: m.content + delta } : m)),
        );
      }, imagemEnvio, perfil ?? undefined);
      if (r.erro) {
        setMensagens((atual) => atual.filter((m) => m.id !== assistId && m.id !== doUsuario.id));
        setErro({ mensagem: r.erro, retryTexto: texto });
      } else {
        setMensagens((atual) =>
          atual.map((m) =>
            m.id === assistId
              ? {
                  ...m,
                  modelo: r.modelo,
                  categoria: categoriaPredominante(r.fontes),
                  fontes: r.fontes,
                }
              : m,
          ),
        );
        // Atualiza o estado estruturado do caso em segundo plano (sem bloquear a UI)
        const msgsFinais: Mensagem[] = [
          ...mensagens,
          doUsuario,
          { id: assistId, role: 'assistant', content: textoStream, ts: Date.now() },
        ];
        // A extracao do caso e textual: registra a presenca da foto como marcador
        if (imagemEnvio) {
          msgsFinais[msgsFinais.length - 2] = {
            ...doUsuario,
            content: `${doUsuario.content}\n[O usuario anexou uma foto como evidencia.]`,
          };
        }
        void atualizarCaso(cid, msgsFinais).then((c) => {
          if (c) setCaso(c);
        });
      }
    } catch {
      setMensagens((atual) => atual.filter((m) => m.id !== assistId && m.id !== doUsuario.id));
      setErro({ mensagem: 'Falha de conexao com o servidor. Tente novamente.', retryTexto: texto });
    } finally {
      tocarSom(false);
      setEnviando(false);
      setEtapaStream(null);
      setAnexo(null);
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
    void buscarCaso(c.id).then((c2) => setCaso(c2));
  }

  // Inicia uma conversa nova (a anterior fica salva no historico)
  function novaConversa() {
    setConversaId(novoId());
    setMensagens([]);
    setErro(null);
    setSidebarAberta(false);
    setAvaliacaoPendente(null);
    setCaso(null);
  }

  // Encerra o atendimento: marca o caso como encerrado e volta a tela de escolha de perfil
  function encerrarAtendimento() {
    if (conversaId) void encerrarCaso(conversaId);
    localStorage.removeItem(CHAVE_PERFIL);
    setPerfil(null);
    novaConversa();
  }

  // Exclui uma conversa do historico
  function excluirConversa(id: string) {
    const restante = conversasRef.current.filter((c) => c.id !== id);
    setConversas(restante);
    salvarConversas(restante);
    if (id === conversaId) novaConversa();
  }

  // Renomeia uma conversa do historico
  function renomearConversa(id: string, titulo: string) {
    setConversas((atual) => {
      const nova = atual.map((c) => (c.id === id ? { ...c, titulo } : c));
      salvarConversas(nova);
      return nova;
    });
  }

  // Exporta um resumo do caso em HTML: estado estruturado + transcricao da conversa
  function exportarResumo() {
    if (exportando || mensagens.length === 0) return;
    setExportando(true);
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const secao = (titulo: string, itens?: string[]) =>
      itens && itens.length > 0
        ? `<h2>${titulo}</h2><ul>${itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
        : '';
    const perfilLabel = perfil ? (PERFIS.find((p) => p.id === perfil)?.label ?? perfil) : null;

    const corpo = [
      caso?.resumo ? `<h2>Resumo</h2><p>${esc(caso.resumo)}</p>` : '',
      caso
        ? `<p><strong>Etapa:</strong> ${ETAPAS_CASO[caso.etapa] ?? caso.etapa} · <strong>Status:</strong> ${caso.status}${caso.categoria ? ` · <strong>Categoria:</strong> ${CATEGORIAS_CASO[caso.categoria] ?? caso.categoria}` : ''}</p>`
        : '',
      secao('Fatos confirmados', caso?.fatos),
      secao('Evidências', caso?.evidencias),
      secao('Pendências', caso?.pendencias),
      '<h2>Conversa</h2><pre>' +
        mensagens
          .map((m) => `${m.role === 'user' ? 'USUÁRIO' : 'NORI'}:\n${m.content}`)
          .join('\n\n---\n\n')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;') +
        '</pre>',
    ].join('\n');

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Resumo do Caso - Nori</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#1c1917;line-height:1.5}h1{color:#1c1917}h2{color:#44403c;border-bottom:1px solid #e7e5e4;padding-bottom:4px}pre{white-space:pre-wrap;font-family:inherit}</style></head><body><h1>Resumo do Caso</h1><p><em>Gerado pela agente Nori - Kora Delivery${perfilLabel ? ` · Perfil: ${perfilLabel}` : ''}</em></p>${corpo}</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resumo-caso.html';
    a.click();
    URL.revokeObjectURL(url);
    setExportando(false);
  }

  // Envia a avaliacao escolhida; comentario e opcional
  function confirmarAvaliacao(comComentario: boolean) {
    if (!avaliacaoPendente) return;
    enviarFeedback(
      avaliacaoPendente.avaliacao as 'util' | 'confuso' | 'incompleto' | 'prolixo',
      undefined,
      comComentario ? comentario.trim() || undefined : undefined,
    );
    setAvaliacaoPendente(null);
    setComentario('');
  }

  const ultimaResposta = [...mensagens].reverse().find((m) => m.role === 'assistant');
  const conversaVazia = mensagens.length === 0 && !enviando;

  // Detecta se o usuario subiu no historico para exibir o botao de voltar ao fim
  function aoRolar() {
    const el = scrollRef.current;
    if (!el) return;
    setMostrarScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 240);
  }

  function rolarParaFim() {
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  return (
    <div className="layout">
      <Sidebar
        conversas={conversas}
        atualId={conversaId}
        aberta={sidebarAberta}
        onSelecionar={selecionarConversa}
        onExcluir={excluirConversa}
        onRenomear={renomearConversa}
        onFechar={() => setSidebarAberta(false)}
      />

      <div className="chat">
        <header className="chat-topo">
          <div className="chat-titulo-bloco">
            <img src="/logo.png" alt="Nori" className="chat-logo" />
            <span className="chat-titulo">Nori</span>
            <span className="chat-subtitulo">- Agent AI</span>
          </div>
          <div className="chat-acoes">
            <button
              className={`btn-icon ${somAtivo ? 'som-ligado' : ''}`}
              onClick={alternarSom}
              title={somAtivo ? 'Desativar sons' : 'Ativar sons'}
              aria-label="Alternar sons"
            >
              {somAtivo ? iconeVolume : iconeMudo}
            </button>
            <button
              className="btn-icon"
              onClick={() => setEscuro((v) => !v)}
              title={escuro ? 'Modo claro' : 'Modo escuro'}
              aria-label="Alternar tema"
            >
              {escuro ? iconeSol : iconeLua}
            </button>
            {mensagens.length > 0 && (
              <button className="btn-icon" onClick={exportarResumo} title="Exportar resumo" aria-label="Exportar resumo" disabled={exportando}>
                {iconeDownload}
              </button>
            )}
          </div>
        </header>

        <main className="chat-mensagens" ref={scrollRef} onScroll={aoRolar}>
          {conversaVazia && (
            <div className="chat-vazio">
              <div className="msg msg-assistant msg-entra">
                <img src="/logo.png" alt="" className="msg-avatar" />
                <div className="msg-assistant-corpo">
                  <div className="msg-balao">
                    <Markdown
                      texto={
                        'Oi! Eu sou a **Nori**, agente de IA do **Kora Delivery**. Me conta o que houve com o seu pedido que eu ajudo a resolver.'
                      }
                    />
                  </div>
                </div>
              </div>
              {!perfil ? (
                <div className="perfis-bloco">
                  <p className="chat-vazio-dica">Quem é você?</p>
                  <div className="perfis-grade">
                    {PERFIS.map((p) => (
                      <button key={p.id} className="perfil-card" onClick={() => escolherPerfil(p.id)}>
                        <span className="perfil-icone">{p.icone}</span>
                        <span className="perfil-textos">
                          <span className="perfil-label">{p.label}</span>
                          <span className="perfil-desc">{p.descricao}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <button className="perfil-chip" onClick={() => setPerfil(null)} title="Trocar perfil">
                    {PERFIS.find((p) => p.id === perfil)?.label} · trocar
                  </button>
                  <div className="chat-sugestoes">
                    {SUGESTOES_POR_PERFIL[perfil].map((texto) => (
                      <button key={texto} className="chip-sugestao" onClick={() => processarEnvio(texto)}>
                        {texto}
                      </button>
                    ))}
                  </div>
                </>
              )}
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
                <img src="/logo.png" alt="" className={`msg-avatar${m.content === '' ? ' ativo' : ''}`} />
                <div className="msg-assistant-corpo">
                  <div className="msg-balao">
                    {m.content === '' ? (
                      <span className="msg-status-stream">
                        <span className="msg-digitando-inline">
                          <span className="dot" />
                          <span className="dot" />
                          <span className="dot" />
                        </span>
                        <span className="msg-status-texto">
                          {etapaStream === 'gerando' ? 'Gerando resposta...' : 'Pensando...'}
                        </span>
                      </span>
                    ) : (
                      <>
                        <Markdown texto={m.content} />
                        {!(enviando && m === ultimaResposta) && (
                          <div className="msg-acoes">
                            <button
                              className="btn-mini"
                              onClick={() => navigator.clipboard?.writeText(m.content)}
                              title="Copiar resposta"
                            >
                              {iconeCopiar}
                            </button>
                            <button
                              className="btn-mini"
                              onClick={() => setAvaliacaoAberta((v) => (v === m.id ? null : m.id))}
                              title="Avaliar resposta"
                            >
                              Avaliar
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="msg-meta">
                    {m.modelo}
                    {' · '}
                    {formatarHora(m.ts)}
                  </div>
                  {avaliacaoAberta === m.id && m.content !== '' && (
                    <div className="msg-avaliacoes">
                      {AVISOS.map((a) => (
                        <button
                          key={a}
                          className="btn-mini"
                          onClick={() => {
                            setAvaliacaoPendente({ msgId: m.id, avaliacao: a });
                            setComentario('');
                            setAvaliacaoAberta(null);
                          }}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  )}
                  {avaliacaoPendente?.msgId === m.id && (
                    <div className="msg-comentario">
                      <input
                        ref={comentarioRef}
                        className="comentario-input"
                        placeholder="Comentário opcional sobre esta avaliação..."
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                        maxLength={500}
                      />
                      <button className="btn-mini" onClick={() => confirmarAvaliacao(true)}>
                        Enviar
                      </button>
                      <button className="btn-mini" onClick={() => confirmarAvaliacao(false)}>
                        Pular
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {erro && (
            <div className="chat-erro">
              {erro.mensagem}
              {erro.retryTexto && (
                <button className="btn-retry" onClick={() => processarEnvio(erro.retryTexto)}>
                  Tentar novamente
                </button>
              )}
            </div>
          )}
          <div ref={fimRef} />
          {mostrarScroll && mensagens.length > 0 && (
            <button className="btn-scroll-fim" onClick={rolarParaFim} title="Ir para a mensagem mais recente" aria-label="Ir para o fim">
              {iconeBaixo}
            </button>
          )}
        </main>

        {caso && (caso.resumo || caso.fatos.length > 0 || caso.pendencias.length > 0) && (
          <div className="caso-card">
            <div className="caso-passos">
              {ORDEM_ETAPAS.map((e, i) => {
                const idx = ORDEM_ETAPAS.indexOf(caso.etapa);
                return (
                  <span
                    key={e}
                    className={`caso-passo ${i < idx ? 'feito' : ''} ${i === idx ? 'atual' : ''}`}
                  >
                    {ETAPAS_CURTAS[i]}
                  </span>
                );
              })}
            </div>
            <div className="caso-header">
              <span className="caso-titulo">Caso</span>
              <span className="caso-etapa">{ETAPAS_CASO[caso.etapa] ?? caso.etapa}</span>
              {caso.categoria && (
                <span className="caso-cat">{CATEGORIAS_CASO[caso.categoria] ?? caso.categoria}</span>
              )}
              {caso.status === 'resolvido' && <span className="caso-status resolvido">Resolvido</span>}
            </div>
            {caso.resumo && <p className="caso-resumo">{caso.resumo}</p>}
            {caso.pendencias.length > 0 && (
              <div className="caso-secao">
                <span className="caso-secao-titulo">Pendências ({caso.pendencias.length})</span>
                <ul className="caso-lista">
                  {caso.pendencias.slice(0, 4).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {(caso.fatos.length > 0 || caso.evidencias.length > 0) && (
              <details className="caso-detalhes">
                <summary>Fatos e evidências confirmados</summary>
                {caso.fatos.length > 0 && (
                  <div className="caso-secao">
                    <span className="caso-secao-titulo">Fatos</span>
                    <ul className="caso-lista">
                      {caso.fatos.slice(0, 6).map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {caso.evidencias.length > 0 && (
                  <div className="caso-secao">
                    <span className="caso-secao-titulo">Evidências</span>
                    <ul className="caso-lista">
                      {caso.evidencias.slice(0, 6).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </details>
            )}
          </div>
        )}

        {mensagens.length > 0 && (
          <div className="chat-acoes-barra">
            <button
              className="btn-menu-acoes"
              onClick={() => setMenuAcoes((v) => !v)}
              title="Ações do caso"
              aria-label="Ações do caso"
            >
              {iconeMais}
            </button>
            {menuAcoes && (
              <>
                <div className="menu-acoes-overlay" onClick={() => setMenuAcoes(false)} />
                <div className="menu-acoes">
                  <button
                    className="menu-item"
                    disabled={enviando}
                    onClick={() => {
                      setMenuAcoes(false);
                      processarEnvio(ACAO_RESUMO);
                    }}
                  >
                    {iconeResumo}
                    Resumir caso
                  </button>
                  <button
                    className="menu-item"
                    disabled={enviando}
                    onClick={() => {
                      setMenuAcoes(false);
                      processarEnvio(ACAO_CHECKLIST);
                    }}
                  >
                    {iconeChecklist}
                    Checklist de evidências
                  </button>
                  <button
                    className="menu-item"
                    disabled={exportando}
                    onClick={() => {
                      setMenuAcoes(false);
                      exportarResumo();
                    }}
                  >
                    {iconeDownload}
                    Exportar resumo
                  </button>
                  <button
                    className="menu-item menu-item-perigo"
                    disabled={enviando}
                    onClick={() => {
                      setMenuAcoes(false);
                      encerrarAtendimento();
                    }}
                  >
                    {iconeEncerrar}
                    Encerrar atendimento
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {anexo && (
          <div className="anexo-preview">
            <img src={anexo.preview} alt={anexo.nome} className="anexo-thumb" />
            <span className="anexo-nome">{anexo.nome}</span>
            <button className="anexo-remover" onClick={() => setAnexo(null)} title="Remover anexo" aria-label="Remover anexo">
              {iconeFechar}
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
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="input-arquivo"
            onChange={selecionarAnexo}
          />
          <button
            type="button"
            className="btn-mic"
            onClick={() => fileRef.current?.click()}
            title="Anexar foto como evidencia"
            aria-label="Anexar foto"
          >
            {iconeClipe}
          </button>
          <button
            type="button"
            className={`btn-mic ${ouvindo ? 'ouvindo' : ''}`}
            onClick={alternarDitado}
            title="Ditar mensagem"
            aria-label="Ditar mensagem"
          >
            {iconeMicrofone}
          </button>
          <div className="chat-input-bloco">
            <input
              ref={inputRef}
              className="chat-input"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              placeholder="Relate o problema com o pedido..."
              maxLength={4000}
              enterKeyHint="send"
            />
            {entrada.length > 3200 && (
              <span className="contador-chars">{entrada.length}/4000</span>
            )}
          </div>
          <button className="chat-enviar" type="submit" disabled={enviando || entrada.trim().length === 0}>
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
