// B12: valores das taxas criadas pelo ADMIN ("x_…") por OP, na tabela
// op_retencoes_extras (migration_25). Sempre dentro da transação da OP.
//
// Sem nenhuma taxa "x_" com valor, nada é lido nem gravado — a OP continua
// funcionando mesmo antes da migration_25 rodar.
import type { PoolConnection } from 'mysql2/promise';
import { ehTaxaExtra } from '@/lib/retencoes';
import { fromCents } from '@/lib/money';

const semTabela = (e: any) => e?.code === 'ER_NO_SUCH_TABLE' || e?.errno === 1146;
const ERRO_SEM_TABELA = 'A tabela das taxas personalizadas ainda não existe. Rode a migration_25 no banco.';

/** Só as "x_" do resultado do cálculo, em reais (0 incluído). */
export function extrasDoResultado(itens: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(itens).filter(([c]) => ehTaxaExtra(c)).map(([c, v]) => [c, fromCents(v)]));
}

/** Substitui as extras da OP pelas do cálculo (só grava valor > 0). */
export async function gravarExtrasDaOp(conn: PoolConnection, opId: string, extras: Record<string, number>, substituir = false) {
  const comValor = Object.entries(extras).filter(([, v]) => v > 0);
  try {
    if (substituir) await conn.execute('DELETE FROM op_retencoes_extras WHERE ordem_pagamento_id = ?', [opId]);
    for (const [campo, valor] of comValor) {
      await conn.execute('INSERT INTO op_retencoes_extras (ordem_pagamento_id, campo, valor) VALUES (?, ?, ?)', [opId, campo, valor]);
    }
  } catch (e) {
    if (!semTabela(e)) throw e;
    if (comValor.length > 0) throw { status: 409, error: ERRO_SEM_TABELA };
  }
}

/** Extras gravadas da OP (reais). Tabela inexistente → {}. */
export async function lerExtrasDaOp(conn: PoolConnection, opId: string): Promise<Record<string, number>> {
  try {
    const [rows]: any = await conn.execute('SELECT campo, valor FROM op_retencoes_extras WHERE ordem_pagamento_id = ?', [opId]);
    return Object.fromEntries((rows || []).map((r: any) => [r.campo, Number(r.valor) || 0]));
  } catch (e) {
    if (semTabela(e)) return {};
    throw e;
  }
}

export async function apagarExtrasDaOp(conn: PoolConnection, opId: string) {
  try {
    await conn.execute('DELETE FROM op_retencoes_extras WHERE ordem_pagamento_id = ?', [opId]);
  } catch (e) {
    if (!semTabela(e)) throw e;
  }
}
