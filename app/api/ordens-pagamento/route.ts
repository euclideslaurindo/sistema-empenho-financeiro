import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { z } from 'zod';

const ordemPagamentoSchema = z.object({
  liquidacao_id: z.string().optional().nullable(),
  numeroNe: z.string().min(1, 'Número da NE é obrigatório.'),
  numeroCheque: z.string().optional().nullable(),
  valorPagamento: z.union([z.string(), z.number()]).transform(val => {
    if (typeof val === 'string') {
      return parseFloat(val.replace(',', '.')) || 0;
    }
    return val;
  }).refine(val => val > 0, { message: 'O valor do pagamento deve ser maior que zero.' }),
  numeroEmpenho: z.string().optional(),
  sub: z.string().optional(),
  credorNome: z.string().optional(),
  credorCpfCnpj: z.string().optional(),
  credorRg: z.string().optional(),
  credorEndereco: z.string().optional(),
  unidadeOrcamentaria: z.string().optional(),
  elementoSubelemento: z.string().optional(),
  gestao: z.string().optional(),
  historico: z.string().optional(),
  itemUnidade: z.string().optional(),
  itemQuantidade: z.union([z.string(), z.number()]).optional(),
  itemValorUnitario: z.union([z.string(), z.number()]).optional(),
  itemUnidade2: z.string().optional().nullable(),
  itemQuantidade2: z.union([z.string(), z.number()]).optional().nullable(),
  itemValorUnitario2: z.union([z.string(), z.number()]).optional().nullable(),
  saldoAnterior: z.union([z.string(), z.number()]).optional(),
  valorEmpenho: z.union([z.string(), z.number()]).optional(),
  irrf: z.union([z.string(), z.number()]).optional(),
  iss: z.union([z.string(), z.number()]).optional(),
  inss: z.union([z.string(), z.number()]).optional(),
  sestSenat: z.union([z.string(), z.number()]).optional(),
  patronal: z.union([z.string(), z.number()]).optional(),
  outrosDescontos: z.union([z.string(), z.number()]).optional(),
  totalDescontos: z.union([z.string(), z.number()]).optional(),
  valorLiquido: z.union([z.string(), z.number()]).optional(),
  dataEmissao: z.string().optional().nullable(),
  dataPagamento: z.string().optional().nullable(),
});

// GET - lista as ordens de pagamento
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const numeroNe = searchParams.get('numeroNe');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
    const offset = (page - 1) * limit;

    if (numeroNe) {
      const rows = await query<any[]>(
        `SELECT id, numero_ne as numeroNe, numero_empenho as numeroEmpenho, sub,
                credor_nome as credorNome, credor_cpf_cnpj as credorCpfCnpj, credor_rg as credorRg, credor_endereco as credorEndereco,
                unidade_orcamentaria as unidadeOrcamentaria, elemento_subelemento as elementoSubelemento, gestao, historico,
                item_unidade as itemUnidade, item_quantidade as itemQuantidade, item_valor_unitario as itemValorUnitario,
                item_unidade2 as itemUnidade2, item_quantidade2 as itemQuantidade2, item_valor_unitario2 as itemValorUnitario2,
                saldo_anterior as saldoAnterior, valor_empenho as valorEmpenho, valor_pagamento as valorPagamento,
                irrf, iss, inss, sest_senat as sestSenat, patronal, outros_descontos as outrosDescontos, total_descontos as totalDescontos, valor_liquido as valorLiquido,
                numero_cheque as numeroCheque,
                DATE_FORMAT(data_emissao, '%Y-%m-%d') as dataEmissao,
                DATE_FORMAT(data_pagamento, '%Y-%m-%d') as dataPagamento,
                created_at
         FROM ordens_pagamento
         WHERE numero_ne = ?
         ORDER BY created_at ASC`,
        [numeroNe]
      );
      return NextResponse.json({ ordens: rows });
    }

    const countResult = await query<any[]>('SELECT COUNT(*) as total FROM ordens_pagamento');
    const total = countResult[0]?.total || 0;

    const rows = await query<any[]>(
      `SELECT id, numero_ne as numeroNe, numero_empenho as numeroEmpenho, sub,
              credor_nome as credorNome, credor_cpf_cnpj as credorCpfCnpj,
              valor_pagamento as valorPagamento, valor_liquido as valorLiquido,
              numero_cheque as numeroCheque,
              DATE_FORMAT(data_emissao, '%Y-%m-%d') as dataEmissao,
              DATE_FORMAT(data_pagamento, '%Y-%m-%d') as dataPagamento,
              created_at
       FROM ordens_pagamento
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`
    );
    return NextResponse.json({
      ordens: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('[API GET /ordens-pagamento] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar ordens de pagamento.' }, { status: 500 });
  }
}

