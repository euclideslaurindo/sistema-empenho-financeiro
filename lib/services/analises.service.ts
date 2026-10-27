import { query } from '@/lib/db';
import { z } from 'zod';
import { fromCents, toCents, type Centavos } from '@/lib/money';
import { somenteDigitos } from '@/lib/ne-credores';
import {
  ANO_MAX,
  ANO_MIN,
  ELEMENTO_TRANSPORTE,
  ErroPeriodo,
  SITUACOES,
  agruparElementos,
  agruparMunicipios,
  avisosDasNes,
  criterios,
  dataValida,
  escaparLike,
  fecharPonte,
  montarResumo,
  participacao,
  resolverPeriodo,
  rotuloMes,
  rotuloMesLongo,
  situacaoDaNe,
  variacao,
  type Base,
  type NeDoPeriodo,
  type Periodo,
  type TipoPeriodo,
} from '@/lib/analises';
import { DATA_NE, DATA_OP, DIGITOS_CPF, EXERCICIO_NE } from '@/lib/sql-op';

const c = (v: unknown) => toCents(v as string | number | null | undefined);
const reais = (v: Centavos) => fromCents(v);

const FROM_OP = 'FROM ordens_pagamento op LEFT JOIN notas_empenho ne ON ne.numero = op.numero_ne';
/** A data da OP com outro alias (subconsulta da ponte). */
const DATA_O2 = 'COALESCE(o2.data_pagamento, o2.data_emissao, DATE(o2.created_at))';

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

const elementoSchema = z
  .string()
  .trim()
  .regex(/^\d(\.\d+)+$/, 'Elemento inválido (ex.: 3.3.90.33).')
  .optional();

export const analisesSchema = z.object({
  periodo: z.enum(['s1', 's2', 'ano', 'intervalo']).default('ano'),
  ano: z.coerce.number().int().min(ANO_MIN).max(ANO_MAX).optional(),
  inicio: z.string().optional(),
  fim: z.string().optional(),
  base: z.enum(['civil', 'exercicio']).default('civil'),
  elemento: elementoSchema,
});

export const opsSchema = z
  .object({
    inicio: z.string().refine(dataValida, 'Data de início inválida (AAAA-MM-DD).'),
    fim: z.string().refine(dataValida, 'Data de fim inválida (AAAA-MM-DD).'),
    base: z.enum(['civil', 'exercicio']).default('civil'),
    ano: z.coerce.number().int().min(ANO_MIN).max(ANO_MAX).optional(),
    elemento: elementoSchema,
    cpf: z
      .string()
      .transform((v) => somenteDigitos(v))
      .refine((v) => v.length === 11 || v.length === 14, 'CPF/CNPJ inválido.')
      .optional(),
  })
  .refine((o) => o.inicio <= o.fim, { message: 'A data de início é depois da data de fim.', path: ['inicio'] })
  .refine((o) => Date.parse(o.fim) - Date.parse(o.inicio) <= 366 * 86400000, { message: 'O recorte pode ter no máximo 1 ano.', path: ['fim'] });

// ---------------------------------------------------------------------------
// Filtros (uma fonte só, sempre com ?)
// ---------------------------------------------------------------------------

interface Filtro {
  base: Base;
  ano: number;
  elemento?: string;
}

function filtroOps(f: Filtro, inicio: string, fim: string, extra?: { elemento?: string }) {
  const partes = [`${DATA_OP} BETWEEN ? AND ?`];
  const params: unknown[] = [inicio, fim];
  if (f.base === 'exercicio') {
    partes.push(`${EXERCICIO_NE} = ?`);
    params.push(f.ano);
  }
  const elemento = extra?.elemento ?? f.elemento;
  if (elemento) {
    partes.push('op.elemento LIKE ?');
    params.push(`${escaparLike(elemento)}%`);
  }
  return { where: partes.join(' AND '), params };
}

