import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';

export type ServiceResult<T = any> = 
  | { success: true; data: T; status?: number }
  | { success: false; error: string; status: number };

// Helper para higienizar números, exatamente como estava na rota antiga
const safeNumber = z.union([z.string(), z.number()]).transform(val => {
  if (typeof val === 'number') return val;
  return parseFloat(String(val)) || 0;
});

// Schema isolado e protegido
const ordemPagamentoSchema = z.object({
  liquidacao_id: z.string().optional().nullable(),
  numeroCheque: z.string().optional().nullable(),
  valorPagamento: safeNumber.refine(val => val > 0, { message: 'O valor do pagamento deve ser maior que zero.' }),
  numeroEmpenho: z.string().min(1, 'O número da Nota de Empenho é obrigatório.'), // Frontend envia como numeroEmpenho, mas é a NE
  sub: z.string().optional(),
  credorNome: z.string().optional(),
  credorCpfCnpj: z.string().optional(),
  credorRg: z.string().optional(),
  credorEndereco: z.string().optional(),
  unidadeOrcamentaria: z.string().optional(),
  elemento: z.string().optional(),
  subelemento: z.string().optional(),
  gestao: z.string().optional(),
  historico: z.string().optional(),
  itens: z.array(z.any()).optional(),
  saldoAnterior: safeNumber.optional(),
  valorEmpenho: safeNumber.optional(),
  irrf: safeNumber.optional(),
  iss: safeNumber.optional(),
  inss: safeNumber.optional(),
  sestSenat: safeNumber.optional(),
  patronal: safeNumber.optional(),
  outrosDescontos: safeNumber.optional(),
  totalDescontos: safeNumber.optional(),
  valorLiquido: safeNumber.optional(),
  dataEmissao: z.string().optional().nullable(),
  dataPagamento: z.string().optional().nullable(),
});

export class OrdemPagamentoService {
  
