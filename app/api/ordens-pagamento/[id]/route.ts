import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import type { PoolConnection } from 'mysql2/promise';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const { id } = await params;

    await withTransaction(async (conn: PoolConnection) => {
      // 1. Obter a OP para saber qual NE está atrelada
      const [ordens] = await conn.execute<any[]>('SELECT numero_ne FROM ordens_pagamento WHERE id = ?', [id]);

      if (!ordens || (ordens as any[]).length === 0) {
        throw { status: 404, message: 'Ordem de pagamento não encontrada.' };
      }
      const numeroNe = (ordens as any[])[0].numero_ne;

      // 2. Deletar a OP
      await conn.execute('DELETE FROM ordens_pagamento WHERE id = ?', [id]);

      // 3. Recalcular o status da NE após remoção
      const [neData] = await conn.execute<any[]>(
        `SELECT ne.valor,
                (ne.valor - COALESCE(op_sum.total_pago, 0)) as saldoDisponivel
         FROM notas_empenho ne
         LEFT JOIN (SELECT numero_ne, SUM(valor_pagamento) as total_pago FROM ordens_pagamento GROUP BY numero_ne) op_sum
           ON op_sum.numero_ne = ne.numero
         WHERE ne.numero = ?`,
        [numeroNe]
      );

      if (neData && (neData as any[]).length > 0) {
        const saldo = parseFloat((neData as any[])[0].saldoDisponivel);
        const valorTotal = parseFloat((neData as any[])[0].valor);

        let novoStatus = 'EMITIDO';
        if (saldo <= 0.01) novoStatus = 'LIQUIDADO';
        else if (saldo < valorTotal) novoStatus = 'PARCIALMENTE PAGO';

        await conn.execute('UPDATE notas_empenho SET status = ? WHERE numero = ?', [novoStatus, numeroNe]);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API DELETE /ordens-pagamento/:id] Erro:', error);
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Erro ao excluir ordem de pagamento.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();

    const {
      numeroNe, sub, credorNome, credorCpfCnpj, credorRg, credorEndereco,
      itemUnidade, itemQuantidade, itemValorUnitario,
      itemUnidade2, itemQuantidade2, itemValorUnitario2,
      saldoAnterior, valorEmpenho, valorPagamento,
      irrf, iss, inss, sestSenat, patronal, outrosDescontos, totalDescontos, valorLiquido,
      numeroCheque, dataEmissao, dataPagamento, historico
    } = body;

    const toDecimal = (v: any) => parseFloat(String(v || 0).replace(',', '.')) || 0;
    const vPagamento = toDecimal(valorPagamento);

    await withTransaction(async (conn: PoolConnection) => {
      // Validar saldo da NE antes de atualizar
      const [neRows] = await conn.execute<any[]>(
        `SELECT ne.valor,
                (ne.valor - COALESCE(op_sum.total_pago, 0) + (SELECT valor_pagamento FROM ordens_pagamento WHERE id = ?)) as saldoDisponivel
         FROM notas_empenho ne
         LEFT JOIN (SELECT numero_ne, SUM(valor_pagamento) as total_pago FROM ordens_pagamento GROUP BY numero_ne) op_sum
           ON op_sum.numero_ne = ne.numero
         WHERE ne.numero = ?`,
        [id, numeroNe]
      );

      if (neRows && (neRows as any[]).length > 0) {
        const saldoDisp = parseFloat((neRows as any[])[0].saldoDisponivel);
        if (vPagamento > saldoDisp + 0.01) {
          throw { status: 409, message: `Valor do pagamento excede o saldo disponível da NE (R$ ${saldoDisp.toFixed(2)}).` };
        }
      }

      await conn.execute(
        `UPDATE ordens_pagamento SET
          sub = ?, credor_nome = ?, credor_cpf_cnpj = ?, credor_rg = ?, credor_endereco = ?,
          item_unidade = ?, item_quantidade = ?, item_valor_unitario = ?,
          item_unidade2 = ?, item_quantidade2 = ?, item_valor_unitario2 = ?,
          saldo_anterior = ?, valor_empenho = ?, valor_pagamento = ?,
          irrf = ?, iss = ?, inss = ?, sest_senat = ?, patronal = ?, outros_descontos = ?,
          total_descontos = ?, valor_liquido = ?, numero_cheque = ?, data_emissao = ?, data_pagamento = ?, historico = ?
         WHERE id = ?`,
        [
          sub || '01', credorNome || '', credorCpfCnpj || '', credorRg || '', credorEndereco || '',
          itemUnidade || 'UN', toDecimal(itemQuantidade), toDecimal(itemValorUnitario),
          itemUnidade2 || null, itemQuantidade2 ? toDecimal(itemQuantidade2) : null, itemValorUnitario2 ? toDecimal(itemValorUnitario2) : null,
          toDecimal(saldoAnterior), toDecimal(valorEmpenho), vPagamento,
          toDecimal(irrf), toDecimal(iss), toDecimal(inss), toDecimal(sestSenat), toDecimal(patronal),
          toDecimal(outrosDescontos), toDecimal(totalDescontos), toDecimal(valorLiquido),
          numeroCheque.trim(), dataEmissao || null, dataPagamento || null, historico || '', id
        ]
      );

      // Recalcular status da NE
      const [neData] = await conn.execute<any[]>(
        `SELECT ne.valor,
                (ne.valor - COALESCE(op_sum.total_pago, 0)) as saldoDisponivel
         FROM notas_empenho ne
         LEFT JOIN (SELECT numero_ne, SUM(valor_pagamento) as total_pago FROM ordens_pagamento GROUP BY numero_ne) op_sum
           ON op_sum.numero_ne = ne.numero
         WHERE ne.numero = ?`,
        [numeroNe]
      );

      if (neData && (neData as any[]).length > 0) {
        const saldo = parseFloat((neData as any[])[0].saldoDisponivel);
        const valorTotal = parseFloat((neData as any[])[0].valor);
        let novoStatus = 'EMITIDO';
        if (saldo <= 0.01) novoStatus = 'LIQUIDADO';
        else if (saldo < valorTotal) novoStatus = 'PARCIALMENTE PAGO';
        await conn.execute('UPDATE notas_empenho SET status = ? WHERE numero = ?', [novoStatus, numeroNe]);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API PUT /ordens-pagamento/:id] Erro:', error);
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Cheque já utilizado.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro ao atualizar ordem de pagamento.' }, { status: 500 });
  }
}

