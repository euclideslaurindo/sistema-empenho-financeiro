import { z } from "zod";
import { lerValorMonetario } from "@/lib/money";

/**
 * Schema Zod para validação de Notas de Empenho.
 * Centralizado aqui para ser reutilizado tanto no frontend (formulário)
 * quanto no backend (API routes).
 */
export const notaEmpenhoSchema = z.object({
  numeroNE: z.string().min(1, "Número da NE é obrigatório"),
  // lerValorMonetario entende "100,00" (tela) e "100.00" (como o banco devolve):
  // apagar os pontos gravava a NE ×100 ao editar.
  valorNE: z.union([z.string(), z.number()]).transform(val => lerValorMonetario(val))
    .refine(val => val > 0, { message: "O valor da NE deve ser maior que zero." }),
  // T29: a NE não tem mais Data de Pagamento nem Data de Emissão na tela.
  unidadeOrcamentaria: z.string().optional(),
  elemento: z.string().optional(),
  subelemento: z.string().optional(),
  gestao: z.string().optional(),
  historico: z.string().optional(),
  dataProvisaoConcedida: z.string().optional().refine(val => {
    if (!val) return true;
    const y = parseInt(val.split('-')[0], 10);
    return y >= 2000 && y <= 2100;
  }, "Ano inválido"),
  // T30: a NE não tem credor; os credores são escolhidos na Ordem de Pagamento.
});

export type NotaEmpenhoFormValues = z.input<typeof notaEmpenhoSchema>;

/**
 * Schemas Zod para elementos/subelementos de despesa (projeto Retenções v2, T04).
 * CODIGO_ELEMENTO_REGEX valida o campo cru (ex.: "3.3.90.36"), diferente da regex
 * de extração usada em lib/elementos.ts (que lê o código de um texto maior).
 */
const CODIGO_ELEMENTO_REGEX = /^\d(?:\.\d+)+$/;

export const elementoCreateSchema = z.object({
  codigo: z.string().max(20).regex(CODIGO_ELEMENTO_REGEX, 'Código inválido (ex.: 3.3.90.36).'),
  descricao: z.string().min(1, 'Descrição é obrigatória.').max(200),
  ordem: z.number().int().optional().default(0),
  ativo: z.boolean().optional().default(true),
});

export const elementoUpdateSchema = elementoCreateSchema
  .omit({ codigo: true })
  .partial()
  .extend({
    legado: z.boolean().optional(),
  });

export const subelementoCreateSchema = z
  .object({
    codigo: z.string().max(30).regex(CODIGO_ELEMENTO_REGEX, 'Código inválido (ex.: 3.3.90.14.01).'),
    elementoCodigo: z.string().max(20),
    descricao: z.string().min(1, 'Descrição é obrigatória.').max(250),
    ordem: z.number().int().optional().default(0),
    ativo: z.boolean().optional().default(true),
  })
  .refine((d) => d.codigo.startsWith(`${d.elementoCodigo}.`), {
    message: 'O código do subelemento deve começar com o código do elemento pai.',
    path: ['codigo'],
  });

export const subelementoUpdateSchema = z.object({
  descricao: z.string().min(1).max(250).optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
});

/**
 * Schema Zod para GET/PUT /api/configuracoes/retencoes (projeto Retenções v2, T06).
 * Cada entrada de `campos` é validada como objeto completo (não parcial).
 */
const CAMPOS_RETENCAO_VALIDOS = [
  'irrf',
  'iss',
  'inss',
  'patronal',
  'sest_senat',
  'outros',
  'taxa_bancaria',
  'taxa_pix',
] as const;

const CAMPOS_TRIBUTARIOS = ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'] as const;

const CAMPOS_SEM_PERCENTUAL = ['taxa_bancaria', 'taxa_pix'];

/** Conta casas decimais por string, evitando ruído de ponto flutuante (ex.: 0.1234 * 10000). */
function temNoMaximoCasasDecimais(valor: number, max: number): boolean {
  const str = valor.toString();
  const i = str.indexOf('.');
  return i === -1 || str.length - i - 1 <= max;
}

const configRetencaoCampoSchema = z
  .object({
    campo: z.enum(CAMPOS_RETENCAO_VALIDOS),
    rotulo: z
      .string()
      .min(1, 'Rótulo é obrigatório.')
      .max(60, 'Rótulo muito longo (máx. 60 caracteres).')
      .regex(/^[^<>]*$/, 'Rótulo não pode conter HTML.'),
    tipo: z.enum(['PERCENTUAL', 'VALOR_DIGITADO']),
    aliquota: z
      .number()
      .min(0, 'Alíquota não pode ser negativa.')
      .max(100, 'Alíquota não pode passar de 100.')
      .refine((v) => temNoMaximoCasasDecimais(v, 4), 'Alíquota aceita no máximo 4 casas decimais.')
      .nullable(),
    calculoAutomatico: z.boolean(),
    editavelOperador: z.boolean(),
    entraDarf: z.boolean(),
    ativo: z.boolean(),
    ordem: z.number().int(),
  })
  .superRefine((d, ctx) => {
    if (CAMPOS_SEM_PERCENTUAL.includes(d.campo) && d.tipo === 'PERCENTUAL') {
      ctx.addIssue({ code: 'custom', path: ['tipo'], message: `${d.campo} não pode ter tipo PERCENTUAL.` });
    }
    if (d.tipo === 'VALOR_DIGITADO' && d.aliquota !== null) {
      ctx.addIssue({ code: 'custom', path: ['aliquota'], message: 'Alíquota deve ser nula para tipo VALOR_DIGITADO.' });
    }
    if (d.tipo === 'PERCENTUAL' && d.calculoAutomatico && d.aliquota === null) {
      ctx.addIssue({ code: 'custom', path: ['aliquota'], message: 'Alíquota é obrigatória quando o cálculo é automático.' });
    }
    if (!(CAMPOS_TRIBUTARIOS as readonly string[]).includes(d.campo) && d.entraDarf) {
      ctx.addIssue({ code: 'custom', path: ['entraDarf'], message: `${d.campo} não pode entrar na DARF.` });
    }
  });

export const configRetencoesSchema = z.object({
  campos: z.array(configRetencaoCampoSchema).min(1),
  regras: z.record(z.string(), z.array(z.enum(CAMPOS_TRIBUTARIOS))),
  versaoBase: z.string().optional(),
});
