import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';
import { extrairCodigoElemento } from '@/lib/elementos';
import { calcularRetencoesDaOp } from '@/lib/services/calculo-op.service';
import { toCents, fromCents, itensBatemComValor, somaItensCents } from '@/lib/money';
import { calcularProximoNumeroOp } from '@/lib/services/numeracao-op';
import { recalcularStatusNe } from '@/lib/services/saldo-ne';
import { entraDarfDaConfig, removerDarfDaOp, sincronizarDarfDaOp } from '@/lib/services/darf.service';
import { criarOpNaTransacao, montarInformados, ordemPagamentoSchema, toDecimal } from '@/lib/services/ordem-pagamento-core';

export type ServiceResult<T = any> = 
  | { success: true; data: T; status?: number }
  | { success: false; error: string; status: number };

export class OrdemPagamentoService {
  /**
   * Prévia das retenções para o formulário (T25): o mesmo cálculo do salvar,
   * com o elemento lido da NE no servidor, sem gravar nada.
   */
  static async previa(rawData: any, perfil: string): Promise<ServiceResult> {
    if (perfil === 'CONSULTA') {
      return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
    }
    const dados = ordemPagamentoSchema.parse(rawData); // ZodError -> 400
    try {
      const neRows = await query<any[]>('SELECT elemento, status FROM notas_empenho WHERE numero = ?', [dados.numeroEmpenho]);
      if (!neRows || neRows.length === 0) {
        return { success: false, error: `NE "${dados.numeroEmpenho}" não encontrada.`, status: 404 };
      }
      if (neRows[0].status === 'CANCELADO') {
        return { success: false, error: `A NE "${dados.numeroEmpenho}" está CANCELADA.`, status: 409 };
      }
      const brutoCents = toCents(dados.valorPagamento);
      const { resultado, perfilCalculo } = await calcularRetencoesDaOp(undefined, {
        brutoCents,
        elementoCodigo: extrairCodigoElemento(neRows[0].elemento || ''),
        credorCpfCnpj: dados.credorCpfCnpj,
        dataPagamento: dados.dataPagamento,
        dataEmissao: dados.dataEmissao,
        informados: montarInformados(dados),
        perfilUsuario: perfil as 'ADMIN' | 'GESTOR' | 'CONSULTA',
        sobrescreverMei: dados.sobrescreverMei,
      });
      return {
        success: true,
        data: {
          perfil: perfilCalculo,
          itens: Object.fromEntries(Object.entries(resultado.itens).map(([campo, cents]) => [campo, fromCents(cents)])),
          totalDescontos: fromCents(resultado.totalDescontosCents),
          valorLiquido: fromCents(resultado.liquidoCents),
          avisos: resultado.avisos,
          informativos: resultado.informativos ?? [],
        },
      };
    } catch (error: any) {
      if (error?.status && error?.error) return { success: false, error: error.error, status: error.status };
      throw error;
    }
  }

  
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
                irrf, iss, inss, sest_senat as sestSenat, patronal, outros_descontos as outrosDescontos, total_descontos as totalDescontos, valor_liquido as valorLiquido,
                taxa_bancaria as taxaBancaria, taxa_pix as taxaPix, retencoes_snapshot as retencoesSnapshot,
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
    if (perfil === 'CONSULTA') {
      return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
    }

