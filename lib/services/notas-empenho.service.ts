import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';
import { NotaEmpenhoDB } from '@/lib/types/db';

export type ServiceResult<T = any> =
  | { success: true; data: T; status?: number }
  | { success: false; error: string; status: number };

// Schema de validação do payload de criação, no formato que o BACKEND espera
// (numero/valor) — não confundir com lib/schemas.ts::notaEmpenhoSchema, que
// valida o formulário do FRONTEND (numeroNE/valorNE), formato diferente.
export const criarNotaEmpenhoSchema = z.object({
  codigo: z.string().optional(),
  numero: z.string().min(1, 'Número da NE é obrigatório.'),
  valor: z.union([z.string(), z.number()]).transform(val => {
    if (typeof val === 'number') return val;
    const str = String(val).trim();
    const clean = str.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  }).refine(val => val > 0, { message: 'O valor da NE deve ser maior que zero.' }),
  dataPagamento: z.string().optional().nullable(),
  unidadeOrcamentaria: z.string().optional(),
  elementoSubelemento: z.string().optional(),
  elemento: z.string().optional(),
  subelemento: z.string().optional(),
  gestao: z.string().optional(),
  historico: z.string().optional(),
  status: z.string().optional().default('EMITIDO'),
  dataProvisaoConcedida: z.string().optional().nullable(),
  dataEmissao: z.string().optional().nullable(),
  credorNome: z.string().optional().nullable(),
  cpfCnpj: z.string().optional().nullable(),
});

async function resolveUsuarioId(conn: PoolConnection, usuarioId: string): Promise<string | null> {
  try {
    const [userCheck]: any = await conn.execute('SELECT id FROM usuarios WHERE id = ?', [usuarioId]);
    return userCheck && userCheck.length > 0 ? usuarioId : null;
  } catch {
    return null;
  }
}

