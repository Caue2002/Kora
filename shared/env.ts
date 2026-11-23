// Leitura centralizada de variaveis de ambiente do servidor
// Toda configuracao sensivel vem de env; nada de segredo no codigo

export interface ModeloConfig {
  id: number;
  provedor: string;
  nomeModelo: string;
  apiKey: string | undefined;
  endpoint: string;
  prioridade: number;
}

function env(nome: string, padrao?: string): string | undefined {
  const v = process.env[nome];
  return v && v.trim().length > 0 ? v.trim() : padrao;
}

export function supabaseUrl(): string {
  const url = env('SUPABASE_URL');
  if (!url) throw new Error('SUPABASE_URL nao configurada');
  return url;
}

export function supabaseServiceKey(): string {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY nao configurada');
  return key;
}

// Catalogo de modelos gratuitos em ordem de prioridade
// Gemini primeiro (mesma chave, modelos diferentes como fallback entre si),
// Groq no meio e Pollinations como ultimo recurso gratuito sem chave.
// Os modelos Gemini extras reutilizam o id de cota do respectivo slot
// (1 ou 3), pois compartilham a mesma cota da API key.
// Nomes e endpoints podem ser sobrescritos por env sem alterar codigo
export function catalogoModelos(): ModeloConfig[] {
  return [
    {
      id: 1,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL', 'gemini-3.1-flash-lite')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 1,
    },
    {
      id: 2,
      provedor: 'groq',
      nomeModelo: env('GROQ_MODEL', 'openai/gpt-oss-120b')!,
      apiKey: env('GROQ_API_KEY'),
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      prioridade: 2,
    },
    {
      id: 3,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL_2', 'gemini-3.5-flash')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 3,
    },
    {
      id: 1,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL_3', 'gemini-3.8-flash')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 4,
    },
    {
      id: 3,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL_4', 'gemini-3.5-flash-lite')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 5,
    },
    {
      id: 4,
      provedor: 'pollinations',
      nomeModelo: env('POLLINATIONS_MODEL', 'openai')!,
      apiKey: env('POLLINATIONS_KEY', 'pollinations'),
      endpoint: 'https://text.pollinations.ai/openai',
      prioridade: 6,
    },
  ];
}

export function limitesJanela() {
  return {
    minuto: Number(env('LIMITE_TOKENS_MINUTO', '8000')),
    hora: Number(env('LIMITE_TOKENS_HORA', '50000')),
    dia: Number(env('LIMITE_TOKENS_DIA', '200000')),
  };
}

export function maxTokensSaida(): number {
  return Number(env('MAX_TOKENS_SAIDA', '400'));
}

export function janelaHistorico(): number {
  return Number(env('JANELA_HISTORICO', '6'));
}

// Timeout por tentativa de chamada ao LLM: sem ele um provedor pendurado
// (headers que nunca chegam) segura a requisicao ate o limite da plataforma
export function timeoutLlmMs(): number {
  return Number(env('LLM_TIMEOUT_MS', '25000'));
}
