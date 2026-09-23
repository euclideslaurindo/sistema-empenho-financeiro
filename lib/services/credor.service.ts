import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { isValidCpfCnpj } from '@/lib/utils';
import { CredorDB } from '@/lib/types/db';

export type ServiceResult<T = any> =
  | { success: true; data: T; status?: number }
  | { success: false; error: string; status: number };

async function resolveUsuarioId(usuarioId: string): Promise<string | null> {
  try {
    const userCheck = await query<{ id: string }[]>('SELECT id FROM usuarios WHERE id = ?', [usuarioId]);
    return userCheck && userCheck.length > 0 ? usuarioId : null;
  } catch {
    return null;
  }
}

function montarEnderecoFinal(body: any): string | null {
  const { endereco, logradouro, numero, bairro, cidade, uf } = body;
  return endereco?.trim() || [logradouro, numero ? `Nº ${numero}` : '', bairro, cidade, uf].filter(Boolean).join(', ') || null;
}

function formatarDataExpedicao(dataExpedicao: any): string | null {
  return dataExpedicao && String(dataExpedicao).trim().length >= 8 ? String(dataExpedicao).trim() : null;
}

export class CredorService {
  static async listar(params: { busca?: string | null; page?: number; limit?: number }) {
    const { busca = '', page = 1, limit = 50 } = params;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT id, cpf_cnpj as cpfCnpj, nome, rg, orgao_emissor as orgaoEmissor,
             endereco, cep, logradouro, numero, bairro,
             pis, data_expedicao as dataExpedicao,
             cidade, uf, telefone, banco, agencia, conta_corrente as contaCorrente, pix, is_mei as isMei
      FROM credores
      WHERE ativo = 1`;
    const sqlParams: any[] = [];

    let countSql = `SELECT COUNT(*) as total FROM credores WHERE ativo = 1`;
    const countParams: any[] = [];

    if (busca) {
      const digits = busca.replace(/\D/g, '');
      const buscaFormatada = busca.trim();
      const clause = ` AND (nome LIKE ? OR cpf_cnpj LIKE ?`;
      sql += clause;
      countSql += clause;
      sqlParams.push(`%${buscaFormatada}%`, `%${buscaFormatada}%`);
      countParams.push(`%${buscaFormatada}%`, `%${buscaFormatada}%`);
      // Só aplica REPLACE (sem índice) quando a busca tem dígitos parciais
      if (digits && digits !== buscaFormatada) {
        const replaceClause = ` OR REPLACE(REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '') LIKE ?`;
        sql += replaceClause;
        countSql += replaceClause;
        sqlParams.push(`%${digits}%`);
        countParams.push(`%${digits}%`);
      }
      sql += ')';
      countSql += ')';
    }

    const countResult = await query<{ total: number }[]>(countSql, countParams);
    const total = countResult[0]?.total || 0;

    sql += ' ORDER BY nome ASC LIMIT ? OFFSET ?';
    sqlParams.push(limit, offset);

    const rows = await query<Partial<CredorDB>[]>(sql, sqlParams);

    return {
      success: true as const,
      data: {
        credores: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    };
  }

  static async criar(body: any, usuarioIdSolicitante: string): Promise<ServiceResult> {
    const { cpfCnpj, nome, rg, orgaoEmissor, pis, dataExpedicao, cep, logradouro, numero, bairro, cidade, uf, telefone, banco, agencia, contaCorrente, pix, isMei } = body;

    if (!cpfCnpj || !nome) {
      return { success: false, error: 'CPF/CNPJ e Nome são obrigatórios.', status: 400 };
    }
    if (!isValidCpfCnpj(cpfCnpj)) {
      return { success: false, error: 'CPF ou CNPJ inválido. Verifique os dígitos digitados.', status: 400 };
    }

    const usuarioId = await resolveUsuarioId(usuarioIdSolicitante);
    const dataExpFormatada = formatarDataExpedicao(dataExpedicao);
    const enderecoFinal = montarEnderecoFinal(body);
    const id = crypto.randomUUID();

    try {
      await query(
        `INSERT INTO credores (id, cpf_cnpj, nome, rg, orgao_emissor, pis, data_expedicao, endereco, cep, logradouro, numero, bairro, cidade, uf, telefone, banco, agencia, conta_corrente, pix, is_mei, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, cpfCnpj.trim(), nome.trim(), rg?.trim() || 'ISENTO', orgaoEmissor?.trim() || null,
          pis?.trim() || null, dataExpFormatada, enderecoFinal, cep?.trim() || null, logradouro?.trim() || null,
          numero?.trim() || null, bairro?.trim() || null, cidade?.trim() || null, uf?.trim() || null,
          telefone?.trim() || null, banco?.trim() || null, agencia?.trim() || null, contaCorrente?.trim() || null,
          pix?.trim() || null, isMei ? 1 : 0, usuarioId,
        ]
      );
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        return { success: false, error: 'Este CPF/CNPJ já está cadastrado no sistema.', status: 409 };
      }
      throw err;
    }

    return { success: true, data: { id }, status: 201 };
  }

  static async atualizar(id: string, body: any, usuarioIdSolicitante: string): Promise<ServiceResult> {
    const { nome, cpfCnpj, pis, rg, orgaoEmissor, dataExpedicao, banco, agencia, contaCorrente, telefone, cidade, uf, cep, logradouro, numero, bairro, pix, isMei } = body;

    if (!nome || !cpfCnpj) {
      return { success: false, error: 'Nome e CPF/CNPJ são obrigatórios.', status: 400 };
    }
    if (!isValidCpfCnpj(cpfCnpj)) {
      return { success: false, error: 'CPF ou CNPJ inválido. Verifique os dígitos digitados.', status: 400 };
    }

    try {
      await withTransaction(async (conn: PoolConnection) => {
        // Lock pessimista: evita corrida entre edições simultâneas do mesmo credor
        const [rows]: any = await conn.execute('SELECT id FROM credores WHERE id = ? AND ativo = 1 FOR UPDATE', [id]);
        if (!rows || rows.length === 0) {
          throw { status: 404, error: 'Credor não encontrado.' };
        }

        const [existing]: any = await conn.execute(
          'SELECT id, nome FROM credores WHERE cpf_cnpj = ? AND id != ? AND ativo = 1',
          [cpfCnpj, id]
        );
        if (existing && existing.length > 0) {
          throw { status: 409, error: `CPF/CNPJ já cadastrado para o credor "${existing[0].nome}".` };
        }

        let usuarioId: string | null = usuarioIdSolicitante;
        try {
          const [userCheck]: any = await conn.execute('SELECT id FROM usuarios WHERE id = ?', [usuarioId]);
          if (!userCheck || userCheck.length === 0) usuarioId = null;
        } catch {
          usuarioId = null;
        }

        const enderecoFinal = montarEnderecoFinal(body);
        const dataExpFormatada = formatarDataExpedicao(dataExpedicao);

        // Construção dinâmica do UPDATE para evitar erros de posição com 20+ parâmetros
        const updateFields: Record<string, any> = {
          nome: nome.trim(),
          endereco: enderecoFinal,
          cpf_cnpj: cpfCnpj.trim(),
          pis: pis?.trim() || null,
          rg: rg?.trim() || 'ISENTO',
          orgao_emissor: orgaoEmissor?.trim() || null,
          data_expedicao: dataExpFormatada,
          cidade: cidade?.trim() || null,
          uf: uf?.trim() || null,
          telefone: telefone?.trim() || null,
          banco: banco?.trim() || null,
          agencia: agencia?.trim() || null,
          conta_corrente: contaCorrente?.trim() || null,
          cep: cep?.trim() || null,
          logradouro: logradouro?.trim() || null,
          numero: numero?.trim() || null,
          bairro: bairro?.trim() || null,
          pix: pix?.trim() || null,
          is_mei: isMei ? 1 : 0,
          usuario_id: usuarioId,
        };
        const setClauses = Object.keys(updateFields).map(col => `${col} = ?`).join(', ');
        const values = [...Object.values(updateFields), id];

        await conn.execute(`UPDATE credores SET ${setClauses} WHERE id = ? AND ativo = 1`, values);
      });
    } catch (error: any) {
      if (error.status && error.error) {
        return { success: false, error: error.error, status: error.status };
      }
      throw error;
    }

    return { success: true, data: null };
  }

  static async excluir(id: string, perfilSolicitante: string): Promise<ServiceResult> {
    if (perfilSolicitante === 'CONSULTA') {
      return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
    }

    try {
      await withTransaction(async (conn: PoolConnection) => {
        const [credorData]: any = await conn.execute('SELECT cpf_cnpj FROM credores WHERE id = ? AND ativo = 1 FOR UPDATE', [id]);
        if (!credorData || credorData.length === 0) {
          throw { status: 404, error: 'Credor não encontrado.' };
        }

        const cpfCnpj = credorData[0].cpf_cnpj;
        const [opSum]: any = await conn.execute('SELECT COUNT(*) as total FROM ordens_pagamento WHERE credor_cpf_cnpj = ?', [cpfCnpj]);
        const totalOps = parseInt(opSum[0]?.total || 0);

        if (totalOps > 0) {
          throw {
            status: 409,
            error: `Não é possível excluir este credor pois existem ${totalOps} ordem(ns) de pagamento vinculada(s) a ele. O sistema necessita preservar o histórico.`,
          };
        }

        // Soft delete: apenas inativa o credor para preservar dados associados (logs, etc.)
        await conn.execute('UPDATE credores SET ativo = 0 WHERE id = ?', [id]);
      });
    } catch (error: any) {
      if (error.status && error.error) {
        return { success: false, error: error.error, status: error.status };
      }
      throw error;
    }

    return { success: true, data: null };
  }
}
