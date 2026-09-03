import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('busca') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
    const offset = (page - 1) * limit;

    let sql = `
      SELECT id, cpf_cnpj as cpfCnpj, nome, rg, orgao_emissor as orgaoEmissor,
             endereco, cep, logradouro, numero, bairro,
             pis, data_expedicao as dataExpedicao,
             cidade, uf, telefone, banco, agencia, conta_corrente as contaCorrente
      FROM credores
      WHERE ativo = 1`;
    const params: any[] = [];

    if (busca) {
      // Busca por nome, CPF/CNPJ formatado OU pelos dígitos puros (sem pontuação)
      const digits = busca.replace(/\D/g, '');
      sql += ` AND (nome LIKE ? OR cpf_cnpj LIKE ? OR REPLACE(REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '') LIKE ?)`;
      params.push(`%${busca}%`, `%${busca}%`, `%${digits}%`);
    }

    // Contar total para paginação
    let countSql = `SELECT COUNT(*) as total FROM credores WHERE ativo = 1`;
    const countParams: any[] = [];
    if (busca) {
      const digits = busca.replace(/\D/g, '');
      countSql += ` AND (nome LIKE ? OR cpf_cnpj LIKE ? OR REPLACE(REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '') LIKE ?)`;
      countParams.push(`%${busca}%`, `%${busca}%`, `%${digits}%`);
    }
    const countResult = await query<any[]>(countSql, countParams);
    const total = countResult[0]?.total || 0;

    sql += ` ORDER BY nome ASC LIMIT ${limit} OFFSET ${offset}`;

    const rows = await query<any[]>(sql, params);

    return NextResponse.json({
      credores: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  });
}

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const body = await request.json();
    const {
      cpfCnpj, nome, rg, orgaoEmissor, pis, dataExpedicao,
      endereco, cep, logradouro, numero, bairro, cidade, uf, telefone,
      banco, agencia, contaCorrente
    } = body;

    if (!cpfCnpj || !nome) {
      return NextResponse.json({ error: 'CPF/CNPJ e Nome são obrigatórios.' }, { status: 400 });
    }

    let usuarioId: string | null = user.id;
    try {
      const userCheck: any = await query('SELECT id FROM usuarios WHERE id = ?', [usuarioId]);
      if (!userCheck || userCheck.length === 0) {
        usuarioId = null;
      }
    } catch {
      usuarioId = null;
    }

    const dataExpFormatada = dataExpedicao && String(dataExpedicao).trim().length >= 8 ? String(dataExpedicao).trim() : null;
    const enderecoFinal = endereco?.trim() || [logradouro, numero ? `Nº ${numero}` : '', bairro, cidade, uf].filter(Boolean).join(', ') || null;

    const id = crypto.randomUUID();

    await query(
      `INSERT INTO credores (id, cpf_cnpj, nome, rg, orgao_emissor, pis, data_expedicao, endereco, cep, logradouro, numero, bairro, cidade, uf, telefone, banco, agencia, conta_corrente, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        cpfCnpj.trim(),
        nome.trim(),
        rg?.trim() || 'ISENTO',
        orgaoEmissor?.trim() || null,
        pis?.trim() || null,
        dataExpFormatada,
        enderecoFinal,
        cep?.trim() || null,
        logradouro?.trim() || null,
        numero?.trim() || null,
        bairro?.trim() || null,
        cidade?.trim() || null,
        uf?.trim() || null,
        telefone?.trim() || null,
        banco?.trim() || null,
        agencia?.trim() || null,
        contaCorrente?.trim() || null,
        usuarioId
      ]
    );

    return NextResponse.json({ success: true, id }, { status: 201 });
  });
}
