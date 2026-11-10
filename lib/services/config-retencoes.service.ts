import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { configRetencaoCampoSchema, configRetencoesSchema } from '@/lib/schemas';
import { ConfigRetencaoDB, ElementoRetencaoDB } from '@/lib/types/db';
import { z } from 'zod';
import { CAMPOS_TRIBUTARIOS, ehTaxaExtra, slugTaxaExtra, type CampoTributario } from '@/lib/retencoes';
import { codigoDoElementoPai } from '@/lib/elementos';
import { perfilDoElemento } from '@/lib/perfis-calculo';

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

/** A migration_20 ainda não rodou: sem a tabela, todo subelemento segue o elemento. */
const semTabela = (e: any) => e?.code === 'ER_NO_SUCH_TABLE' || e?.errno === 1146;

/** Transporte (3.3.90.33) tem cálculo próprio: subelemento dele não tem regra própria (R5). */
export function subelementoAceitaRegraPropria(subelementoCodigo: string): boolean {
  return perfilDoElemento(codigoDoElementoPai(subelementoCodigo)) !== 'TRANSPORTE_AUTONOMO';
}

/**
 * "irrf, iss" → ['irrf', 'iss'], na ordem dos tributários; '' → [] (nenhuma
 * retenção). B12: as taxas criadas ("x_…") vêm depois, na ordem gravada.
 */
export function camposDoTexto(texto: string | null | undefined): string[] {
  const lidos = String(texto ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  const unicos = [...new Set(lidos)];
  return [...CAMPOS_TRIBUTARIOS.filter((c) => unicos.includes(c)), ...unicos.filter((c) => ehTaxaExtra(c))];
}

/** B12: taxas percentuais criadas pelo ADMIN — as únicas "x_" que entram na Matriz. */
async function extrasPercentuais(conn: PoolConnection | undefined): Promise<Set<string>> {
  const rows = await executar<{ campo: string; tipo: string }[]>(conn, 'SELECT campo, tipo FROM config_retencoes');
  return new Set((rows || []).filter((r) => ehTaxaExtra(r.campo) && r.tipo === 'PERCENTUAL').map((r) => r.campo));
}

function conferirExtrasDaMatriz(campos: string[], validos: Set<string>) {
  for (const campo of campos) {
    if (ehTaxaExtra(campo) && !validos.has(campo)) {
      throw { status: 400, error: `Taxa "${campo}" não existe ou não é percentual: não pode entrar na Matriz.` };
    }
  }
}

/** B7a: regras próprias por subelemento (subelemento_retencoes). Tabela inexistente → {}. */
export async function montarRegrasSubelemento(conn: PoolConnection | undefined): Promise<Record<string, string[]>> {
  let rows: { subelemento_codigo: string; campos: string | null }[];
  try {
    rows = await executar(conn, 'SELECT subelemento_codigo, campos FROM subelemento_retencoes');
  } catch (e) {
    if (semTabela(e)) return {};
    throw e;
  }
  const regras: Record<string, string[]> = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!subelementoAceitaRegraPropria(r.subelemento_codigo)) continue;
    regras[r.subelemento_codigo] = camposDoTexto(r.campos);
  }
  return regras;
}

/**
 * B9: alíquota do IRRF por subelemento (natureza; tabela subelemento_irrf,
 * migration_22). Tabela inexistente → {} (todos seguem a alíquota padrão).
 * Transporte tem cálculo próprio e não entra.
 */
export async function montarIrrfSubelemento(conn: PoolConnection | undefined): Promise<Record<string, number>> {
  let rows: { subelemento_codigo: string; aliquota: string | number }[];
  try {
    rows = await executar(conn, 'SELECT subelemento_codigo, aliquota FROM subelemento_irrf');
  } catch (e) {
    if (semTabela(e)) return {};
    throw e;
  }
  const mapa: Record<string, number> = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    const v = Number(r.aliquota);
    if (!subelementoAceitaRegraPropria(r.subelemento_codigo) || !Number.isFinite(v)) continue;
    mapa[r.subelemento_codigo] = v;
  }
  return mapa;
}

export async function obterConfigRetencoes(conn?: PoolConnection) {
  const camposRows = await executar<ConfigRetencaoDB[]>(conn, 'SELECT * FROM config_retencoes ORDER BY ordem');
  const regras = await montarRegras(conn);
  const versaoRow = await executar<{ versao: Date | string | null }[]>(
    conn,
    'SELECT MAX(updated_at) as versao FROM config_retencoes'
  );
  const versao = versaoRow[0]?.versao ? new Date(versaoRow[0].versao).toISOString() : new Date(0).toISOString();
  // Por último: a tabela da migration_20 pode não existir (vira {}).
  const regrasSubelemento = await montarRegrasSubelemento(conn);
  // B9: idem, a tabela da migration_22 pode não existir.
  const irrfSubelemento = await montarIrrfSubelemento(conn);

  return {
    campos: camposRows.map(mapCampo),
    regras,
    regrasSubelemento,
    irrfSubelemento,
    versao,
  };
}

