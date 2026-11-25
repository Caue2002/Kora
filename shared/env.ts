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

// Catalogo de modelos gratuitos ordenado do MAIS FORTE ao MAIS FRACO.
// O primeiro da fila que tiver cota assume a request; os demais sao
// failover em cascata. Cada slot tem id de cota PROPRIO: as cotas
// free-tier do Gemini sao por modelo, entao um 429 em um slot
// nao pode bloquear os irmaos — antes os slots compartilhavam ids 1 e 3
// e um unico 429 derrubava varios modelos ao mesmo tempo.
// Nomes e endpoints podem ser sobrescritos por env sem alterar codigo.
// Ordem (verificada com scripts/testar_modelos_gemini.mjs):
// hydrogen/3.8/3.6/3.5/3-preview > groq > 3.5-lite > 3.1-lite(-preview)
// > 3.7-flash/4-argon (candidatos, free tier a confirmar) > pollinations
// O pollinations e o unico slot com id != prioridade (id 10 travado por
// FK no banco; prioridade 12 para ficar por ultimo na fila).
export function catalogoModelos(): ModeloConfig[] {
  return [
    {
      id: 1,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL', 'gemini-4-hydrogen')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 1,
    },
    {
      id: 2,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL_2', 'gemini-3.8-flash')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 2,
    },
    {
      id: 3,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL_3', 'gemini-3.6-flash')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 3,
    },
    {
      id: 4,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL_4', 'gemini-3.5-flash')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 4,
    },
    {
      id: 5,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL_5', 'gemini-3-flash-preview')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 5,
    },
    {
      id: 6,
      provedor: 'groq',
      nomeModelo: env('GROQ_MODEL', 'openai/gpt-oss-120b')!,
      apiKey: env('GROQ_API_KEY'),
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      prioridade: 6,
    },
    {
      id: 7,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL_6', 'gemini-3.5-flash-lite')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 7,
    },
    {
      id: 8,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL_7', 'gemini-3.1-flash-lite')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 8,
    },
    {
      id: 9,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL_8', 'gemini-3.1-flash-lite-preview')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 9,
    },
    {
      id: 11,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL_9', 'gemini-3.7-flash')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 10,
    },
    {
      id: 12,
      provedor: 'gemini',
      nomeModelo: env('GEMINI_MODEL_10', 'gemini-4-argon')!,
      apiKey: env('GEMINI_API_KEY'),
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      prioridade: 11,
    },
    {
      id: 10,
      provedor: 'pollinations',
      nomeModelo: env('POLLINATIONS_MODEL', 'openai')!,
      apiKey: env('POLLINATIONS_KEY', 'pollinations'),
      endpoint: 'https://text.pollinations.ai/openai',
      prioridade: 12,
    },
  ];
}

// Chave de acesso ao servidor MCP (/api/mcp): sem ela o endpoint fica
// desabilitado; com ela, o cliente precisa envia-la em Authorization/x-api-key
export function mcpApiKey(): string | undefined {
  return env('MCP_API_KEY');
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
  // 15s por tentativa: modelos saudaveis respondem em <10s; um pendurado
  // nao pode segurar a fila de failover por 25s em cada modelo
  return Number(env('LLM_TIMEOUT_MS', '15000'));
}
