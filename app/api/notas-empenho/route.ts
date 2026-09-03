import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { z } from 'zod';
import { withErrorHandler } from '@/lib/api-handler';

const notaEmpenhoSchema = z.object({
  codigo: z.string().optional(),
  numero: z.string().min(1, 'Número da NE é obrigatório.'),
  valor: z.union([z.string(), z.number()]).transform(val => {
    if (typeof val === 'string') {
      return parseFloat(val.replace(',', '.')) || 0;
    }
    return val;
  }).refine(val => val > 0, { message: 'O valor da NE deve ser maior que zero.' }),
  dataPagamento: z.string().optional().nullable(),
  unidadeOrcamentaria: z.string().optional(),
  elementoSubelemento: z.string().optional(),
  gestao: z.string().optional(),
  historico: z.string().optional(),
  status: z.string().optional().default('EMITIDO'),
  dataProvisaoConcedida: z.string().optional().nullable(),
  dataEmissao: z.string().optional().nullable()
});

// lista as NEs, se passar ?numero= busca uma especifica (usado na OP)
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('busca') || '';
    const numero = searchParams.get('numero') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
    const offset = (page - 1) * limit;

    // se passou ?numero= eh pra buscar uma NE especifica (chamada da tela de OP)
    if (numero) {
      const rows = await query<any[]>(
        `SELECT
           ne.id, ne.codigo, ne.numero, ne.valor,
           DATE_FORMAT(ne.data_pagamento, '%Y-%m-%d') as dataPagamento,
           DATE_FORMAT(ne.data_provisao_concedida, '%Y-%m-%d') as dataProvisaoConcedida,
           DATE_FORMAT(ne.data_emissao, '%Y-%m-%d') as dataEmissao,
           ne.unidade_orcamentaria as unidadeOrcamentaria,
           ne.elemento_subelemento as elementoSubelemento,
           ne.gestao, ne.status, ne.historico,
           (ne.valor - COALESCE(op_sum.total_pago, 0)) as saldoDisponivel
         FROM notas_empenho ne
         LEFT JOIN (
           SELECT numero_ne, SUM(valor_pagamento) as total_pago
           FROM ordens_pagamento
           GROUP BY numero_ne
         ) op_sum ON op_sum.numero_ne = ne.numero
         WHERE ne.numero = ?`,
        [numero.trim()]
      );
      if (!rows || rows.length === 0) {
        return NextResponse.json({ error: 'NE não encontrada.' }, { status: 404 });
      }
      return NextResponse.json({ ne: rows[0] });
    }

    // listagem geral - usei LEFT JOIN pra nao fazer N queries pra cada NE
    // aprendi esse padrao no YouTube, evita o problema N+1
    let sql = `
      SELECT
        ne.id, ne.codigo, ne.numero, ne.valor,
        DATE_FORMAT(ne.data_pagamento, '%Y-%m-%d') as dataPagamento,
        DATE_FORMAT(ne.data_provisao_concedida, '%Y-%m-%d') as dataProvisaoConcedida,
        DATE_FORMAT(ne.data_emissao, '%Y-%m-%d') as dataEmissao,
        ne.unidade_orcamentaria as unidadeOrcamentaria,
        ne.elemento_subelemento as elementoSubelemento,
        ne.gestao, ne.status, ne.historico, ne.created_at,
        (ne.valor - COALESCE(op_sum.total_pago, 0)) as saldoDisponivel
      FROM notas_empenho ne
      LEFT JOIN (
        SELECT numero_ne, SUM(valor_pagamento) as total_pago
        FROM ordens_pagamento
        GROUP BY numero_ne
      ) op_sum ON op_sum.numero_ne = ne.numero
      WHERE 1=1`;

    const params: any[] = [];

    if (busca) {
      sql += ' AND (ne.numero LIKE ? OR ne.codigo LIKE ?)';
      params.push(`%${busca}%`, `%${busca}%`);
    }

    // contagem separada pra montar paginacao
    let countSql = `SELECT COUNT(*) as total FROM notas_empenho ne WHERE 1=1`;
    if (busca) {
      countSql += ' AND (ne.numero LIKE ? OR ne.codigo LIKE ?)';
    }
    const countParams = busca ? [`%${busca}%`, `%${busca}%`] : [];
    const countResult = await query<any[]>(countSql, countParams);
    const total = countResult[0]?.total || 0;

    sql += ` ORDER BY ne.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    // nao usei params.push aqui por causa de um bug estranho no driver mysql2 com LIMIT

    const rows = await query<any[]>(sql, params);
    return NextResponse.json({
      notas: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  });
}

// cria uma NE nova no banco
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const body = await request.json();
    
    // uso parse() em vez de safeParse() pra o zod jogar o erro direto pro withErrorHandler
    const parsed = notaEmpenhoSchema.parse(body);

    const { codigo, numero, valor: valorDecimal, dataPagamento, unidadeOrcamentaria, elementoSubelemento, gestao, historico, status, dataProvisaoConcedida, dataEmissao } = parsed;

    const result = await withTransaction(async (connection) => {
    // checar se ja existe uma NE com esse numero antes de inserir
      const [existing]: any = await connection.execute('SELECT id FROM notas_empenho WHERE numero = ?', [numero.trim()]);
      if (existing && existing.length > 0) {
        return { error: `A NE "${numero}" já está cadastrada no sistema.`, status: 409 };
      }

      const id = crypto.randomUUID();
      const exercicio = dataPagamento ? dataPagamento.substring(0, 4) : new Date().getFullYear().toString();

      let usuarioId: string | null = user.id;
      try {
        const userCheck: any = await connection.execute('SELECT id FROM usuarios WHERE id = ?', [usuarioId]);
        if (!userCheck || !userCheck[0] || userCheck[0].length === 0) usuarioId = null;
      } catch {
        usuarioId = null;
      }

      await connection.execute(
        `INSERT INTO notas_empenho (id, exercicio, codigo, numero, valor, data_pagamento, data_provisao_concedida, data_emissao, unidade_orcamentaria, elemento_subelemento, gestao, status, historico, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, exercicio, codigo?.trim() || '', numero.trim(), valorDecimal, dataPagamento || null, dataProvisaoConcedida || null, dataEmissao || null,
         unidadeOrcamentaria?.trim() || '', elementoSubelemento?.trim() || '',
         gestao?.trim() || '', status || 'EMITIDO', historico?.trim() || '', usuarioId]
      );

      return { success: true, id, status: 201 };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: result.success, id: result.id }, { status: result.status });
  });
}