function filtroNes(f: Filtro, inicio: string, fim: string) {
  const partes = [`${DATA_NE} BETWEEN ? AND ?`];
  const params: unknown[] = [inicio, fim];
  if (f.base === 'exercicio') {
    partes.push(`${EXERCICIO_NE} = ?`);
    params.push(f.ano);
  }
  if (f.elemento) {
    partes.push('ne.elemento LIKE ?');
    params.push(`${escaparLike(f.elemento)}%`);
  }
  return { where: partes.join(' AND '), params };
}

// ---------------------------------------------------------------------------
// Consultas (cada uma testável pelo texto do SQL)
// ---------------------------------------------------------------------------

/** (i) Anos com OP ou NE, do mais recente ao mais antigo. */
export async function anosComMovimento(): Promise<number[]> {
  const rows: any[] =
    (await query(
      `SELECT YEAR(${DATA_OP}) AS ano FROM ordens_pagamento op
       UNION
       SELECT YEAR(${DATA_NE}) AS ano FROM notas_empenho ne
       ORDER BY ano DESC`
    )) || [];
  return rows.map((r) => Number(r.ano)).filter((a) => Number.isInteger(a) && a >= ANO_MIN && a <= ANO_MAX);
}

/** (a) OPs por mês, com restos e o pago às NEs do período. */
async function opsPorMes(f: Filtro, inicio: string, fim: string) {
  const w = filtroOps(f, inicio, fim);
  const rows: any[] =
    (await query(
      `SELECT DATE_FORMAT(${DATA_OP}, '%Y-%m') AS mes, COUNT(*) AS ops,
              SUM(COALESCE(op.valor_pagamento, 0)) AS bruto,
              SUM(COALESCE(op.irrf, 0)) AS irrf, SUM(COALESCE(op.iss, 0)) AS iss,
              SUM(COALESCE(op.inss, 0)) AS inss, SUM(COALESCE(op.sest_senat, 0)) AS sest,
              SUM(COALESCE(op.patronal, 0)) AS patronal, SUM(COALESCE(op.valor_liquido, 0)) AS liquido,
              SUM(CASE WHEN ${EXERCICIO_NE} < ? THEN COALESCE(op.valor_pagamento, 0) ELSE 0 END) AS restos,
              SUM(CASE WHEN ${DATA_NE} BETWEEN ? AND ? THEN COALESCE(op.valor_pagamento, 0) ELSE 0 END) AS pagoNesPeriodo
         ${FROM_OP}
        WHERE ${w.where}
        GROUP BY mes
        ORDER BY mes`,
      [f.ano, inicio, fim, ...w.params]
    )) || [];
  return rows.map((r) => ({
    mes: String(r.mes), ops: Number(r.ops) || 0,
    bruto: c(r.bruto), irrf: c(r.irrf), iss: c(r.iss), inss: c(r.inss), sest: c(r.sest), patronal: c(r.patronal), liquido: c(r.liquido),
    restos: c(r.restos), pagoNesPeriodo: c(r.pagoNesPeriodo),
  }));
}

/** (b) Credores distintos (por dígitos do documento). */
async function qtdCredores(f: Filtro, inicio: string, fim: string): Promise<number> {
  const w = filtroOps(f, inicio, fim);
  const rows: any[] = (await query(`SELECT COUNT(DISTINCT ${DIGITOS_CPF}) AS qtd ${FROM_OP} WHERE ${w.where}`, w.params)) || [];
  return Number(rows[0]?.qtd) || 0;
}

/** (c) Pago por texto de elemento; o agrupamento por código é no código. */
async function pagoPorElemento(f: Filtro, inicio: string, fim: string) {
  const w = filtroOps(f, inicio, fim);
  const rows: any[] =
    (await query(
      `SELECT op.elemento AS elemento, SUM(COALESCE(op.valor_pagamento, 0)) AS pago ${FROM_OP} WHERE ${w.where} GROUP BY op.elemento`,
      w.params
    )) || [];
  return agruparElementos(rows.map((r) => ({ elemento: r.elemento ?? null, pago: c(r.pago) })));
}

