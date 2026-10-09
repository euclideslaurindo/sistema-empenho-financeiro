import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';
import { NotaEmpenhoDB, NeCredorResposta } from '@/lib/types/db';
import { parseFormNumber } from '@/lib/utils';
import { toCents, fromCents, formatarBRL } from '@/lib/money';
import { somenteDigitos, mensagemSomaBrutos } from '@/lib/ne-credores';

export type ServiceResult<T = any> =
  | { success: true; data: T; status?: number }
  | { success: false; error: string; status: number };

// ---------------------------------------------------------------------------
// Vários credores por NE (T15). A tabela ne_credores é a fonte da verdade;
// as colunas legadas credor_nome/cpf_cnpj da NE guardam o 1º credor (D7).
// ---------------------------------------------------------------------------

export const credoresPayloadSchema = z
  .array(
    z.object({
      cpfCnpj: z.string().trim().min(1, 'Informe o CPF/CNPJ do credor.'),
      valorBruto: z.union([z.string(), z.number()]),
    })
  )
  .min(1, 'Informe ao menos um credor.');

export type CredorPayload = z.infer<typeof credoresPayloadSchema>[number];

interface LinhaCredor {
  cpfCnpj: string;
  nome: string;
  brutoCents: number;
}


/** Validações que não dependem do banco. Devolve o erro (status + mensagem) ou os brutos em centavos. */
export function validarCredoresPayload(
  credores: CredorPayload[],
  valorNeCents: number
): { erro: { status: number; error: string } } | { brutos: Array<{ digitos: string; cpfCnpj: string; brutoCents: number }> } {
  const vistos = new Set<string>();
  const brutos: Array<{ digitos: string; cpfCnpj: string; brutoCents: number }> = [];
  for (const c of credores) {
    const digitos = somenteDigitos(c.cpfCnpj);
    if (!digitos) return { erro: { status: 400, error: `CPF/CNPJ inválido: "${c.cpfCnpj}".` } };
    if (vistos.has(digitos)) {
      return { erro: { status: 400, error: `O credor ${c.cpfCnpj} foi informado mais de uma vez.` } };
    }
    vistos.add(digitos);
    const brutoCents = toCents(c.valorBruto);
    if (brutoCents <= 0) {
      return { erro: { status: 400, error: `O valor bruto do credor ${c.cpfCnpj} deve ser maior que zero.` } };
    }
    brutos.push({ digitos, cpfCnpj: c.cpfCnpj, brutoCents });
  }
  const soma = brutos.reduce((t, b) => t + b.brutoCents, 0);
  const msg = mensagemSomaBrutos(soma, valorNeCents);
  if (msg) return { erro: { status: 422, error: msg } };
  return { brutos };
}

/**
 * Monta a lista `credores` de uma NE para a resposta. Sem linhas em
 * ne_credores (NE anterior à T15), sintetiza um credor a partir das colunas
 * legadas, com bruto = valor da NE.
 */
export function montarCredoresDaNe(
  ne: { valor?: unknown; cpfCnpj?: string | null; credorNome?: string | null },
  linhas: Array<{ credor_cpf_cnpj: string; credor_nome: string; valor_bruto: unknown }>,
  pagoPorDigitos: Map<string, number>,
  meiPorDigitos: Set<string> = new Set()
): NeCredorResposta[] {
  const montar = (cpfCnpj: string, nome: string, brutoCents: number, legado?: true): NeCredorResposta => {
    const digitos = somenteDigitos(cpfCnpj);
    const pagoCents = pagoPorDigitos.get(digitos) ?? 0;
    return {
      cpfCnpj,
      nome,
      valorBruto: fromCents(brutoCents),
      valorPago: fromCents(pagoCents),
      saldo: fromCents(brutoCents - pagoCents),
      ...(legado ? { legado } : {}),
      ...(meiPorDigitos.has(digitos) ? { isMei: true as const } : {}),
    };
  };

  if (linhas.length > 0) {
    return linhas.map((l) => montar(l.credor_cpf_cnpj, l.credor_nome, toCents(l.valor_bruto as any)));
  }
  if (ne.cpfCnpj && ne.cpfCnpj.trim()) {
    return [montar(ne.cpfCnpj.trim(), ne.credorNome || '', toCents(ne.valor as any), true)];
  }
  return [];
}

