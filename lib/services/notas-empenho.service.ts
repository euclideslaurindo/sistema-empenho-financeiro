import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';
import { NotaEmpenhoDB } from '@/lib/types/db';
import { parseFormNumber } from '@/lib/utils';
import { formatarBRL, lerValorMonetario, toCents } from '@/lib/money';
import { statusPeloSaldo } from '@/lib/status-ne';
import { montarSaldo, saldoParaResposta } from '@/lib/services/saldo-ne';

/** Acrescenta `saldo` (valor, gasto, restante, % gasto, qtd. de OPs) a partir das colunas da própria consulta (T31). */
const comSaldo = <T extends Record<string, any>>(ne: T) => {
  const { gasto, qtdOps, ...resto } = ne;
  return { ...resto, saldo: saldoParaResposta(montarSaldo(ne.valor, gasto, qtdOps)) };
};

export type ServiceResult<T = any> =
  | { success: true; data: T; status?: number }
  | { success: false; error: string; status: number };

// T30 (rodada 2): a NE não tem mais credor. Os credores são escolhidos na
// Ordem de Pagamento; ne_credores (T15) fica no banco sem uso (D36) e os
// campos de credor que ainda chegarem no payload são ignorados.

async function registrarAuditoriaNe(
  conn: PoolConnection,
  neId: string,
  acao: 'CREATE' | 'UPDATE',
  antes: unknown,
  depois: unknown,
  usuarioId: string | null
) {
  await conn.execute(
    `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), 'notas_empenho', neId, acao, antes ? JSON.stringify(antes) : null, JSON.stringify(depois), usuarioId]
  );
}

// Schema de validação do payload de criação, no formato que o BACKEND espera
// (numero/valor) — não confundir com lib/schemas.ts::notaEmpenhoSchema, que
// valida o formulário do FRONTEND (numeroNE/valorNE), formato diferente.
export const criarNotaEmpenhoSchema = z.object({
  codigo: z.string().optional(),
  numero: z.string().min(1, 'Número da NE é obrigatório.'),
  // Mesmo leitor da tela: "100.00" é R$ 100,00, não 10.000 (defesa em profundidade).
  valor: z.union([z.string(), z.number()]).transform(val => lerValorMonetario(val))
    .refine(val => val > 0, { message: 'O valor da NE deve ser maior que zero.' }),
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
  // Aceitos por compatibilidade e IGNORADOS (T30): a NE não tem credor.
  credorNome: z.unknown().optional(),
  cpfCnpj: z.unknown().optional(),
  credores: z.unknown().optional(),
});

async function resolveUsuarioId(conn: PoolConnection, usuarioId: string): Promise<string | null> {
  try {
    const [userCheck]: any = await conn.execute('SELECT id FROM usuarios WHERE id = ?', [usuarioId]);
    return userCheck && userCheck.length > 0 ? usuarioId : null;
  } catch {
    return null;
  }
}


const SELECT_NE = `
        ne.id, ne.codigo, ne.numero, ne.valor,
        DATE_FORMAT(ne.data_pagamento, '%Y-%m-%d') as dataPagamento,
        DATE_FORMAT(ne.data_provisao_concedida, '%Y-%m-%d') as dataProvisaoConcedida,
        DATE_FORMAT(ne.data_emissao, '%Y-%m-%d') as dataEmissao,
        ne.unidade_orcamentaria as unidadeOrcamentaria,
        ne.elemento, ne.subelemento,
        ne.gestao, ne.status, ne.historico,
        DATE_FORMAT(ne.created_at, '%Y-%m-%d') as criadaEm,
        ne.credor_nome as credorNome, ne.cpf_cnpj as cpfCnpj,
        (ne.valor - COALESCE(op_sum.total_pago, 0)) as saldoDisponivel,
        COALESCE(op_sum.total_pago, 0) as gasto,
        COALESCE(op_sum.qtd, 0) as qtdOps`;

export class NotasEmpenhoService {
  static async listar(params: { busca?: string; page?: number; limit?: number }) {
    const { busca = '', page = 1, limit = 50 } = params;
    const offset = (page - 1) * limit;

    // LEFT JOIN com subquery pré-agregada (GROUP BY), em vez de subquery
    // correlacionada por linha. Evita recalcular o SUM uma vez por linha.
    // credorNome/cpfCnpj só existem em NEs antigas (T30); continuam na
    // resposta para consulta e impressão.
    let sql = `
      SELECT ${SELECT_NE}, ne.created_at,
        u.nome as quemAtualizou
      FROM notas_empenho ne
      LEFT JOIN usuarios u ON ne.usuario_id = u.id
      LEFT JOIN (
        SELECT numero_ne, SUM(valor_pagamento) as total_pago, COUNT(*) as qtd
        FROM ordens_pagamento
        GROUP BY numero_ne
      ) op_sum ON op_sum.numero_ne = ne.numero
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

    const notas = (await query<Partial<NotaEmpenhoDB>[]>(sql, sqlParams)).map(comSaldo);

    return {
      success: true as const,
      data: {
        notas,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    };
  }

  static async buscarPorNumero(numero: string): Promise<ServiceResult> {
    const rows = await query<Partial<NotaEmpenhoDB>[]>(
      `SELECT ${SELECT_NE}
       FROM notas_empenho ne
       LEFT JOIN (
         SELECT numero_ne, SUM(valor_pagamento) as total_pago, COUNT(*) as qtd
         FROM ordens_pagamento
         GROUP BY numero_ne
       ) op_sum ON op_sum.numero_ne = ne.numero
       WHERE ne.numero = ?`,
      [numero.trim()]
    );
    if (!rows || rows.length === 0) {
      return { success: false, error: 'NE não encontrada.', status: 404 };
    }
    return { success: true, data: comSaldo(rows[0]) };
  }

  static async criar(rawData: any, usuarioIdSolicitante: string, perfilSolicitante: string): Promise<ServiceResult> {
    if (perfilSolicitante === 'CONSULTA') {
      return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
    }

    const parsed = criarNotaEmpenhoSchema.parse(rawData);
    // `status` do payload é ignorado: NE nova ainda não tem OP, então é sempre EMITIDO.
    // Credor (credores/credorNome/cpfCnpj) também é ignorado: a NE não tem credor (T30).
    const { numero, valor: valorDecimal, dataPagamento, unidadeOrcamentaria, elemento, subelemento, gestao, historico, dataProvisaoConcedida, dataEmissao } = parsed;
    const status = 'EMITIDO';

    let result: { id: string };
    try {
      result = await withTransaction(async (conn: PoolConnection) => {
        const [existing]: any = await conn.execute('SELECT id FROM notas_empenho WHERE numero = ?', [numero.trim()]);
        if (existing && existing.length > 0) {
          throw { status: 409, error: `A NE "${numero}" já está cadastrada no sistema.` };
        }

        const id = crypto.randomUUID();
        // D42: ano do número da NE (2026NE000123 -> 2026); senão o da Data de
        // Provisão; senão o ano corrente.
        const anoDoNumero = /^(20\d{2})/.exec(numero.trim())?.[1];
        const anoDaProvisao = dataProvisaoConcedida ? String(dataProvisaoConcedida).substring(0, 4) : null;
        const exercicio = anoDoNumero ?? anoDaProvisao ?? new Date().getFullYear().toString();
        const usuarioId = await resolveUsuarioId(conn, usuarioIdSolicitante);

        await conn.execute(
          `INSERT INTO notas_empenho (id, exercicio, numero, valor, data_pagamento, data_provisao_concedida, data_emissao, unidade_orcamentaria, elemento, subelemento, gestao, status, historico, usuario_id, credor_nome, cpf_cnpj)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, exercicio, numero.trim(), valorDecimal, dataPagamento || null, dataProvisaoConcedida || null, dataEmissao || null,
           unidadeOrcamentaria?.trim() || '', elemento?.trim() || '', subelemento?.trim() || '',
           gestao?.trim() || '', status, historico?.trim() || '', usuarioId, null, null]
        );

        await registrarAuditoriaNe(conn, id, 'CREATE', null, {
          id, numero: numero.trim(), valor: valorDecimal, elemento: elemento?.trim() || '', subelemento: subelemento?.trim() || '',
          status,
        }, usuarioId);

        return { id };
      });
    } catch (error: any) {
      if (error.status && error.error) {
        return { success: false, error: error.error, status: error.status };
      }
      throw error;
    }

    return { success: true, data: { id: result.id }, status: 201 };
  }

  static async atualizar(id: string, body: any, usuarioIdSolicitante: string, perfilSolicitante: string): Promise<ServiceResult> {
    if (perfilSolicitante === 'CONSULTA') {
      return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
    }

    // `status` do payload é ignorado: ele é derivado do saldo mais abaixo
    // (antes, a tela mandava sempre EMITIDO e reabria NE parcial/liquidada/cancelada).
    // Credor também é ignorado (T30): ne_credores e credor_nome/cpf_cnpj de NEs
    // antigas ficam como estão.
    const { numero, valor, dataPagamento, unidadeOrcamentaria, elemento, subelemento, gestao, historico, dataProvisaoConcedida, dataEmissao } = body;
    const veio = (campo: string) => Object.prototype.hasOwnProperty.call(body ?? {}, campo);

    if (!String(numero ?? '').trim()) {
      return { success: false, error: 'Número da NE é obrigatório.', status: 400 };
    }
    const valorDecimal = parseFormNumber(valor);
    if (valorDecimal <= 0) {
      return { success: false, error: 'O valor da NE deve ser maior que zero.', status: 400 };
    }
    const valorCents = toCents(valorDecimal);

    try {
      await withTransaction(async (conn: PoolConnection) => {
        const [neRows]: any = await conn.execute('SELECT * FROM notas_empenho WHERE id = ? FOR UPDATE', [id]);
        if (!neRows || neRows.length === 0) {
          throw { status: 404, error: 'Nota de empenho não encontrada.' };
        }
        const neAntes = neRows[0];

        const numeroAntigo = neAntes.numero;
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
        // Comparação em centavos (T31). Continua 409 com a mesma mensagem (D46).
        const gastoCents = toCents(opSum[0]?.total_pago ?? 0);
        if (valorCents < gastoCents) {
          throw { status: 409, error: `Não é possível reduzir o valor da NE para R$ ${formatarBRL(valorCents)} pois já foram geradas OPs no valor total de R$ ${formatarBRL(gastoCents)}.` };
        }
        const status = statusPeloSaldo(valorCents, gastoCents, neAntes.status);

        // tabela de dotação ainda não existe no banco — sem ajuste de saldo aqui

        const usuarioId = await resolveUsuarioId(conn, usuarioIdSolicitante);

        // T29: a tela não tem mais Data de Pagamento/Data de Emissão. Essas
        // colunas só são gravadas se a chave vier no payload (compatibilidade);
        // sem ela, o valor de NEs antigas fica como está.
        const colunas: Record<string, any> = {
          numero: numeroNovo,
          valor: valorDecimal,
          data_provisao_concedida: dataProvisaoConcedida || null,
          unidade_orcamentaria: unidadeOrcamentaria?.trim() || '',
          elemento: elemento?.trim() || '',
          subelemento: subelemento?.trim() || '',
          gestao: gestao?.trim() || '',
          status,
          historico: historico?.trim() || '',
          usuario_id: usuarioId,
          ...(veio('dataPagamento') ? { data_pagamento: dataPagamento || null } : {}),
          ...(veio('dataEmissao') ? { data_emissao: dataEmissao || null } : {}),
        };
        // A FK fk_op_ne já tem ON UPDATE CASCADE: renomear a NE atualiza
        // ordens_pagamento.numero_ne. ne_credores (sem uso desde a T30) não
        // acompanha — ninguém mais lê essa tabela.
        await conn.execute(
          `UPDATE notas_empenho SET ${Object.keys(colunas).map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
          [...Object.values(colunas), id]
        );
        // O acompanhamento de DARF não tem FK com a NE: acompanha a troca de
        // número aqui, senão ficava com o número antigo.
        if (numeroNovo !== numeroAntigo) {
          await conn.execute('UPDATE darf_acompanhamento SET numero_ne = ? WHERE numero_ne = ?', [numeroNovo, numeroAntigo]);
        }

        await registrarAuditoriaNe(
          conn,
          id,
          'UPDATE',
          neAntes,
          { id, numero: numeroNovo, valor: valorDecimal, elemento: elemento?.trim() || '', subelemento: subelemento?.trim() || '', status },
          usuarioId
        );
      });
    } catch (error: any) {
      if (error.status && error.error) {
        return { success: false, error: error.error, status: error.status };
      }
      throw error;
    }

    return { success: true, data: null };
  }

  static async cancelar(id: string, perfilSolicitante: string, usuarioIdSolicitante?: string): Promise<ServiceResult> {
    if (perfilSolicitante === 'CONSULTA') {
      return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
    }

    try {
      await withTransaction(async (conn: PoolConnection) => {
        const [neRows]: any = await conn.execute('SELECT numero, valor, status FROM notas_empenho WHERE id = ? FOR UPDATE', [id]);
        if (!neRows || neRows.length === 0) {
          throw { status: 404, error: 'Nota de empenho não encontrada.' };
        }
        const neAntes = neRows[0];
        if (neAntes.status === 'CANCELADO') {
          throw { status: 409, error: 'Esta NE já está cancelada.' };
        }

        const [opsVinculadas]: any = await conn.execute(
          `SELECT COUNT(*) as total FROM ordens_pagamento op
           INNER JOIN notas_empenho ne ON op.numero_ne = ne.numero
           WHERE ne.id = ?`,
          [id]
        );

        const totalOps = parseInt(opsVinculadas[0]?.total || 0);
        if (totalOps > 0) {
          throw { status: 409, error: `Não é possível cancelar esta NE pois existem ${totalOps} ordem(ns) de pagamento vinculada(s). Um administrador pode excluir as OPs em Ordem de Pagamento > Ordens Recentes.` };
        }

        // estorno desativado pq n tem tabela de dotacao ainda

        await conn.execute("UPDATE notas_empenho SET status = 'CANCELADO' WHERE id = ?", [id]);
        // Cancelar não tem volta: fica na auditoria quem cancelou e quando
        // (como UPDATE de status, nos valores já usados pela coluna `acao`).
        const usuarioId = usuarioIdSolicitante ? await resolveUsuarioId(conn, usuarioIdSolicitante) : null;
        await registrarAuditoriaNe(
          conn,
          id,
          'UPDATE',
          { numero: neAntes.numero, valor: neAntes.valor, status: neAntes.status },
          { numero: neAntes.numero, valor: neAntes.valor, status: 'CANCELADO' },
          usuarioId
        );
      });
    } catch (error: any) {
      if (error.status && error.error) {
        return { success: false, error: error.error, status: error.status };
      }
      throw error;
    }

    return { success: true, data: null };
  }

  /**
   * Aviso de NE parecida (D33): mesmo valor + mesmo elemento + mesmo
   * subelemento (cada um só conta se informado). É só aviso. Credor/CPF
   * ainda podem chegar (cliente antigo), mas não entram na regra (T30).
   * Devolve os dados que o "Carregar dados da NE" usa para preencher a tela.
   */
  static async verificarDuplicidade(p: { valor: string | null; elemento?: string; subelemento?: string; ignorarId?: string }) {
    if (!p.valor) return { duplicado: false };

    const valor = parseFloat(p.valor);
    if (isNaN(valor)) return { duplicado: false };
    const elemento = (p.elemento || '').trim();
    const subelemento = (p.subelemento || '').trim();
    // A NE em edição não é "parecida" com ela mesma, e NE cancelada não conta.
    const ignorarId = (p.ignorarId || '').trim();

    const rows = await query<any[]>(
      `SELECT ne.id, ne.numero, ne.valor, ne.elemento, ne.subelemento,
              ne.unidade_orcamentaria as unidadeOrcamentaria, ne.gestao, ne.historico,
              DATE_FORMAT(ne.data_provisao_concedida, '%Y-%m-%d') as dataProvisaoConcedida,
              DATE_FORMAT(ne.created_at, '%Y-%m-%d') as criadaEm
         FROM notas_empenho ne
        WHERE ne.valor = ?
          AND (ne.elemento = ? OR ? = '')
          AND (ne.subelemento = ? OR ? = '')
          AND ne.status <> 'CANCELADO'
          AND (ne.id <> ? OR ? = '')
        ORDER BY ne.created_at DESC
        LIMIT 1`,
      [valor, elemento, elemento, subelemento, subelemento, ignorarId, ignorarId]
    );

    if (rows && rows.length > 0) {
      return { duplicado: true, nota: rows[0] };
    }
    return { duplicado: false };
  }
}
