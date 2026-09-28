import { withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';

export type ServiceResult<T = any> =
  | { success: true; data: T; status?: number }
  | { success: false; error: string; status: number };

export const criarLiquidacaoSchema = z.object({
  notas_empenho_id: z.string().min(1, 'ID do empenho é obrigatório.'),
  numero_liquidacao: z.string().min(1, 'Número da liquidação é obrigatório.'),
  valor_liquidado: z.number().positive('O valor da liquidação deve ser maior que zero.'),
  data_liquidacao: z.string().min(1, 'Data é obrigatória.'),
  responsavel_atesto: z.string().optional(),
  documento_fiscal: z.string().optional(),
});

export class LiquidacaoService {
  static async criar(rawData: any, usuarioId: string, perfilSolicitante: string): Promise<ServiceResult> {
    if (perfilSolicitante === 'CONSULTA') {
      return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
    }

    const parsed = criarLiquidacaoSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message, status: 400 };
    }
    const { notas_empenho_id, numero_liquidacao, valor_liquidado, data_liquidacao, responsavel_atesto, documento_fiscal } = parsed.data;

    const liquidacaoId = crypto.randomUUID();

    try {
      await withTransaction(async (conn: PoolConnection) => {
        // trava o registro pra nao ter problema de concorrencia
        const [neRows]: any = await conn.execute(
          'SELECT id, valor FROM notas_empenho WHERE id = ? FOR UPDATE',
          [notas_empenho_id]
        );
        if (!neRows || neRows.length === 0) {
          throw { status: 422, error: 'Empenho não encontrado.' };
        }
        const valorOriginal = parseFloat(neRows[0].valor);

        // soma o que ja foi liquidado antes
        const [liqRows]: any = await conn.execute(
          'SELECT SUM(valor_liquidado) as total_liquidado FROM liquidacoes WHERE notas_empenho_id = ?',
          [notas_empenho_id]
        );
        const totalLiquidadoAnterior = parseFloat(liqRows[0]?.total_liquidado || 0);

        // Comparação em CENTAVOS inteiros para evitar imprecisão IEEE 754
        const saldoCentavos = Math.round(valorOriginal * 100) - Math.round(totalLiquidadoAnterior * 100);
        const valorLiquidadoCentavos = Math.round(valor_liquidado * 100);

        if (valorLiquidadoCentavos > saldoCentavos) {
          const saldoFormatado = (saldoCentavos / 100).toFixed(2).replace('.', ',');
          throw { status: 422, error: `O valor da liquidação excede o saldo a liquidar do empenho. Saldo disponível: R$ ${saldoFormatado}` };
        }

        // insere a liquidacao
        await conn.execute(
          `INSERT INTO liquidacoes (id, numero_liquidacao, notas_empenho_id, valor_liquidado, data_liquidacao, responsavel_atesto, documento_fiscal, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [liquidacaoId, numero_liquidacao, notas_empenho_id, valor_liquidado, data_liquidacao, responsavel_atesto || null, documento_fiscal || null, usuarioId]
        );

        // Atualiza o status do empenho usando o MESMO vocabulário que o resto do
        // sistema (ordem-pagamento.service.ts, app/notas-empenho/page.tsx e
        // app/page.tsx só reconhecem 'EMITIDO' | 'PARCIALMENTE PAGO' | 'LIQUIDADO').
        // Antes desta extração, esse UPDATE usava 'TOTALMENTE_LIQUIDADO' /
        // 'PARCIALMENTE_LIQUIDADO' — valores que a UI não reconhece, então o
        // badge da NE cairia no texto cru em vez de mostrar "PAGO".
        const novoTotal = totalLiquidadoAnterior + valor_liquidado;
        const novoStatus = novoTotal >= valorOriginal ? 'LIQUIDADO' : 'PARCIALMENTE PAGO';

        await conn.execute(
          'UPDATE notas_empenho SET status = ? WHERE id = ?',
          [novoStatus, notas_empenho_id]
        );
      });

      return { success: true, data: { id: liquidacaoId }, status: 201 };
    } catch (error: any) {
      if (error.status && error.error) {
        return { success: false, error: error.error, status: error.status };
      }
      if (error.code === 'ER_DUP_ENTRY') {
        return { success: false, error: 'Número de liquidação já cadastrado.', status: 409 };
      }
      console.error('[Service: criarLiquidacao]', error);
      return { success: false, error: 'Erro ao criar liquidação.', status: 500 };
    }
  }
}
