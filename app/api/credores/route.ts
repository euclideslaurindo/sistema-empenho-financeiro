import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { isValidCpfCnpj } from '@/lib/utils';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('busca') || '';
    const rawPage = parseInt(searchParams.get('page') || '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage);
    const limit = Math.min(100, Math.max(1, Number.isNaN(rawLimit) ? 50 : rawLimit));
    const offset = (page - 1) * limit;

    let sql = `
      SELECT id, cpf_cnpj as cpfCnpj, nome, rg, orgao_emissor as orgaoEmissor,
             endereco, cep, logradouro, numero, bairro,
             pis, data_expedicao as dataExpedicao,
             cidade, uf, telefone, banco, agencia, conta_corrente as contaCorrente, pix, is_mei as isMei
      FROM credores
      WHERE ativo = 1`;
    const params: any[] = [];

    if (busca) {
      const digits = busca.replace(/\D/g, '');
      // Se a busca for só dígitos, pré-formata para CPF/CNPJ para usar o índice
      // evitando REPLACE() em toda a tabela (Full Table Scan)
      const buscaFormatada = busca.trim();
      sql += ` AND (nome LIKE ? OR cpf_cnpj LIKE ?`;
      params.push(`%${buscaFormatada}%`, `%${buscaFormatada}%`);
      // Só aplica REPLACE (sem índice) quando a busca tem dígitos parciais
      if (digits && digits !== buscaFormatada) {
        sql += ` OR REPLACE(REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '') LIKE ?`;
        params.push(`%${digits}%`);
      }
      sql += ')';
    }

    // Contar total para paginação
    let countSql = `SELECT COUNT(*) as total FROM credores WHERE ativo = 1`;
    const countParams: any[] = [];
    if (busca) {
      const digits = busca.replace(/\D/g, '');
      const buscaFormatada = busca.trim();
      countSql += ` AND (nome LIKE ? OR cpf_cnpj LIKE ?`;
      countParams.push(`%${buscaFormatada}%`, `%${buscaFormatada}%`);
      if (digits && digits !== buscaFormatada) {
        countSql += ` OR REPLACE(REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '') LIKE ?`;
        countParams.push(`%${digits}%`);
      }
      countSql += ')';
    }
    const countResult = await query<any[]>(countSql, countParams);
    const total = countResult[0]?.total || 0;

    sql += ' ORDER BY nome ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

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
      banco, agencia, contaCorrente, pix, isMei
    } = body;

    if (!cpfCnpj || !nome) {
      return NextResponse.json({ error: 'CPF/CNPJ e Nome são obrigatórios.' }, { status: 400 });
    }

    if (!isValidCpfCnpj(cpfCnpj)) {
      return NextResponse.json({ error: 'CPF ou CNPJ inválido. Verifique os dígitos digitados.' }, { status: 400 });
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

    try {
      await query(
        `INSERT INTO credores (id, cpf_cnpj, nome, rg, orgao_emissor, pis, data_expedicao, endereco, cep, logradouro, numero, bairro, cidade, uf, telefone, banco, agencia, conta_corrente, pix, is_mei, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          pix?.trim() || null,
          isMei ? 1 : 0,
          usuarioId
        ]
      );
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        return NextResponse.json({ error: 'Este CPF/CNPJ já está cadastrado no sistema.' }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json({ success: true, id }, { status: 201 });
  });
}
