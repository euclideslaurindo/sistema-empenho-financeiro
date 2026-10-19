import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';
import { extrairCodigoElemento } from '@/lib/elementos';
import { toCents, fromCents, formatarBRL } from '@/lib/money';
import { calcularRetencoesDaOp, criarCacheCalculo, type CacheCalculo } from '@/lib/services/calculo-op.service';
import { criarOpNaTransacao, montarInformados, ordemPagamentoSchema, type DadosOp, type OpCriada } from '@/lib/services/ordem-pagamento-core';
import { MAX_OPS_POR_EMISSAO } from '@/lib/services/numeracao-op';
import { recalcularStatusNe } from '@/lib/services/saldo-ne';
import type { ServiceResult } from '@/lib/services/ordem-pagamento.service';

// Emissão em lote (T34-C, D35): várias OPs da mesma NE, uma por credor, numa
// transação só — qualquer erro desfaz tudo. Erros de uma linha saem como
// `credores[i]: …` para a tela (T35) destacar a linha.

const ACESSO_NEGADO = 'Acesso negado. Perfil insuficiente para esta operacao.';
const MAX_TENTATIVAS_NUMERO_OP = 5;

const loteSchema = z.object({
  numeroNe: z.string().trim().min(1, 'O número da Nota de Empenho é obrigatório.'),
  dataEmissao: z.string().optional().nullable(),
  credores: z
    .array(z.looseObject({ credorCpfCnpj: z.string().trim().min(1, 'O CPF/CNPJ do credor é obrigatório.') }))
    .min(1, 'Informe ao menos um credor.')
    .max(MAX_OPS_POR_EMISSAO, `No máximo ${MAX_OPS_POR_EMISSAO} credores por emissão.`),
});

const previaLoteSchema = loteSchema.extend({
  credores: z
    .array(
      z.looseObject({
        indice: z.number().int().min(0),
        credorCpfCnpj: z.string().trim().min(1, 'O CPF/CNPJ do credor é obrigatório.'),
      })
    )
    .min(1, 'Informe ao menos um credor.')
    .max(MAX_OPS_POR_EMISSAO, `No máximo ${MAX_OPS_POR_EMISSAO} credores por emissão.`),
});

const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const erroLinha = (i: number, status: number, error: string) => ({ status, error: `credores[${i}]: ${error}` });
const reais = (cents: number) => `R$ ${formatarBRL(cents)}`;

/** Primeira mensagem do Zod, com o índice da linha quando o erro é de um credor. */
function mensagemZod(err: z.ZodError): string {
  const issue = err.issues[0];
  const [raiz, indice] = issue?.path ?? [];
  return raiz === 'credores' && typeof indice === 'number' ? `credores[${indice}]: ${issue.message}` : issue?.message || 'Dados inválidos.';
}

/** Mesma regra da tela: itens unidos por " | "; sem itens, Observações da NE; senão o texto padrão. */
export function historicoDaOp(itens: unknown, historicoNe: string | null | undefined, numeroNe: string): string {
  const especificacoes = Array.isArray(itens)
    ? itens.map((i: any) => String(i?.especificacao ?? '').trim()).filter(Boolean)
    : [];
  if (especificacoes.length > 0) return especificacoes.join(' | ');
  return String(historicoNe ?? '').trim() || `Pagamento referente ao empenho ${numeroNe}`;
}

interface CredorCadastro {
  cpf_cnpj: string;
  nome: string;
  rg: string | null;
  endereco: string | null;
  ativo: number;
}

/** Credores do lote numa consulta só, casados em código pelos dígitos (sem JOIN/collation). */
async function carregarCredores(
  exec: (sql: string, params: any[]) => Promise<any[]>,
  cpfs: string[]
): Promise<Map<string, CredorCadastro>> {
  const marcas = cpfs.map(() => '?').join(',');
  const rows: CredorCadastro[] = await exec(
    `SELECT cpf_cnpj, nome, rg, endereco, ativo FROM credores
      WHERE cpf_cnpj IN (${marcas})
         OR REPLACE(REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '') IN (${marcas})`,
    [...cpfs, ...cpfs.map(digitos)]
  );
  const porDigitos = new Map<string, CredorCadastro>();
  for (const r of rows) {
    const chave = digitos(r.cpf_cnpj);
    const atual = porDigitos.get(chave);
    if (!atual || (!Number(atual.ativo) && Number(r.ativo))) porDigitos.set(chave, r); // ativo vence duplicata inativa
  }
  return porDigitos;
}

