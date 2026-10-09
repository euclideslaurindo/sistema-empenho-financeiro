import { query } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { CHAVES_TRANSPORTE, type FaixaIrrf, type IssMunicipio, type ParametrosTransporte } from '@/lib/retencoes-transporte';
import { normalizarMunicipio, type PerfilCalculo } from '@/lib/perfis-calculo';

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