  static async listar(params: { numeroNe?: string | null; busca?: string | null; page?: number; limit?: number }) {
    const { numeroNe, busca, page = 1, limit = 50 } = params;
    const offset = (page - 1) * limit;

    if (numeroNe) {
      const rows = await query<any[]>(
        `SELECT id, numero_ne as numeroNe, numero_empenho as numeroEmpenho, sub,
                credor_nome as credorNome, credor_cpf_cnpj as credorCpfCnpj, credor_rg as credorRg, credor_endereco as credorEndereco,
                unidade_orcamentaria as unidadeOrcamentaria, elemento, subelemento, gestao, historico,
                itens_json as itensJson,
                saldo_anterior as saldoAnterior, valor_empenho as valorEmpenho, valor_pagamento as valorPagamento,
                irrf, iss, inss, sest_senat as sestSenat, patronal, outros_descontos as outrosDescontos, total_descontos as total_descontos, valor_liquido as valorLiquido,
                numero_cheque as numeroCheque,
                DATE_FORMAT(data_emissao, '%Y-%m-%d') as dataEmissao,
                DATE_FORMAT(data_pagamento, '%Y-%m-%d') as dataPagamento,
                created_at
         FROM ordens_pagamento
         WHERE numero_ne = ?
         ORDER BY created_at ASC`,
        [numeroNe]
      );
      return { success: true as const, data: { ordens: rows } };
    }

    let countSql = 'SELECT COUNT(*) as total FROM ordens_pagamento';
    const countParams: any[] = [];
    if (busca) {
      countSql += ' WHERE credor_nome LIKE ? OR numero_empenho LIKE ? OR credor_cpf_cnpj LIKE ?';
      const b = `%${busca}%`;
      countParams.push(b, b, b);
    }
    const countResult = await query<any[]>(countSql, countParams);
    const total = countResult[0]?.total || 0;

    let sql = `SELECT id, numero_ne as numeroNe, numero_empenho as numeroEmpenho, sub,
              credor_nome as credorNome, credor_cpf_cnpj as credorCpfCnpj,
              valor_pagamento as valorPagamento, valor_liquido as valorLiquido,
              numero_cheque as numeroCheque,
              DATE_FORMAT(data_emissao, '%Y-%m-%d') as dataEmissao,
              DATE_FORMAT(data_pagamento, '%Y-%m-%d') as dataPagamento,
              created_at
       FROM ordens_pagamento`;
    const sqlParams: any[] = [];

    if (busca) {
      sql += ' WHERE credor_nome LIKE ? OR numero_empenho LIKE ? OR credor_cpf_cnpj LIKE ?';
      const b = `%${busca}%`;
      sqlParams.push(b, b, b);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    sqlParams.push(limit, offset);

    const rows = await query<any[]>(sql, sqlParams);
    return {
      success: true as const,
      data: {
        ordens: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      }
    };
  }

  static async criar(rawData: any, usuarioId: string, perfil: string = 'GESTOR'): Promise<ServiceResult> {
    try {
      const parsedData = ordemPagamentoSchema.parse(rawData);

      const toDecimal = (v: any): number => {
        if (typeof v === 'number') return isNaN(v) ? 0 : v;
        return parseFloat(String(v)) || 0;
      };

      const result = await withTransaction(async (conn: PoolConnection) => {
        const {
          liquidacao_id, numeroEmpenho: neReal, sub, credorNome, credorCpfCnpj, credorRg, credorEndereco,
          unidadeOrcamentaria, elemento, subelemento, gestao, historico, itens,
          saldoAnterior, valorEmpenho, valorPagamento: vPagamento,
          irrf, iss, inss, sestSenat, patronal, outrosDescontos, totalDescontos, valorLiquido,
          numeroCheque, dataEmissao, dataPagamento,
        } = parsedData;

        const chequeFormatado = numeroCheque ? numeroCheque.trim() : null;
        if (chequeFormatado) {
          const [existingCheque]: any = await conn.execute(
            'SELECT id FROM ordens_pagamento WHERE numero_cheque = ?',
            [chequeFormatado]
          );
          if (existingCheque && existingCheque.length > 0) {
            throw { status: 409, error: `O cheque nº "${chequeFormatado}" já foi utilizado.` };
          }
        }

        const [neRows]: any = await conn.execute(
          'SELECT id, valor, status FROM notas_empenho WHERE numero = ? FOR UPDATE',
          [neReal]
        );
        if (!neRows || neRows.length === 0) {
          throw { status: 404, error: `NE "${neReal}" não encontrada.` };
        }
        if (neRows[0].status === 'CANCELADO') {
          throw { status: 409, error: `Não é possível criar OP para a NE "${neReal}" pois ela está CANCELADA.` };
        }
        const valorNe = parseFloat(neRows[0].valor) || 0;

        const [paidRows]: any = await conn.execute(
          'SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago FROM ordens_pagamento WHERE numero_ne = ? FOR UPDATE',
          [neReal]
        );
        const totalJaPago = parseFloat(paidRows[0]?.total_pago) || 0;
        const saldoDisponivel = Math.round((valorNe - totalJaPago) * 100) / 100;
        const vPagamentoArredondado = Math.round(vPagamento * 100) / 100;

        if (vPagamentoArredondado > saldoDisponivel) {
          throw {
            status: 422,
            error: `Saldo insuficiente. Saldo disponível da NE: R$ ${saldoDisponivel.toFixed(2).replace('.', ',')}. Valor solicitado: R$ ${vPagamentoArredondado.toFixed(2).replace('.', ',')}`
          };
        }

        let totalItensCalc = 0;
        if (itens && Array.isArray(itens)) {
          itens.forEach((i: any) => {
            totalItensCalc += (Number(i.quantidade) || 0) * toDecimal(i.valorUnitario);
          });
        }
        totalItensCalc = Math.round(totalItensCalc * 100) / 100;
        // Tolerância de 1 centavo para evitar falso positivo por imprecisão IEEE 754
        if (totalItensCalc > 0 && Math.abs(totalItensCalc - vPagamentoArredondado) > 0.01) {
          throw { status: 400, error: `A soma dos itens (R$ ${totalItensCalc.toFixed(2)}) não bate com o valor a pagar da OP (R$ ${vPagamentoArredondado.toFixed(2)}). Fraude detectada.` };
        }

        // arrumei usando MAX no lugar de COUNT pra não dar b.o se deletar alguma op no meio
        const anoAtual = new Date().getFullYear();
        const prefixoOp = `${anoAtual}.OP.%`;
        const [maxOpResult]: any = await conn.execute(
          `SELECT CAST(SUBSTRING_INDEX(numero_empenho, '.', -1) AS UNSIGNED) as seq 
           FROM ordens_pagamento WHERE numero_empenho LIKE ? 
           ORDER BY seq DESC LIMIT 1 FOR UPDATE`,
          [prefixoOp]
        );
        const maxOpNumber = maxOpResult.length > 0 && maxOpResult[0].seq ? Number(maxOpResult[0].seq) : 0;
        const numeroDaOpGerado = `${anoAtual}.OP.${String(maxOpNumber + 1).padStart(4, '0')}`;

        // mesma logica pro sub-empenho
        const [maxSubResult]: any = await conn.execute(
          `SELECT CAST(sub AS UNSIGNED) as seq 
           FROM ordens_pagamento WHERE numero_ne = ? 
           ORDER BY seq DESC LIMIT 1 FOR UPDATE`,
          [neReal]
        );
        const maxSubNumber = maxSubResult.length > 0 && maxSubResult[0].seq ? Number(maxSubResult[0].seq) : 0;
        const subGerado = String(maxSubNumber + 1).padStart(2, '0');

        let finalIrrf = toDecimal(irrf);
        let finalIss = toDecimal(iss);
        let finalInss = toDecimal(inss);
        let finalSestSenat = toDecimal(sestSenat);
        let finalPatronal = toDecimal(patronal);
        let finalOutros = toDecimal(outrosDescontos);
        let finalTotalDescontos = toDecimal(totalDescontos);
        let finalLiquido = toDecimal(valorLiquido);

        // trava de seguranca pros impostos se nao for admin
        if (perfil !== 'ADMIN') {
          finalIrrf = (finalIrrf > 0) ? Math.round((vPagamentoArredondado * 0.015) * 100) / 100 : 0;
          // iss agora da pra editar livre na tela
          finalInss = (finalInss > 0) ? Math.round((vPagamentoArredondado * 0.11) * 100) / 100 : 0;
          finalSestSenat = (finalSestSenat > 0) ? Math.round((vPagamentoArredondado * 0.025) * 100) / 100 : 0;
          finalPatronal = (finalPatronal > 0) ? Math.round((vPagamentoArredondado * 0.20) * 100) / 100 : 0;
          finalOutros = 0;
          finalTotalDescontos = Math.round((finalIrrf + finalIss + finalInss + finalSestSenat + finalPatronal + finalOutros) * 100) / 100;
          finalLiquido = Math.round((vPagamentoArredondado - finalTotalDescontos) * 100) / 100;
        }

        // Guarda de tamanho: evita estouro do max_allowed_packet do MySQL (~16MB padrão)
        const itensJson = itens ? JSON.stringify(itens) : null;
        if (itensJson && itensJson.length > 65535) {
          throw { status: 400, error: 'A lista de itens é muito grande. Reduza a quantidade de itens ou o tamanho das descrições.' };
        }
        const id = crypto.randomUUID();
        await conn.execute(
          `INSERT INTO ordens_pagamento (
            id, liquidacao_id, numero_ne, numero_empenho, sub, credor_nome, credor_cpf_cnpj, credor_rg, credor_endereco,
            unidade_orcamentaria, elemento, subelemento, gestao, historico,
            itens_json,
            saldo_anterior, valor_empenho, valor_pagamento,
            irrf, iss, inss, sest_senat, patronal, outros_descontos, total_descontos, valor_liquido,
            numero_cheque, data_emissao, data_pagamento, usuario_id
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            id, liquidacao_id || null, neReal, numeroDaOpGerado, subGerado,
            credorNome || '', credorCpfCnpj || '', credorRg || '', credorEndereco || '',
            unidadeOrcamentaria || '', elemento || '', subelemento || '', gestao || '', historico || '',
            itensJson,
            toDecimal(saldoAnterior), toDecimal(valorEmpenho), vPagamento,
            finalIrrf, finalIss, finalInss, finalSestSenat, finalPatronal,
            finalOutros, finalTotalDescontos, finalLiquido,
            chequeFormatado, dataEmissao || null, dataPagamento || null, usuarioId
          ]
        );

        const saldoRestante = Math.round((saldoDisponivel - vPagamentoArredondado) * 100) / 100;
        const novoStatus = saldoRestante <= 0 ? 'LIQUIDADO' : saldoRestante < valorNe ? 'PARCIALMENTE PAGO' : 'EMITIDO';
        await conn.execute('UPDATE notas_empenho SET status = ? WHERE numero = ?', [novoStatus, neReal]);

        return { success: true as const, data: { id, saldoRestante }, status: 201 };
      });

      return result;

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return { success: false, error: 'Dados inválidos.', status: 400 }; // Validation catch
      }
      if (error.error && error.status) {
        return { success: false, error: error.error, status: error.status }; // Our custom transaction throws
      }
      console.error('[Service: criarOrdem]', error);
      return { success: false, error: 'Erro interno do servidor', status: 500 };
    }
  }

  static async atualizar(id: string, rawData: any, usuarioId: string, perfil: string = 'GESTOR'): Promise<ServiceResult> {
    try {
      // Correção 1: Forçamos a validação Zod no PUT também! Bypass resolvido.
      const parsedData = ordemPagamentoSchema.parse(rawData);

      const toDecimal = (v: any): number => {
        if (typeof v === 'number') return isNaN(v) ? 0 : v;
        return parseFloat(String(v)) || 0;
      };

      const result = await withTransaction(async (conn: PoolConnection) => {
        const {
          numeroEmpenho: neReal, sub, credorNome, credorCpfCnpj, credorRg, credorEndereco,
          itens, // <-- Array de itens
          saldoAnterior, valorEmpenho, valorPagamento: vPagamento,
          irrf, iss, inss, sestSenat, patronal, outrosDescontos, totalDescontos, valorLiquido,
          numeroCheque, dataEmissao, dataPagamento, historico
        } = parsedData;

        // AUDITORIA: Salvar estado anterior e precaver injeção de NE cruzada
        const [oldOpRows] = await conn.execute<any[]>('SELECT * FROM ordens_pagamento WHERE id = ?', [id]);
        if (!oldOpRows || (oldOpRows as any[]).length === 0) {
          throw { status: 404, error: 'Ordem de pagamento não encontrada.' };
        }
        const oldOp = (oldOpRows as any[])[0];
        const neSegura = oldOp.numero_ne; // Trava absoluta da NE original da OP

        // verifica se o novo valor cabe no saldo antes de atualizar
        const [neRows] = await conn.execute<any[]>(
          `SELECT ne.valor, ne.status,
                  (ne.valor - COALESCE(op_sum.total_pago, 0) + (SELECT valor_pagamento FROM ordens_pagamento WHERE id = ?)) as saldoDisponivel
           FROM notas_empenho ne
           LEFT JOIN (SELECT numero_ne, SUM(valor_pagamento) as total_pago FROM ordens_pagamento GROUP BY numero_ne) op_sum
             ON op_sum.numero_ne = ne.numero
           WHERE ne.numero = ? FOR UPDATE`,
          [id, neSegura]
        );

        let saldoDisp = 0;
        const vPagamentoArredondado = Math.round(vPagamento * 100) / 100;

        if (neRows && (neRows as any[]).length > 0) {
          const neObj = (neRows as any[])[0];
          if (neObj.status === 'CANCELADO') {
            throw { status: 409, error: `Não é possível atualizar OP da NE "${neSegura}" pois ela foi CANCELADA.` };
          }
          saldoDisp = Math.round(parseFloat(neObj.saldoDisponivel) * 100) / 100;
          if (vPagamentoArredondado > saldoDisp) {
            throw { status: 409, error: `Valor do pagamento excede o saldo disponível da NE (R$ ${saldoDisp.toFixed(2)}).` };
          }
        }

        let totalItensCalc = 0;
        if (itens && Array.isArray(itens)) {
          itens.forEach((i: any) => {
            totalItensCalc += (Number(i.quantidade) || 0) * toDecimal(i.valorUnitario);
          });
        }
        totalItensCalc = Math.round(totalItensCalc * 100) / 100;
        if (totalItensCalc > 0 && Math.abs(totalItensCalc - vPagamentoArredondado) > 0) {
          throw { status: 400, error: `A soma dos itens (R$ ${totalItensCalc.toFixed(2)}) não bate com o valor a pagar da OP (R$ ${vPagamentoArredondado.toFixed(2)}). Fraude detectada.` };
        }

        let finalIrrf = toDecimal(irrf);
        let finalIss = toDecimal(iss);
        let finalInss = toDecimal(inss);
        let finalSestSenat = toDecimal(sestSenat);
        let finalPatronal = toDecimal(patronal);
        let finalOutros = toDecimal(outrosDescontos);
        let finalTotalDescontos = toDecimal(totalDescontos);
        let finalLiquido = toDecimal(valorLiquido);

        // trava de seguranca pros impostos se nao for admin
        if (perfil !== 'ADMIN') {
          finalIrrf = (finalIrrf > 0) ? Math.round((vPagamentoArredondado * 0.015) * 100) / 100 : 0;
          // iss agora da pra editar livre na tela
          finalInss = (finalInss > 0) ? Math.round((vPagamentoArredondado * 0.11) * 100) / 100 : 0;
          finalSestSenat = (finalSestSenat > 0) ? Math.round((vPagamentoArredondado * 0.025) * 100) / 100 : 0;
          finalPatronal = (finalPatronal > 0) ? Math.round((vPagamentoArredondado * 0.20) * 100) / 100 : 0;
          finalOutros = 0;
          finalTotalDescontos = Math.round((finalIrrf + finalIss + finalInss + finalSestSenat + finalPatronal + finalOutros) * 100) / 100;
          finalLiquido = Math.round((vPagamentoArredondado - finalTotalDescontos) * 100) / 100;
        }

        // tava dando erro no itens_json antes, agr ta passando certo
        await conn.execute(
          `UPDATE ordens_pagamento SET
            sub = ?, credor_nome = ?, credor_cpf_cnpj = ?, credor_rg = ?, credor_endereco = ?,
            itens_json = ?,
            saldo_anterior = ?, valor_empenho = ?, valor_pagamento = ?,
            irrf = ?, iss = ?, inss = ?, sest_senat = ?, patronal = ?, outros_descontos = ?,
            total_descontos = ?, valor_liquido = ?, numero_cheque = ?, data_emissao = ?, data_pagamento = ?, historico = ?, usuario_id = ?
           WHERE id = ?`,
          [
            sub || '01', credorNome || '', credorCpfCnpj || '', credorRg || '', credorEndereco || '',
            itens ? JSON.stringify(itens) : null,
            toDecimal(saldoAnterior), toDecimal(valorEmpenho), vPagamento,
            finalIrrf, finalIss, finalInss, finalSestSenat, finalPatronal,
            finalOutros, finalTotalDescontos, finalLiquido,
            numeroCheque ? numeroCheque.trim() : null, dataEmissao || null, dataPagamento || null, historico || '', usuarioId, id
          ]
        );

        // AUDITORIA: Salvar estado novo
        const [newOpRows] = await conn.execute<any[]>('SELECT * FROM ordens_pagamento WHERE id = ?', [id]);
        const newOp = newOpRows && (newOpRows as any[]).length > 0 ? (newOpRows as any[])[0] : null;

        if (oldOp && newOp) {
          await conn.execute(
            `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [crypto.randomUUID(), 'ordens_pagamento', id, 'UPDATE', JSON.stringify(oldOp), JSON.stringify(newOp), usuarioId]
          );
        }

        // atualiza status da NE conforme saldo restante
        const [neData] = await conn.execute<any[]>(
          `SELECT ne.valor,
                  (ne.valor - COALESCE(op_sum.total_pago, 0)) as saldoDisponivel
           FROM notas_empenho ne
           LEFT JOIN (SELECT numero_ne, SUM(valor_pagamento) as total_pago FROM ordens_pagamento GROUP BY numero_ne) op_sum
             ON op_sum.numero_ne = ne.numero
           WHERE ne.numero = ? FOR UPDATE`,
          [neSegura]
        );

        if (neData && (neData as any[]).length > 0) {
          const saldo = Math.round(parseFloat((neData as any[])[0].saldoDisponivel) * 100) / 100;
          const valorTotal = Math.round(parseFloat((neData as any[])[0].valor) * 100) / 100;
          let novoStatus = 'EMITIDO';
          if (saldo <= 0) novoStatus = 'LIQUIDADO';
          else if (saldo < valorTotal) novoStatus = 'PARCIALMENTE PAGO';
          await conn.execute('UPDATE notas_empenho SET status = ? WHERE numero = ?', [novoStatus, neSegura]);
        }

        return { success: true as const, data: null, status: 200 };
      });

      return result;

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return { success: false, error: 'Dados inválidos na edição.', status: 400 };
      }
      if (error.error && error.status) {
        return { success: false, error: error.error, status: error.status };
      }
      if (error.code === 'ER_DUP_ENTRY') {
        return { success: false, error: 'Cheque já utilizado.', status: 409 };
      }
      console.error('[Service: atualizarOrdem]', error);
      return { success: false, error: 'Erro ao atualizar ordem de pagamento.', status: 500 };
    }
  }

  static async excluir(id: string, usuarioId: string): Promise<ServiceResult> {
    try {
      const result = await withTransaction(async (conn: PoolConnection) => {
        const [ordens] = await conn.execute<any[]>('SELECT * FROM ordens_pagamento WHERE id = ?', [id]);

        if (!ordens || (ordens as any[]).length === 0) {
          throw { status: 404, error: 'Ordem de pagamento não encontrada.' };
        }
        
        const oldOp = (ordens as any[])[0];
        const numeroNe = oldOp.numero_ne;

        await conn.execute('DELETE FROM ordens_pagamento WHERE id = ?', [id]);

        // AUDITORIA: Salvar exclusão
        await conn.execute(
          `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), 'ordens_pagamento', id, 'DELETE', JSON.stringify(oldOp), null, usuarioId]
        );

        const [neData] = await conn.execute<any[]>(
          `SELECT ne.valor,
                  (ne.valor - COALESCE(op_sum.total_pago, 0)) as saldoDisponivel
           FROM notas_empenho ne
           LEFT JOIN (SELECT numero_ne, SUM(valor_pagamento) as total_pago FROM ordens_pagamento GROUP BY numero_ne) op_sum
             ON op_sum.numero_ne = ne.numero
           WHERE ne.numero = ? FOR UPDATE`,
          [numeroNe]
        );

        if (neData && (neData as any[]).length > 0) {
          const saldo = Math.round(parseFloat((neData as any[])[0].saldoDisponivel) * 100) / 100;
          const valorTotal = Math.round(parseFloat((neData as any[])[0].valor) * 100) / 100;

          let novoStatus = 'EMITIDO';
          if (saldo <= 0) novoStatus = 'LIQUIDADO';
          else if (saldo < valorTotal) novoStatus = 'PARCIALMENTE PAGO';

          await conn.execute('UPDATE notas_empenho SET status = ? WHERE numero = ?', [novoStatus, numeroNe]);
        }
        return { success: true as const, data: null, status: 200 };
      });

      return result;
    } catch (error: any) {
      if (error.error && error.status) {
        return { success: false, error: error.error, status: error.status };
      }
      console.error('[Service: excluirOrdem]', error);
      return { success: false, error: 'Erro ao excluir ordem de pagamento.', status: 500 };
    }
  }
}
