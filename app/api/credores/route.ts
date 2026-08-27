import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('busca') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
    const offset = (page - 1) * limit;

    let sql = `
      SELECT id, cpf_cnpj as cpfCnpj, nome, rg, endereco,
             pis, data_expedicao as dataExpedicao,
             cidade, uf, telefone, banco, agencia, conta_corrente as contaCorrente
      FROM credores
      WHERE ativo = 1`;
    const params: any[] = [];

    if (busca) {
      sql += ' AND (nome LIKE ? OR cpf_cnpj LIKE ?)';
      params.push(`%${busca}%`, `%${busca}%`);
    }

    // Contar total
    const countSql = `SELECT COUNT(*) as total FROM credores WHERE ativo = 1${busca ? ' AND (nome LIKE ? OR cpf_cnpj LIKE ?)' : ''}`;
    const countParams = busca ? [`%${busca}%`, `%${busca}%`] : [];
    const countResult = await query<any[]>(countSql, countParams);
    const total = countResult[0]?.total || 0;

    sql += ' ORDER BY nome ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await query<any[]>(sql, params);
    
    return NextResponse.json({
      credores: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('[API GET /credores] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar credores.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { cpfCnpj, nome, rg, endereco, banco, agencia, contaCorrente, telefone, cidade, uf, pis, dataExpedicao } = body;

    if (!cpfCnpj || !nome) {
      return NextResponse.json({ error: 'CPF/CNPJ e Nome são obrigatórios.' }, { status: 400 });
    }

    const id = crypto.randomUUID();

    await query(
      `INSERT INTO credores (id, cpf_cnpj, nome, rg, pis, data_expedicao, endereco, cidade, uf, telefone, banco, agencia, conta_corrente, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        cpfCnpj.trim(), 
        nome.trim(), 
        rg?.trim() || 'ISENTO', 
        pis?.trim() || null, 
        dataExpedicao?.trim() || null, 
        endereco?.trim() || null,
        cidade?.trim() || null,
        uf?.trim() || null,
        telefone?.trim() || null,
        banco?.trim() || null,
        agencia?.trim() || null,
        contaCorrente?.trim() || null,
        user.id
      ]
    );

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: any) {
    console.error('[API POST /credores] Erro:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Este CPF/CNPJ já está cadastrado.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro ao criar credor.' }, { status: 500 });
  }
}