export class NotasEmpenhoService {
  static async listar(params: { busca?: string; page?: number; limit?: number }) {
    const { busca = '', page = 1, limit = 50 } = params;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT
        ne.id, ne.codigo, ne.numero, ne.valor,
        DATE_FORMAT(ne.data_pagamento, '%Y-%m-%d') as dataPagamento,
        DATE_FORMAT(ne.data_provisao_concedida, '%Y-%m-%d') as dataProvisaoConcedida,
        DATE_FORMAT(ne.data_emissao, '%Y-%m-%d') as dataEmissao,
        ne.unidade_orcamentaria as unidadeOrcamentaria,
        ne.elemento, ne.subelemento,
        ne.gestao, ne.status, ne.historico, ne.created_at,
        ne.credor_nome as credorNome, ne.cpf_cnpj as cpfCnpj,
        (ne.valor - COALESCE(
          (SELECT SUM(op.valor_pagamento) FROM ordens_pagamento op WHERE op.numero_ne = ne.numero),
        0)) as saldoDisponivel,
        u.nome as quemAtualizou
      FROM notas_empenho ne
      LEFT JOIN usuarios u ON ne.usuario_id = u.id
      WHERE 1=1`;
    const sqlParams: any[] = [];

    if (busca) {
      sql += ' AND (ne.numero LIKE ?)';
      sqlParams.push(`%${busca}%`);
    }

    let countSql = `SELECT COUNT(*) as total FROM notas_empenho ne WHERE 1=1`;
    if (busca) countSql += ' AND (ne.numero LIKE ?)';
    const countParams = busca ? [`%${busca}%`] : [];
    const countResult = await query<{ total: number }[]>(countSql, countParams);
    const total = countResult[0]?.total || 0;

    sql += ' ORDER BY ne.created_at DESC LIMIT ? OFFSET ?';
    sqlParams.push(limit, offset);

    const rows = await query<Partial<NotaEmpenhoDB>[]>(sql, sqlParams);

    return {
      success: true as const,
      data: {
        notas: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    };
  }

  static async buscarPorNumero(numero: string): Promise<ServiceResult> {
    const rows = await query<Partial<NotaEmpenhoDB>[]>(
      `SELECT
         ne.id, ne.codigo, ne.numero, ne.valor,
         DATE_FORMAT(ne.data_pagamento, '%Y-%m-%d') as dataPagamento,
         DATE_FORMAT(ne.data_provisao_concedida, '%Y-%m-%d') as dataProvisaoConcedida,
         DATE_FORMAT(ne.data_emissao, '%Y-%m-%d') as dataEmissao,
         ne.unidade_orcamentaria as unidadeOrcamentaria,
         ne.elemento, ne.subelemento,
         ne.gestao, ne.status, ne.historico,
         ne.credor_nome as credorNome, ne.cpf_cnpj as cpfCnpj,
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
      return { success: false, error: 'NE não encontrada.', status: 404 };
    }
    return { success: true, data: rows[0] };
  }

  static async criar(rawData: any, usuarioIdSolicitante: string): Promise<ServiceResult> {
    const parsed = criarNotaEmpenhoSchema.parse(rawData);
    const { numero, valor: valorDecimal, dataPagamento, unidadeOrcamentaria, elemento, subelemento, gestao, historico, status, dataProvisaoConcedida, dataEmissao, credorNome, cpfCnpj } = parsed;

    const result = await withTransaction(async (conn: PoolConnection) => {
      const [existing]: any = await conn.execute('SELECT id FROM notas_empenho WHERE numero = ?', [numero.trim()]);
      if (existing && existing.length > 0) {
        return { error: `A NE "${numero}" já está cadastrada no sistema.`, status: 409 };
      }

      const id = crypto.randomUUID();
      const exercicio = dataPagamento ? dataPagamento.substring(0, 4) : new Date().getFullYear().toString();
      const usuarioId = await resolveUsuarioId(conn, usuarioIdSolicitante);

      await conn.execute(
        `INSERT INTO notas_empenho (id, exercicio, numero, valor, data_pagamento, data_provisao_concedida, data_emissao, unidade_orcamentaria, elemento, subelemento, gestao, status, historico, usuario_id, credor_nome, cpf_cnpj)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, exercicio, numero.trim(), valorDecimal, dataPagamento || null, dataProvisaoConcedida || null, dataEmissao || null,
         unidadeOrcamentaria?.trim() || '', elemento?.trim() || '', subelemento?.trim() || '',
         gestao?.trim() || '', status || 'EMITIDO', historico?.trim() || '', usuarioId, credorNome?.trim() || null, cpfCnpj?.trim() || null]
      );

      return { success: true, id, status: 201 };
    });

    if (result.error) {
      return { success: false, error: result.error, status: result.status };
    }
    return { success: true, data: { id: result.id }, status: result.status };
  }

  static async atualizar(id: string, body: any, usuarioIdSolicitante: string): Promise<ServiceResult> {
    const { numero, valor, dataPagamento, unidadeOrcamentaria, elemento, subelemento, gestao, historico, status, dataProvisaoConcedida, dataEmissao, credorNome, cpfCnpj } = body;

    const valorDecimal = parseFloat(String(valor).replace(',', '.')) || 0;
    if (valorDecimal <= 0) {
      return { success: false, error: 'O valor da NE deve ser maior que zero.', status: 400 };
    }

    try {
      await withTransaction(async (conn: PoolConnection) => {
        const [neRows]: any = await conn.execute('SELECT numero, valor, unidade_orcamentaria FROM notas_empenho WHERE id = ? FOR UPDATE', [id]);
        if (!neRows || neRows.length === 0) {
          throw { status: 404, error: 'Nota de empenho não encontrada.' };
        }

        const numeroAntigo = neRows[0].numero;
        const numeroNovo = numero?.trim() || '';

        if (numeroNovo !== numeroAntigo) {
          const [duplicateCheck]: any = await conn.execute('SELECT id FROM notas_empenho WHERE numero = ? AND id != ?', [numeroNovo, id]);
          if (duplicateCheck && duplicateCheck.length > 0) {
            throw { status: 409, error: `O número da NE "${numeroNovo}" já está cadastrado em outra nota de empenho.` };
          }
        }

        const [opSum]: any = await conn.execute(
          `SELECT COALESCE(SUM(op.valor_pagamento), 0) as total_pago
           FROM ordens_pagamento op
           INNER JOIN notas_empenho ne ON op.numero_ne = ne.numero
           WHERE ne.id = ?`,
          [id]
        );
        const totalPago = parseFloat(opSum[0]?.total_pago || 0);

        if (valorDecimal < totalPago) {
          throw { status: 409, error: `Não é possível reduzir o valor da NE para R$ ${valorDecimal.toFixed(2)} pois já foram geradas OPs no valor total de R$ ${totalPago.toFixed(2)}.` };
        }

        // tabela de dotação ainda não existe no banco — sem ajuste de saldo aqui

        const usuarioId = await resolveUsuarioId(conn, usuarioIdSolicitante);

        await conn.execute(
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

        // A FK fk_op_ne em database.sql já possui ON UPDATE CASCADE,
        // então o MySQL atualiza ordens_pagamento.numero_ne automaticamente.
      });
    } catch (error: any) {
      if (error.status && error.error) {
        return { success: false, error: error.error, status: error.status };
      }
      throw error;
    }

    return { success: true, data: null };
  }

  static async cancelar(id: string): Promise<ServiceResult> {
    try {
      await withTransaction(async (conn: PoolConnection) => {
        const [neRows]: any = await conn.execute('SELECT valor, unidade_orcamentaria FROM notas_empenho WHERE id = ? FOR UPDATE', [id]);
        if (!neRows || neRows.length === 0) {
          throw { status: 404, error: 'Nota de empenho não encontrada.' };
        }

        const [opsVinculadas]: any = await conn.execute(
          `SELECT COUNT(*) as total FROM ordens_pagamento op
           INNER JOIN notas_empenho ne ON op.numero_ne = ne.numero
           WHERE ne.id = ?`,
          [id]
        );

        const totalOps = parseInt(opsVinculadas[0]?.total || 0);
        if (totalOps > 0) {
          throw { status: 409, error: `Não é possível cancelar esta NE pois existem ${totalOps} ordem(ns) de pagamento vinculada(s). Exclua as OPs primeiro.` };
        }

        // estorno desativado pq n tem tabela de dotacao ainda

        await conn.execute("UPDATE notas_empenho SET status = 'CANCELADO' WHERE id = ?", [id]);
      });
    } catch (error: any) {
      if (error.status && error.error) {
        return { success: false, error: error.error, status: error.status };
      }
      throw error;
    }

    return { success: true, data: null };
  }

  static async verificarDuplicidade(valorParam: string | null, credorParam: string, subelementoParam: string) {
    if (!valorParam) return { duplicado: false };

    const valor = parseFloat(valorParam);
    if (isNaN(valor)) return { duplicado: false };

    // Duplicidade = mesmo Valor + mesmo Credor + mesmo Subelemento
    const rows = await query<{ numero: string; data_emissao: Date }[]>(
      `SELECT numero, data_emissao FROM notas_empenho
       WHERE valor = ?
         AND (credor_nome = ? OR ? = '')
         AND (subelemento = ? OR ? = '')
       LIMIT 1`,
      [valor, credorParam, credorParam, subelementoParam, subelementoParam]
    );

    if (rows && rows.length > 0) {
      return { duplicado: true, nota: rows[0] };
    }
    return { duplicado: false };
  }
}
