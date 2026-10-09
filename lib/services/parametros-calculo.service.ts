import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { CHAVES_TRANSPORTE, type FaixaIrrf, type IssMunicipio, type ParametrosTransporte } from '@/lib/retencoes-transporte';
import { normalizarMunicipio, type PerfilCalculo } from '@/lib/perfis-calculo';
import { numero, validarFaixasIrrf, validarMunicipio, validarParametrosTransporte, type FaixaEdicao } from '@/lib/transporte-admin';

async function executar<T>(conn: PoolConnection | undefined, sql: string, values: any[]): Promise<T> {
  if (conn) {
    const [rows] = await conn.execute(sql, values);
    return rows as T;
  }
  return query<T>(sql, values);
}

const ERRO_VIGENCIA = 'Parâmetros de cálculo do transporte não cadastrados para a data';

const hojeLocal = (agora: Date) => new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** Data de referência da OP: pagamento, senão emissão, senão hoje ('YYYY-MM-DD'). */
export function dataReferenciaDaOp(
  dataPagamento: string | null | undefined,
  dataEmissao: string | null | undefined,
  agora: Date = new Date()
): string {
  for (const d of [dataPagamento, dataEmissao]) {
    if (d && /^\d{4}-\d{2}-\d{2}/.test(String(d))) return String(d).slice(0, 10);
  }
  return hojeLocal(agora);
}

/** Para cada chave, a linha de maior vigente_de <= data. Faltando alguma → 422. */
export async function obterParametrosVigentes(
  conn: PoolConnection | undefined,
  perfil: PerfilCalculo,
  data: string
): Promise<{ parametros: ParametrosTransporte; vigencia: string }> {
  const rows = await executar<Array<{ chave: string; valor: string | number; vigente_de: string }>>(
    conn,
    `SELECT chave, valor, DATE_FORMAT(vigente_de, '%Y-%m-%d') as vigente_de
       FROM calculo_parametros
      WHERE perfil = ? AND vigente_de <= ?
      ORDER BY chave, vigente_de DESC`,
    [perfil, data]
  );
  const parametros: Record<string, string | number> = {};
  let vigencia = '';
  for (const r of rows) {
    if (parametros[r.chave] !== undefined) continue; // já pegou a mais recente
    parametros[r.chave] = r.valor;
    if (r.vigente_de > vigencia) vigencia = r.vigente_de;
  }
  const faltando = CHAVES_TRANSPORTE.filter((c) => parametros[c] === undefined);
  if (faltando.length > 0) {
    throw { status: 422, error: `${ERRO_VIGENCIA} ${data.split('-').reverse().join('/')} (faltando: ${faltando.join(', ')}).` };
  }
  return { parametros: parametros as ParametrosTransporte, vigencia };
}

/** Faixas da tabela do IRRF de maior vigente_de <= data. Nenhuma → 422. */
export async function obterFaixasIrrfVigentes(
  conn: PoolConnection | undefined,
  data: string
): Promise<{ faixas: FaixaIrrf[]; vigencia: string }> {
  const [ultima] = await executar<Array<{ vigente_de: string | null }>>(
    conn,
    `SELECT DATE_FORMAT(MAX(vigente_de), '%Y-%m-%d') as vigente_de FROM irrf_faixas WHERE vigente_de <= ?`,
    [data]
  );
  const vigencia = ultima?.vigente_de;
  if (!vigencia) {
    throw { status: 422, error: `${ERRO_VIGENCIA} ${data.split('-').reverse().join('/')} (tabela do IRRF).` };
  }
  const rows = await executar<Array<{ ordem: number; limite_ate: string | null; aliquota: string; parcela_deduzir: string }>>(
    conn,
    `SELECT ordem, limite_ate, aliquota, parcela_deduzir FROM irrf_faixas WHERE vigente_de = ? ORDER BY ordem`,
    [vigencia]
  );
  return {
    vigencia,
    faixas: rows.map((r) => ({
      ordem: Number(r.ordem),
      limiteAte: r.limite_ate,
      aliquota: r.aliquota,
      parcelaDeduzir: r.parcela_deduzir,
    })),
  };
}