/** Anexa `credores` às NEs com 2 queries para a página inteira (sem N+1). */
async function anexarCredores<T extends { numero?: string; valor?: unknown; cpfCnpj?: string | null; credorNome?: string | null }>(
  rows: T[]
): Promise<Array<T & { credores: NeCredorResposta[] }>> {
  if (rows.length === 0) return [];
  const numeros = rows.map((r) => r.numero as string);
  const marcadores = numeros.map(() => '?').join(',');

  const linhas = await query<any[]>(
    `SELECT numero_ne, credor_cpf_cnpj, credor_nome, valor_bruto
       FROM ne_credores WHERE numero_ne IN (${marcadores})
      ORDER BY numero_ne, ordem`,
    numeros
  );
  const pagos = await query<any[]>(
    `SELECT numero_ne, credor_cpf_cnpj, SUM(valor_pagamento) as total_pago
       FROM ordens_pagamento WHERE numero_ne IN (${marcadores})
      GROUP BY numero_ne, credor_cpf_cnpj`,
    numeros
  );

  // Selo MEI (T26): casa por dígitos com literais, sem JOIN — ne_credores e
  // credores podem ter collations diferentes no banco compartilhado.
  const digitosCredores = [
    ...new Set(
      [...linhas.map((l) => l.credor_cpf_cnpj), ...rows.map((r) => r.cpfCnpj)].map(somenteDigitos).filter(Boolean)
    ),
  ];
  const meiPorDigitos = new Set<string>();
  if (digitosCredores.length > 0) {
    const meis = await query<Array<{ cpf_cnpj: string }>>(
      `SELECT cpf_cnpj FROM credores
        WHERE is_mei = 1
          AND REPLACE(REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '') IN (${digitosCredores.map(() => '?').join(',')})`,
      digitosCredores
    );
    for (const m of meis) meiPorDigitos.add(somenteDigitos(m.cpf_cnpj));
  }

  return rows.map((ne) => {
    const pagoPorDigitos = new Map<string, number>();
    for (const p of pagos.filter((x) => x.numero_ne === ne.numero)) {
      const digitos = somenteDigitos(p.credor_cpf_cnpj);
      pagoPorDigitos.set(digitos, (pagoPorDigitos.get(digitos) ?? 0) + toCents(p.total_pago));
    }
    const linhasDaNe = linhas.filter((l) => l.numero_ne === ne.numero);
    return { ...ne, credores: montarCredoresDaNe(ne, linhasDaNe, pagoPorDigitos, meiPorDigitos) };
  });
}

/**
 * Confere no cadastro (por dígitos, pra aceitar CPF/CNPJ com ou sem máscara)
 * que todos os credores existem e estão ativos. O nome e o CPF/CNPJ gravados
 * são os do cadastro, nunca os do cliente.
 */
async function resolverCredoresCadastrados(
  conn: PoolConnection,
  brutos: Array<{ digitos: string; cpfCnpj: string; brutoCents: number }>
): Promise<LinhaCredor[]> {
  const marcadores = brutos.map(() => '?').join(',');
  const [rows]: any = await conn.execute(
    `SELECT cpf_cnpj, nome, ativo FROM credores
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '') IN (${marcadores})`,
    brutos.map((b) => b.digitos)
  );
  const porDigitos = new Map<string, any>((rows || []).map((r: any) => [somenteDigitos(r.cpf_cnpj), r]));
  return brutos.map((b) => {
    const cad = porDigitos.get(b.digitos);
    if (!cad || Number(cad.ativo) !== 1) {
      throw { status: 422, error: `Credor ${b.cpfCnpj} não encontrado ou inativo no cadastro de credores.` };
    }
    return { cpfCnpj: cad.cpf_cnpj, nome: cad.nome, brutoCents: b.brutoCents };
  });
}