export const regraSubelementoSchema = z.object({
  subelementoCodigo: z.string().trim().regex(/^\d(?:\.\d+){4,}$/, 'Código de subelemento inválido.'),
  /** null = sem regra própria (segue o elemento); [] = nenhuma retenção. */
  campos: z
    .array(z.string().refine((c) => (CAMPOS_TRIBUTARIOS as string[]).includes(c) || ehTaxaExtra(c), 'Campo de retenção inválido.'))
    .max(40)
    .nullable(),
});

/**
 * B7a: grava (ou tira) a regra própria de um subelemento. Só o Admin; o
 * subelemento tem que existir e não pode ser do transporte. Auditoria com o
 * antes e o depois (null = seguia/segue o elemento).
 */
export async function salvarRegraSubelemento(
  body: unknown,
  usuarioId: string,
  perfil: string
): Promise<ServiceResult<{ subelementoCodigo: string; campos: string[] | null }>> {
  if (perfil !== 'ADMIN') {
    return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
  }
  const parsed = regraSubelementoSchema.parse(body); // ZodError -> 400
  const codigo = parsed.subelementoCodigo;
  const novo = parsed.campos === null ? null : camposDoTexto(parsed.campos.join(','));

  if (!subelementoAceitaRegraPropria(codigo)) {
    return { success: false, error: 'Subelemento de transporte (3.3.90.33) tem cálculo próprio e não aceita regra por subelemento.', status: 400 };
  }

  try {
    await withTransaction(async (conn) => {
      const sub = await executar<{ codigo: string }[]>(conn, 'SELECT codigo FROM subelementos_despesa WHERE codigo = ?', [codigo]);
      if (!sub || sub.length === 0) throw { status: 400, error: `Subelemento "${codigo}" não encontrado.` };
      if (novo && novo.some((c) => ehTaxaExtra(c))) conferirExtrasDaMatriz(novo, await extrasPercentuais(conn));

      const atual = await executar<{ campos: string | null }[]>(
        conn,
        'SELECT campos FROM subelemento_retencoes WHERE subelemento_codigo = ? FOR UPDATE',
        [codigo]
      );
      const antes = atual && atual.length > 0 ? camposDoTexto(atual[0].campos) : null;
      if (JSON.stringify(antes) === JSON.stringify(novo)) return;

      if (novo === null) {
        await executar(conn, 'DELETE FROM subelemento_retencoes WHERE subelemento_codigo = ?', [codigo]);
      } else {
        await executar(
          conn,
          `INSERT INTO subelemento_retencoes (subelemento_codigo, campos, atualizado_por) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE campos = VALUES(campos), atualizado_por = VALUES(atualizado_por)`,
          [codigo, novo.join(','), usuarioId]
        );
      }
      await executar(
        conn,
        `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), 'subelemento_retencoes', codigo, 'UPDATE', JSON.stringify({ campos: antes }), JSON.stringify({ campos: novo }), usuarioId]
      );
    });
  } catch (error: any) {
    if (semTabela(error)) {
      return {
        success: false,
        error: 'A tabela de regras por subelemento ainda não existe. Rode a migration_20 no banco para poder salvar.',
        status: 409,
      };
    }
    if (error.status && error.error) return { success: false, error: error.error, status: error.status };
    throw error;
  }
  return { success: true, data: { subelementoCodigo: codigo, campos: novo } };
}

export const aliquotaIrrfSubelementoSchema = z.object({
  subelementoCodigo: z.string().trim().regex(/^\d(?:\.\d+){4,}$/, 'Código de subelemento inválido.'),
  /** null = sem alíquota própria (vale a alíquota padrão do IRRF). */
  aliquota: z.number().min(0, 'Alíquota entre 0 e 100.').max(100, 'Alíquota entre 0 e 100.').nullable(),
});

/**
 * B9: grava (ou tira) a alíquota do IRRF pela natureza de um subelemento.
 * Só o Admin; o subelemento tem que existir e não pode ser do transporte.
 * Auditoria com o antes e o depois (null = alíquota padrão).
 */
export async function salvarAliquotaIrrfSubelemento(
  body: unknown,
  usuarioId: string,
  perfil: string
): Promise<ServiceResult<{ subelementoCodigo: string; aliquota: number | null }>> {
  if (perfil !== 'ADMIN') {
    return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
  }
  const parsed = aliquotaIrrfSubelementoSchema.parse(body); // ZodError -> 400
  const codigo = parsed.subelementoCodigo;
  const novo = parsed.aliquota === null ? null : Math.round(parsed.aliquota * 10000) / 10000;

  if (!subelementoAceitaRegraPropria(codigo)) {
    return { success: false, error: 'Subelemento de transporte (3.3.90.33) tem cálculo próprio e não aceita alíquota por natureza.', status: 400 };
  }

  try {
    await withTransaction(async (conn) => {
      const sub = await executar<{ codigo: string }[]>(conn, 'SELECT codigo FROM subelementos_despesa WHERE codigo = ?', [codigo]);
      if (!sub || sub.length === 0) throw { status: 400, error: `Subelemento "${codigo}" não encontrado.` };

      const atual = await executar<{ aliquota: string | number }[]>(
        conn,
        'SELECT aliquota FROM subelemento_irrf WHERE subelemento_codigo = ? FOR UPDATE',
        [codigo]
      );
      const antes = atual && atual.length > 0 ? Number(atual[0].aliquota) : null;
      if (antes === novo) return;

      if (novo === null) {
        await executar(conn, 'DELETE FROM subelemento_irrf WHERE subelemento_codigo = ?', [codigo]);
      } else {
        await executar(
          conn,
          `INSERT INTO subelemento_irrf (subelemento_codigo, aliquota, atualizado_por) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE aliquota = VALUES(aliquota), atualizado_por = VALUES(atualizado_por)`,
          [codigo, novo, usuarioId]
        );
      }
      await executar(
        conn,
        `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), 'subelemento_irrf', codigo, 'UPDATE', JSON.stringify({ aliquota: antes }), JSON.stringify({ aliquota: novo }), usuarioId]
      );
    });
  } catch (error: any) {
    if (semTabela(error)) {
      return {
        success: false,
        error: 'A tabela de alíquotas por natureza ainda não existe. Rode a migration_22 no banco para poder salvar.',
        status: 409,
      };
    }
    if (error.status && error.error) return { success: false, error: error.error, status: error.status };
    throw error;
  }
  return { success: true, data: { subelementoCodigo: codigo, aliquota: novo } };
}