/** Validações que não precisam do banco: credor e cheque repetidos no próprio lote. */
function validarRepetidos(credores: Array<Record<string, any>>) {
  const vistosCredor = new Map<string, number>();
  const vistosCheque = new Map<string, number>();
  credores.forEach((c, i) => {
    const chave = digitos(c.credorCpfCnpj) || String(c.credorCpfCnpj).trim();
    if (vistosCredor.has(chave)) throw erroLinha(i, 400, 'credor repetido nesta emissão.');
    vistosCredor.set(chave, i);
    const cheque = typeof c.numeroCheque === 'string' ? c.numeroCheque.trim() : '';
    if (cheque) {
      if (vistosCheque.has(cheque)) throw erroLinha(i, 409, `o cheque nº "${cheque}" está repetido nesta emissão.`);
      vistosCheque.set(cheque, i);
    }
  });
}

/** Payload de uma linha no formato da OP individual (validado pelo mesmo schema). */
function dadosDaLinha(linha: Record<string, any>, numeroNe: string, dataEmissao: string | null | undefined, i: number): DadosOp {
  const r = ordemPagamentoSchema.safeParse({
    ...linha,
    numeroEmpenho: numeroNe,
    dataEmissao: dataEmissao ?? null,
    // nunca do cliente: vêm da NE/cadastro na gravação
    credorNome: undefined, credorRg: undefined, credorEndereco: undefined,
    unidadeOrcamentaria: undefined, gestao: undefined, elemento: undefined, subelemento: undefined,
    saldoAnterior: undefined, valorEmpenho: undefined, totalDescontos: undefined, valorLiquido: undefined,
  });
  if (!r.success) throw erroLinha(i, 400, r.error.issues[0]?.message || 'dados inválidos.');
  return r.data;
}

function ehDuplicidade(err: any, chave: string) {
  return err?.code === 'ER_DUP_ENTRY' && String(err.sqlMessage || err.message || '').includes(chave);
}

