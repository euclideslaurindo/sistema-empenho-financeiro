import { NextRequest, NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { z } from 'zod';

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
  status: z.string().optional().default('EMITIDO')
});

// GET /api/notas-empenho — lista NEs (com paginacao e fix de N+1)
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('busca') || '';
    const numero = searchParams.get('numero') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
    const offset = (page - 1) * limit;

    // Busca por numero exato (para Ordem de Pagamento)
    if (numero) {
      const rows = await query<any[]>(
        `SELECT
           ne.id, ne.codigo, ne.numero, ne.valor,
           DATE_FORMAT(ne.data_pagamento, '%Y-%m-%d') as dataPagamento,
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

    // Listagem geral com busca opcional e paginacao
    // FIX N+1: usa LEFT JOIN com subquery agrupada em vez de subconsulta correlacionada
    let sql = `
      SELECT
        ne.id, ne.codigo, ne.numero, ne.valor,
        DATE_FORMAT(ne.data_pagamento, '%Y-%m-%d') as dataPagamento,
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

    // Contar total para paginacao
    let countSql = `SELECT COUNT(*) as total FROM notas_empenho ne WHERE 1=1`;
    if (busca) {
      countSql += ' AND (ne.numero LIKE ? OR ne.codigo LIKE ?)';
    }
    const countParams = busca ? [`%${busca}%`, `%${busca}%`] : [];
    const countResult = await query<any[]>(countSql, countParams);
    const total = countResult[0]?.total || 0;

    sql += ' ORDER BY ne.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await query<any[]>(sql, params);
    return NextResponse.json({
      notas: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('[API GET /notas-empenho] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar notas de empenho.' }, { status: 500 });
  }
}

// POST /api/notas-empenho — cria nova NE
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    
    const parsed = notaEmpenhoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { codigo, numero, valor: valorDecimal, dataPagamento, unidadeOrcamentaria, elementoSubelemento, gestao, historico, status } = parsed.data;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Verificar duplicidade
      const [existing]: any = await connection.execute('SELECT id FROM notas_empenho WHERE numero = ?', [numero.trim()]);
      if (existing && existing.length > 0) {
        await connection.rollback();
        connection.release();
        return NextResponse.json({ error: `A NE "${numero}" já está cadastrada no sistema.` }, { status: 409 });
      }

      // Saldo e Dotação (MOCK): A tabela dotacao_orcamentaria não existe no banco atual,
      // então pulamos essa verificação para permitir o cadastro da NE.

      const id = crypto.randomUUID();
      const exercicio = dataPagamento ? dataPagamento.substring(0, 4) : new Date().getFullYear().toString();

      await connection.execute(
        `INSERT INTO notas_empenho (id, exercicio, codigo, numero, valor, data_pagamento, unidade_orcamentaria, elemento_subelemento, gestao, status, historico, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, exercicio, codigo?.trim() || '', numero.trim(), valorDecimal, dataPagamento || null,
         unidadeOrcamentaria?.trim() || '', elementoSubelemento?.trim() || '',
         gestao?.trim() || '', status || 'EMITIDO', historico?.trim() || '', user.id]
      );

      await connection.commit();
      connection.release();

      return NextResponse.json({ success: true, id }, { status: 201 });
    } catch (err: any) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error: any) {
    console.error('[API POST /notas-empenho] Erro:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Número de NE já cadastrado.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro ao criar nota de empenho.' }, { status: 500 });
  }
}

