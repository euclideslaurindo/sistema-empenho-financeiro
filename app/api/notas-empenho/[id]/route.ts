import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';

// PUT /api/notas-empenho/[id] — atualiza NE com validação de saldo
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const { codigo, numero, valor, dataPagamento, unidadeOrcamentaria, elementoSubelemento, gestao, historico, status } = body;

    const valorDecimal = parseFloat(String(valor).replace(',', '.')) || 0;

    if (valorDecimal <= 0) {
      return NextResponse.json({ error: 'O valor da NE deve ser maior que zero.' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Pega o valor antigo da NE
      const [neRows]: any = await connection.execute('SELECT valor, unidade_orcamentaria FROM notas_empenho WHERE id = ? FOR UPDATE', [id]);
      if (!neRows || neRows.length === 0) {
        await connection.rollback(); connection.release();
        return NextResponse.json({ error: 'Nota de empenho não encontrada.' }, { status: 404 });
      }

      const valorAntigo = parseFloat(neRows[0].valor);
      const diferenca = valorDecimal - valorAntigo;

      // Valida que o novo valor não é menor que o total já pago em OPs vinculadas
      const [opSum]: any = await connection.execute(
        `SELECT COALESCE(SUM(op.valor_pagamento), 0) as total_pago
         FROM ordens_pagamento op
         INNER JOIN notas_empenho ne ON op.numero_ne = ne.numero
         WHERE ne.id = ?`,
        [id]
      );
      const totalPago = parseFloat(opSum[0]?.total_pago || 0);

      if (valorDecimal < totalPago) {
        await connection.rollback(); connection.release();
        return NextResponse.json(
          { error: `Não é possível reduzir o valor da NE para R$ ${valorDecimal.toFixed(2)} pois já foram geradas OPs no valor total de R$ ${totalPago.toFixed(2)}.` },
          { status: 409 }
        );
      }

      // Travar a dotação orçamentária e reajustar o saldo
      if (diferenca !== 0) {
        const [dotacaoRows]: any = await connection.execute(
          'SELECT id, saldo_disponivel FROM dotacao_orcamentaria WHERE unidade_orcamentaria = ? FOR UPDATE',
          [neRows[0].unidade_orcamentaria]
        );

        if (!dotacaoRows || dotacaoRows.length === 0) {
          await connection.rollback(); connection.release();
          return NextResponse.json({ error: 'Dotação orçamentária não encontrada.' }, { status: 422 });
        }

        if (diferenca > 0 && dotacaoRows[0].saldo_disponivel < diferenca) {
          await connection.rollback(); connection.release();
          return NextResponse.json({ error: 'Saldo insuficiente na dotação orçamentária para o aumento do empenho.' }, { status: 422 });
        }

        await connection.execute(
          'UPDATE dotacao_orcamentaria SET saldo_disponivel = saldo_disponivel - ? WHERE id = ?',
          [diferenca, dotacaoRows[0].id]
        );
      }

      await connection.execute(
        `UPDATE notas_empenho
         SET codigo = ?, numero = ?, valor = ?, data_pagamento = ?,
             unidade_orcamentaria = ?, elemento_subelemento = ?, gestao = ?, status = ?, historico = ?
         WHERE id = ?`,
        [codigo?.trim() || '', numero?.trim() || '', valorDecimal, dataPagamento || null,
         unidadeOrcamentaria?.trim() || '', elementoSubelemento?.trim() || '',
         gestao?.trim() || '', status || 'EMITIDO', historico?.trim() || '', id]
      );

      await connection.commit();
      connection.release();

      return NextResponse.json({ success: true });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error: any) {
    console.error('[API PUT /notas-empenho/[id]] Erro:', error);
    return NextResponse.json({ error: 'Erro ao atualizar nota de empenho.' }, { status: 500 });
  }
}

// DELETE /api/notas-empenho/[id] — cancela NE com verificação de OPs vinculadas e estorno
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const { id } = await params;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Pega info da NE para estorno
      const [neRows]: any = await connection.execute('SELECT valor, unidade_orcamentaria FROM notas_empenho WHERE id = ? FOR UPDATE', [id]);
      if (!neRows || neRows.length === 0) {
        await connection.rollback(); connection.release();
        return NextResponse.json({ error: 'Nota de empenho não encontrada.' }, { status: 404 });
      }

      // Bloqueia cancelamento se existem OPs vinculadas
      const [opsVinculadas]: any = await connection.execute(
        `SELECT COUNT(*) as total FROM ordens_pagamento op
         INNER JOIN notas_empenho ne ON op.numero_ne = ne.numero
         WHERE ne.id = ?`,
        [id]
      );

      const totalOps = parseInt(opsVinculadas[0]?.total || 0);
      if (totalOps > 0) {
        await connection.rollback(); connection.release();
        return NextResponse.json(
          { error: `Não é possível cancelar esta NE pois existem ${totalOps} ordem(ns) de pagamento vinculada(s). Exclua as OPs primeiro.` },
          { status: 409 }
        );
      }

      // Estorno para a dotação orçamentária
      const [dotacaoRows]: any = await connection.execute(
        'SELECT id FROM dotacao_orcamentaria WHERE unidade_orcamentaria = ? FOR UPDATE',
        [neRows[0].unidade_orcamentaria]
      );
      if (dotacaoRows && dotacaoRows.length > 0) {
        await connection.execute(
          'UPDATE dotacao_orcamentaria SET saldo_disponivel = saldo_disponivel + ? WHERE id = ?',
          [neRows[0].valor, dotacaoRows[0].id]
        );
      }

      await connection.execute("UPDATE notas_empenho SET status = 'CANCELADO' WHERE id = ?", [id]);
      
      await connection.commit();
      connection.release();

      return NextResponse.json({ success: true });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error: any) {
    console.error('[API DELETE /notas-empenho/[id]] Erro:', error);
    return NextResponse.json({ error: 'Erro ao cancelar nota de empenho.' }, { status: 500 });
  }
}