/** Casa o município do credor (normalizado) com a chave ou um dos apelidos. */
export async function obterIssMunicipio(
  conn: PoolConnection | undefined,
  cidade: string | null | undefined
): Promise<IssMunicipio | null> {
  const alvo = normalizarMunicipio(cidade);
  if (!alvo) return null;
  const rows = await executar<
    Array<{ chave: string; nome: string; aliquota: string; taxa_expediente: string; apelidos: string | null }>
  >(conn, 'SELECT chave, nome, aliquota, taxa_expediente, apelidos FROM iss_municipios WHERE ativo = 1', []);
  const achado = rows.find(
    (m) =>
      normalizarMunicipio(m.chave) === alvo ||
      (m.apelidos || '')
        .split(';')
        .map((a) => normalizarMunicipio(a))
        .filter(Boolean)
        .includes(alvo)
  );
  return achado ? { nome: achado.nome, aliquota: achado.aliquota, taxaExpediente: achado.taxa_expediente } : null;
}

// ===========================================================================
// Administração (T27): só ADMIN escreve; toda escrita em transação e auditada.
// ===========================================================================

export type ServiceResult<T = any> =
  | { success: true; data: T; status?: number }
  | { success: false; error: string; status: number };

const PERFIL_TRANSPORTE = 'TRANSPORTE_AUTONOMO';
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const negado = { success: false as const, error: 'Acesso negado. Somente o administrador altera estes parâmetros.', status: 403 };

const hoje = () => hojeLocal(new Date());

