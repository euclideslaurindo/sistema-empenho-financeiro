import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';
import { extrairCodigoElemento } from '@/lib/elementos';
import { calcularRetencoesDaOp, type CacheCalculo } from '@/lib/services/calculo-op.service';
import type { CampoTributario, CampoDesconto } from '@/lib/retencoes';
import { toCents, fromCents, formatarBRL, itensBatemComValor, lerValorMonetario, somaItensCents } from '@/lib/money';
import { calcularProximoNumeroOp } from '@/lib/services/numeracao-op';
import { entraDarfDaConfig, sincronizarDarfDaOp } from '@/lib/services/darf.service';

// Miolo da criação de OP (T34-A): o que acontece DENTRO da transação depois
// que a NE já foi travada. Sem transação, sem retry e sem status da NE — quem
// chama decide (OP individual recalcula logo depois; o lote, uma vez no fim).

// Mesmo leitor de valores da NE: "1.234,56" é R$ 1.234,56 (antes o
// parseFloat lia R$ 1,23). Texto inválido continua virando 0.
const safeNumber = z.union([z.string(), z.number()]).transform(val => {
  if (typeof val === 'number') return val;
  const lido = lerValorMonetario(val);
  return Number.isFinite(lido) ? lido : 0;
});

/** Mensagens com valores sempre como "R$ 1.234,56". */
const reais = (cents: number) => `R$ ${formatarBRL(cents)}`;

/** Itens que não somam o valor a pagar (criação e edição usam a mesma mensagem). */
export const mensagemItensNaoBatem = (itensCents: number, brutoCents: number) =>
  `A soma dos itens (${reais(itensCents)}) não bate com o valor a pagar da OP (${reais(brutoCents)}). Confira os itens.`;

/**
 * Descontos maiores que o bruto dariam líquido negativo. A tela já não
 * deixa; o servidor confere também (criação e edição).
 */
export function garantirLiquidoNaoNegativo(resultado: { liquidoCents: number; totalDescontosCents: number }, brutoCents: number) {
  if (resultado.liquidoCents < 0) {
    throw {
      status: 400,
      error: `O total de descontos (${reais(resultado.totalDescontosCents)}) é maior que o valor a pagar (${reais(brutoCents)}).`,
    };
  }
}

// Schema isolado e protegido
export const ordemPagamentoSchema = z.object({
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
  // T26: ADMIN confirmou reter mesmo com credor MEI.
  sobrescreverMei: z.boolean().optional(),
  totalDescontos: safeNumber.optional(),
  valorLiquido: safeNumber.optional(),
  dataEmissao: z.string().optional().nullable(),
  dataPagamento: z.string().optional().nullable(),
});

export type DadosOp = z.infer<typeof ordemPagamentoSchema>;

export const toDecimal = (v: any): number => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  return parseFloat(String(v)) || 0;
};

/**
 * Monta o mapa `informados` pro motor de cálculo (T10) a partir do payload já
 * validado pelo Zod. Só inclui uma chave se o campo realmente veio no
 * payload (`!== undefined`) — é isso que distingue "operador não tocou no
 * campo" de "operador digitou 0", e é o que corrige o bug antigo de
 * "cliente manda 0 e pula um imposto" (ver lib/retencoes.ts).
 */