// POST - salva uma nova ordem de pagamento e valida o saldo da NE antes de inserir
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const parsed = ordemPagamentoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const {
      liquidacao_id, numeroNe, numeroEmpenho, sub, credorNome, credorCpfCnpj, credorRg, credorEndereco,
      unidadeOrcamentaria, elementoSubelemento, gestao, historico,
      itemUnidade, itemQuantidade, itemValorUnitario,
      itemUnidade2, itemQuantidade2, itemValorUnitario2,
      saldoAnterior, valorEmpenho, valorPagamento: vPagamento,
      irrf, iss, inss, sestSenat, patronal, outrosDescontos, totalDescontos, valorLiquido,
      numeroCheque, dataEmissao, dataPagamento,
    } = parsed.data;

    const toDecimal = (v: any) => parseFloat(String(v || 0).replace(',', '.')) || 0;

    const result = await withTransaction(async (connection) => {
      // checa se esse numero de cheque ja foi usado
      const chequeFormatado = numeroCheque ? numeroCheque.trim() : null;
      if (chequeFormatado) {
        const [existingCheque]: any = await connection.execute(
          'SELECT id FROM ordens_pagamento WHERE numero_cheque = ?',
          [chequeFormatado]
        );
        if (existingCheque && existingCheque.length > 0) {
          return { error: `O cheque nº "${chequeFormatado}" já foi utilizado.`, status: 409 };
        }
      }

      // busca a NE pra saber quanto de saldo sobrou
      const [neRows]: any = await connection.execute(
        'SELECT id, valor FROM notas_empenho WHERE numero = ?',
        [numeroNe.trim()]
      );
      if (!neRows || neRows.length === 0) {
        return { error: `NE "${numeroNe}" não encontrada.`, status: 404 };
      }
      const valorNe = parseFloat(neRows[0].valor) || 0;

      // soma tudo que ja foi pago nessa NE
      const [paidRows]: any = await connection.execute(
        'SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago FROM ordens_pagamento WHERE numero_ne = ?',
        [numeroNe.trim()]
      );
      const totalJaPago = parseFloat(paidRows[0]?.total_pago) || 0;
      const saldoDisponivel = valorNe - totalJaPago;

      // nao deixa pagar mais do que tem de saldo
      if (vPagamento > saldoDisponivel + 0.01) {
        return {
          error: `Saldo insuficiente. Saldo disponível da NE: R$ ${saldoDisponivel.toFixed(2).replace('.', ',')}. Valor solicitado: R$ ${vPagamento.toFixed(2).replace('.', ',')}`,
          status: 422
        };
      }

      // tudo ok, insere a OP
      const id = crypto.randomUUID();
      await connection.execute(
        `INSERT INTO ordens_pagamento (
          id, liquidacao_id, numero_ne, numero_empenho, sub, credor_nome, credor_cpf_cnpj, credor_rg, credor_endereco,
          unidade_orcamentaria, elemento_subelemento, gestao, historico,
          item_unidade, item_quantidade, item_valor_unitario,
          item_unidade2, item_quantidade2, item_valor_unitario2,
          saldo_anterior, valor_empenho, valor_pagamento,
          irrf, iss, inss, sest_senat, patronal, outros_descontos, total_descontos, valor_liquido,
          numero_cheque, data_emissao, data_pagamento, usuario_id
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, liquidacao_id || null, numeroNe.trim(), numeroEmpenho?.trim() || '', sub?.trim() || '01',
          credorNome || '', credorCpfCnpj || '', credorRg || '', credorEndereco || '',
          unidadeOrcamentaria || '', elementoSubelemento || '', gestao || '', historico || '',
          itemUnidade || 'UN', toDecimal(itemQuantidade), toDecimal(itemValorUnitario),
          itemUnidade2 || null, itemQuantidade2 ? toDecimal(itemQuantidade2) : null, itemValorUnitario2 ? toDecimal(itemValorUnitario2) : null,
          toDecimal(saldoAnterior), toDecimal(valorEmpenho), vPagamento,
          toDecimal(irrf), toDecimal(iss), toDecimal(inss), toDecimal(sestSenat), toDecimal(patronal),
          toDecimal(outrosDescontos), toDecimal(totalDescontos), toDecimal(valorLiquido),
          chequeFormatado, dataEmissao || null, dataPagamento || null, user.id
        ]
      );

      // muda o status da NE: se zerou vira LIQUIDADO, se ainda tem saldo fica EMITIDO
      const saldoRestante = saldoDisponivel - vPagamento;
      const novoStatus = saldoRestante <= 0.01 ? 'LIQUIDADO' : 'EMITIDO';
      await connection.execute(
        'UPDATE notas_empenho SET status = ? WHERE numero = ?',
        [novoStatus, numeroNe.trim()]
      );

      return { success: true, id, saldoRestante, status: 201 };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: result.success, id: result.id, saldoRestante: result.saldoRestante }, { status: result.status });

  } catch (error: any) {
    console.error('[API POST /ordens-pagamento] Erro:', error);
    return NextResponse.json({ error: 'Erro ao salvar ordem de pagamento.' }, { status: 500 });
  }
}