async function auditar(
  conn: PoolConnection,
  entidade: string,
  entidadeId: string,
  acao: string,
  antes: unknown,
  depois: unknown,
  usuarioId: string
) {
  await conn.execute(
    `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), entidade, entidadeId, acao, antes ? JSON.stringify(antes) : null, JSON.stringify(depois), usuarioId]
  );
}

/** Vigências já usadas por alguma OP (gravadas no snapshot do cálculo). */
async function vigenciasEmUso(campo: 'vigencia' | 'vigencia_irrf', conn?: PoolConnection): Promise<Set<string>> {
  const rows = await executar<Array<{ v: string | null }>>(
    conn,
    `SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(retencoes_snapshot, '$.${campo}')) as v
       FROM ordens_pagamento
      WHERE JSON_UNQUOTE(JSON_EXTRACT(retencoes_snapshot, '$.perfil')) = ?`,
    [PERFIL_TRANSPORTE]
  );
  return new Set(rows.map((r) => r.v).filter((v): v is string => !!v && v !== 'null'));
}

const atualDe = (vigencias: string[], dia: string): string | null => vigencias.filter((v) => v <= dia).sort().at(-1) ?? null;

const erroDe = (e: any): { success: false; error: string; status: number } | null =>
  e?.status && e?.error ? { success: false, error: e.error, status: e.status } : null;

function validarVigencia(vigenteDe: string): string | null {
  if (!DATA_ISO.test(vigenteDe)) return 'Informe a data de início da vigência (AAAA-MM-DD).';
  if (vigenteDe < hoje()) return 'A vigência deve começar hoje ou depois. Vigências passadas não podem ser alteradas.';
  return null;
}

// ---------------------------------------------------------------- parâmetros
export async function listarVigenciasParametros() {
  const rows = await query<Array<{ chave: string; valor: string; vigente_de: string }>>(
    `SELECT chave, valor, DATE_FORMAT(vigente_de, '%Y-%m-%d') as vigente_de
       FROM calculo_parametros WHERE perfil = ? ORDER BY vigente_de, chave`,
    [PERFIL_TRANSPORTE]
  );
  const porVigencia = new Map<string, Record<string, string>>();
  for (const r of rows) {
    if (!porVigencia.has(r.vigente_de)) porVigencia.set(r.vigente_de, {});
    porVigencia.get(r.vigente_de)![r.chave] = r.valor;
  }
  const emUso = await vigenciasEmUso('vigencia');
  const dia = hoje();
  const datas = [...porVigencia.keys()];
  return {
    hoje: dia,
    atual: atualDe(datas, dia),
    vigencias: datas.map((v) => ({
      vigenteDe: v,
      parametros: porVigencia.get(v)!,
      emUso: emUso.has(v),
      editavel: v >= dia && !emUso.has(v),
    })),
  };
}

export async function salvarVigenciaParametros(body: any, usuarioId: string, perfil: string): Promise<ServiceResult<null>> {
  if (perfil !== 'ADMIN') return negado;
  const vigenteDe = String(body?.vigenteDe ?? '');
  const parametros = body?.parametros ?? {};
  const erroVigencia = validarVigencia(vigenteDe);
  if (erroVigencia) return { success: false, error: erroVigencia, status: 400 };
  const erros = validarParametrosTransporte(parametros);
  if (erros.length > 0) return { success: false, error: erros.join(' '), status: 400 };

  try {
    await withTransaction(async (conn) => {
      if ((await vigenciasEmUso('vigencia', conn)).has(vigenteDe)) {
        throw { status: 409, error: 'Vigência já usada por OP: crie uma nova vigência.' };
      }
      const [antesRows]: any = await conn.execute(
        'SELECT chave, valor FROM calculo_parametros WHERE perfil = ? AND vigente_de = ? FOR UPDATE',
        [PERFIL_TRANSPORTE, vigenteDe]
      );
      const existia = (antesRows || []).length > 0;
      for (const chave of CHAVES_TRANSPORTE) {
        await conn.execute(
          `INSERT INTO calculo_parametros (perfil, chave, valor, vigente_de, updated_by) VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_by = VALUES(updated_by)`,
          [PERFIL_TRANSPORTE, chave, numero(parametros[chave]), vigenteDe, usuarioId]
        );
      }
      const antes = existia ? Object.fromEntries(antesRows.map((r: any) => [r.chave, r.valor])) : null;
      const depois = Object.fromEntries(CHAVES_TRANSPORTE.map((c) => [c, numero(parametros[c])]));
      await auditar(conn, 'calculo_parametros', `${PERFIL_TRANSPORTE}@${vigenteDe}`, existia ? 'UPDATE' : 'CREATE', antes, depois, usuarioId);
    });
  } catch (e: any) {
    const r = erroDe(e);
    if (r) return r;
    throw e;
  }
  return { success: true, data: null };
}

// ---------------------------------------------------------------- tabela do IRRF
export async function listarVigenciasIrrf() {
  const rows = await query<
    Array<{ vigente_de: string; ordem: number; limite_ate: string | null; aliquota: string; parcela_deduzir: string }>
  >(
    `SELECT DATE_FORMAT(vigente_de, '%Y-%m-%d') as vigente_de, ordem, limite_ate, aliquota, parcela_deduzir
       FROM irrf_faixas ORDER BY vigente_de, ordem`,
    []
  );
  const porVigencia = new Map<string, FaixaIrrf[]>();
  for (const r of rows) {
    if (!porVigencia.has(r.vigente_de)) porVigencia.set(r.vigente_de, []);
    porVigencia.get(r.vigente_de)!.push({
      ordem: Number(r.ordem),
      limiteAte: r.limite_ate,
      aliquota: r.aliquota,
      parcelaDeduzir: r.parcela_deduzir,
    });
  }
  const emUso = await vigenciasEmUso('vigencia_irrf');
  const dia = hoje();
  const datas = [...porVigencia.keys()];
  return {
    hoje: dia,
    atual: atualDe(datas, dia),
    vigencias: datas.map((v) => ({
      vigenteDe: v,
      faixas: porVigencia.get(v)!,
      emUso: emUso.has(v),
      editavel: v >= dia && !emUso.has(v),
    })),
  };
}

export async function salvarFaixasIrrf(body: any, usuarioId: string, perfil: string): Promise<ServiceResult<null>> {
  if (perfil !== 'ADMIN') return negado;
  const vigenteDe = String(body?.vigenteDe ?? '');
  const faixas: FaixaEdicao[] = Array.isArray(body?.faixas) ? body.faixas : [];
  const erroVigencia = validarVigencia(vigenteDe);
  if (erroVigencia) return { success: false, error: erroVigencia, status: 400 };
  const erros = validarFaixasIrrf(faixas);
  if (erros.length > 0) return { success: false, error: erros.join(' '), status: 400 };

  try {
    await withTransaction(async (conn) => {
      if ((await vigenciasEmUso('vigencia_irrf', conn)).has(vigenteDe)) {
        throw { status: 409, error: 'Tabela do IRRF já usada por OP: crie uma nova vigência.' };
      }
      const [antes]: any = await conn.execute(
        'SELECT ordem, limite_ate, aliquota, parcela_deduzir FROM irrf_faixas WHERE vigente_de = ? ORDER BY ordem FOR UPDATE',
        [vigenteDe]
      );
      await conn.execute('DELETE FROM irrf_faixas WHERE vigente_de = ?', [vigenteDe]);
      const depois = faixas.map((f, i) => ({
        ordem: i + 1,
        limite_ate: i === faixas.length - 1 ? null : numero(f.limiteAte),
        aliquota: numero(f.aliquota),
        parcela_deduzir: numero(f.parcelaDeduzir),
      }));
      for (const f of depois) {
        await conn.execute(
          'INSERT INTO irrf_faixas (vigente_de, ordem, limite_ate, aliquota, parcela_deduzir, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
          [vigenteDe, f.ordem, f.limite_ate, f.aliquota, f.parcela_deduzir, usuarioId]
        );
      }
      const existia = (antes || []).length > 0;
      await auditar(conn, 'irrf_faixas', vigenteDe, existia ? 'UPDATE' : 'CREATE', existia ? antes : null, depois, usuarioId);
    });
  } catch (e: any) {
    const r = erroDe(e);
    if (r) return r;
    throw e;
  }
  return { success: true, data: null };
}

// ---------------------------------------------------------------- ISS por município
const normalizarApelidos = (v: unknown): string | null => {
  const lista = String(v ?? '')
    .split(';')
    .map((a) => normalizarMunicipio(a))
    .filter(Boolean);
  return lista.length ? [...new Set(lista)].join(';') : null;
};

export async function listarIssMunicipios() {
  const rows = await query<any[]>(
    'SELECT chave, nome, uf, aliquota, taxa_expediente, apelidos, ativo FROM iss_municipios ORDER BY nome',
    []
  );
  return rows.map((r) => ({
    chave: r.chave,
    nome: r.nome,
    uf: r.uf,
    aliquota: r.aliquota,
    taxaExpediente: r.taxa_expediente,
    apelidos: r.apelidos,
    ativo: !!Number(r.ativo),
  }));
}

export async function criarIssMunicipio(body: any, usuarioId: string, perfil: string): Promise<ServiceResult<{ chave: string }>> {
  if (perfil !== 'ADMIN') return negado;
  const erros = validarMunicipio({ ...body, ativo: true });
  if (erros.length > 0) return { success: false, error: erros.join(' '), status: 400 };
  const chave = normalizarMunicipio(body.nome);
  const dados = {
    chave,
    nome: String(body.nome).trim().replace(/\s+/g, ' '),
    uf: String(body.uf).trim().toUpperCase(),
    aliquota: numero(body.aliquota),
    taxa_expediente: numero(body.taxaExpediente),
    apelidos: normalizarApelidos(body.apelidos),
  };
  try {
    await withTransaction(async (conn) => {
      const [existe]: any = await conn.execute('SELECT chave FROM iss_municipios WHERE chave = ? FOR UPDATE', [chave]);
      if (existe?.length) throw { status: 409, error: `O município "${dados.nome}" já está cadastrado.` };
      await conn.execute(
        `INSERT INTO iss_municipios (chave, nome, uf, aliquota, taxa_expediente, apelidos, ativo, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [dados.chave, dados.nome, dados.uf, dados.aliquota, dados.taxa_expediente, dados.apelidos, usuarioId]
      );
      await auditar(conn, 'iss_municipios', chave, 'CREATE', null, dados, usuarioId);
    });
  } catch (e: any) {
    const r = erroDe(e);
    if (r) return r;
    throw e;
  }
  return { success: true, data: { chave }, status: 201 };
}

