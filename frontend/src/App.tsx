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
  gerarAudioFala,
  gerarHandoff,
  listarConversas,
  salvarConversas,
  tituloDe,
  type Conversa,
  type EstadoCaso,
  type Fonte,
  type Mensagem,
} from './api';
import { formatarHoraMensagem } from './utils';
import { ALERTA_SATURACAO, mapearErroApi, type AlertaErro } from './alertas';
import { Markdown } from './markdown';
import Sidebar from './Sidebar';

// Cloudflare Turnstile: widget anti-abuso do /api/chat — so renderiza
// quando VITE_TURNSTILE_SITE_KEY esta definida no build do frontend;
// sem ela nada muda (o backend tambem fica em no-op sem o secret par)
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

// API minima do script da Cloudflare (tipos locais, sem dependencia)
interface TurnstileApi {
  render: (el: HTMLElement, opcoes: Record<string, unknown>) => string;
  reset: (id?: string) => void;
}

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
  pagamento: 'Pagamento',
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
  pagamento: 'Pagamento',
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

// Alvo aleatorio de posicao para uma camada da aurora de inatividade:
// left/top em % do container com faixa ampla o bastante para a luz
// alcancar as QUATRO bordas da tela (cima, baixo, esquerda e direita),
// inclusive ficando parcialmente fora da viewport
function posicaoAleatoriaAurora(): { left: number; top: number } {
  return {
    left: -45 + Math.random() * 95,
    top: -45 + Math.random() * 105,
  };
}

const formatarHora = formatarHoraMensagem;

// Detecta quando a Nori pergunta se pode encerrar a conversa
// (ex.: "Podemos encerrar a conversa?") — usado para o fluxo de encerramento
function ehPerguntaEncerramento(texto: string): boolean {
  // Aceita a pergunta em qualquer ponto da mensagem (a Nori pode encadear frases depois)
  if (!texto.includes('?')) return false;
  return /(podemos|posso|poderia|deseja|gostaria|queria|vamos|bora|encerramos|finalizamos|conclu[ií]mos)[^\n?]{0,120}(encerr|finaliz|conclu|parar)/i.test(
    texto,
  );
}

