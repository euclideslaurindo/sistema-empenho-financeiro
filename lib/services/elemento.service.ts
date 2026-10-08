import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import {
  elementoCreateSchema,
  elementoUpdateSchema,
  subelementoCreateSchema,
  subelementoUpdateSchema,
} from '@/lib/schemas';
import { montarValorElemento } from '@/lib/elementos';
import { ElementoDespesaDB, SubelementoDespesaDB, ElementoRetencaoDB } from '@/lib/types/db';

export type ServiceResult<T = any> =
  | { success: true; data: T; status?: number }
  | { success: false; error: string; status: number };

async function registrarAuditoria(
  conn: PoolConnection | null,
  params: {
    entidade: string;
    entidadeId: string;
    acao: 'CREATE' | 'UPDATE' | 'DELETE';
    antes: any;
    depois: any;
    usuarioId: string | null;
  }
) {
  const sql = `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const values = [
    crypto.randomUUID(),
    params.entidade,
    params.entidadeId,
    params.acao,
    params.antes ? JSON.stringify(params.antes) : null,
    params.depois ? JSON.stringify(params.depois) : null,
    params.usuarioId,
  ];
  if (conn) {
    await conn.execute(sql, values);
  } else {
    await query(sql, values);
  }
}

export class ElementoService {
  static async listar(params: { incluirInativos?: boolean } = {}) {
    const { incluirInativos = false } = params;

    const elementosSql = incluirInativos
      ? 'SELECT codigo, descricao, legado, ativo, ordem FROM elementos_despesa ORDER BY ordem'
      : 'SELECT codigo, descricao, legado, ativo, ordem FROM elementos_despesa WHERE ativo = 1 ORDER BY ordem';
    const subelementosSql = incluirInativos
      ? 'SELECT codigo, elemento_codigo, descricao, ativo, ordem FROM subelementos_despesa ORDER BY ordem'
      : 'SELECT codigo, elemento_codigo, descricao, ativo, ordem FROM subelementos_despesa WHERE ativo = 1 ORDER BY ordem';

    const [elementosRows, subelementosRows, retencoesRows] = await Promise.all([
      query<ElementoDespesaDB[]>(elementosSql),
      query<SubelementoDespesaDB[]>(subelementosSql),
      query<ElementoRetencaoDB[]>('SELECT elemento_codigo, campo FROM elemento_retencoes'),
    ]);

    const elementos = elementosRows.map((el) => {
      const subelementos = subelementosRows
        .filter((s) => s.elemento_codigo === el.codigo)
        .map((s) => ({
          codigo: s.codigo,
          descricao: s.descricao,
          valor: montarValorElemento(s),
        }));

      const retencoes = retencoesRows.filter((r) => r.elemento_codigo === el.codigo).map((r) => r.campo);

      return {
        codigo: el.codigo,
        descricao: el.descricao,
        valor: montarValorElemento(el),
        legado: !!el.legado,
        ativo: !!el.ativo,
        ordem: el.ordem,
        retencoes,
        subelementos,
      };
    });

    return { success: true as const, data: { elementos } };
  }

  static async criar(body: any, usuarioId: string | null): Promise<ServiceResult<{ codigo: string }>> {
    const parsed = elementoCreateSchema.parse(body);

    const novo = {
      codigo: parsed.codigo,
      descricao: parsed.descricao,
      legado: 0, // todo elemento criado pela API nasce não-legado
      ativo: parsed.ativo ? 1 : 0,
      ordem: parsed.ordem,
    };

    try {
      await query(
        'INSERT INTO elementos_despesa (codigo, descricao, legado, ativo, ordem) VALUES (?, ?, ?, ?, ?)',
        [novo.codigo, novo.descricao, novo.legado, novo.ativo, novo.ordem]
      );
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        return { success: false, error: 'Código já cadastrado.', status: 409 };
      }
      throw err;
    }

    await registrarAuditoria(null, {
      entidade: 'elementos_despesa',
      entidadeId: novo.codigo,
      acao: 'CREATE',
      antes: null,
      depois: novo,
      usuarioId,
    });

    return { success: true, data: { codigo: novo.codigo }, status: 201 };
  }

  static async atualizar(codigo: string, body: any, usuarioId: string | null): Promise<ServiceResult<null>> {
    try {
      await withTransaction(async (conn) => {
        const [rows]: any = await conn.execute('SELECT * FROM elementos_despesa WHERE codigo = ? FOR UPDATE', [codigo]);
        if (!rows || rows.length === 0) {
          throw { status: 404, error: 'Elemento não encontrado.' };
        }
        const antes = rows[0];

        const parsed = elementoUpdateSchema.parse(body);

        const campos: Record<string, any> = {};
        if (parsed.descricao !== undefined) campos.descricao = parsed.descricao;
        if (parsed.ordem !== undefined) campos.ordem = parsed.ordem;
        if (parsed.ativo !== undefined) campos.ativo = parsed.ativo ? 1 : 0;
        if (parsed.legado !== undefined) campos.legado = parsed.legado ? 1 : 0;

        if (Object.keys(campos).length === 0) return;

        const setClauses = Object.keys(campos).map((c) => `${c} = ?`).join(', ');
        const values = [...Object.values(campos), codigo];
        await conn.execute(`UPDATE elementos_despesa SET ${setClauses} WHERE codigo = ?`, values);

        await registrarAuditoria(conn, {
          entidade: 'elementos_despesa',
          entidadeId: codigo,
          acao: 'UPDATE',
          antes,
          depois: { ...antes, ...campos },
          usuarioId,
        });
      });
    } catch (error: any) {
      if (error.status && error.error) {
        return { success: false, error: error.error, status: error.status };
      }
      throw error;
    }

    return { success: true, data: null };
  }

  static async excluir(codigo: string, usuarioId: string | null): Promise<ServiceResult<null>> {
    try {
      await withTransaction(async (conn) => {
        const [rows]: any = await conn.execute('SELECT * FROM elementos_despesa WHERE codigo = ? FOR UPDATE', [codigo]);
        if (!rows || rows.length === 0) {
          throw { status: 404, error: 'Elemento não encontrado.' };
        }
        const antes = rows[0];

        await conn.execute('UPDATE elementos_despesa SET ativo = 0 WHERE codigo = ?', [codigo]);

        await registrarAuditoria(conn, {
          entidade: 'elementos_despesa',
          entidadeId: codigo,
          acao: 'UPDATE',
          antes,
          depois: { ...antes, ativo: 0 },
          usuarioId,
        });
      });
    } catch (error: any) {
      if (error.status && error.error) {
        return { success: false, error: error.error, status: error.status };
      }
      throw error;
    }

    return { success: true, data: null };
  }
}

export class SubelementoService {
  static async listar(params: { incluirInativos?: boolean } = {}) {
    const { incluirInativos = false } = params;
    const sql = incluirInativos
      ? 'SELECT codigo, elemento_codigo, descricao, ativo, ordem FROM subelementos_despesa ORDER BY ordem'
      : 'SELECT codigo, elemento_codigo, descricao, ativo, ordem FROM subelementos_despesa WHERE ativo = 1 ORDER BY ordem';
    const rows = await query<SubelementoDespesaDB[]>(sql);

    const subelementos = rows.map((s) => ({
      codigo: s.codigo,
      elementoCodigo: s.elemento_codigo,
      descricao: s.descricao,
      valor: montarValorElemento(s),
      ativo: !!s.ativo,
      ordem: s.ordem,
    }));

    return { success: true as const, data: { subelementos } };
  }

  static async criar(body: any, usuarioId: string | null): Promise<ServiceResult<{ codigo: string }>> {
    const parsed = subelementoCreateSchema.parse(body);

    const elementoExiste = await query<{ codigo: string }[]>('SELECT codigo FROM elementos_despesa WHERE codigo = ?', [
      parsed.elementoCodigo,
    ]);
    if (!elementoExiste || elementoExiste.length === 0) {
      return { success: false, error: 'Elemento não encontrado.', status: 400 };
    }

    const novo = {
      codigo: parsed.codigo,
      elemento_codigo: parsed.elementoCodigo,
      descricao: parsed.descricao,
      ativo: parsed.ativo ? 1 : 0,
      ordem: parsed.ordem,
    };

    try {
      await query(
        'INSERT INTO subelementos_despesa (codigo, elemento_codigo, descricao, ativo, ordem) VALUES (?, ?, ?, ?, ?)',
        [novo.codigo, novo.elemento_codigo, novo.descricao, novo.ativo, novo.ordem]
      );
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        return { success: false, error: 'Código já cadastrado.', status: 409 };
      }
      throw err;
    }

    await registrarAuditoria(null, {
      entidade: 'subelementos_despesa',
      entidadeId: novo.codigo,
      acao: 'CREATE',
      antes: null,
      depois: novo,
      usuarioId,
    });

    return { success: true, data: { codigo: novo.codigo }, status: 201 };
  }

  static async atualizar(codigo: string, body: any, usuarioId: string | null): Promise<ServiceResult<null>> {
    try {
      await withTransaction(async (conn) => {
        const [rows]: any = await conn.execute('SELECT * FROM subelementos_despesa WHERE codigo = ? FOR UPDATE', [codigo]);
        if (!rows || rows.length === 0) {
          throw { status: 404, error: 'Subelemento não encontrado.' };
        }
        const antes = rows[0];

        const parsed = subelementoUpdateSchema.parse(body);

        const campos: Record<string, any> = {};
        if (parsed.descricao !== undefined) campos.descricao = parsed.descricao;
        if (parsed.ordem !== undefined) campos.ordem = parsed.ordem;
        if (parsed.ativo !== undefined) campos.ativo = parsed.ativo ? 1 : 0;

        if (Object.keys(campos).length === 0) return;

        const setClauses = Object.keys(campos).map((c) => `${c} = ?`).join(', ');
        const values = [...Object.values(campos), codigo];
        await conn.execute(`UPDATE subelementos_despesa SET ${setClauses} WHERE codigo = ?`, values);

        await registrarAuditoria(conn, {
          entidade: 'subelementos_despesa',
          entidadeId: codigo,
          acao: 'UPDATE',
          antes,
          depois: { ...antes, ...campos },
          usuarioId,
        });
      });
    } catch (error: any) {
      if (error.status && error.error) {
        return { success: false, error: error.error, status: error.status };
      }
      throw error;
    }

    return { success: true, data: null };
  }

  static async excluir(codigo: string, usuarioId: string | null): Promise<ServiceResult<null>> {
    try {
      await withTransaction(async (conn) => {
        const [rows]: any = await conn.execute('SELECT * FROM subelementos_despesa WHERE codigo = ? FOR UPDATE', [codigo]);
        if (!rows || rows.length === 0) {
          throw { status: 404, error: 'Subelemento não encontrado.' };
        }
        const antes = rows[0];

        await conn.execute('UPDATE subelementos_despesa SET ativo = 0 WHERE codigo = ?', [codigo]);

        await registrarAuditoria(conn, {
          entidade: 'subelementos_despesa',
          entidadeId: codigo,
          acao: 'UPDATE',
          antes,
          depois: { ...antes, ativo: 0 },
          usuarioId,
        });
      });
    } catch (error: any) {
      if (error.status && error.error) {
        return { success: false, error: error.error, status: error.status };
      }
      throw error;
    }

    return { success: true, data: null };
  }
}
