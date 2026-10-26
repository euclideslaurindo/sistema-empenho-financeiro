import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';
import { fromCents, toCents } from '@/lib/money';
import {
  ANO_MAX,
  ANO_MIN,
  cpfDoTexto,
  ordenarPessoas,
  pessoaDaLinha,
  totaisDoAno,
  type InformeIr,
  type LinhaIr,
  type PessoaFisicaIr,
  type TotaisIr,
} from '@/lib/ir-pessoas-fisicas';
import type { ServiceResult } from '@/lib/services/darf.service';

// ---------------------------------------------------------------------------
// Expressões SQL (uma fonte só, conferidas nos testes)
// ---------------------------------------------------------------------------

/** CPF/CNPJ da OP só com dígitos (a máscara gravada varia). */
export const DIGITOS_CPF =
  "REPLACE(REPLACE(REPLACE(REPLACE(op.credor_cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '')";

/** Data que define o ano da OP: a mesma regra da competência da DARF. */
export const DATA_COMPETENCIA = 'COALESCE(op.data_pagamento, op.data_emissao, DATE(op.created_at))';

const FILTRO_PF = `CHAR_LENGTH(${DIGITOS_CPF}) = 11`;

// ---------------------------------------------------------------------------
// Relatório do ano
// ---------------------------------------------------------------------------

export interface RelatorioIr {
  ano: number;
  anos: number[];
  pessoas: PessoaFisicaIr[];
  totais: TotaisIr;
}

/** Anos com OP para pessoa física, do mais recente para o mais antigo. */
export async function listarAnosComMovimento(): Promise<number[]> {
  const rows: any[] = await query(
    `SELECT DISTINCT YEAR(${DATA_COMPETENCIA}) AS ano
       FROM ordens_pagamento op
      WHERE ${FILTRO_PF}
      ORDER BY ano DESC`
  );
  return (rows || []).map((r) => Number(r.ano)).filter((a) => Number.isInteger(a) && a > 0);
}

/**
 * As OPs são somadas por CPF numa subconsulta e só depois o nome do cadastro
 * é buscado: um JOIN direto com credores multiplicaria as somas se houvesse
 * cadastro repetido.
 */
async function lerLinhasDoAno(ano: number): Promise<LinhaIr[]> {
  return query(
    `SELECT t.cpf, t.nomeOp, t.qtdOps, t.bruto, t.irrf, t.inss, t.iss, t.liquido, t.elementos,
            (SELECT MAX(c.nome) FROM credores c WHERE c.cpf_cnpj = t.cpfGravado) AS nomeCadastro
       FROM (
         SELECT ${DIGITOS_CPF} AS cpf,
                MAX(op.credor_cpf_cnpj) AS cpfGravado,
                MAX(op.credor_nome) AS nomeOp,
                COUNT(*) AS qtdOps,
                SUM(COALESCE(op.valor_pagamento, 0)) AS bruto,
                SUM(COALESCE(op.irrf, 0)) AS irrf,
                SUM(COALESCE(op.inss, 0)) AS inss,
                SUM(COALESCE(op.iss, 0)) AS iss,
                SUM(COALESCE(op.valor_liquido, 0)) AS liquido,
                GROUP_CONCAT(DISTINCT op.elemento ORDER BY op.elemento SEPARATOR '||') AS elementos
           FROM ordens_pagamento op
          WHERE YEAR(${DATA_COMPETENCIA}) = ?
            AND ${FILTRO_PF}
          GROUP BY cpf
       ) t`,
    [ano]
  );
}

/**
 * Marcações do ano, sem JOIN: ir_informes_pf tem a collation copiada da OP e a
 * de usuarios.id é desconhecida. O nome de quem marcou vem de outra consulta.
 */