// Normaliza o texto para comparacao: minusculo, sem acento e sem pontuacao
function palavrasNormalize(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos para comparar sem diacriticos
    .replace(/[^a-z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// Palavras aceitas como confirmacao de encerramento; a mensagem inteira precisa ser afirmativa
const PALAVRAS_CONFIRMACAO = new Set([
  'sim', 's', 'ok', 'okay', 'claro', 'certo', 'exato', 'isso', 'mesmo', 'certeza', 'com',
  'pode', 'quero', 'bora', 'vamos', 'encerrar', 'conversa', 'finalizar',
  'encerra', 'fecha', 'fechar', 'concluir', 'por', 'favor', 'obrigado', 'obrigada',
  'valeu', 'beleza', 'blz', 'show', 'perfeito', 'fechado', 'otimo', 'maravilha', 'joia',
]);

// Retorna true quando o usuario responde apenas uma confirmacao curta ("sim", "pode encerrar" etc.)
function ehRespostaAfirmativa(texto: string): boolean {
  const palavras = palavrasNormalize(texto);
  if (palavras.length === 0 || palavras.length > 8) return false;
  return palavras.every((p) => PALAVRAS_CONFIRMACAO.has(p));
}

// Verbos e conectores aceitos num comando direto de encerramento ("encerre o chat")
const VERBOS_ENCERRAR = new Set([
  'encerrar', 'encerre', 'encerramento', 'finalizar', 'finalize', 'fechar', 'fecha',
  'feche', 'concluir', 'conclua', 'encerra',
]);
const PALAVRAS_COMANDO_ENCERRAR = new Set([
  ...PALAVRAS_CONFIRMACAO,
  'o', 'a', 'os', 'as', 'chat', 'conversa', 'atendimento', 'caso', 'aqui', 'agora',
  'ja', 'entao', 'vou', 'sair', 'tchau', 'adeus', 'um', 'por', 'favor', 'pf', 'pfv',
]);

// Detecta comando explicito do usuario para encerrar ("encerre o chat", "quero encerrar")
// Diferente da confirmacao curta: aqui a intencao e terminar imediatamente
function ehComandoEncerramento(texto: string): boolean {
  if (texto.includes('?')) return false;
  const palavras = palavrasNormalize(texto);
  if (palavras.length === 0 || palavras.length > 8) return false;
  return (
    palavras.some((p) => VERBOS_ENCERRAR.has(p)) &&
    palavras.every((p) => VERBOS_ENCERRAR.has(p) || PALAVRAS_COMANDO_ENCERRAR.has(p))
  );
}

// Foco automatico so faz sentido em dispositivos com ponteiro preciso (desktop);
// no mobile o focus() abre o teclado sem o usuario ter tocado no campo
function podeFocarInput(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
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

// Indicador de carregamento padrao do app: 3 esferas em orbita eliptica
// dentro de uma pilula sutil. Usar SEMPRE que houver espera/processing
// visivel — ver .devin/skills/indicador-carregamento-metaball e
// spec/SPEC-indicador-carregamento.md
function IndicadorCarregando({ grande = false }: { grande?: boolean }) {
  return (
    <span
      className={`msg-orbita${grande ? ' msg-orbita-grande' : ''}`}
      role="status"
      aria-label="Carregando"
    >
      <span className="msg-orbita-palco" aria-hidden="true">
        <span className="msg-orbita-luz" />
        {[0, 1, 2].map((i) => (
          <span className="msg-orbita-ponto" key={i} />
        ))}
        {/* anel tracejado girando devagar + ondas que expandem do centro:
            movimento extra circular em volta da orbita (vem depois dos
            pontos para nao deslocar os nth-child dos delays) */}
        <span className="msg-orbita-anel" />
        <span className="msg-orbita-onda" />
        <span className="msg-orbita-onda msg-orbita-onda-2" />
      </span>
    </span>
  );
}

// Texto de uma resposta da Nori: mensagens longas ficam colapsadas por padrao
// com um "Ver mais", para nao virar um muro de texto na conversa
function TextoAssistente({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false);
  const longo = texto.length > 1100;
  if (!longo) return <Markdown texto={texto} />;
  return (
    <>
      <div className={`msg-texto${aberto ? '' : ' colapsado'}`}>
        <Markdown texto={texto} />
      </div>
      <button type="button" className="btn-mini msg-ver-mais" onClick={() => setAberto((v) => !v)}>
        {aberto ? 'Ver menos' : 'Ver mais'}
      </button>
    </>
  );
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
const iconeAtendente = (
  <Icone size={13}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Icone>
);
const iconeSom = (
  <Icone size={13}>
    <path d="M11 5 6 9H2v6h4l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </Icone>
);
const iconeGrafico = (
  <Icone size={13}>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-4 3 3 5-6" />
  </Icone>
);
const iconeMais = (
  <Icone size={18}>
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </Icone>
);
const iconeClipe = (
  <Icone size={16}>
    <path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </Icone>
);
const iconeCelular = (
  <Icone size={13}>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
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
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e?: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

// Tipo minimo do evento beforeinstallprompt (instalacao do PWA)
interface EventoInstalacaoPwa extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function App() {
  const [conversas, setConversas] = useState<Conversa[]>(() => listarConversas());
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [entrada, setEntrada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; retryTexto: string } | null>(null);
  // Banner amarelo pequeno exibido por 3s quando a API retorna qualquer erro
  const [alertaApi, setAlertaApi] = useState<AlertaErro | null>(null);
  const [exportando, setExportando] = useState(false);
  const [escuro, setEscuro] = useState<boolean>(() => localStorage.getItem(CHAVE_TEMA) === 'escuro');
  const [ouvindo, setOuvindo] = useState(false);
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [avaliacaoPendente, setAvaliacaoPendente] = useState<{ msgId: string; avaliacao: string } | null>(null);
  const [comentario, setComentario] = useState('');
  const [etapaStream, setEtapaStream] = useState<string | null>(null);
  // Id da mensagem da Nori cujo audio esta tocando (botao "ouvir")
  const [tocandoId, setTocandoId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [avaliacaoAberta, setAvaliacaoAberta] = useState<string | null>(null);
  const [mostrarScroll, setMostrarScroll] = useState(false);
  const [caso, setCaso] = useState<EstadoCaso | null>(null);
  const [menuAcoes, setMenuAcoes] = useState(false);
  // Resumo de handoff para atendente humano: null = modal fechado;
  // 'carregando' = gerando; string = markdown pronto para exibir
  const [handoff, setHandoff] = useState<string | 'carregando' | null>(null);
  // Id da mensagem da Nori que perguntou se pode encerrar; enquanto existir, o timer de 3min corre
  const [perguntaEncerramentoId, setPerguntaEncerramentoId] = useState<string | null>(null);
  // Segundos restantes da contagem regressiva de encerramento (null = fora do fluxo)
  const [encerrandoEm, setEncerrandoEm] = useState<number | null>(null);
  // Anexo de evidencia: guardamos so a miniatura (dataURL) para exibir na bolha;
  // a imagem nao e enviada ao modelo — o agente apenas confirma o recebimento
  const [anexo, setAnexo] = useState<{ nome: string; preview: string } | null>(null);
  const [perfil, setPerfil] = useState<PerfilId | null>(() => {
    const salvo = localStorage.getItem(CHAVE_PERFIL);
    return PERFIS.some((p) => p.id === salvo) ? (salvo as PerfilId) : null;
  });
  // Instalacao do PWA: o evento beforeinstallprompt fica guardado para o
  // item "Baixar app" do menu disparar o prompt nativo do navegador
  const installPromptRef = useRef<EventoInstalacaoPwa | null>(null);
  const [mostrarAjudaApp, setMostrarAjudaApp] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const comentarioRef = useRef<HTMLInputElement>(null);
  const reconhecimentoRef = useRef<ReconhecimentoVoz | null>(null);
  const conversasRef = useRef(conversas);
  conversasRef.current = conversas;
  const encerrarRef = useRef<() => void>(() => {});

  // Relogio de inatividade (SPEC-fundo-inatividade + SPEC-inatividade-chat):
  // ultimaAtividadeRef guarda o timestamp do ultimo sinal de vida — clique,
  // toque, tecla, scroll, roda do mouse ou qualquer processo visivel da
  // Nori. Comeca "expirado" (-61s) para a aurora ja nascer acesa na tela
  // inicial; qualquer interacao real e que rearma o timer de 60s.
  // segundosInativo alimenta a aurora e o aviso de encerramento.
  const ultimaAtividadeRef = useRef(Date.now() - 61_000);
  const [segundosInativo, setSegundosInativo] = useState(61);
  // Posicoes das 3 camadas de luz da aurora: mudam para alvos aleatorios
  // a cada ~10s e deslizam ate la via transicao CSS — o fundo nunca fica
  // estatico nem previsivel
  const [alvosAurora, setAlvosAurora] = useState(() => [
    { left: -15, top: -20, size: 75 },
    { left: 55, top: 40, size: 80 },
    { left: 30, top: 35, size: 60 },
  ]);
  // Enquanto ha processamento visivel (stream, handoff, TTS, tela de
  // encerramento) o relogio congela: guarda o inicio para somar a pausa
  // de volta na ultima atividade quando o processo terminar
  const processamentoInicioRef = useRef<number | null>(null);
  // Ref para o tick de inatividade chamar o encerramento sem fechar sobre
  // estado velho (conversaId/mensagens do render em que o efeito rodou)
  const encerrarAtendimentoRef = useRef<() => void>(() => {});
  // Turnstile: container do widget, id do widget renderizado e token
  // atual em ref (o callback do script atualiza sem re-render). O token
  // e de uso unico — cada envio consome e o widget e resetado
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const turnstileTokenRef = useRef<string | undefined>(undefined);
  const turnstileEsperaRef = useRef<((token?: string) => void) | null>(null);

  // Processamento visivel na interface: stream da Nori, geracao de
  // handoff, TTS tocando ou a tela "Encerrando..." — congela a contagem
  const processando =
    enviando || handoff === 'carregando' || encerrandoEm !== null || tocandoId !== null;
  // Timer de encerramento so roda com chat em andamento (ha caso aberto)
  const temChat = mensagens.length > 0 || enviando;
  // Aurora de inatividade: acesa sempre que a tela passa 60s sem nenhum
  // sinal de vida (na abertura ela ja nasce acesa; qualquer clique, toque,
  // tecla ou scroll em qualquer lugar apaga e rearma os 60s). Nao acende
  // durante processamento da Nori.
  const mostrarAurora = !processando && segundosInativo >= 60;
  // Aviso de encerramento por inatividade: aparece no ultimo minuto antes
  // do encerramento automatico (5min sem atividade com chat em andamento)
  const mostrarAvisoInatividade = temChat && !processando && segundosInativo >= 240;
  const segundosParaEncerrar = Math.max(1, 300 - segundosInativo);

  // Na primeira carga, abre a conversa mais recente que NAO foi encerrada:
  // conversa encerrada pelo usuario nunca volta sozinha ao atualizar a pagina
  useEffect(() => {
    if (conversaId === null && conversas.length > 0) {
      const maisRecente = [...conversas]
        .filter((c) => !c.encerrada)
        .sort((a, b) => b.atualizadoEm - a.atualizadoEm)[0];
      if (maisRecente) {
        setConversaId(maisRecente.id);
        setMensagens(maisRecente.mensagens);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aplica o tema escuro/claro no elemento raiz e persiste a escolha
  useEffect(() => {
    document.documentElement.dataset.theme = escuro ? 'escuro' : 'claro';
    localStorage.setItem(CHAVE_TEMA, escuro ? 'escuro' : 'claro');
  }, [escuro]);

  // Captura o evento de instalacao do PWA para o menu "..." oferecer
  // "Baixar app" sob demanda; navegadores sem suporte caem nas instrucoes
  useEffect(() => {
    const aoBeforeInstall = (e: Event) => {
      e.preventDefault();
      installPromptRef.current = e as EventoInstalacaoPwa;
    };
    const aoInstalado = () => {
      installPromptRef.current = null;
      setMostrarAjudaApp(false);
    };
    window.addEventListener('beforeinstallprompt', aoBeforeInstall);
    window.addEventListener('appinstalled', aoInstalado);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoBeforeInstall);
      window.removeEventListener('appinstalled', aoInstalado);
    };
  }, []);

  // O alerta amarelo de erro da API fica 3s na tela e some sozinho
  useEffect(() => {
    if (!alertaApi) return;
    const timer = setTimeout(() => setAlertaApi(null), 3000);
    return () => clearTimeout(timer);
  }, [alertaApi]);

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
        // Preserva a marca de encerrada para nao reabrir no refresh
        encerrada: existente?.encerrada,
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

  // Quando a resposta termina de gerar, alinha o TOPO da ultima mensagem da
  // Nori: sem isso, mensagens longas deixavam a tela parada no final do texto
  // e o usuario precisava subir manualmente para ler o comeco
  const enviandoAnterior = useRef(enviando);
  useEffect(() => {
    const terminou = enviandoAnterior.current && !enviando;
    enviandoAnterior.current = enviando;
    if (!terminou || !scrollRef.current) return;
    const bolhas = scrollRef.current.querySelectorAll('.msg-assistant');
    const ultima = bolhas[bolhas.length - 1] as HTMLElement | undefined;
    ultima?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [enviando]);

  // Para o audio ao desmontar o componente
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    };
  }, []);

  // Foca o campo de comentario quando uma avaliacao fica pendente
  useEffect(() => {
    if (avaliacaoPendente) comentarioRef.current?.focus();
  }, [avaliacaoPendente]);

  // Mantem o foco no campo apos cada resposta — apenas em desktop (pointer fino);
  // no mobile o focus() programatico abre o teclado sem o usuario tocar no campo
  useEffect(() => {
    if (!enviando && podeFocarInput()) inputRef.current?.focus();
  }, [enviando]);

  // Vigia a ultima mensagem: quando a Nori pergunta se pode encerrar, arma o estado
  // de encerramento pendente; qualquer outra resposta dela encerra a espera
  useEffect(() => {
    if (enviando || mensagens.length === 0) return;
    const ultima = mensagens[mensagens.length - 1];
    if (ultima?.role === 'assistant') {
      setPerguntaEncerramentoId(ehPerguntaEncerramento(ultima.content) ? ultima.id : null);
    }
  }, [mensagens, enviando]);

  // Sem resposta do usuario em 3 minutos apos a pergunta de encerramento, encerra sozinho
  useEffect(() => {
    if (!perguntaEncerramentoId) return;
    const timer = setTimeout(() => encerrarRef.current(), 3 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [perguntaEncerramentoId]);

  // Contagem regressiva de 3s exibida na tela ao encerrar: ao zerar, executa
  // o encerramento de fato (marca o caso e volta a tela de escolha de perfil)
  useEffect(() => {
    if (encerrandoEm === null) return;
    if (encerrandoEm <= 0) {
      setEncerrandoEm(null);
      encerrarAtendimento();
      return;
    }
    const t = setTimeout(() => setEncerrandoEm((v) => (v === null ? null : v - 1)), 1000);
    return () => clearTimeout(t);
  }, [encerrandoEm]);

  // Listeners globais de atividade do usuario: clique/toque (pointerdown
  // cobre mouse, touch e caneta), tecla, roda e scroll (capture pega
  // scroll de qualquer container) zeram os timers de inatividade. No
  // mobile todo input e touch — pointerdown cobre tudo. Movimento do
  // mouse NAO conta: so interacao real apaga a aurora.
  useEffect(() => {
    const marcarAtividade = () => {
      ultimaAtividadeRef.current = Date.now();
    };
    const opcoes = { passive: true };
    window.addEventListener('pointerdown', marcarAtividade, opcoes);
    window.addEventListener('keydown', marcarAtividade, opcoes);
    window.addEventListener('wheel', marcarAtividade, opcoes);
    window.addEventListener('touchmove', marcarAtividade, opcoes);
    window.addEventListener('scroll', marcarAtividade, { passive: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', marcarAtividade);
      window.removeEventListener('keydown', marcarAtividade);
      window.removeEventListener('wheel', marcarAtividade);
      window.removeEventListener('touchmove', marcarAtividade);
      window.removeEventListener('scroll', marcarAtividade, true);
    };
  }, []);

  // Atividade da agente tambem conta: stream de tokens, troca de etapa de
  // tool, envio, TTS e handoff atualizam a ultima atividade — o timer so
  // corre quando a tela esta completamente parada. A primeira execucao
  // (montagem) e ignorada: sem isso a aurora nunca nasceria acesa, porque
  // o timestamp "expirado" inicial seria zerado antes do primeiro tick
  const montouRef = useRef(false);
  useEffect(() => {
    if (!montouRef.current) {
      montouRef.current = true;
      return;
    }
    ultimaAtividadeRef.current = Date.now();
  }, [mensagens, etapaStream, enviando, tocandoId, handoff]);

  // As camadas da aurora trocam de lugar aleatoriamente: a cada ~7s cada
  // luz ganha um novo alvo (left/top) e desliza ate ele pela transicao
  // CSS — o fundo nunca fica estatico. Desligado com prefers-reduced-motion
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      setAlvosAurora((atual) => {
        // Cada camada ganha um alvo novo com distancia minima das outras:
        // sem isso as 3 luzes podiam cair todas no mesmo canto da tela.
        // Ate 12 tentativas por camada; se nenhuma passar, fica a ultima
        const alvos: typeof atual = [];
        for (const a of atual) {
          let p = posicaoAleatoriaAurora();
          for (let t = 0; t < 12; t++) {
            const colada = alvos.some((o) => Math.hypot(o.left - p.left, o.top - p.top) < 45);
            if (!colada) break;
            p = posicaoAleatoriaAurora();
          }
          alvos.push({ ...a, ...p });
        }
        return alvos;
      });
    }, 7000);
    return () => clearInterval(id);
  }, []);

  // Carrega o script do Turnstile e renderiza o widget uma unica vez
  // quando ha site key configurada. O callback guarda o token na ref e
  // acorda quem estiver aguardando um token novo (apos cada envio)
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const render = () => {
      const w = (window as { turnstile?: TurnstileApi }).turnstile;
      if (!w || !turnstileRef.current || turnstileWidgetId.current !== null) return;
      turnstileWidgetId.current = w.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => {
          turnstileTokenRef.current = token;
          turnstileEsperaRef.current?.(token);
          turnstileEsperaRef.current = null;
        },
        'expired-callback': () => {
          turnstileTokenRef.current = undefined;
        },
        theme: 'auto',
      });
    };
    const w = (window as { turnstile?: TurnstileApi }).turnstile;
    if (w) {
      render();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = render;
    document.head.appendChild(s);
  }, []);

  // Congela o relogio durante qualquer processamento: o tempo ocioso nao
  // corre nem zera — ao terminar, a contagem retoma de onde parou
  useEffect(() => {
    if (processando) {
      if (processamentoInicioRef.current === null) {
        processamentoInicioRef.current = Date.now();
      }
      return;
    }
    const inicio = processamentoInicioRef.current;
    if (inicio !== null) {
      processamentoInicioRef.current = null;
      // Empurra a ultima atividade pelo tempo processado, sem deixar o
      // relogio ficar "no futuro" quando a atividade da agente ja renovou
      // o timestamp durante o processo (ex.: tokens do stream)
      ultimaAtividadeRef.current = Math.min(
        Date.now(),
        ultimaAtividadeRef.current + (Date.now() - inicio),
      );
    }
  }, [processando]);

  // Relogio de 1s: mede a inatividade efetiva (congelada durante o
  // processamento) e dispara o encerramento automatico aos 5min sem
  // nenhuma atividade com chat em andamento — imediato, sem a contagem
  // de 3s do encerramento manual. O proprio tick nao conta como
  // atividade. O aviso com contagem regressiva aparece a partir de 4min.
  useEffect(() => {
    const tick = () => {
      const agora = processamentoInicioRef.current ?? Date.now();
      const ms = Math.max(0, agora - ultimaAtividadeRef.current);
      setSegundosInativo(Math.floor(ms / 1000));
      if (temChat && !processando && ms >= 5 * 60 * 1000) {
        // Renova o timestamp antes de encerrar: evita disparo duplo
        // enquanto o estado novo ainda nao propagou para o proximo tick
        ultimaAtividadeRef.current = Date.now();
        encerrarAtendimentoRef.current();
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [temChat, processando]);

  // Define o perfil do usuario (cliente, parceiro ou entregador) e persiste
  function escolherPerfil(p: PerfilId) {
    setPerfil(p);
    localStorage.setItem(CHAVE_PERFIL, p);
    if (podeFocarInput()) inputRef.current?.focus();
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
    rec.continuous = true;
    rec.interimResults = true;
    const base = entrada;
    rec.onresult = (e) => {
      // Reconstrui a transcricao completa: results acumula todas as frases ditadas
      let texto = '';
      for (let i = 0; i < e.results.length; i++) {
        texto += e.results[i]?.[0]?.transcript ?? '';
      }
      const combinado = `${base} ${texto}`.trim();
      setEntrada(combinado);
    };
    rec.onend = () => setOuvindo(false);
    rec.onerror = (ev) => {
      setOuvindo(false);
      if (ev?.error === 'not-allowed' || ev?.error === 'service-not-allowed') {
        setErro({ mensagem: 'Microfone bloqueado. Permita o acesso nas configuracoes do navegador e tente de novo.', retryTexto: '' });
      }
    };
    reconhecimentoRef.current = rec;
    setOuvindo(true);
    rec.start();
  }

  // Gera uma miniatura da imagem (max ~520px, JPEG) para exibir na bolha do chat
  // Reduz o dataURL de ~4MB para ~50-150KB, evitando estourar o localStorage
  function miniaturaDe(dataUrl: string, callback: (thumb: string) => void) {
    const img = new Image();
    img.onload = () => {
      const max = 520;
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        callback(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => callback(dataUrl);
    img.src = dataUrl;
  }

  // Le uma imagem do dispositivo como evidencia do caso (vira miniatura na bolha)
  function selecionarAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErro({ mensagem: 'Envie apenas imagens (foto da evidencia).', retryTexto: '' });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setErro({ mensagem: 'Imagem muito grande (maximo 3MB).', retryTexto: '' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      if (!dataUrl) return;
      miniaturaDe(dataUrl, (thumb) => setAnexo({ nome: file.name, preview: thumb }));
    };
    reader.readAsDataURL(file);
  }

  // Fluxo unico de envio com streaming: placeholder da resposta e preenchido por deltas
  // Aceita envio so com foto (sem texto): a mensagem vira "Enviei uma foto como evidencia."
  async function processarEnvio(texto: string) {
    if ((!texto && !anexo) || enviando) return;
    reconhecimentoRef.current?.stop();
    setOuvindo(false);
    setErro(null);
    setEntrada('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setSidebarAberta(false);
    setAvaliacaoPendente(null);

    // Comando explicito do usuario ("encerre o chat", "quero encerrar"): encerra
    // na hora, sem passar pelo modelo — a triagem incompleta fica registrada
    if (mensagens.length > 0 && ehComandoEncerramento(texto)) {
      iniciarEncerramento();
      return;
    }

    // Se a Nori perguntou se pode encerrar e o usuario confirmou, apenas registra
    // a resposta e exibe o botao de encerrar — sem gastar chamada ao modelo
    if (perguntaEncerramentoId && ehRespostaAfirmativa(texto)) {
      const cid = conversaId ?? novoId();
      if (!conversaId) setConversaId(cid);
      setMensagens((atual) => [
        ...atual,
        { id: novoId(), role: 'user', content: texto, ts: Date.now() },
      ]);
      return;
    }

    const textoMsg = texto || 'Enviei uma foto como evidência.';

    // garante um id de conversa antes do primeiro envio
    const cid = conversaId ?? novoId();
    if (!conversaId) setConversaId(cid);

    const doUsuario: Mensagem = {
      id: novoId(),
      role: 'user',
      content: textoMsg,
      ts: Date.now(),
      imagem: anexo?.preview,
    };
    const assistId = novoId();
    setMensagens((atual) => [
      ...atual,
      doUsuario,
      { id: assistId, role: 'assistant', content: '', ts: Date.now() },
    ]);
    setEnviando(true);
    setEtapaStream('contexto');
    let primeiroDelta = true;
    let textoStream = '';
    const enviouFoto = !!anexo;

    // Uma falha transitoria de rede/stream ganha uma segunda tentativa
    // automatica e silenciosa antes de exibir o erro para o usuario.
    // Cada tentativa precisa de token Turnstile NOVO (uso unico): o
    // finally consome o atual e reseta o widget para a proxima chamada
    const chamarApi = async () => {
      const token = await garantirTokenTurnstile();
      try {
        // A foto nao vai para o modelo: o agente so confirma o recebimento dela
        return await enviarMensagemStream(textoMsg, mensagens, (delta) => {
          textoStream += delta;
          if (primeiroDelta) {
            primeiroDelta = false;
            setEtapaStream('gerando');
          }
          setMensagens((atual) =>
            atual.map((m) => (m.id === assistId ? { ...m, content: m.content + delta } : m)),
          );
        }, undefined, perfil ?? undefined, cid, (tool) => setEtapaStream(`tool:${tool}`), token);
      } finally {
        consumirTokenTurnstile();
      }
    };

    try {
      let r;
      try {
        r = await chamarApi();
      } catch {
        // Limpa o stream parcial da tentativa que falhou e tenta de novo
        textoStream = '';
        primeiroDelta = true;
        setEtapaStream('contexto');
        setMensagens((atual) =>
          atual.map((m) => (m.id === assistId ? { ...m, content: '' } : m)),
        );
        await new Promise((res) => setTimeout(res, 1200));
        r = await chamarApi();
      }
      if (r.erro) {
        setMensagens((atual) => atual.filter((m) => m.id !== assistId && m.id !== doUsuario.id));
        setErro({ mensagem: r.erro, retryTexto: textoMsg });
        setAlertaApi(mapearErroApi(r.status ?? 0, r.erro));
      } else {
        // Resposta 200 mas com fallback: todos os modelos falharam (saturacao)
        if (r.fallback) setAlertaApi(ALERTA_SATURACAO);
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
        if (enviouFoto) {
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
      setErro({ mensagem: 'Falha de conexao com o servidor. Tente novamente.', retryTexto: textoMsg });
      // Falha de rede/stream: sem resposta HTTP, codigo 0
      setAlertaApi(mapearErroApi(0));
    } finally {
      setEnviando(false);
      setEtapaStream(null);
      setAnexo(null);
    }
  }

  // Garante um token Turnstile fresco para o proximo envio: reusa o
  // atual se o widget ja emitiu; senao aguarda o callback dele (ate 10s
  // de margem — o modo gerenciado normalmente emite sem interacao).
  // Sem site key configurada devolve undefined e nada muda no fluxo
  function garantirTokenTurnstile(): Promise<string | undefined> {
    if (!TURNSTILE_SITE_KEY) return Promise.resolve(undefined);
    if (turnstileTokenRef.current) return Promise.resolve(turnstileTokenRef.current);
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        turnstileEsperaRef.current = null;
        resolve(turnstileTokenRef.current);
      }, 10_000);
      turnstileEsperaRef.current = (token) => {
        clearTimeout(t);
        resolve(token);
      };
    });
  }

  // O siteverify invalida o token a cada uso: depois de cada chamada a
  // API o widget e resetado para emitir um novo antes da proxima mensagem
  function consumirTokenTurnstile() {
    turnstileTokenRef.current = undefined;
    const w = (window as { turnstile?: TurnstileApi }).turnstile;
    if (w?.reset && turnstileWidgetId.current !== null) {
      try {
        w.reset(turnstileWidgetId.current);
      } catch {
        // Widget ainda nao renderizou (script carregando): o proximo
        // garantirTokenTurnstile aguarda o callback normalmente
      }
    }
  }

  function enviar() {
    processarEnvio(entrada.trim());
  }

  // Abre uma conversa existente do historico
  function selecionarConversa(c: Conversa) {
    setConversaId(c.id);
    setMensagens(c.mensagens);
    // Reabertura manual remove a marca de encerrada: se o usuario atualizar
    // a pagina com ela aberta de proposito, ela pode reabrir normalmente
    if (c.encerrada) {
      setConversas((atual) => {
        const nova = atual.map((x) => (x.id === c.id ? { ...x, encerrada: false } : x));
        salvarConversas(nova);
        return nova;
      });
    }
    setErro(null);
    setSidebarAberta(false);
    setPerguntaEncerramentoId(null);
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
    setPerguntaEncerramentoId(null);
  }

  // Encerra o atendimento: marca o caso como encerrado no servidor e volta a
  // tela inicial (escolha de perfil). O card do caso concluido fica salvo na
  // conversa do historico — ao reabri-la, a bolha de encerrado aparece no fim
  function encerrarAtendimento() {
    setPerguntaEncerramentoId(null);
    setErro(null);
    const cid = conversaId;
    localStorage.removeItem(CHAVE_PERFIL);
    setPerfil(null);
    // Marca a conversa como encerrada ANTES de limpar a tela: o refresh nao
    // pode reabri-la sozinho (ela continua acessivel pelo historico)
    if (cid) {
      setConversas((atual) => {
        const nova = atual.map((c) => (c.id === cid ? { ...c, encerrada: true } : c));
        salvarConversas(nova);
        return nova;
      });
    }
    novaConversa();
    if (cid) void encerrarCaso(cid);
  }

  // Inicio do encerramento: exibe "Encerrando..." com contagem de 3s antes de
  // voltar a tela inicial — feedback visual do pedido de encerrar do usuario
  function iniciarEncerramento() {
    setEncerrandoEm((v) => v ?? 3);
  }
  encerrarRef.current = iniciarEncerramento;
  encerrarAtendimentoRef.current = encerrarAtendimento;

  // "Baixar app": dispara o prompt nativo de instalacao do PWA quando o
  // navegador oferece (Chrome/Edge); sem suporte mostra instrucoes manuais
  async function baixarApp() {
    const evt = installPromptRef.current;
    if (!evt) {
      setMostrarAjudaApp(true);
      return;
    }
    installPromptRef.current = null;
    await evt.prompt().catch(() => undefined);
    await evt.userChoice.catch(() => undefined);
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

  // Gera o resumo de handoff da disputa atual para um atendente humano
  // (POST /api/handoff) e abre o modal com o briefing em markdown
  async function abrirHandoff() {
    if (handoff === 'carregando' || mensagens.length === 0) return;
    setHandoff('carregando');
    const texto = await gerarHandoff(mensagens);
    setHandoff(texto ?? 'Não foi possível gerar o resumo de handoff no momento. Tente novamente.');
  }

  // Rotulo amigavel para as tools que a Nori pode executar (function calling)
function rotuloTool(nome: string): string {
  if (nome === 'consultar_pedido') return 'Consultando pedido...';
  if (nome === 'buscar_politica') return 'Consultando a base de conhecimento...';
  return 'Consultando dados...';
}

// Toca a resposta em audio: primeiro tenta a voz neural do /api/tts
// (Microsoft Edge, gratuita); se falhar, cai na voz do navegador
async function ouvirMensagem(m: Mensagem) {
  if (tocandoId === m.id) {
    pararAudio();
    return;
  }
  pararAudio();
  const url = await gerarAudioFala(m.content);
  if (url) {
    const audio = new Audio(url);
    audioRef.current = audio;
    setTocandoId(m.id);
    const limpar = () => {
      setTocandoId(null);
      URL.revokeObjectURL(url);
      audioRef.current = null;
    };
    audio.onended = limpar;
    audio.onerror = limpar;
    void audio.play().catch(limpar);
    return;
  }
  // Fallback: voz sintetica do proprio navegador (qualidade inferior)
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(m.content);
  u.lang = 'pt-BR';
  u.onend = () => setTocandoId(null);
  u.onerror = () => setTocandoId(null);
  speechSynthesis.speak(u);
  setTocandoId(m.id);
}

function pararAudio() {
  audioRef.current?.pause();
  audioRef.current = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  setTocandoId(null);
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
  const ultimaMsg = mensagens[mensagens.length - 1];
  const conversaVazia = mensagens.length === 0 && !enviando;
  // Botao de encerrar so aparece depois que o usuario confirma a pergunta da Nori
  const mostrarBotaoEncerrar =
    !!perguntaEncerramentoId &&
    ultimaMsg?.role === 'user' &&
    ehRespostaAfirmativa(ultimaMsg.content);

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
      {/* Aurora de inatividade: overlay de luz na tela inteira — acende
          ao abrir o app e volta apos 60s sem nenhuma atividade; qualquer
          clique, toque, tecla ou scroll em qualquer lugar apaga na hora
          e rearma o timer. pointer-events:none — ver styles.css */}
      <div className={`aurora${mostrarAurora ? ' aurora-on' : ''}`} aria-hidden="true">
        {alvosAurora.map((a, i) => (
          <i
            key={i}
            className={`aurora-camada aurora-camada-${i + 1}`}
            style={{
              left: `${a.left}%`,
              top: `${a.top}%`,
              width: `${a.size}%`,
              height: `${a.size}%`,
            }}
          />
        ))}
      </div>
      {/* Banner amarelo de erro da API: pequeno, some sozinho em 3s */}
      {alertaApi && (
        <div className="alerta-api" role="alert">
          Erro {alertaApi.codigo} — {alertaApi.texto}
        </div>
      )}
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
            <span className="chat-subtitulo">- Agente AI</span>
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
            <a
              className="btn-icon"
              href="/metricas.html"
              target="_blank"
              rel="noreferrer"
              title="Painel de métricas"
              aria-label="Painel de métricas"
            >
              {iconeGrafico}
            </a>
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
                        'Eu sou a **Nori**, agente de IA do **Kora Delivery**, especializada em conciliação de disputas de pedidos. Me conta o que houve com o seu pedido que eu ajudo a resolver.'
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
                        <span className="chip-sugestao-label">{texto}</span>
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
                <div className="msg-balao">
                  {m.imagem && <img src={m.imagem} alt="Foto enviada como evidência" className="msg-foto" />}
                  {m.content}
                </div>
                <span className="msg-hora">{formatarHora(m.ts)}</span>
              </div>
            ) : (
              <div key={m.id} className="msg msg-assistant msg-entra">
                <img src="/logo.png" alt="" className={`msg-avatar${m.content === '' ? ' ativo' : ''}`} />
                <div className="msg-assistant-corpo">
                  {m.content === '' ? (
                    <span className="msg-status-stream msg-status-solto">
                      <IndicadorCarregando />
                      {(etapaStream === 'gerando' || etapaStream?.startsWith('tool:')) && (
                        <span className="msg-status-texto">
                          {etapaStream === 'gerando'
                            ? 'Gerando resposta...'
                            : rotuloTool(etapaStream.slice(5))}
                        </span>
                      )}
                    </span>
                  ) : (
                    <div className="msg-balao">
                      <TextoAssistente texto={m.content} />
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
                              onClick={() => void ouvirMensagem(m)}
                              title={tocandoId === m.id ? 'Parar áudio' : 'Ouvir resposta'}
                            >
                              {iconeSom}
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
                    </div>
                  )}
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

        {/* O card do caso (etapas, resumo, pendencias) so aparece no fim da conversa,
            quando o atendimento esta encerrado — durante a conversa ficam so as mensagens */}
        {caso?.etapa === 'encerrado' &&
          (caso.resumo || caso.fatos.length > 0 || caso.pendencias.length > 0) && (
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
              {caso.status === 'incompleto' && (
                <span className="caso-status incompleto">Triagem incompleta</span>
              )}
              {caso.status === 'encerrado' && <span className="caso-status encerrado">Encerrado</span>}
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
                    <span className="menu-item-label">Resumir caso</span>
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
                    <span className="menu-item-label">Checklist de evidências</span>
                  </button>
                  <button
                    className="menu-item"
                    disabled={handoff === 'carregando' || enviando}
                    onClick={() => {
                      setMenuAcoes(false);
                      void abrirHandoff();
                    }}
                  >
                    {iconeAtendente}
                    <span className="menu-item-label">Encaminhar p/ atendente</span>
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setMenuAcoes(false);
                      void baixarApp();
                    }}
                  >
                    {iconeCelular}
                    <span className="menu-item-label">Baixar app</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Barra de encerramento: aparece quando a Nori pergunta se pode encerrar.
            Mostra o botao apos a confirmacao do usuario; senao, avisa do timeout de 3min */}
        {perguntaEncerramentoId && !enviando && (
          <div className="encerrar-barra">
            {mostrarBotaoEncerrar ? (
              <button className="btn-encerrar" onClick={iniciarEncerramento}>
                {iconeEncerrar}
                Encerrar conversa
              </button>
            ) : (
              <span className="encerrar-dica">
                Se você não responder, a conversa encerra automaticamente em 3 minutos.
              </span>
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
            <textarea
              ref={inputRef}
              className="chat-input"
              value={entrada}
              onChange={(e) => {
                setEntrada(e.target.value);
                // Cresce ate o limite visual; depois rola internamente
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
              }}
              placeholder="Fale com a Nori..."
              maxLength={4000}
              rows={1}
              enterKeyHint="enter"
              onKeyDown={(e) => {
                // Enter envia so no desktop (pointer fino); Shift+Enter e
                // sempre quebra de linha. No mobile nao ha teclado fisico
                // confiavel e o botao Enviar segue sendo o unico caminho
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  podeFocarInput()
                ) {
                  e.preventDefault();
                  enviar();
                }
              }}
            />
            {entrada.length > 3200 && (
              <span className="contador-chars">{entrada.length}/4000</span>
            )}
          </div>
          <button
            className="chat-enviar"
            type="submit"
            disabled={enviando || (entrada.trim().length === 0 && !anexo)}
          >
            Enviar
          </button>
        </form>

        {/* Widget Turnstile: so renderiza quando VITE_TURNSTILE_SITE_KEY
            esta definida no build — o backend exige o token enquanto
            TURNSTILE_SECRET_KEY estiver configurada */}
        {TURNSTILE_SITE_KEY && (
          <div className="turnstile-faixa">
            <div ref={turnstileRef} />
          </div>
        )}
      </div>

      {/* Modal de handoff: briefing estruturado da disputa para o atendente humano */}
      {handoff !== null && (
        <div className="handoff-overlay" role="dialog" aria-modal="true" aria-label="Resumo para atendente">
          <div className="handoff-card">
            <div className="handoff-topo">
              <div>
                <h2 className="handoff-titulo">Resumo para atendente</h2>
                <p className="handoff-sub">Briefing da disputa gerado pela Nori — o caso não foi alterado.</p>
              </div>
              <div className="handoff-acoes">
                {handoff !== 'carregando' && (
                  <button
                    className="btn-icon"
                    title="Copiar resumo"
                    aria-label="Copiar resumo"
                    onClick={() => void navigator.clipboard?.writeText(handoff)}
                  >
                    {iconeCopiar}
                  </button>
                )}
                <button className="btn-icon" title="Fechar" aria-label="Fechar" onClick={() => setHandoff(null)}>
                  {iconeFechar}
                </button>
              </div>
            </div>
            <div className="handoff-corpo">
              {handoff === 'carregando' ? (
                <p className="handoff-carregando">
                  <IndicadorCarregando />
                  <span>Gerando resumo do caso...</span>
                </p>
              ) : (
                <Markdown texto={handoff} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de instalacao do app: o Kora e PWA e se instala pelo navegador,
          sem passar por loja de aplicativos */}
      {mostrarAjudaApp && (
        <div className="handoff-overlay" role="dialog" aria-modal="true" aria-label="Baixar o app">
          <div className="handoff-card">
            <div className="handoff-topo">
              <div>
                <h2 className="handoff-titulo">Baixar o app Kora</h2>
                <p className="handoff-sub">
                  O Kora é um app web instalável: não está na Play Store nem na App Store.
                  A instalação é feita pelo próprio navegador.
                </p>
              </div>
              <div className="handoff-acoes">
                <button className="btn-icon" title="Fechar" aria-label="Fechar" onClick={() => setMostrarAjudaApp(false)}>
                  {iconeFechar}
                </button>
              </div>
            </div>
            <div className="handoff-corpo">
              <ul className="app-ajuda-lista">
                <li><strong>Android (Chrome):</strong> menu ⋮ → "Instalar app" ou "Adicionar à tela inicial".</li>
                <li><strong>iPhone (Safari):</strong> botão Compartilhar → "Adicionar à Tela de Início".</li>
                <li><strong>Computador:</strong> ícone de instalação na barra de endereço do navegador.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Aviso de encerramento por inatividade: conta os segundos restantes
          ate o encerramento automatico (5min sem atividade no chat).
          Qualquer interacao zera o timer e some o aviso */}
      {mostrarAvisoInatividade && (
        <div className="inatividade-aviso" role="status" aria-live="polite">
          Sua conversa será encerrada por inatividade em {segundosParaEncerrar}{' '}
          {segundosParaEncerrar === 1 ? 'segundo' : 'segundos'}. Toque ou clique em
          qualquer lugar para continuar.
        </div>
      )}

      {/* Tela de encerramento: cobre o app durante a contagem regressiva de 3s */}
      {encerrandoEm !== null && (
        <div className="encerrando-overlay" role="status" aria-live="polite">
          <div className="encerrando-card">
            <IndicadorCarregando grande />
            <p className="encerrando-titulo">Encerrando...</p>
            <p className="encerrando-contagem">{encerrandoEm}</p>
          </div>
        </div>
      )}
    </div>
  );
}