/** (d) Os 10 maiores credores; o nome do cadastro vem depois da soma (sem multiplicar valores). */
async function maioresCredores(f: Filtro, inicio: string, fim: string) {
  const w = filtroOps(f, inicio, fim);
  const rows: any[] =
    (await query(
      `SELECT t.cpf, t.nomeOp, t.pago,
              (SELECT MAX(cr.nome) FROM credores cr WHERE cr.cpf_cnpj = t.cpfGravado) AS nomeCadastro
         FROM (
           SELECT ${DIGITOS_CPF} AS cpf, MAX(op.credor_cpf_cnpj) AS cpfGravado, MAX(op.credor_nome) AS nomeOp,
                  SUM(COALESCE(op.valor_pagamento, 0)) AS pago
             ${FROM_OP}
            WHERE ${w.where}
            GROUP BY cpf
            ORDER BY pago DESC
            LIMIT 10
         ) t
        ORDER BY t.pago DESC`,
      w.params
    )) || [];
  return rows.map((r) => ({ nome: String(r.nomeCadastro || r.nomeOp || 'Sem nome').trim(), pago: c(r.pago) }));
}

/**
 * (e) Transporte por município do credor (Município do Expediente, T33).
 * A coluna municipioExpediente só é LIDA, nunca comparada: a collation dela é
 * diferente das tabelas antigas.
 */
async function transportePorMunicipio(f: Filtro, inicio: string, fim: string) {
  if (f.elemento && !f.elemento.startsWith(ELEMENTO_TRANSPORTE) && !ELEMENTO_TRANSPORTE.startsWith(f.elemento)) return [];
  const w = filtroOps(f, inicio, fim, { elemento: f.elemento && f.elemento.length > ELEMENTO_TRANSPORTE.length ? f.elemento : ELEMENTO_TRANSPORTE });
  const rows: any[] =
    (await query(
      `SELECT t.pago,
              (SELECT cr.municipioExpediente FROM credores cr WHERE cr.cpf_cnpj = t.cpfGravado LIMIT 1) AS municipio
         FROM (
           SELECT op.credor_cpf_cnpj AS cpfGravado, SUM(COALESCE(op.valor_pagamento, 0)) AS pago
             ${FROM_OP}
            WHERE ${w.where}
            GROUP BY op.credor_cpf_cnpj
         ) t`,
      w.params
    )) || [];
  return agruparMunicipios(rows.map((r) => ({ municipio: r.municipio ?? null, pago: c(r.pago) })));
}

/** (f) NEs do período com o pago e o líquido até o fim efetivo (a posição da ponte). */
async function nesDoPeriodo(f: Filtro, inicio: string, fim: string, fimEfetivo: string) {
  const w = filtroNes(f, inicio, fim);
  const rows: any[] =
    (await query(
      `SELECT ne.numero, ne.valor, ne.status, DATE_FORMAT(${DATA_NE}, '%Y-%m') AS mes,
              COALESCE(pg.pago, 0) AS pago, COALESCE(pg.liquido, 0) AS liquido
         FROM notas_empenho ne
         LEFT JOIN (
           SELECT o2.numero_ne, SUM(COALESCE(o2.valor_pagamento, 0)) AS pago, SUM(COALESCE(o2.valor_liquido, 0)) AS liquido
             FROM ordens_pagamento o2
            WHERE ${DATA_O2} <= ?
            GROUP BY o2.numero_ne
         ) pg ON pg.numero_ne = ne.numero
        WHERE ${w.where}`,
      [fimEfetivo, ...w.params]
    )) || [];
  return rows.map((r) => ({ mes: String(r.mes), valor: c(r.valor), status: r.status ?? null, pago: c(r.pago), liquido: c(r.liquido) }));
}