export const novaTaxaSchema = z.object({
  rotulo: z.string().trim().min(1).max(60),
  tipo: z.enum(['PERCENTUAL', 'VALOR_DIGITADO']),
  aliquota: z.number().nullable().optional(),
  calculoAutomatico: z.boolean().optional(),
  editavelOperador: z.boolean().optional(),
  entraDarf: z.boolean().optional(),
});

/**
 * B12: o ADMIN cria uma taxa nova ("x_<slug do rótulo>"). Não há exclusão:
 * taxa usada em OP só se desativa. Auditoria com a taxa criada.
 */
export async function criarTaxaExtra(
  body: unknown,
  usuarioId: string,
  perfil: string
): Promise<ServiceResult<ConfigRetencaoCampoMapeado>> {
  if (perfil !== 'ADMIN') {
    return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
  }
  const dados = novaTaxaSchema.parse(body); // ZodError -> 400
  const campo = slugTaxaExtra(dados.rotulo);
  if (!campo) return { success: false, error: 'Rótulo inválido: use letras ou números.', status: 400 };
  const percentual = dados.tipo === 'PERCENTUAL';
  const linha = configRetencaoCampoSchema.parse({
    campo,
    rotulo: dados.rotulo,
    tipo: dados.tipo,
    aliquota: percentual ? (dados.aliquota ?? null) : null,
    calculoAutomatico: percentual ? (dados.calculoAutomatico ?? true) : false,
    editavelOperador: percentual ? !!dados.editavelOperador : true,
    entraDarf: percentual ? !!dados.entraDarf : false,
    ativo: true,
    ordem: 0,
  });

  try {
    const criada = await withTransaction(async (conn) => {
      const existentes = await executar<{ campo: string; ordem: number }[]>(conn, 'SELECT campo, ordem FROM config_retencoes FOR UPDATE');
      if ((existentes || []).some((r) => r.campo === campo)) {
        throw { status: 409, error: `Já existe uma taxa com esse nome (${campo}). Use outro rótulo.` };
      }
      const ordem = Math.max(0, ...(existentes || []).map((r) => Number(r.ordem) || 0)) + 10;
      await executar(
        conn,
        `INSERT INTO config_retencoes
           (campo, rotulo, tipo, aliquota, calculo_automatico, editavel_operador, entra_darf, ativo, ordem, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [campo, linha.rotulo, linha.tipo, linha.aliquota, linha.calculoAutomatico ? 1 : 0, linha.editavelOperador ? 1 : 0, linha.entraDarf ? 1 : 0, ordem, usuarioId]
      );
      const nova = { ...linha, ordem } as ConfigRetencaoCampoMapeado;
      await executar(
        conn,
        `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), 'config_retencoes', campo, 'CREATE', null, JSON.stringify(nova), usuarioId]
      );
      return nova;
    });
    return { success: true, data: criada, status: 201 };
  } catch (error: any) {
    if (error.status && error.error) return { success: false, error: error.error, status: error.status };
    throw error;
  }
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
      // B12: "x_" na Matriz só se for taxa percentual que existe.
      const extrasValidas = new Set(
        configRowsAntes.filter((r: any) => ehTaxaExtra(r.campo) && r.tipo === 'PERCENTUAL').map((r: any) => r.campo)
      );
      for (const campos of Object.values(parsed.regras)) conferirExtrasDaMatriz(campos, extrasValidas);

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
