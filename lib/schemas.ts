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

/**
 * Schema Zod para o payload de PUT /api/configuracoes.
 * Os max() batem com o tamanho real das colunas em configuracoes_sistema
 * (nome_completo/email_corporativo VARCHAR(255), unidade_padrao/gestao_padrao VARCHAR(100)).
 */
export const configuracoesSchema = z.object({
  nome_completo: z.string().max(255, 'Nome muito longo (máx. 255 caracteres).').optional(),
  email_corporativo: z.union([z.string().email('Formato de e-mail corporativo inválido.'), z.literal('')]).optional(),
  unidade_padrao: z.string().max(100, 'Unidade padrão muito longa (máx. 100 caracteres).').optional(),
  gestao_padrao: z.string().max(100, 'Gestão padrão muito longa (máx. 100 caracteres).').optional(),
  auto_preencher_credor: z.boolean().optional(),
  notifica_email_empenho: z.boolean().optional(),
  exigir_2fa_op: z.boolean().optional(),
  alerta_integracao: z.boolean().optional(),
  aviso_manutencao: z.boolean().optional(),
});