export class OrdemPagamentoLoteService {
  static async criarLote(rawData: any, usuarioId: string, perfil: string): Promise<ServiceResult> {
    if (perfil === 'CONSULTA') return { success: false, error: ACESSO_NEGADO, status: 403 };

    try {
      const { numeroNe, dataEmissao, credores } = loteSchema.parse(rawData);
      validarRepetidos(credores);
      const linhas = credores.map((c, i) => dadosDaLinha(c, numeroNe, dataEmissao, i));

      let result: ServiceResult | undefined;
      for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_NUMERO_OP; tentativa++) {
        try {
          result = await withTransaction((conn: PoolConnection) => gravarLote(conn, numeroNe, linhas, usuarioId, perfil));
          break;
        } catch (err: any) {
          // Colisão do nº da OP (uq_numero_empenho): refaz o lote inteiro.
          if (ehDuplicidade(err, 'numero_empenho') && tentativa < MAX_TENTATIVAS_NUMERO_OP) continue;
          throw err;
        }
      }
      return result!;
    } catch (error: any) {
      if (error instanceof z.ZodError) return { success: false, error: mensagemZod(error), status: 400 };
      if (error?.error && error?.status) return { success: false, error: error.error, status: error.status };
      console.error('[Service: criarLoteOp]', error);
      return { success: false, error: 'Erro interno do servidor', status: 500 };
    }
  }

  /**
   * Prévia (D43): mesmo cálculo da gravação, sem gravar. Aceita qualquer
   * subconjunto das linhas (cada uma com o seu `indice`); erro de uma linha
   * volta só nela.
   */
  static async previaLote(rawData: any, perfil: string): Promise<ServiceResult> {
    if (perfil === 'CONSULTA') return { success: false, error: ACESSO_NEGADO, status: 403 };

    let entrada: z.infer<typeof previaLoteSchema>;
    try {
      entrada = previaLoteSchema.parse(rawData);
    } catch (error: any) {
      if (error instanceof z.ZodError) return { success: false, error: mensagemZod(error), status: 400 };
      throw error;
    }
    const { numeroNe, dataEmissao, credores } = entrada;

    const neRows = await query<any[]>('SELECT elemento, status FROM notas_empenho WHERE numero = ?', [numeroNe]);
    if (!neRows || neRows.length === 0) return { success: false, error: `NE "${numeroNe}" não encontrada.`, status: 404 };
    if (neRows[0].status === 'CANCELADO') return { success: false, error: `A NE "${numeroNe}" está CANCELADA.`, status: 409 };
    const elementoCodigo = extrairCodigoElemento(neRows[0].elemento || '');

    const cadastro = await carregarCredores((sql, p) => query<any[]>(sql, p), credores.map((c) => c.credorCpfCnpj));
    const cache = criarCacheCalculo();

    const linhas = [];
    for (const linha of credores) {
      const { indice } = linha;
      try {
        const credor = cadastro.get(digitos(linha.credorCpfCnpj));
        if (!credor || !Number(credor.ativo)) throw { status: 422, error: 'credor não encontrado ou inativo.' };
        const dados = dadosDaLinha(linha, numeroNe, dataEmissao, indice);
        const { resultado } = await calcularRetencoesDaOp(
          undefined,
          {
            brutoCents: toCents(dados.valorPagamento),
            elementoCodigo,
            credorCpfCnpj: credor.cpf_cnpj,
            dataPagamento: dados.dataPagamento,
            dataEmissao: dados.dataEmissao,
            informados: montarInformados(dados),
            perfilUsuario: perfil as 'ADMIN' | 'GESTOR' | 'CONSULTA',
            sobrescreverMei: dados.sobrescreverMei,
          },
          cache
        );
        linhas.push({
          indice,
          itens: Object.fromEntries(Object.entries(resultado.itens).map(([campo, cents]) => [campo, fromCents(cents)])),
          totalDescontos: fromCents(resultado.totalDescontosCents),
          valorLiquido: fromCents(resultado.liquidoCents),
          avisos: resultado.avisos,
          informativos: resultado.informativos ?? [],
        });
      } catch (err: any) {
        if (!(err?.status && err?.error)) throw err;
        linhas.push({ indice, erro: String(err.error).replace(/^credores\[\d+\]: /, '') });
      }
    }
    return { success: true, data: { linhas } };
  }
}

