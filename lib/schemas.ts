import { z } from "zod";

/**
 * Schema Zod para validação de Notas de Empenho.
 * Centralizado aqui para ser reutilizado tanto no frontend (formulário)
 * quanto no backend (API routes).
 */
export const notaEmpenhoSchema = z.object({
  numeroNE: z.string().min(1, "Número da NE é obrigatório"),
  valorNE: z.union([z.string(), z.number()]).transform(val => {
    const clean = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  }).refine(val => val > 0, { message: "O valor da NE deve ser maior que zero." }),
  dataPagamento: z.string().min(1, "Data é obrigatória").refine(val => {
    const y = parseInt(val.split('-')[0], 10);
    return y >= 2000 && y <= 2100;
  }, "Ano inválido"),
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
  dataEmissao: z.string().optional().refine(val => {
    if (!val) return true;
    const y = parseInt(val.split('-')[0], 10);
    return y >= 2000 && y <= 2100;
  }, "Ano inválido"),
  credorNome: z.string().optional(),
  cpfCnpj: z.string().optional(),
});

export type NotaEmpenhoFormValues = z.input<typeof notaEmpenhoSchema>;