async function inserirLinhasCredores(
  conn: PoolConnection,
  numeroNe: string,
  linhas: LinhaCredor[],
  usuarioId: string | null
) {
  if (linhas.length === 0) return;
  const valores: any[] = [];
  for (const [i, l] of linhas.entries()) {
    valores.push(crypto.randomUUID(), numeroNe, l.cpfCnpj, l.nome, fromCents(l.brutoCents), i, usuarioId);
  }
  await conn.execute(
    `INSERT INTO ne_credores (id, numero_ne, credor_cpf_cnpj, credor_nome, valor_bruto, ordem, created_by)
     VALUES ${linhas.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
    valores
  );
}

const linhasParaAuditoria = (linhas: LinhaCredor[]) =>
  linhas.map((l) => ({ cpfCnpj: l.cpfCnpj, nome: l.nome, valorBruto: fromCents(l.brutoCents) }));

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
  credores: credoresPayloadSchema.optional(),
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

    // LEFT JOIN com subquery pré-agregada (GROUP BY), em vez de subquery
    // correlacionada por linha — mesmo padrão já usado em buscarPorNumero()
    // logo abaixo. Evita recalcular o SUM uma vez por linha da página inteira.
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
        (ne.valor - COALESCE(op_sum.total_pago, 0)) as saldoDisponivel,
        u.nome as quemAtualizou
      FROM notas_empenho ne
      LEFT JOIN usuarios u ON ne.usuario_id = u.id
      LEFT JOIN (
        SELECT numero_ne, SUM(valor_pagamento) as total_pago
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

    const rows = await query<Partial<NotaEmpenhoDB>[]>(sql, sqlParams);
    const notas = await anexarCredores(rows as any[]);

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
    const [ne] = await anexarCredores([rows[0]] as any[]);
    return { success: true, data: ne };
  }

  static async criar(rawData: any, usuarioIdSolicitante: string, perfilSolicitante: string): Promise<ServiceResult> {
    if (perfilSolicitante === 'CONSULTA') {
      return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
    }

    const parsed = criarNotaEmpenhoSchema.parse(rawData);
    const { numero, valor: valorDecimal, dataPagamento, unidadeOrcamentaria, elemento, subelemento, gestao, historico, status, dataProvisaoConcedida, dataEmissao, credorNome, cpfCnpj, credores } = parsed;
    const valorCents = toCents(valorDecimal);

    let brutos: Array<{ digitos: string; cpfCnpj: string; brutoCents: number }> | null = null;
    if (credores) {
      const validacao = validarCredoresPayload(credores, valorCents);
      if ('erro' in validacao) return { success: false, ...validacao.erro };
      brutos = validacao.brutos;
    }

    let result: { id: string };
    try {
      result = await withTransaction(async (conn: PoolConnection) => {
        const [existing]: any = await conn.execute('SELECT id FROM notas_empenho WHERE numero = ?', [numero.trim()]);
        if (existing && existing.length > 0) {
          throw { status: 409, error: `A NE "${numero}" já está cadastrada no sistema.` };
        }

        // Formato novo: credores validados no cadastro. Formato antigo (tela
        // atual): credor em texto livre, sem validar cadastro — vira 1 linha
        // com bruto = valor da NE, só se veio CPF/CNPJ.
        let linhas: LinhaCredor[] = [];
        if (brutos) {
          linhas = await resolverCredoresCadastrados(conn, brutos);
        } else if (cpfCnpj?.trim()) {
          linhas = [{ cpfCnpj: cpfCnpj.trim(), nome: credorNome?.trim() || '', brutoCents: valorCents }];
        }
        const legadoNome = brutos ? linhas[0].nome : credorNome?.trim() || null;
        const legadoCpf = brutos ? linhas[0].cpfCnpj : cpfCnpj?.trim() || null;

        const id = crypto.randomUUID();
        const exercicio = dataPagamento ? dataPagamento.substring(0, 4) : new Date().getFullYear().toString();
        const usuarioId = await resolveUsuarioId(conn, usuarioIdSolicitante);

        await conn.execute(
          `INSERT INTO notas_empenho (id, exercicio, numero, valor, data_pagamento, data_provisao_concedida, data_emissao, unidade_orcamentaria, elemento, subelemento, gestao, status, historico, usuario_id, credor_nome, cpf_cnpj)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, exercicio, numero.trim(), valorDecimal, dataPagamento || null, dataProvisaoConcedida || null, dataEmissao || null,
           unidadeOrcamentaria?.trim() || '', elemento?.trim() || '', subelemento?.trim() || '',
           gestao?.trim() || '', status || 'EMITIDO', historico?.trim() || '', usuarioId, legadoNome, legadoCpf]
        );

        await inserirLinhasCredores(conn, numero.trim(), linhas, usuarioId);

        await registrarAuditoriaNe(conn, id, 'CREATE', null, {
          id, numero: numero.trim(), valor: valorDecimal, elemento: elemento?.trim() || '', subelemento: subelemento?.trim() || '',
          status: status || 'EMITIDO', credorNome: legadoNome, cpfCnpj: legadoCpf, credores: linhasParaAuditoria(linhas),
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

    const { numero, valor, dataPagamento, unidadeOrcamentaria, elemento, subelemento, gestao, historico, status, dataProvisaoConcedida, dataEmissao, credorNome, cpfCnpj } = body;

    const valorDecimal = parseFormNumber(valor);
    if (valorDecimal <= 0) {
      return { success: false, error: 'O valor da NE deve ser maior que zero.', status: 400 };
    }
    const valorCents = toCents(valorDecimal);

    let brutos: Array<{ digitos: string; cpfCnpj: string; brutoCents: number }> | null = null;
    if (body.credores !== undefined) {
      const credores = credoresPayloadSchema.parse(body.credores); // ZodError -> 400 via withErrorHandler
      const validacao = validarCredoresPayload(credores, valorCents);
      if ('erro' in validacao) return { success: false, ...validacao.erro };
      brutos = validacao.brutos;
    }

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
        const totalPago = parseFloat(opSum[0]?.total_pago || 0);

        if (valorDecimal < totalPago) {
          throw { status: 409, error: `Não é possível reduzir o valor da NE para R$ ${valorDecimal.toFixed(2)} pois já foram geradas OPs no valor total de R$ ${totalPago.toFixed(2)}.` };
        }

        // tabela de dotação ainda não existe no banco — sem ajuste de saldo aqui

        const [linhasAtuaisRows]: any = await conn.execute(
          'SELECT credor_cpf_cnpj, credor_nome, valor_bruto FROM ne_credores WHERE numero_ne = ? ORDER BY ordem',
          [numeroAntigo]
        );
        const linhasAtuais: LinhaCredor[] = (linhasAtuaisRows || []).map((l: any) => ({
          cpfCnpj: l.credor_cpf_cnpj,
          nome: l.credor_nome,
          brutoCents: toCents(l.valor_bruto),
        }));

        const [pagosRows]: any = await conn.execute(
          `SELECT credor_cpf_cnpj, COALESCE(SUM(valor_pagamento), 0) as total_pago
             FROM ordens_pagamento WHERE numero_ne = ? GROUP BY credor_cpf_cnpj`,
          [numeroAntigo]
        );
        const pagoPorDigitos = new Map<string, { cpfCnpj: string; cents: number }>();
        for (const p of pagosRows || []) {
          const digitos = somenteDigitos(p.credor_cpf_cnpj);
          const atual = pagoPorDigitos.get(digitos);
          pagoPorDigitos.set(digitos, { cpfCnpj: p.credor_cpf_cnpj, cents: (atual?.cents ?? 0) + toCents(p.total_pago) });
        }

        // Credor que já recebeu OP nesta NE não pode sair da lista nem ficar
        // com bruto abaixo do que já recebeu. `considerar` limita a checagem
        // de remoção (ver chamada no formato antigo).
        const conferirPagos = (novas: LinhaCredor[], considerar: (digitos: string) => boolean) => {
          const novasPorDigitos = new Map(novas.map((l) => [somenteDigitos(l.cpfCnpj), l]));
          for (const [digitos, pago] of pagoPorDigitos) {
            if (pago.cents <= 0 || !considerar(digitos)) continue;
            const nova = novasPorDigitos.get(digitos);
            if (!nova) {
              throw { status: 409, error: `O credor ${pago.cpfCnpj} já recebeu OP nesta NE e não pode ser removido.` };
            }
            if (nova.brutoCents < pago.cents) {
              throw {
                status: 409,
                error: `O valor bruto do credor ${pago.cpfCnpj} (R$ ${formatarBRL(nova.brutoCents)}) não pode ficar abaixo do que ele já recebeu (R$ ${formatarBRL(pago.cents)}).`,
              };
            }
          }
        };

        // null = manter as linhas atuais de ne_credores.
        let novasLinhas: LinhaCredor[] | null;
        if (brutos) {
          if (neAntes.status === 'CANCELADO') {
            throw { status: 409, error: 'Não é possível alterar os credores de uma NE cancelada.' };
          }
          novasLinhas = await resolverCredoresCadastrados(conn, brutos);
          conferirPagos(novasLinhas, () => true);
        } else if (linhasAtuais.length >= 2) {
          // Tela antiga editando NE com vários credores: não deixa "desfazer"
          // a lista nem mudar o valor sem reenviar a divisão.
          if (valorCents !== toCents(neAntes.valor)) {
            throw {
              status: 422,
              error: 'Esta NE tem vários credores: ao alterar o valor, envie a lista de credores fechando a soma.',
            };
          }
          novasLinhas = null;
        } else {
          // NE de credor único (ou sem credor): a linha acompanha o payload antigo.
          novasLinhas = cpfCnpj?.trim()
            ? [{ cpfCnpj: cpfCnpj.trim(), nome: credorNome?.trim() || '', brutoCents: valorCents }]
            : [];
          // Só protege credores que estavam em ne_credores: NE anterior à T15
          // pode ter OP para outro credor, e a edição dela já funcionava assim.
          const digitosAtuais = new Set(linhasAtuais.map((l) => somenteDigitos(l.cpfCnpj)));
          conferirPagos(novasLinhas, (d) => digitosAtuais.has(d));
        }

        const linhasFinais = novasLinhas ?? linhasAtuais;
        const usarPrimeiroCredor = brutos !== null || novasLinhas === null;
        const legadoNome = usarPrimeiroCredor ? linhasFinais[0]?.nome ?? null : credorNome?.trim() || null;
        const legadoCpf = usarPrimeiroCredor ? linhasFinais[0]?.cpfCnpj ?? null : cpfCnpj?.trim() || null;

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
           legadoNome, legadoCpf, id]
        );

        // A FK fk_op_ne em database.sql já possui ON UPDATE CASCADE,
        // então o MySQL atualiza ordens_pagamento.numero_ne automaticamente.
        // ne_credores não tem FK: o número precisa acompanhar aqui.
        if (novasLinhas !== null) {
          await conn.execute('DELETE FROM ne_credores WHERE numero_ne = ?', [numeroAntigo]);
          await inserirLinhasCredores(conn, numeroNovo, novasLinhas, usuarioId);
        } else if (numeroNovo !== numeroAntigo) {
          await conn.execute('UPDATE ne_credores SET numero_ne = ? WHERE numero_ne = ?', [numeroNovo, numeroAntigo]);
        }

        await registrarAuditoriaNe(
          conn,
          id,
          'UPDATE',
          { ...neAntes, credores: linhasParaAuditoria(linhasAtuais) },
          {
            id, numero: numeroNovo, valor: valorDecimal, elemento: elemento?.trim() || '', subelemento: subelemento?.trim() || '',
            status: status || 'EMITIDO', credorNome: legadoNome, cpfCnpj: legadoCpf, credores: linhasParaAuditoria(linhasFinais),
          },
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

  static async cancelar(id: string, perfilSolicitante: string): Promise<ServiceResult> {
    if (perfilSolicitante === 'CONSULTA') {
      return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
    }

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

  static async verificarDuplicidade(
    valorParam: string | null,
    credorParam: string,
    subelementoParam: string,
    cpfCnpjParam: string = ''
  ) {
    if (!valorParam) return { duplicado: false };

    const valor = parseFloat(valorParam);
    if (isNaN(valor)) return { duplicado: false };

    // Duplicidade = mesmo Valor + mesmo Credor + mesmo Subelemento. O credor
    // casa com a coluna legada da NE ou com qualquer credor dela em
    // ne_credores (por nome ou CPF/CNPJ).
    const rows = await query<{ numero: string; data_emissao: Date }[]>(
      `SELECT ne.numero, ne.data_emissao FROM notas_empenho ne
       WHERE ne.valor = ?
         AND (
           (? = '' AND ? = '')
           OR (? <> '' AND ne.credor_nome = ?)
           OR (? <> '' AND ne.cpf_cnpj = ?)
           OR EXISTS (
             SELECT 1 FROM ne_credores x
              WHERE x.numero_ne = ne.numero
                AND ((? <> '' AND x.credor_nome = ?) OR (? <> '' AND x.credor_cpf_cnpj = ?))
           )
         )
         AND (ne.subelemento = ? OR ? = '')
       LIMIT 1`,
      [
        valor,
        credorParam, cpfCnpjParam,
        credorParam, credorParam,
        cpfCnpjParam, cpfCnpjParam,
        credorParam, credorParam, cpfCnpjParam, cpfCnpjParam,
        subelementoParam, subelementoParam,
      ]
    );

    if (rows && rows.length > 0) {
      return { duplicado: true, nota: rows[0] };
    }
    return { duplicado: false };
  }
}
