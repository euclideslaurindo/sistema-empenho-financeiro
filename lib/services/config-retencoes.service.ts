import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { configRetencoesSchema } from '@/lib/schemas';
import { ConfigRetencaoDB, ElementoRetencaoDB } from '@/lib/types/db';

export type ServiceResult<T = any> =
  | { success: true; data: T; status?: number }
  | { success: false; error: string; status: number };

const ENTIDADE_ID_CONFIG = 'config_retencoes_global';

/** Shape devolvido por mapCampo — reaproveitado pelo motor de cálculo (T10), não duplicado. */
export interface ConfigRetencaoCampoMapeado {
  campo: string;
  rotulo: string;
  tipo: string;
  aliquota: number | null;
  calculoAutomatico: boolean;
  editavelOperador: boolean;
  entraDarf: boolean;
  ativo: boolean;
  ordem: number;
}

/** Roteia pra conn.execute (dentro de transação, formato tupla) ou pro query() direto do pool. */
async function executar<T>(conn: PoolConnection | undefined, sql: string, values?: any[]): Promise<T> {
  if (conn) {
    const [rows] = await conn.execute(sql, values);
    return rows as T;
  }
  return query<T>(sql, values);
}

function mapCampo(row: ConfigRetencaoDB): ConfigRetencaoCampoMapeado {
  return {
    campo: row.campo,
    rotulo: row.rotulo,
    tipo: row.tipo,
    aliquota: row.aliquota === null ? null : Number(row.aliquota),
    calculoAutomatico: !!row.calculo_automatico,
    editavelOperador: !!row.editavel_operador,
    entraDarf: !!row.entra_darf,
    ativo: !!row.ativo,
    ordem: row.ordem,
  };
}

async function montarRegras(conn: PoolConnection | undefined): Promise<Record<string, string[]>> {
  const elementos = await executar<{ codigo: string }[]>(conn, 'SELECT codigo FROM elementos_despesa WHERE ativo = 1');
  const retencoes = await executar<ElementoRetencaoDB[]>(conn, 'SELECT elemento_codigo, campo FROM elemento_retencoes');

  const regras: Record<string, string[]> = {};
  for (const el of elementos) {
    regras[el.codigo] = retencoes.filter((r) => r.elemento_codigo === el.codigo).map((r) => r.campo);
  }
  return regras;
}

export async function obterConfigRetencoes(conn?: PoolConnection) {
  const camposRows = await executar<ConfigRetencaoDB[]>(conn, 'SELECT * FROM config_retencoes ORDER BY ordem');
  const regras = await montarRegras(conn);
  const versaoRow = await executar<{ versao: Date | string | null }[]>(
    conn,
    'SELECT MAX(updated_at) as versao FROM config_retencoes'
  );
  const versao = versaoRow[0]?.versao ? new Date(versaoRow[0].versao).toISOString() : new Date(0).toISOString();

  return {
    campos: camposRows.map(mapCampo),
    regras,
    versao,
  };
}

export async function salvarConfigRetencoes(body: any, usuarioId: string | null): Promise<ServiceResult<null>> {
  const parsed = configRetencoesSchema.parse(body); // ZodError sobe -> 400 via withErrorHandler

  try {
    await withTransaction(async (conn) => {
      // Trava as 8 linhas pra serializar PUTs concorrentes.
      const configRowsAntes = await executar<ConfigRetencaoDB[]>(conn, 'SELECT * FROM config_retencoes FOR UPDATE');
      const versaoAtual =
        configRowsAntes.length > 0
          ? new Date(Math.max(...configRowsAntes.map((r) => new Date(r.updated_at).getTime()))).toISOString()
          : new Date(0).toISOString();

      if (parsed.versaoBase && parsed.versaoBase !== versaoAtual) {
        throw { status: 409, error: 'A configuração foi alterada por outro administrador.' };
      }

      const elementosExistentes = await executar<{ codigo: string }[]>(conn, 'SELECT codigo FROM elementos_despesa');
      const codigosValidos = new Set(elementosExistentes.map((e) => e.codigo));
      for (const elementoCodigo of Object.keys(parsed.regras)) {
        if (!codigosValidos.has(elementoCodigo)) {
          throw { status: 400, error: `Elemento "${elementoCodigo}" não encontrado.` };
        }
      }

      const antes = { campos: configRowsAntes.map(mapCampo), regras: await montarRegras(conn) };

      for (const c of parsed.campos) {
        await executar(
          conn,
          `UPDATE config_retencoes
             SET rotulo = ?, tipo = ?, aliquota = ?, calculo_automatico = ?, editavel_operador = ?, entra_darf = ?, ativo = ?, ordem = ?, updated_by = ?
           WHERE campo = ?`,
          [
            c.rotulo,
            c.tipo,
            c.aliquota,
            c.calculoAutomatico ? 1 : 0,
            c.editavelOperador ? 1 : 0,
            c.entraDarf ? 1 : 0,
            c.ativo ? 1 : 0,
            c.ordem,
            usuarioId,
            c.campo,
          ]
        );
      }

      for (const [elementoCodigo, campos] of Object.entries(parsed.regras)) {
        await executar(conn, 'DELETE FROM elemento_retencoes WHERE elemento_codigo = ?', [elementoCodigo]);
        for (const campo of campos) {
          await executar(conn, 'INSERT INTO elemento_retencoes (elemento_codigo, campo) VALUES (?, ?)', [
            elementoCodigo,
            campo,
          ]);
        }
      }

      // Garante que a "versão" (MAX(updated_at)) avança mesmo quando só a
      // matriz (regras) mudou — elemento_retencoes não tem updated_at próprio.
      await executar(conn, `UPDATE config_retencoes SET updated_at = CURRENT_TIMESTAMP WHERE campo = 'irrf'`);

      const configRowsDepois = await executar<ConfigRetencaoDB[]>(conn, 'SELECT * FROM config_retencoes ORDER BY ordem');
      const depois = { campos: configRowsDepois.map(mapCampo), regras: await montarRegras(conn) };

      await executar(
        conn,
        `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          'config_retencoes',
          ENTIDADE_ID_CONFIG,
          'UPDATE',
          JSON.stringify(antes),
          JSON.stringify(depois),
          usuarioId,
        ]
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