export function montarInformados(parsedData: any): Partial<Record<CampoTributario | CampoDesconto, number>> {
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

/** Linha da NE já travada (`FOR UPDATE`) por quem chama. */
export interface NeTravada {
  valor: string | number;
  elemento?: string | null;
  subelemento?: string | null;
}

export interface ContextoCriacaoOp {
  usuarioId: string;
  perfil: string;
  neRow: NeTravada;
  /** Cheque já conferido (não duplicado) por quem chama; null se não houver. */
  chequeFormatado: string | null;
  /** Cache do cálculo da requisição (lote, T34-C); sem ele, lê tudo a cada OP. */
  cache?: CacheCalculo;
}

export interface OpCriada {
  id: string;
  numeroNe: string;
  numeroOp: string;
  sub: string;
  saldoRestante: number;
  irrf: number;
  iss: number;
  inss: number;
  sestSenat: number;
  patronal: number;
  outrosDescontos: number;
  taxaBancaria: number;
  taxaPix: number;
  totalDescontos: number;
  valorLiquido: number;
}

/**
 * Grava uma OP na transação `conn`: saldo, itens, numeração, retenções,
 * INSERT, auditoria do MEI e DARF. Erros de regra saem como `{ status, error }`.
 */
export async function criarOpNaTransacao(conn: PoolConnection, dados: DadosOp, ctx: ContextoCriacaoOp): Promise<OpCriada> {
  const {
    liquidacao_id, numeroEmpenho: neReal, credorNome, credorCpfCnpj, credorRg, credorEndereco,
    unidadeOrcamentaria, gestao, historico, itens,
    saldoAnterior, valorEmpenho, valorPagamento: vPagamento,
    dataEmissao, dataPagamento,
  } = dados;
  const { usuarioId, perfil, neRow, chequeFormatado, cache } = ctx;

  const valorNe = parseFloat(String(neRow.valor)) || 0;
  // Elemento/subelemento SEMPRE vêm da NE no servidor — nunca do
  // payload do cliente. Vale tanto pro cálculo das retenções (T10)
  // quanto pro que é gravado/impresso na OP, pra nunca divergir do
  // que foi de fato usado no cálculo.
  const elementoGravado = neRow.elemento || '';
  const subelementoGravado = neRow.subelemento || '';
  const elementoCodigo = extrairCodigoElemento(elementoGravado);

  const [paidRows]: any = await conn.execute(
    'SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago FROM ordens_pagamento WHERE numero_ne = ? FOR UPDATE',
    [neReal]
  );
  // Saldo em centavos inteiros (T31), nunca `valor - pago` em ponto flutuante.
  const saldoCents = toCents(valorNe) - toCents(paidRows[0]?.total_pago ?? 0);
  // Mesma conversão de sempre, mas passando por centavos inteiros (T01)
  // em vez de só Math.round(x*100)/100 — é o valor que entra no motor
  // de retenções, bom já higienizar aqui.
  const brutoCents = toCents(vPagamento);
  const vPagamentoArredondado = fromCents(brutoCents);

  if (brutoCents > saldoCents) {
    throw {
      status: 422,
      error: `Saldo insuficiente. Saldo disponível da NE: ${reais(saldoCents)}. Valor solicitado: ${reais(brutoCents)}`
    };
  }

  // Mesma conta da tela (lib/money.ts): cada item arredondado em centavos,
  // depois somado; tolerância de 1 centavo.
  const itensCents = somaItensCents(Array.isArray(itens) ? itens : []);
  if (itensCents > 0 && !itensBatemComValor(itensCents, brutoCents)) {
    throw { status: 400, error: mensagemItensNaoBatem(itensCents, brutoCents) };
  }

  const { numeroOp: numeroDaOpGerado, sub: subGerado } = await calcularProximoNumeroOp(
    async (sql, params) => {
      const [rows]: any = await conn.execute(sql, params);
      return rows;
    },
    neReal,
    { travar: true }
  );

  // Motor único (T10/T25): config do banco, perfil pelo elemento (transporte
  // no .33), MEI do cadastro; nunca confia em total/líquido do cliente.
  const { resultado, configCampos } = await calcularRetencoesDaOp(conn, {
    brutoCents,
    elementoCodigo,
    credorCpfCnpj,
    dataPagamento,
    dataEmissao,
    informados: montarInformados(dados),
    perfilUsuario: perfil as 'ADMIN' | 'GESTOR' | 'CONSULTA',
    sobrescreverMei: dados.sobrescreverMei,
  }, cache);
  garantirLiquidoNaoNegativo(resultado, brutoCents);

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
      // grava o mesmo valor (em centavos) que entrou no cálculo das retenções
      toDecimal(saldoAnterior), toDecimal(valorEmpenho), vPagamentoArredondado,
      finalIrrf, finalIss, finalInss, finalSestSenat, finalPatronal, finalOutros, finalTaxaBancaria, finalTaxaPix,
      finalTotalDescontos, finalLiquido, snapshotJson,
      chequeFormatado, dataEmissao || null, dataPagamento || null, usuarioId
    ]
  );

  // T26: retenção em credor MEI só com confirmação do ADMIN — fica na auditoria.
  if (resultado.snapshot.mei_sobrescrito) {
    await conn.execute(
      `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(), 'ordens_pagamento', id, 'CREATE', null,
        JSON.stringify({
          aviso: 'Retenção aplicada manualmente pelo ADMIN em credor MEI.',
          credorCpfCnpj, irrf: finalIrrf, iss: finalIss, inss: finalInss, patronal: finalPatronal, sestSenat: finalSestSenat,
        }),
        usuarioId,
      ]
    );
  }

  // Mesma transação: erro na DARF desfaz a OP.
  await sincronizarDarfDaOp(
    conn,
    {
      id, numeroNe: neReal, numeroOp: numeroDaOpGerado, sub: subGerado,
      credorCpfCnpj, credorNome: credorNome || null, dataPagamento, dataEmissao,
      valores: { irrf: finalIrrf, iss: finalIss, inss: finalInss, patronal: finalPatronal, sest_senat: finalSestSenat },
    },
    { entraDarf: entraDarfDaConfig(configCampos) }
  );

  return {
    id,
    numeroNe: neReal,
    numeroOp: numeroDaOpGerado,
    sub: subGerado,
    saldoRestante: fromCents(saldoCents - brutoCents),
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
  };
}
