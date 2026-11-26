// Schema zod do estado estruturado do caso (spec SPEC-caso-estruturado).
// Contrato unico da extracao via LLM em /api/caso: enums fechados,
// listas limitadas e defaults tolerantes — um campo invalido nao
// derruba o objeto inteiro (.catch absorve com o mesmo default que o
// sanitizador manual aplicava antes).

import { z } from 'zod';

export const ETAPAS_CASO = ['triagem', 'coleta_evidencias', 'analise', 'parecer', 'encerrado'] as const;
export const CATEGORIAS_CASO = ['quantidade', 'troca_item', 'qualidade', 'prazo_roteamento', 'pagamento', 'outro'] as const;
export const STATUS_CASO = ['em_andamento', 'resolvido', 'encerrado'] as const;

// Corta em 12 antes de validar (mesmo comportamento do slice(0,12) do
// sanitizador manual); tipo errado cai no catch -> []
const listaLimitada = z
  .preprocess(
    (v) => (Array.isArray(v) ? v.slice(0, 12) : v),
    z.array(z.string().trim().min(1).max(300)).catch([]),
  );

export const EstadoCasoSchema = z.object({
  etapa: z.enum(ETAPAS_CASO).catch('triagem'),
  categoria: z.enum(CATEGORIAS_CASO).nullable().catch(null),
  status: z.enum(STATUS_CASO).catch('em_andamento'),
  resumo: z.string().max(500).catch('').transform((s) => s.slice(0, 300)),
  fatos: listaLimitada,
  evidencias: listaLimitada,
  pendencias: listaLimitada,
});

export type EstadoExtraido = z.infer<typeof EstadoCasoSchema>;

// Extrai o objeto JSON da resposta do modelo de forma tolerante
// (o modelo pode embrulhar o JSON em texto) e valida pelo schema.
// Devolve null apenas quando nao ha JSON utilizavel — campos invalidos
// caem nos defaults do schema
export function parseEstadoExtraido(texto: string): EstadoExtraido | null {
  const inicio = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');
  if (inicio < 0 || fim <= inicio) return null;
  try {
    const bruto: unknown = JSON.parse(texto.slice(inicio, fim + 1));
    const r = EstadoCasoSchema.safeParse(bruto);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