export async function atualizarIssMunicipio(body: any, usuarioId: string, perfil: string): Promise<ServiceResult<null>> {
  if (perfil !== 'ADMIN') return negado;
  const chave = String(body?.chave ?? '');
  if (!chave) return { success: false, error: 'Município não informado.', status: 400 };
  try {
    await withTransaction(async (conn) => {
      const [rows]: any = await conn.execute('SELECT * FROM iss_municipios WHERE chave = ? FOR UPDATE', [chave]);
      const antes = rows?.[0];
      if (!antes) throw { status: 404, error: 'Município não encontrado.' };
      const erros = validarMunicipio({ nome: antes.nome, ...body });
      if (erros.length > 0) throw { status: 400, error: erros.join(' ') };
      const depois = {
        uf: String(body.uf).trim().toUpperCase(),
        aliquota: numero(body.aliquota),
        taxa_expediente: numero(body.taxaExpediente),
        apelidos: normalizarApelidos(body.apelidos),
        ativo: body.ativo === false ? 0 : 1,
      };
      await conn.execute(
        'UPDATE iss_municipios SET uf = ?, aliquota = ?, taxa_expediente = ?, apelidos = ?, ativo = ?, updated_by = ? WHERE chave = ?',
        [depois.uf, depois.aliquota, depois.taxa_expediente, depois.apelidos, depois.ativo, usuarioId, chave]
      );
      await auditar(conn, 'iss_municipios', chave, 'UPDATE', antes, { ...antes, ...depois }, usuarioId);
    });
  } catch (e: any) {
    const r = erroDe(e);
    if (r) return r;
    throw e;
  }
  return { success: true, data: null };
}