/** (g) DARF por competência e status. Sem JOIN: segue só a competência. */
async function darfPorCompetencia(inicio: string, fim: string) {
  const rows: any[] =
    (await query(
      `SELECT competencia, status, SUM(COALESCE(valor_darf, 0)) AS valor
         FROM darf_acompanhamento
        WHERE competencia BETWEEN ? AND ?
        GROUP BY competencia, status`,
      [inicio.slice(0, 7), fim.slice(0, 7)]
    )) || [];
  return rows.map((r) => ({ mes: String(r.competencia), status: String(r.status), valor: c(r.valor) }));
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

const soma = <T,>(l: T[], f: (x: T) => number) => l.reduce((t, x) => t + f(x), 0);
const retidoDe = (x: { irrf: number; iss: number; inss: number; sest: number }) => x.irrf + x.iss + x.inss + x.sest;

function hojeLocal(agora: Date): string {
  const tz = agora.getTimezoneOffset() * 60000;
  return new Date(agora.getTime() - tz).toISOString().slice(0, 10);
}

export interface EntradaAnalises {
  periodo?: TipoPeriodo;
  ano?: number;
  inicio?: string;
  fim?: string;
  base?: Base;
  elemento?: string;
}

/** Monta a resposta da aba Análises. ErroPeriodo → 400 na rota. */
export async function obterAnalises(entrada: unknown, agora: Date = new Date()) {
  const e = analisesSchema.parse(entrada); // ZodError -> 400
  const hoje = hojeLocal(agora);
  const anos = await anosComMovimento();
  const anoPedido = e.ano ?? (e.periodo === 'intervalo' && e.inicio ? Number(String(e.inicio).slice(0, 4)) : anos[0] ?? Number(hoje.slice(0, 4)));
  const periodo: Periodo = resolverPeriodo({ tipo: e.periodo, ano: anoPedido, inicio: e.inicio, fim: e.fim }, hoje);
  const f: Filtro = { base: e.base, ano: periodo.ano, elemento: e.elemento };
  const fAnt: Filtro = { ...f, ano: periodo.ano - 1 };

  const cabecalho = {
    periodo, base: e.base, elemento: e.elemento ?? null, anos,
    criterios: criterios(e.base, periodo), atualizadoEm: agora.toISOString(),
  };

  if (periodo.futuro) {
    return { ...cabecalho, vazio: true, avisos: [], ...montarVazio(periodo) };
  }

  const { inicio, fimEfetivo } = periodo;
  const ant = periodo.anterior;
  const [meses, credoresQtd, elementos, credores, municipios, nes, darf, mesesAnt, nesAnt] = await Promise.all([
    opsPorMes(f, inicio, fimEfetivo),
    qtdCredores(f, inicio, fimEfetivo),
    pagoPorElemento(f, inicio, fimEfetivo),
    maioresCredores(f, inicio, fimEfetivo),
    transportePorMunicipio(f, inicio, fimEfetivo),
    nesDoPeriodo(f, inicio, fimEfetivo, fimEfetivo),
    darfPorCompetencia(inicio, fimEfetivo),
    opsPorMes(fAnt, ant.inicio, ant.fim),
    nesDoPeriodo(fAnt, ant.inicio, ant.fim, ant.fim),
  ]);

  // ---- totais (centavos) ----
  const pago = soma(meses, (m) => m.bruto);
  const retido = soma(meses, retidoDe);
  const restos = e.base === 'civil' ? soma(meses, (m) => m.restos) : 0;
  const pagoDasNes = soma(meses, (m) => m.pagoNesPeriodo);
  const qtdOps = soma(meses, (m) => m.ops);
  const ponte = fecharPonte(nes as NeDoPeriodo[]);
  const ponteAnt = fecharPonte(nesAnt as NeDoPeriodo[]);
  const pagoAnt = soma(mesesAnt, (m) => m.bruto);
  const retidoAnt = soma(mesesAnt, retidoDe);

  // ---- situação das NEs (identidade: soma = empenhado) ----
  const situacao = new Map(SITUACOES.map((s) => [s, { nome: s, qtd: 0, valor: 0 }]));
  for (const n of nes) {
    const s = situacao.get(situacaoDaNe(n.valor, n.pago, n.status))!;
    s.qtd += 1;
    s.valor += n.valor;
  }
  if (soma([...situacao.values()], (s) => s.valor) !== ponte.empenhado) throw new Error('Situação das NEs não soma o empenhado.');

  // ---- diferenças vindas dos dados: aviso, não erro ----
  const avisos = avisosDasNes(nes as NeDoPeriodo[]);
  const somaElementos = soma(elementos, (x) => x.pago);
  if (somaElementos !== pago) avisos.push('Houve lançamento de OP durante a leitura: recarregue para ver os números atualizados.');

  // ---- meses completos (o gráfico não pula mês) ----
  const porMes = new Map(meses.map((m) => [m.mes, m]));
  const empenhadoPorMes = new Map<string, number>();
  for (const n of nes) empenhadoPorMes.set(n.mes, (empenhadoPorMes.get(n.mes) ?? 0) + n.valor);
  const darfPorMes = new Map<string, { paga: number; pendente: number }>();
  for (const d of darf) {
    const x = darfPorMes.get(d.mes) ?? { paga: 0, pendente: 0 };
    if (d.status === 'PAGA') x.paga += d.valor;
    else x.pendente += d.valor;
    darfPorMes.set(d.mes, x);
  }

  const transporte = elementos.find((x) => x.codigo === ELEMENTO_TRANSPORTE);
  const pctTransporte = transporte ? participacao(transporte.pago, pago) : 0;
  const kpis = {
    empenhado: reais(ponte.empenhado), pago: reais(pago), saldo: reais(ponte.saldo), retido: reais(retido),
    varEmpenhado: variacao(ponte.empenhado, ponteAnt.empenhado), varPago: variacao(pago, pagoAnt),
    varSaldo: variacao(ponte.saldo, ponteAnt.saldo), varRetido: variacao(retido, retidoAnt),
  };

  return {
    ...cabecalho,
    vazio: qtdOps === 0 && nes.length === 0,
    avisos,
    kpis,
    restos: reais(restos),
    pagoDasNes: reais(pagoDasNes),
    pagoAnteriores: reais(pago - pagoDasNes),
    qtdOps,
    qtdCredores: credoresQtd,
    qtdNes: nes.length,
    pctTransporte,
    pctPagoDoEmpenhado: ponte.empenhado - ponte.cancelado > 0 ? Math.round(((ponte.liquido + ponte.retencoes) / (ponte.empenhado - ponte.cancelado)) * 100) : 0,
    ponte: { empenhado: reais(ponte.empenhado), cancelado: reais(ponte.cancelado), liquido: reais(ponte.liquido), retencoes: reais(ponte.retencoes), saldo: reais(ponte.saldo) },
    meses: periodo.meses.map((mes) => {
      const m = porMes.get(mes);
      return {
        mes, rotulo: rotuloMes(mes), longo: rotuloMesLongo(mes),
        empenhado: reais(empenhadoPorMes.get(mes) ?? 0),
        pago: reais(m?.bruto ?? 0), ops: m?.ops ?? 0,
        irrf: reais(m?.irrf ?? 0), iss: reais(m?.iss ?? 0), inss: reais(m?.inss ?? 0), sest: reais(m?.sest ?? 0), patronal: reais(m?.patronal ?? 0),
      };
    }),
    elementos: elementos.map((x) => ({ codigo: x.codigo, desc: x.desc, pago: reais(x.pago), pct: x.pct })),
    credores: credores.map((x) => ({ nome: x.nome, pago: reais(x.pago) })),
    municipios: municipios.map((x) => ({ nome: x.nome, pago: reais(x.pago) })),
    darf: periodo.meses.map((mes) => {
      const d = darfPorMes.get(mes) ?? { paga: 0, pendente: 0 };
      return { mes, rotulo: rotuloMes(mes), paga: reais(d.paga), pendente: reais(d.pendente) };
    }),
    nes: [...situacao.values()].map((s) => ({ nome: s.nome, qtd: s.qtd, valor: reais(s.valor) })),
    resumo: montarResumo({
      periodo, pago, saldo: ponte.saldo, empenhado: ponte.empenhado, restos,
      qtdCredores: credoresQtd, qtdOps, varPago: kpis.varPago, pctTransporte,
    }),
  };
}

function montarVazio(periodo: Periodo) {
  const zero = { empenhado: 0, cancelado: 0, liquido: 0, retencoes: 0, saldo: 0 };
  return {
    kpis: { empenhado: 0, pago: 0, saldo: 0, retido: 0, varEmpenhado: null, varPago: null, varSaldo: null, varRetido: null },
    restos: 0, pagoDasNes: 0, pagoAnteriores: 0, qtdOps: 0, qtdCredores: 0, qtdNes: 0, pctTransporte: 0, pctPagoDoEmpenhado: 0,
    ponte: zero, meses: [], elementos: [], credores: [], municipios: [], darf: [],
    nes: SITUACOES.map((nome) => ({ nome, qtd: 0, valor: 0 })),
    resumo: montarResumo({ periodo, pago: 0, saldo: 0, empenhado: 0, restos: 0, qtdCredores: 0, qtdOps: 0, varPago: null, pctTransporte: 0 }),
  };
}

// ---------------------------------------------------------------------------
// Detalhe: as OPs de um recorte
// ---------------------------------------------------------------------------

export const LIMITE_OPS = 500;

export async function listarOpsDoRecorte(entrada: unknown) {
  const e = opsSchema.parse(entrada); // ZodError -> 400
  const ano = e.ano ?? Number(e.inicio.slice(0, 4));
  const f: Filtro = { base: e.base, ano, elemento: e.elemento };
  const w = filtroOps(f, e.inicio, e.fim);
  const where = e.cpf ? `${w.where} AND ${DIGITOS_CPF} = ?` : w.where;
  const params = e.cpf ? [...w.params, e.cpf] : w.params;

  const [totais, rows] = await Promise.all([
    query<any[]>(`SELECT COUNT(*) AS qtd, SUM(COALESCE(op.valor_pagamento, 0)) AS total ${FROM_OP} WHERE ${where}`, params),
    query<any[]>(
      `SELECT op.id, DATE_FORMAT(${DATA_OP}, '%Y-%m-%d') AS data, op.numero_empenho AS numeroOp, op.numero_ne AS numeroNe, op.sub,
              op.credor_nome AS credor, op.elemento,
              COALESCE(op.valor_pagamento, 0) AS bruto,
              COALESCE(op.irrf, 0) + COALESCE(op.iss, 0) + COALESCE(op.inss, 0) + COALESCE(op.sest_senat, 0) AS retido,
              COALESCE(op.valor_liquido, 0) AS liquido,
              ${EXERCICIO_NE} AS exercicioNe
         ${FROM_OP}
        WHERE ${where}
        ORDER BY data, op.numero_empenho
        LIMIT ${LIMITE_OPS + 1}`,
      params
    ),
  ]);
  const lista = (rows || []).slice(0, LIMITE_OPS);
  return {
    ops: lista.map((r) => ({
      id: r.id, data: r.data ?? null, numeroOp: r.numeroOp ?? null, numeroNe: r.numeroNe ?? null, sub: r.sub ?? null,
      credor: r.credor ?? null, elemento: r.elemento ?? null,
      bruto: reais(c(r.bruto)), retido: reais(c(r.retido)), liquido: reais(c(r.liquido)),
      restos: e.base === 'civil' && r.exercicioNe != null && Number(r.exercicioNe) < ano,
    })),
    qtd: Number(totais?.[0]?.qtd) || 0,
    total: reais(c(totais?.[0]?.total)),
    limite: LIMITE_OPS,
    truncado: (rows || []).length > LIMITE_OPS,
  };
}

export { ErroPeriodo };
