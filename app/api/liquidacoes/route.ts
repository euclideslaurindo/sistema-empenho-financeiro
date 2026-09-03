import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { z } from 'zod';

const liquidacaoSchema = z.object({
  notas_empenho_id: z.string().min(1, 'ID do empenho é obrigatório.'),
  numero_liquidacao: z.string().min(1, 'Número da liquidação é obrigatório.'),
  valor_liquidado: z.number().positive('O valor da liquidação deve ser maior que zero.'),
  data_liquidacao: z.string().min(1, 'Data é obrigatória.'),
  responsavel_atesto: z.string().optional(),
  documento_fiscal: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    
    const parsed = liquidacaoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { notas_empenho_id, numero_liquidacao, valor_liquidado, data_liquidacao, responsavel_atesto, documento_fiscal } = parsed.data;

    const liquidacaoId = crypto.randomUUID();

    await withTransaction(async (connection) => {
      // trava o registro pra nao ter problema de concorrencia
      const [neRows]: any = await connection.execute(
        'SELECT id, valor FROM notas_empenho WHERE id = ? FOR UPDATE',
        [notas_empenho_id]
      );

      if (!neRows || neRows.length === 0) {
        throw new Error('Empenho não encontrado.');
      }

      const valorOriginal = parseFloat(neRows[0].valor);

      // soma o que ja foi liquidado antes
      const [liqRows]: any = await connection.execute(
        'SELECT SUM(valor_liquidado) as total_liquidado FROM liquidacoes WHERE notas_empenho_id = ?',
        [notas_empenho_id]
      );
      
      const totalLiquidadoAnterior = parseFloat(liqRows[0]?.total_liquidado || 0);
      const saldoALiquidar = valorOriginal - totalLiquidadoAnterior;

      if (valor_liquidado > saldoALiquidar) {
        throw new Error('O valor da liquidação excede o saldo a liquidar do empenho.');
      }

      // insere a liquidacao
      await connection.execute(
        `INSERT INTO liquidacoes (id, numero_liquidacao, notas_empenho_id, valor_liquidado, data_liquidacao, responsavel_atesto, documento_fiscal, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [liquidacaoId, numero_liquidacao, notas_empenho_id, valor_liquidado, data_liquidacao, responsavel_atesto || null, documento_fiscal || null, user.id]
      );

      // atualiza o status do empenho
      const novoTotal = totalLiquidadoAnterior + valor_liquidado;
      const novoStatus = novoTotal >= valorOriginal ? 'TOTALMENTE_LIQUIDADO' : 'PARCIALMENTE_LIQUIDADO';
      
      await connection.execute(
        'UPDATE notas_empenho SET status = ? WHERE id = ?',
        [novoStatus, notas_empenho_id]
      );
    });

    return NextResponse.json({ success: true, id: liquidacaoId }, { status: 201 });

  } catch (error: any) {
    console.error('[API POST /liquidacoes] Erro:', error);
    if (error.message === 'Empenho não encontrado.') {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error.message === 'O valor da liquidação excede o saldo a liquidar do empenho.') {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Número de liquidação já cadastrado.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro ao criar liquidação.' }, { status: 500 });
  }
}
