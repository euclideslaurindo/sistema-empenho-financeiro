import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';
import { extrairCodigoElemento } from '@/lib/elementos';
import { obterConfigRetencoes } from '@/lib/services/config-retencoes.service';
import { calcularRetencoes, type CampoTributario, type CampoDesconto } from '@/lib/retencoes';
import { toCents, fromCents, formatarBRL } from '@/lib/money';
import { somenteDigitos } from '@/lib/ne-credores';
import { calcularProximoNumeroOp } from '@/lib/services/numeracao-op';

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
  // Obrigatório: ordens_pagamento.credor_cpf_cnpj referencia credores.cpf_cnpj (fk_op_credor).
  credorCpfCnpj: z.string().min(1, 'O CPF/CNPJ do credor é obrigatório.'),
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
  taxaBancaria: safeNumber.optional(),
  taxaPix: safeNumber.optional(),
  totalDescontos: safeNumber.optional(),
  valorLiquido: safeNumber.optional(),
  dataEmissao: z.string().optional().nullable(),
  dataPagamento: z.string().optional().nullable(),
});

/**
 * Monta o mapa `informados` pro motor de cálculo (T10) a partir do payload já
 * validado pelo Zod. Só inclui uma chave se o campo realmente veio no
 * payload (`!== undefined`) — é isso que distingue "operador não tocou no
 * campo" de "operador digitou 0", e é o que corrige o bug antigo de
 * "cliente manda 0 e pula um imposto" (ver lib/retencoes.ts).
 */
function montarInformados(parsedData: any): Partial<Record<CampoTributario | CampoDesconto, number>> {
  const informados: Partial<Record<CampoTributario | CampoDesconto, number>> = {};
  const mapa: Array<[string, CampoTributario | CampoDesconto]> = [
    ['irrf', 'irrf'],
    ['iss', 'iss'],
    ['inss', 'inss'],
    ['sestSenat', 'sest_senat'],
    ['patronal', 'patronal'],
    ['outrosDescontos', 'outros'],
    ['taxaBancaria', 'taxa_bancaria'],
    ['taxaPix', 'taxa_pix'],
  ];
  for (const [campoPayload, campoEngine] of mapa) {
    const valor = parsedData[campoPayload];
    if (valor !== undefined) {
      informados[campoEngine] = toCents(valor);
    }
  }
  return informados;
}

/**
 * NE com vários credores (T17): o credor da OP tem que estar em ne_credores
 * e o total pago a ele na NE não pode passar do bruto dele. NE sem linhas em
 * ne_credores (anterior à T15) continua livre — só vale o saldo total.
 * Roda dentro da transação, depois da trava da NE (FOR UPDATE), então duas
 * OPs simultâneas da mesma NE enxergam uma à outra.
 */