async function gravarLote(
  conn: PoolConnection,
  numeroNe: string,
  linhas: DadosOp[],
  usuarioId: string,
  perfil: string
): Promise<ServiceResult> {
  const exec = async (sql: string, params: any[]) => ((await conn.execute(sql, params))[0] as any[]);

  // 1) NE travada uma vez: serializa duas emissões na mesma NE.
  const [ne] = await exec(
    'SELECT id, valor, status, elemento, subelemento, unidade_orcamentaria, gestao, historico FROM notas_empenho WHERE numero = ? FOR UPDATE',
    [numeroNe]
  );
  if (!ne) throw { status: 404, error: `NE "${numeroNe}" não encontrada.` };
  if (ne.status === 'CANCELADO') {
    throw { status: 409, error: `Não é possível criar OP para a NE "${numeroNe}" pois ela está CANCELADA.` };
  }

  // 2) Saldo em centavos contra a soma do lote.
  const [pago] = await exec(
    'SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago FROM ordens_pagamento WHERE numero_ne = ? FOR UPDATE',
    [numeroNe]
  );
  const saldoAnteriorCents = toCents(ne.valor) - toCents(pago?.total_pago ?? 0);
  const totalCents = linhas.reduce((t, l) => t + toCents(l.valorPagamento), 0);
  if (totalCents > saldoAnteriorCents) {
    throw { status: 422, error: `Soma das OPs (${reais(totalCents)}) maior que o saldo da NE (${reais(saldoAnteriorCents)}).` };
  }

  // 3) Cheques já usados no banco, numa consulta só.
  const cheques = linhas.map((l) => (l.numeroCheque ? l.numeroCheque.trim() : '')).filter(Boolean);
  if (cheques.length > 0) {
    const usados = new Set(
      (await exec(`SELECT numero_cheque FROM ordens_pagamento WHERE numero_cheque IN (${cheques.map(() => '?').join(',')})`, cheques)).map(
        (r: any) => String(r.numero_cheque)
      )
    );
    const i = linhas.findIndex((l) => l.numeroCheque && usados.has(l.numeroCheque.trim()));
    if (i >= 0) throw erroLinha(i, 409, `o cheque nº "${linhas[i].numeroCheque!.trim()}" já foi utilizado.`);
  }

  // 4) Credores do cadastro (ativos), numa consulta só.
  const cadastro = await carregarCredores(exec, linhas.map((l) => l.credorCpfCnpj));

  // 5) Uma OP por credor, na ordem do payload (= ordem dos números).
  const cache: CacheCalculo = criarCacheCalculo();
  const neRow = { valor: ne.valor, elemento: ne.elemento, subelemento: ne.subelemento };
  const ops: Array<OpCriada & { credorCpfCnpj: string; credorNome: string; valorPagamento: number }> = [];
  let saldoCorridoCents = saldoAnteriorCents;

  for (const [i, linha] of linhas.entries()) {
    const credor = cadastro.get(digitos(linha.credorCpfCnpj));
    if (!credor || !Number(credor.ativo)) throw erroLinha(i, 422, 'credor não encontrado ou inativo.');

    const chequeFormatado = linha.numeroCheque ? linha.numeroCheque.trim() : null;
    const dados: DadosOp = {
      ...linha,
      credorCpfCnpj: credor.cpf_cnpj,
      credorNome: credor.nome || '',
      credorRg: credor.rg || '',
      credorEndereco: credor.endereco || '',
      unidadeOrcamentaria: ne.unidade_orcamentaria || '',
      gestao: ne.gestao || '',
      historico: historicoDaOp(linha.itens, ne.historico, numeroNe),
      valorEmpenho: Number(ne.valor) || 0,
      saldoAnterior: fromCents(saldoCorridoCents),
    };

    let op: OpCriada;
    try {
      op = await criarOpNaTransacao(conn, dados, { usuarioId, perfil, neRow, chequeFormatado, cache });
    } catch (err: any) {
      if (ehDuplicidade(err, 'uq_cheque') || ehDuplicidade(err, 'numero_cheque')) {
        // outra transação gravou o mesmo cheque entre a checagem e o INSERT
        throw erroLinha(i, 409, `o cheque nº "${chequeFormatado}" já foi utilizado.`);
      }
      if (err?.status && err?.error) throw erroLinha(i, err.status, err.error);
      throw err; // inclui a colisão do nº da OP, que refaz o lote
    }
    saldoCorridoCents -= toCents(linha.valorPagamento);
    ops.push({ ...op, credorCpfCnpj: credor.cpf_cnpj, credorNome: credor.nome || '', valorPagamento: fromCents(toCents(linha.valorPagamento)) });
  }

  // 6) Status da NE uma vez e auditoria do lote.
  const statusNe = await recalcularStatusNe(conn, numeroNe);
  await conn.execute(
    `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(), 'notas_empenho', ne.id, 'CREATE_LOTE', null,
      JSON.stringify({
        numeroNe,
        quantidade: ops.length,
        totalBruto: fromCents(totalCents),
        ops: ops.map((o) => ({ id: o.id, numeroOp: o.numeroOp, sub: o.sub, credorCpfCnpj: o.credorCpfCnpj })),
      }),
      usuarioId,
    ]
  );

  return {
    success: true,
    status: 201,
    data: {
      numeroNe,
      ops: ops.map((o) => ({
        id: o.id,
        numeroOp: o.numeroOp,
        sub: o.sub,
        credorCpfCnpj: o.credorCpfCnpj,
        credorNome: o.credorNome,
        valorPagamento: o.valorPagamento,
        totalDescontos: o.totalDescontos,
        valorLiquido: o.valorLiquido,
      })),
      resumo: {
        quantidade: ops.length,
        totalBruto: fromCents(totalCents),
        saldoAnterior: fromCents(saldoAnteriorCents),
        saldoRestante: fromCents(saldoAnteriorCents - totalCents),
        statusNe,
      },
    },
  };
}
