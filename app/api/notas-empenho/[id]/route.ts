import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';

// PUT /api/notas-empenho/[id] — atualiza a ne e ja checa o saldo
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const { numero, valor, dataPagamento, unidadeOrcamentaria, elemento, subelemento, gestao, historico, status, dataProvisaoConcedida, dataEmissao, credorNome, cpfCnpj } = body;

    const valorDecimal = parseFloat(String(valor).replace(',', '.')) || 0;

    if (valorDecimal <= 0) {
      return NextResponse.json({ error: 'O valor da NE deve ser maior que zero.' }, { status: 400 });
    }

    await withTransaction(async (connection) => {
      // pegando o valor de antes pra comparar
      const [neRows]: any = await connection.execute('SELECT numero, valor, unidade_orcamentaria FROM notas_empenho WHERE id = ? FOR UPDATE', [id]);
      if (!neRows || neRows.length === 0) {
        throw new Error('Nota de empenho não encontrada.');
      }

      const numeroAntigo = neRows[0].numero;
      const numeroNovo = numero?.trim() || '';

      // nao deixa o cara colocar o numero de uma ne que ja existe
      if (numeroNovo !== numeroAntigo) {
        const [duplicateCheck]: any = await connection.execute('SELECT id FROM notas_empenho WHERE numero = ? AND id != ?', [numeroNovo, id]);
        if (duplicateCheck && duplicateCheck.length > 0) {
          throw new Error(`O número da NE "${numeroNovo}" já está cadastrado em outra nota de empenho.`);
        }
      }

      const valorAntigo = parseFloat(neRows[0].valor);
      const diferenca = valorDecimal - valorAntigo;

      // nao deixa diminuir o valor se ja tiver pago mais q isso nas ops
      const [opSum]: any = await connection.execute(
        `SELECT COALESCE(SUM(op.valor_pagamento), 0) as total_pago
         FROM ordens_pagamento op
         INNER JOIN notas_empenho ne ON op.numero_ne = ne.numero
         WHERE ne.id = ?`,
        [id]
      );
      const totalPago = parseFloat(opSum[0]?.total_pago || 0);

      if (valorDecimal < totalPago) {
        throw new Error(`Não é possível reduzir o valor da NE para R$ ${valorDecimal.toFixed(2)} pois já foram geradas OPs no valor total de R$ ${totalPago.toFixed(2)}.`);
      }

      // tirei a validacao da tabela de dotacao pq ela nem existe no banco kkkk

      let usuarioId: string | null = user.id;
      try {
        const userCheck: any = await connection.execute('SELECT id FROM usuarios WHERE id = ?', [usuarioId]);
        if (!userCheck || !userCheck[0] || userCheck[0].length === 0) usuarioId = null;
      } catch {
        usuarioId = null;
      }

      await connection.execute(
        `UPDATE notas_empenho
         SET numero = ?, valor = ?, data_pagamento = ?, data_provisao_concedida = ?, data_emissao = ?,
             unidade_orcamentaria = ?, elemento = ?, subelemento = ?, gestao = ?, status = ?, historico = ?, usuario_id = ?,
             credor_nome = ?, cpf_cnpj = ?
         WHERE id = ?`,
        [numero?.trim() || '', valorDecimal, dataPagamento || null, dataProvisaoConcedida || null, dataEmissao || null,
         unidadeOrcamentaria?.trim() || '', elemento?.trim() || '', subelemento?.trim() || '',
         gestao?.trim() || '', status || 'EMITIDO', historico?.trim() || '', usuarioId,
         credorNome?.trim() || null, cpfCnpj?.trim() || null, id]
      );

      // se mudou o numero, atualiza nas ops tambem senao quebra a relacao
      if (numeroNovo !== numeroAntigo) {
        await connection.execute(
          'UPDATE ordens_pagamento SET numero_ne = ? WHERE numero_ne = ?',
          [numeroNovo, numeroAntigo]
        );
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API PUT /notas-empenho/[id]] Erro:', error);
    if (error.message.includes('já está cadastrado') || error.message.includes('Não é possível reduzir')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error.message === 'Nota de empenho não encontrada.') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro ao atualizar nota de empenho.' }, { status: 500 });
  }
}

// DELETE /api/notas-empenho/[id] — cancela a ne mas checa as ops antes
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const { id } = await params;

    await withTransaction(async (connection) => {
      // pega os dados pra estornar dps
      const [neRows]: any = await connection.execute('SELECT valor, unidade_orcamentaria FROM notas_empenho WHERE id = ? FOR UPDATE', [id]);
      if (!neRows || neRows.length === 0) {
        throw new Error('Nota de empenho não encontrada.');
      }

      // barra o delete se tiver op pendurada
      const [opsVinculadas]: any = await connection.execute(
        `SELECT COUNT(*) as total FROM ordens_pagamento op
         INNER JOIN notas_empenho ne ON op.numero_ne = ne.numero
         WHERE ne.id = ?`,
        [id]
      );

      const totalOps = parseInt(opsVinculadas[0]?.total || 0);
      if (totalOps > 0) {
        throw new Error(`Não é possível cancelar esta NE pois existem ${totalOps} ordem(ns) de pagamento vinculada(s). Exclua as OPs primeiro.`);
      }

      // estorno desativado pq n tem tabela de dotacao ainda

      await connection.execute("UPDATE notas_empenho SET status = 'CANCELADO' WHERE id = ?", [id]);
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API DELETE /notas-empenho/[id]] Erro:', error);
    if (error.message.includes('Não é possível cancelar')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error.message === 'Nota de empenho não encontrada.') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro ao cancelar nota de empenho.' }, { status: 500 });
  }
}
