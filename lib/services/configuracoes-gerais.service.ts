import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';
import type { ServiceResult } from '@/lib/services/darf.service';

// Textos do sistema editados pelo administrador (tabela configuracoes_gerais,
// migration_19). O primeiro uso é o cabeçalho do relatório A4 das Análises.

export const CHAVES_IDENTIFICACAO = { orgao: 'relatorio.orgao', setor: 'relatorio.setor' } as const;
export const MAX_IDENTIFICACAO = 120;
/** entidade_id da auditoria (CHAR(36)): o nome da configuração, que não tem UUID. */
const ID_AUDITORIA = 'relatorio.identificacao';

export interface Identificacao {
  orgao: string;
  setor: string;
}

const VAZIA: Identificacao = { orgao: '', setor: '' };

/** A migration_19 ainda não rodou: o sistema continua funcionando sem a tabela. */
const semTabela = (e: any) => e?.code === 'ER_NO_SUCH_TABLE' || e?.errno === 1146;

/** Cabeçalho do relatório; vazio quando não preenchido ou quando a tabela ainda não existe. */
export async function obterIdentificacao(): Promise<Identificacao> {
  try {
    const rows: any[] =
      (await query('SELECT chave, valor FROM configuracoes_gerais WHERE chave IN (?, ?)', [CHAVES_IDENTIFICACAO.orgao, CHAVES_IDENTIFICACAO.setor])) || [];
    const valor = (chave: string) => String(rows.find((r) => r.chave === chave)?.valor ?? '').trim();
    return { orgao: valor(CHAVES_IDENTIFICACAO.orgao), setor: valor(CHAVES_IDENTIFICACAO.setor) };
  } catch (e) {
    if (semTabela(e)) return { ...VAZIA };
    throw e;
  }
}

const campo = z
  .string()
  .max(MAX_IDENTIFICACAO, `Use no máximo ${MAX_IDENTIFICACAO} caracteres.`)
  .transform((v) => v.trim());

export const identificacaoSchema = z.object({ orgao: campo, setor: campo });

/** Só o Admin. Vazio apaga (grava NULL). Auditoria com o antes e o depois. */
export async function salvarIdentificacao(body: unknown, usuarioId: string, perfil: string): Promise<ServiceResult<Identificacao>> {
  if (perfil !== 'ADMIN') {
    return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
  }
  const novo = identificacaoSchema.parse(body); // ZodError -> 400

  try {
    await withTransaction(async (conn: PoolConnection) => {
      const [rows]: any = await conn.execute(
        'SELECT chave, valor FROM configuracoes_gerais WHERE chave IN (?, ?) FOR UPDATE',
        [CHAVES_IDENTIFICACAO.orgao, CHAVES_IDENTIFICACAO.setor]
      );
      const antes: Identificacao = {
        orgao: String((rows || []).find((r: any) => r.chave === CHAVES_IDENTIFICACAO.orgao)?.valor ?? ''),
        setor: String((rows || []).find((r: any) => r.chave === CHAVES_IDENTIFICACAO.setor)?.valor ?? ''),
      };
      if (antes.orgao === novo.orgao && antes.setor === novo.setor) return;

      for (const k of ['orgao', 'setor'] as const) {
        await conn.execute(
          `INSERT INTO configuracoes_gerais (chave, valor, atualizado_por) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE valor = VALUES(valor), atualizado_por = VALUES(atualizado_por)`,
          [CHAVES_IDENTIFICACAO[k], novo[k] || null, usuarioId]
        );
      }
      await conn.execute(
        `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), 'configuracoes_gerais', ID_AUDITORIA, 'UPDATE', JSON.stringify(antes), JSON.stringify(novo), usuarioId]
      );
    });
  } catch (e) {
    if (semTabela(e)) {
      return { success: false, error: 'A tabela de configurações ainda não existe. Rode a migration_19 no banco para poder salvar.', status: 409 };
    }
    throw e;
  }
  return { success: true, data: novo };
}