async function validarSaldoCredor(
  conn: PoolConnection,
  numeroNe: string,
  credorCpfCnpj: string,
  valorCents: number,
  opIdIgnorar?: string
) {
  const [linhas]: any = await conn.execute(
    'SELECT credor_cpf_cnpj, credor_nome, valor_bruto FROM ne_credores WHERE numero_ne = ? FOR UPDATE',
    [numeroNe]
  );
  if (!linhas || linhas.length === 0) return;

  const digitos = somenteDigitos(credorCpfCnpj);
  const alvo = linhas.find((l: any) => somenteDigitos(l.credor_cpf_cnpj) === digitos);
  if (!alvo) {
    throw { status: 422, error: `O credor ${credorCpfCnpj} não pertence à NE "${numeroNe}".` };
  }

  const [pagos]: any = await conn.execute(
    `SELECT credor_cpf_cnpj, COALESCE(SUM(valor_pagamento), 0) as total_pago
       FROM ordens_pagamento
      WHERE numero_ne = ?${opIdIgnorar ? ' AND id <> ?' : ''}
      GROUP BY credor_cpf_cnpj`,
    opIdIgnorar ? [numeroNe, opIdIgnorar] : [numeroNe]
  );
  const pagoCents = (pagos || [])
    .filter((p: any) => somenteDigitos(p.credor_cpf_cnpj) === digitos)
    .reduce((t: number, p: any) => t + toCents(p.total_pago), 0);
  const brutoCents = toCents(alvo.valor_bruto);

  if (pagoCents + valorCents > brutoCents) {
    throw {
      status: 422,
      error:
        `Saldo do credor insuficiente. Bruto R$ ${formatarBRL(brutoCents)}, ` +
        `já pago R$ ${formatarBRL(pagoCents)}, restante R$ ${formatarBRL(brutoCents - pagoCents)}.`,
    };
  }
}

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

      const toDecimal = (v: any): number => {
        if (typeof v === 'number') return isNaN(v) ? 0 : v;
        return parseFloat(String(v)) || 0;
      };

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
        const {
          liquidacao_id, numeroEmpenho: neReal, sub, credorNome, credorCpfCnpj, credorRg, credorEndereco,
          unidadeOrcamentaria, gestao, historico, itens,
          saldoAnterior, valorEmpenho, valorPagamento: vPagamento,
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
          'SELECT id, valor, status, elemento, subelemento FROM notas_empenho WHERE numero = ? FOR UPDATE',
          [neReal]
        );
        if (!neRows || neRows.length === 0) {
          throw { status: 404, error: `NE "${neReal}" não encontrada.` };
        }
        if (neRows[0].status === 'CANCELADO') {
          throw { status: 409, error: `Não é possível criar OP para a NE "${neReal}" pois ela está CANCELADA.` };
        }
        const valorNe = parseFloat(neRows[0].valor) || 0;
        // Elemento/subelemento SEMPRE vêm da NE no servidor — nunca do
        // payload do cliente. Vale tanto pro cálculo das retenções (T10)
        // quanto pro que é gravado/impresso na OP, pra nunca divergir do
        // que foi de fato usado no cálculo.
        const elementoGravado = neRows[0].elemento || '';
        const subelementoGravado = neRows[0].subelemento || '';
        const elementoCodigo = extrairCodigoElemento(elementoGravado);

        const [paidRows]: any = await conn.execute(
          'SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago FROM ordens_pagamento WHERE numero_ne = ? FOR UPDATE',
          [neReal]
        );
        const totalJaPago = parseFloat(paidRows[0]?.total_pago) || 0;
        const saldoDisponivel = Math.round((valorNe - totalJaPago) * 100) / 100;
        // Mesma conversão de sempre, mas passando por centavos inteiros (T01)
        // em vez de só Math.round(x*100)/100 — é o valor que entra no motor
        // de retenções, bom já higienizar aqui.
        const brutoCents = toCents(vPagamento);
        const vPagamentoArredondado = fromCents(brutoCents);

        if (vPagamentoArredondado > saldoDisponivel) {
          throw {
            status: 422,
            error: `Saldo insuficiente. Saldo disponível da NE: R$ ${saldoDisponivel.toFixed(2).replace('.', ',')}. Valor solicitado: R$ ${vPagamentoArredondado.toFixed(2).replace('.', ',')}`
          };
        }

        await validarSaldoCredor(conn, neReal, credorCpfCnpj, brutoCents);

        let totalItensCalc = 0;
        if (itens && Array.isArray(itens)) {
          itens.forEach((i: any) => {
            totalItensCalc += (Number(i.quantidade) || 0) * toDecimal(i.valorUnitario);
          });
        }
        totalItensCalc = Math.round(totalItensCalc * 100) / 100;
        // Tolerância de 1 centavo para evitar falso positivo por imprecisão IEEE 754.
        // A diferença também é arredondada antes de comparar, pois mesmo dois valores
        // já arredondados podem subtrair para algo como 0.010000000000005 em vez de 0.01.
        const diferencaItens = Math.round(Math.abs(totalItensCalc - vPagamentoArredondado) * 100) / 100;
        if (totalItensCalc > 0 && diferencaItens > 0.01) {
          throw { status: 400, error: `A soma dos itens (R$ ${totalItensCalc.toFixed(2)}) não bate com o valor a pagar da OP (R$ ${vPagamentoArredondado.toFixed(2)}). Fraude detectada.` };
        }

        const { numeroOp: numeroDaOpGerado, sub: subGerado } = await calcularProximoNumeroOp(
          async (sql, params) => {
            const [rows]: any = await conn.execute(sql, params);
            return rows;
          },
          neReal,
          { travar: true }
        );

        // Motor único de cálculo (T10): lê config/matriz do banco (T06/T03),
        // nunca confia em totalDescontos/valorLiquido enviados pelo cliente,
        // e só aceita sobrescrita manual de quem tem permissão (ver lib/retencoes.ts).
        const { campos: configCampos, regras } = await obterConfigRetencoes(conn);
        const informados = montarInformados(parsedData);
        const resultado = calcularRetencoes({
          brutoCents,
          elementoCodigo,
          config: configCampos,
          regras,
          informados,
          perfil: perfil as 'ADMIN' | 'GESTOR' | 'CONSULTA',
        });

        const finalIrrf = fromCents(resultado.itens.irrf ?? 0);
        const finalIss = fromCents(resultado.itens.iss ?? 0);
        const finalInss = fromCents(resultado.itens.inss ?? 0);
        const finalSestSenat = fromCents(resultado.itens.sest_senat ?? 0);
        const finalPatronal = fromCents(resultado.itens.patronal ?? 0);
        const finalOutros = fromCents(resultado.itens.outros ?? 0);
        const finalTaxaBancaria = fromCents(resultado.itens.taxa_bancaria ?? 0);
        const finalTaxaPix = fromCents(resultado.itens.taxa_pix ?? 0);
        const finalTotalDescontos = fromCents(resultado.totalDescontosCents);
        const finalLiquido = fromCents(resultado.liquidoCents);
        const snapshotJson = JSON.stringify(resultado.snapshot);

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
            irrf, iss, inss, sest_senat, patronal, outros_descontos, taxa_bancaria, taxa_pix,
            total_descontos, valor_liquido, retencoes_snapshot,
            numero_cheque, data_emissao, data_pagamento, usuario_id
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            id, liquidacao_id || null, neReal, numeroDaOpGerado, subGerado,
            credorNome || '', credorCpfCnpj || '', credorRg || '', credorEndereco || '',
            unidadeOrcamentaria || '', elementoGravado, subelementoGravado, gestao || '', historico || '',
            itensJson,
            toDecimal(saldoAnterior), toDecimal(valorEmpenho), vPagamento,
            finalIrrf, finalIss, finalInss, finalSestSenat, finalPatronal, finalOutros, finalTaxaBancaria, finalTaxaPix,
            finalTotalDescontos, finalLiquido, snapshotJson,
            chequeFormatado, dataEmissao || null, dataPagamento || null, usuarioId
          ]
        );

        const saldoRestante = Math.round((saldoDisponivel - vPagamentoArredondado) * 100) / 100;
        const novoStatus = saldoRestante <= 0 ? 'LIQUIDADO' : saldoRestante < valorNe ? 'PARCIALMENTE PAGO' : 'EMITIDO';
        await conn.execute('UPDATE notas_empenho SET status = ? WHERE numero = ?', [novoStatus, neReal]);

        return {
          success: true as const,
          data: {
            id,
            numeroOp: numeroDaOpGerado,
            sub: subGerado,
            saldoRestante,
            irrf: finalIrrf,
            iss: finalIss,
            inss: finalInss,
            sestSenat: finalSestSenat,
            patronal: finalPatronal,
            outrosDescontos: finalOutros,
            taxaBancaria: finalTaxaBancaria,
            taxaPix: finalTaxaPix,
            totalDescontos: finalTotalDescontos,
            valorLiquido: finalLiquido,
          },
          status: 201,
        };
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

      const toDecimal = (v: any): number => {
        if (typeof v === 'number') return isNaN(v) ? 0 : v;
        return parseFloat(String(v)) || 0;
      };

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
          saldoDisp = Math.round(parseFloat(neObj.saldoDisponivel) * 100) / 100;
          if (vPagamentoArredondado > saldoDisp) {
            throw { status: 409, error: `Valor do pagamento excede o saldo disponível da NE (R$ ${saldoDisp.toFixed(2)}).` };
          }
          elementoGravado = neObj.elemento || '';
          subelementoGravado = neObj.subelemento || '';
          elementoCodigo = extrairCodigoElemento(elementoGravado);
        }

        await validarSaldoCredor(conn, neSegura, credorCpfCnpj, brutoCents, id);

        let totalItensCalc = 0;
        if (itens && Array.isArray(itens)) {
          itens.forEach((i: any) => {
            totalItensCalc += (Number(i.quantidade) || 0) * toDecimal(i.valorUnitario);
          });
        }
        totalItensCalc = Math.round(totalItensCalc * 100) / 100;
        // Tolerância de 1 centavo para evitar falso positivo por imprecisão IEEE 754
        // (mesmo critério usado em criar(), ver comentário lá).
        const diferencaItens = Math.round(Math.abs(totalItensCalc - vPagamentoArredondado) * 100) / 100;
        if (totalItensCalc > 0 && diferencaItens > 0.01) {
          throw { status: 400, error: `A soma dos itens (R$ ${totalItensCalc.toFixed(2)}) não bate com o valor a pagar da OP (R$ ${vPagamentoArredondado.toFixed(2)}). Fraude detectada.` };
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
        const valorMudou = Math.abs((parseFloat(oldOp.valor_pagamento) || 0) - vPagamento) > 0.001;
        const credorMudou = (oldOp.credor_cpf_cnpj || '') !== (credorCpfCnpj || '');
        const elementoMudou = elementoCodigo !== elementoAnterior;
        const precisaRecalcular = valorMudou || credorMudou || elementoMudou;

        let finalIrrf: number, finalIss: number, finalInss: number, finalSestSenat: number, finalPatronal: number;
        let finalOutros: number, finalTaxaBancaria: number, finalTaxaPix: number;
        let finalTotalDescontos: number, finalLiquido: number, snapshotJson: string | null;

        if (precisaRecalcular) {
          const { campos: configCampos, regras } = await obterConfigRetencoes(conn);
          const informados = montarInformados(parsedData);
          const resultado = calcularRetencoes({
            brutoCents,
            elementoCodigo,
            config: configCampos,
            regras,
            informados,
            perfil: perfil as 'ADMIN' | 'GESTOR' | 'CONSULTA',
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
            toDecimal(saldoAnterior), toDecimal(valorEmpenho), vPagamento,
            finalIrrf, finalIss, finalInss, finalSestSenat, finalPatronal, finalOutros, finalTaxaBancaria, finalTaxaPix,
            finalTotalDescontos, finalLiquido, snapshotJson,
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