async function lerInformesDoAno(ano: number): Promise<Map<string, InformeIr>> {
  const rows: any[] =
    (await query(
      `SELECT cpf, informado_por, observacao, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS em
         FROM ir_informes_pf
        WHERE ano = ?`,
      [ano]
    )) || [];

  const ids = [...new Set(rows.map((r) => r.informado_por).filter(Boolean))];
  const nomes = new Map<string, string>();
  if (ids.length > 0) {
    const usuarios: any[] =
      (await query(`SELECT id, nome FROM usuarios WHERE id IN (${ids.map(() => '?').join(',')})`, ids)) || [];
    for (const u of usuarios) nomes.set(String(u.id), u.nome);
  }

  const informes = new Map<string, InformeIr>();
  for (const r of rows) {
    const cpf = cpfDoTexto(r.cpf);
    if (!cpf) continue;
    informes.set(cpf, {
      em: r.em ?? null,
      porNome: (r.informado_por && nomes.get(String(r.informado_por))) || null,
      observacao: r.observacao ?? null,
    });
  }
  return informes;
}

/** Relatório do ano. Sem `ano`: o mais recente com movimento (ou o atual). */
export async function listarPessoasFisicas(anoPedido: number | null, agora: Date = new Date()): Promise<RelatorioIr> {
  const anos = await listarAnosComMovimento();
  const ano = anoPedido ?? anos[0] ?? agora.getFullYear();

  const [linhas, informes] = await Promise.all([lerLinhasDoAno(ano), lerInformesDoAno(ano)]);
  const pessoas = ordenarPessoas(
    (linhas || []).map((l) => {
      const cpf = cpfDoTexto(l.cpf);
      return pessoaDaLinha(l, (cpf && informes.get(cpf)) || null);
    })
  );
  return { ano, anos, pessoas, totais: totaisDoAno(pessoas) };
}

// ---------------------------------------------------------------------------
// OPs de uma pessoa no ano
// ---------------------------------------------------------------------------

export interface OpDaPessoaIr {
  id: string;
  numeroOp: string | null;
  sub: string | null;
  numeroNe: string | null;
  elemento: string | null;
  data: string | null;
  bruto: number;
  irrf: number;
  inss: number;
  iss: number;
  liquido: number;
}

const reais = (v: unknown) => fromCents(toCents(v as string | number | null | undefined));

export async function detalharPessoaFisica(ano: number, cpf: string): Promise<OpDaPessoaIr[]> {
  const rows: any[] =
    (await query(
      `SELECT op.id, op.numero_empenho AS numeroOp, op.sub, op.numero_ne AS numeroNe, op.elemento,
              DATE_FORMAT(${DATA_COMPETENCIA}, '%Y-%m-%d') AS data,
              op.valor_pagamento AS bruto, COALESCE(op.irrf, 0) AS irrf, COALESCE(op.inss, 0) AS inss,
              COALESCE(op.iss, 0) AS iss, COALESCE(op.valor_liquido, 0) AS liquido
         FROM ordens_pagamento op
        WHERE YEAR(${DATA_COMPETENCIA}) = ?
          AND ${DIGITOS_CPF} = ?
        ORDER BY data, op.numero_empenho`,
      [ano, cpf]
    )) || [];
  return rows.map((r) => ({
    id: r.id,
    numeroOp: r.numeroOp ?? null,
    sub: r.sub ?? null,
    numeroNe: r.numeroNe ?? null,
    elemento: r.elemento ?? null,
    data: r.data ?? null,
    bruto: reais(r.bruto),
    irrf: reais(r.irrf),
    inss: reais(r.inss),
    iss: reais(r.iss),
    liquido: reais(r.liquido),
  }));
}

// ---------------------------------------------------------------------------
// Marcar / desmarcar "informado"
// ---------------------------------------------------------------------------

export const marcarInformadoSchema = z.object({
  ano: z.number().int().min(ANO_MIN).max(ANO_MAX),
  cpf: z
    .string()
    .transform((v) => cpfDoTexto(v) ?? '')
    .refine((v) => v.length === 11, 'CPF inválido (11 dígitos).'),
  informado: z.boolean(),
  /** Ausente: mantém a observação gravada. Vazia: apaga. */
  observacao: z.string().max(300).nullable().optional(),
});

