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

// Catalogo dos 4 modelos gratuitos na ordem de prioridade
// Provedor 1 Gemini (principal); 2 Groq, 3 Cerebras e 4 OpenRouter (contingencia)
// Nomes e endpoints podem ser sobrescritos por env sem alterar codigo
export function catalogoModelos(): ModeloConfig[] {
  return [
    {
      id: 1,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL', 'gemini-3.6-flash')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 1,
    },
    {
      id: 2,
      provedor: 'groq',
      nomeModelo: env('GROQ_MODEL', 'llama-3.3-70b-versatile')!,
      apiKey: env('GROQ_API_KEY'),
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      prioridade: 2,
    },
    {
      id: 3,
      provedor: 'cerebras',
      nomeModelo: env('CEREBRAS_MODEL', 'llama-3.3-70b')!,
      apiKey: env('CEREBRAS_API_KEY'),
      endpoint: 'https://api.cerebras.ai/v1/chat/completions',
      prioridade: 3,
    },
    {
      id: 4,
      provedor: 'openrouter',
      nomeModelo: env('OPENROUTER_MODEL', 'meta-llama/llama-3.3-70b-instruct:free')!,
      apiKey: env('OPENROUTER_API_KEY'),
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      prioridade: 4,
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
  return Number(env('MAX_TOKENS_SAIDA', '600'));
}

export function janelaHistorico(): number {
  return Number(env('JANELA_HISTORICO', '6'));
}