    try {
      const parsedData = ordemPagamentoSchema.parse(rawData);

      // Retry em caso de colisão no numero_empenho: o SELECT MAX() FOR UPDATE não
      // trava nada quando é a primeira OP do ano (sem linhas pra travar), então duas
      // requisições concorrentes podem calcular o mesmo número. A UNIQUE KEY no banco
      // (uq_numero_empenho) é quem realmente impede a duplicata; aqui só recalculamos
      // e tentamos de novo se ela disparar.
      const MAX_TENTATIVAS_NUMERO_OP = 5;
      let result: any;
      for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_NUMERO_OP; tentativa++) {
      try {
      result = await withTransaction(async (conn: PoolConnection) => {
        const { numeroEmpenho: neReal, numeroCheque } = parsedData;

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
          'SELECT id, valor, status, elemento, subelemento FROM notas_empenho WHERE numero = ? FOR UPDATE',
          [neReal]
        );
        if (!neRows || neRows.length === 0) {
          throw { status: 404, error: `NE "${neReal}" não encontrada.` };
        }
        if (neRows[0].status === 'CANCELADO') {
          throw { status: 409, error: `Não é possível criar OP para a NE "${neReal}" pois ela está CANCELADA.` };
        }
        // Passos 3–9 (saldo, itens, numeração, retenções, INSERT, MEI, DARF): T34-A.
        const { numeroNe, ...data } = await criarOpNaTransacao(conn, parsedData, {
          usuarioId, perfil, neRow: neRows[0], chequeFormatado,
        });
        await recalcularStatusNe(conn, numeroNe);

        return { success: true as const, data, status: 201 };
      });
      break;
      } catch (err: any) {
        const ehColisaoNumeroOp = err.code === 'ER_DUP_ENTRY' && String(err.sqlMessage || err.message || '').includes('numero_empenho');
        if (ehColisaoNumeroOp && tentativa < MAX_TENTATIVAS_NUMERO_OP) {
          continue;
        }
        throw err;
      }
      }

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
    if (perfil === 'CONSULTA') {
      return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
    }

    try {
      // Correção 1: Forçamos a validação Zod no PUT também! Bypass resolvido.
      const parsedData = ordemPagamentoSchema.parse(rawData);

      const result = await withTransaction(async (conn: PoolConnection) => {
        const {
          numeroEmpenho: neReal, sub, credorNome, credorCpfCnpj, credorRg, credorEndereco,
          itens, // <-- Array de itens
          saldoAnterior, valorEmpenho, valorPagamento: vPagamento,
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
          `SELECT ne.valor, ne.status, ne.elemento, ne.subelemento,
                  (ne.valor - COALESCE(op_sum.total_pago, 0) + (SELECT valor_pagamento FROM ordens_pagamento WHERE id = ?)) as saldoDisponivel
           FROM notas_empenho ne
           LEFT JOIN (SELECT numero_ne, SUM(valor_pagamento) as total_pago FROM ordens_pagamento GROUP BY numero_ne) op_sum
             ON op_sum.numero_ne = ne.numero
           WHERE ne.numero = ? FOR UPDATE`,
          [id, neSegura]
        );

        let saldoDisp = 0;
        const brutoCents = toCents(vPagamento);
        const vPagamentoArredondado = fromCents(brutoCents);
        // Elemento/subelemento SEMPRE vêm da NE atual (nunca do payload do
        // cliente) — mesma regra do criar(), inclusive pra detectar se a NE
        // mudou de elemento desde que a OP foi criada (D12, abaixo).
        let elementoGravado = oldOp.elemento || '';
        let subelementoGravado = oldOp.subelemento || '';
        let elementoCodigo: string | null = null;

        if (neRows && (neRows as any[]).length > 0) {
          const neObj = (neRows as any[])[0];
          if (neObj.status === 'CANCELADO') {
            throw { status: 409, error: `Não é possível atualizar OP da NE "${neSegura}" pois ela foi CANCELADA.` };
          }
          // Em centavos (T31). O SQL já soma em DECIMAL; aqui só se compara.
          const saldoCents = toCents(neObj.saldoDisponivel ?? 0);
          saldoDisp = fromCents(saldoCents);
          if (brutoCents > saldoCents) {
            throw { status: 409, error: `Valor do pagamento excede o saldo disponível da NE (R$ ${saldoDisp.toFixed(2)}).` };
          }
          elementoGravado = neObj.elemento || '';
          subelementoGravado = neObj.subelemento || '';
          elementoCodigo = extrairCodigoElemento(elementoGravado);
        }


        // Mesma conta da criação e da tela (lib/money.ts): itens em centavos,
        // tolerância de 1 centavo.
        const itensCents = somaItensCents(Array.isArray(itens) ? itens : []);
        if (itensCents > 0 && !itensBatemComValor(itensCents, brutoCents)) {
          throw { status: 400, error: `A soma dos itens (R$ ${fromCents(itensCents).toFixed(2)}) não bate com o valor a pagar da OP (R$ ${vPagamentoArredondado.toFixed(2)}). Fraude detectada.` };
        }

        // D12: só recalcula se valor, credor ou elemento mudaram desde a
        // criação/última edição — evita que uma edição não-financeira (ex.:
        // corrigir o histórico) recalcule com uma config que pode ter
        // mudado nesse meio-tempo. OPs antigas (pré-T10, sem snapshot) são
        // tratadas como "elemento mudou" por padrão — força recálculo na
        // primeira edição pós-deploy, o que é aceitável e desejável.
        const snapshotAnterior =
          oldOp.retencoes_snapshot && typeof oldOp.retencoes_snapshot === 'object' ? oldOp.retencoes_snapshot : null;
        const elementoAnterior = snapshotAnterior?.elemento ?? null;
        const valorMudou = toCents(oldOp.valor_pagamento) !== brutoCents;
        const credorMudou = (oldOp.credor_cpf_cnpj || '') !== (credorCpfCnpj || '');
        const elementoMudou = elementoCodigo !== elementoAnterior;
        const precisaRecalcular = valorMudou || credorMudou || elementoMudou;

        let finalIrrf: number, finalIss: number, finalInss: number, finalSestSenat: number, finalPatronal: number;
        let finalOutros: number, finalTaxaBancaria: number, finalTaxaPix: number;
        let finalTotalDescontos: number, finalLiquido: number, snapshotJson: string | null;

        if (precisaRecalcular) {
          const { resultado } = await calcularRetencoesDaOp(conn, {
            brutoCents,
            elementoCodigo,
            credorCpfCnpj,
            dataPagamento,
            dataEmissao,
            informados: montarInformados(parsedData),
            perfilUsuario: perfil as 'ADMIN' | 'GESTOR' | 'CONSULTA',
          sobrescreverMei: parsedData.sobrescreverMei,
          });
          finalIrrf = fromCents(resultado.itens.irrf ?? 0);
          finalIss = fromCents(resultado.itens.iss ?? 0);
          finalInss = fromCents(resultado.itens.inss ?? 0);
          finalSestSenat = fromCents(resultado.itens.sest_senat ?? 0);
          finalPatronal = fromCents(resultado.itens.patronal ?? 0);
          finalOutros = fromCents(resultado.itens.outros ?? 0);
          finalTaxaBancaria = fromCents(resultado.itens.taxa_bancaria ?? 0);
          finalTaxaPix = fromCents(resultado.itens.taxa_pix ?? 0);
          finalTotalDescontos = fromCents(resultado.totalDescontosCents);
          finalLiquido = fromCents(resultado.liquidoCents);
          snapshotJson = JSON.stringify(resultado.snapshot);
        } else {
          finalIrrf = parseFloat(oldOp.irrf) || 0;
          finalIss = parseFloat(oldOp.iss) || 0;
          finalInss = parseFloat(oldOp.inss) || 0;
          finalSestSenat = parseFloat(oldOp.sest_senat) || 0;
          finalPatronal = parseFloat(oldOp.patronal) || 0;
          finalOutros = parseFloat(oldOp.outros_descontos) || 0;
          finalTaxaBancaria = parseFloat(oldOp.taxa_bancaria) || 0;
          finalTaxaPix = parseFloat(oldOp.taxa_pix) || 0;
          finalTotalDescontos = parseFloat(oldOp.total_descontos) || 0;
          finalLiquido = parseFloat(oldOp.valor_liquido) || 0;
          snapshotJson = oldOp.retencoes_snapshot ? JSON.stringify(oldOp.retencoes_snapshot) : null;
        }

        // Guarda de tamanho: evita estouro do max_allowed_packet do MySQL (~16MB padrão)
        const itensJson = itens ? JSON.stringify(itens) : null;
        if (itensJson && itensJson.length > 65535) {
          throw { status: 400, error: 'A lista de itens é muito grande. Reduza a quantidade de itens ou o tamanho das descrições.' };
        }

        await conn.execute(
          `UPDATE ordens_pagamento SET
            sub = ?, credor_nome = ?, credor_cpf_cnpj = ?, credor_rg = ?, credor_endereco = ?,
            elemento = ?, subelemento = ?,
            itens_json = ?,
            saldo_anterior = ?, valor_empenho = ?, valor_pagamento = ?,
            irrf = ?, iss = ?, inss = ?, sest_senat = ?, patronal = ?, outros_descontos = ?, taxa_bancaria = ?, taxa_pix = ?,
            total_descontos = ?, valor_liquido = ?, retencoes_snapshot = ?,
            numero_cheque = ?, data_emissao = ?, data_pagamento = ?, historico = ?, usuario_id = ?
           WHERE id = ?`,
          [
            sub || '01', credorNome || '', credorCpfCnpj || '', credorRg || '', credorEndereco || '',
            elementoGravado, subelementoGravado,
            itensJson,
            toDecimal(saldoAnterior), toDecimal(valorEmpenho), vPagamentoArredondado,
            finalIrrf, finalIss, finalInss, finalSestSenat, finalPatronal, finalOutros, finalTaxaBancaria, finalTaxaPix,
            finalTotalDescontos, finalLiquido, snapshotJson,
            numeroCheque ? numeroCheque.trim() : null, dataEmissao || null, dataPagamento || null, historico || '', usuarioId, id
          ]
        );

        // Mesma transação: DARF paga que mudaria de valor/competência bloqueia a edição (D13).
        await sincronizarDarfDaOp(
          conn,
          {
            id, numeroNe: neSegura, numeroOp: oldOp.numero_empenho ?? null, sub: sub || '01',
            credorCpfCnpj, credorNome: credorNome || null, dataPagamento, dataEmissao,
            valores: { irrf: finalIrrf, iss: finalIss, inss: finalInss, patronal: finalPatronal, sest_senat: finalSestSenat },
          },
          { manterValorExistente: !precisaRecalcular }
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

        // atualiza o status da NE conforme o saldo (regra única, T31)
        await recalcularStatusNe(conn, neSegura);

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

  static async excluir(id: string, usuarioId: string, perfilSolicitante: string): Promise<ServiceResult> {
    if (perfilSolicitante === 'CONSULTA') {
      return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
    }

    try {
      const result = await withTransaction(async (conn: PoolConnection) => {
        const [ordens] = await conn.execute<any[]>('SELECT * FROM ordens_pagamento WHERE id = ?', [id]);

        if (!ordens || (ordens as any[]).length === 0) {
          throw { status: 404, error: 'Ordem de pagamento não encontrada.' };
        }
        
        const oldOp = (ordens as any[])[0];
        const numeroNe = oldOp.numero_ne;

        await removerDarfDaOp(conn, id); // DARF paga -> 409, antes de apagar a OP
        await conn.execute('DELETE FROM ordens_pagamento WHERE id = ?', [id]);

        // AUDITORIA: Salvar exclusão
        await conn.execute(
          `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), 'ordens_pagamento', id, 'DELETE', JSON.stringify(oldOp), null, usuarioId]
        );

        // devolve o saldo à NE e recalcula o status (regra única, T31)
        await recalcularStatusNe(conn, numeroNe);
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