const registrarAuditoria = (
  conn: PoolConnection,
  id: string,
  acao: 'CREATE' | 'UPDATE' | 'DELETE',
  antes: unknown,
  depois: unknown,
  usuarioId: string
) =>
  conn.execute(
    `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), 'ir_informes_pf', id, acao, antes == null ? null : JSON.stringify(antes), depois == null ? null : JSON.stringify(depois), usuarioId]
  );

async function lerInforme(conn: PoolConnection, ano: number, cpf: string, travar: boolean) {
  const [rows]: any = await conn.execute(
    `SELECT id, ano, cpf, informado_por, observacao FROM ir_informes_pf WHERE ano = ? AND cpf = ?${travar ? ' FOR UPDATE' : ''}`,
    [ano, cpf]
  );
  return rows?.[0] ?? null;
}

const ehDuplicada = (e: any) => e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062;

/**
 * Idempotente: marcar quem já está marcado só muda a observação (se veio);
 * desmarcar quem não está não grava nada.
 *
 * Ordem das travas: a linha só é lida com FOR UPDATE quando já existe. Travar
 * uma linha que não existe trava o "vão" do índice, e dois cliques ao mesmo
 * tempo virariam deadlock no INSERT. Sem a linha, o INSERT vai direto e a
 * chave única (ano, cpf) segura o segundo clique (ER_DUP_ENTRY = sucesso).
 */
export async function marcarInformado(
  body: unknown,
  usuarioId: string,
  perfil: string
): Promise<ServiceResult<{ informado: boolean }>> {
  if (perfil !== 'ADMIN' && perfil !== 'GESTOR') {
    return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
  }

  const dados = marcarInformadoSchema.parse(body); // ZodError -> 400
  const observacao = dados.observacao === undefined ? undefined : dados.observacao?.trim() || null;

  try {
    await withTransaction(async (conn: PoolConnection) => {
      const [contagem]: any = await conn.execute(
        `SELECT COUNT(*) AS total FROM ordens_pagamento op
          WHERE YEAR(${DATA_COMPETENCIA}) = ? AND ${DIGITOS_CPF} = ?`,
        [dados.ano, dados.cpf]
      );
      if (!Number(contagem?.[0]?.total)) {
        throw { status: 404, error: `Esta pessoa não tem pagamentos em ${dados.ano}.` };
      }

      const existe = await lerInforme(conn, dados.ano, dados.cpf, false);
      const atual = existe ? await lerInforme(conn, dados.ano, dados.cpf, true) : null;

      if (!dados.informado) {
        if (!atual) return;
        await conn.execute('DELETE FROM ir_informes_pf WHERE id = ?', [atual.id]);
        await registrarAuditoria(conn, atual.id, 'DELETE', atual, null, usuarioId);
        return;
      }

      if (atual) {
        if (observacao === undefined || observacao === (atual.observacao ?? null)) return;
        await conn.execute('UPDATE ir_informes_pf SET observacao = ? WHERE id = ?', [observacao, atual.id]);
        await registrarAuditoria(conn, atual.id, 'UPDATE', atual, { ...atual, observacao }, usuarioId);
        return;
      }

      const novo = { id: crypto.randomUUID(), ano: dados.ano, cpf: dados.cpf, informado_por: usuarioId, observacao: observacao ?? null };
      try {
        await conn.execute(
          'INSERT INTO ir_informes_pf (id, ano, cpf, informado_por, observacao) VALUES (?, ?, ?, ?, ?)',
          [novo.id, novo.ano, novo.cpf, novo.informado_por, novo.observacao]
        );
      } catch (e) {
        if (ehDuplicada(e)) return; // outro clique marcou primeiro
        throw e;
      }
      await registrarAuditoria(conn, novo.id, 'CREATE', null, novo, usuarioId);
    });
  } catch (error: any) {
    if (error?.status && error?.error) return { success: false, error: error.error, status: error.status };
    throw error;
  }

  return { success: true, data: { informado: dados.informado } };
}
