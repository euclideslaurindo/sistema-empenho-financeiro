// Saldo da Nota de Empenho (T31): valor, gasto (soma do valor a pagar/bruto
// das OPs — D28) e restante. Sempre em centavos inteiros; nada de
// `valor - pago` em ponto flutuante.
import type { PoolConnection } from 'mysql2/promise';
import { fromCents, toCents } from '@/lib/money';
import { statusPeloSaldo } from '@/lib/status-ne';
import type { ExecRows } from '@/lib/services/numeracao-op';

export interface SaldoNe {
  valorCents: number;
  gastoCents: number;
  restanteCents: number; // pode ser negativo em dados antigos inconsistentes
  percentualGasto: number; // 0..100+, 2 casas
  qtdOps: number;
}

export interface SaldoNeResposta {
  valor: number;
  gasto: number;
  restante: number;
  percentualGasto: number;
  qtdOps: number;
}

export function montarSaldo(valor: unknown, gasto: unknown, qtdOps: unknown = 0): SaldoNe {
  const valorCents = toCents(valor as any);
  const gastoCents = toCents(gasto as any);
  const percentualGasto = valorCents > 0 ? Math.round((gastoCents * 10000) / valorCents) / 100 : 0;
  return {
    valorCents,
    gastoCents,
    restanteCents: valorCents - gastoCents,
    percentualGasto,
    qtdOps: Number(qtdOps) || 0,
  };
}

export const saldoParaResposta = (s: SaldoNe): SaldoNeResposta => ({
  valor: fromCents(s.valorCents),
  gasto: fromCents(s.gastoCents),
  restante: fromCents(s.restanteCents),
  percentualGasto: s.percentualGasto,
  qtdOps: s.qtdOps,
});

/** Soma do valor a pagar das OPs da NE. Consulta própria, sem JOIN (collation no banco compartilhado). */
async function somarOps(exec: ExecRows, numeroNe: string): Promise<{ gasto: unknown; qtd: unknown }> {
  const [linha] = await exec(
    'SELECT COALESCE(SUM(valor_pagamento), 0) AS gasto, COUNT(*) AS qtd FROM ordens_pagamento WHERE numero_ne = ?',
    [numeroNe]
  );
  return { gasto: linha?.gasto ?? 0, qtd: linha?.qtd ?? 0 };
}

/** Saldo de uma NE pelo número; `null` se a NE não existe. */
export async function obterSaldoNe(exec: ExecRows, numeroNe: string): Promise<SaldoNe | null> {
  const [ne] = await exec('SELECT valor FROM notas_empenho WHERE numero = ?', [numeroNe]);
  if (!ne) return null;
  const { gasto, qtd } = await somarOps(exec, numeroNe);
  return montarSaldo(ne.valor, gasto, qtd);
}

/**
 * Status da NE derivado do saldo (EMITIDO / PARCIALMENTE PAGO / LIQUIDADO),
 * dentro da transação de quem mexeu nas OPs. CANCELADO nunca é desfeito.
 * Devolve o status gravado (ou null se a NE não existe).
 */
export async function recalcularStatusNe(conn: PoolConnection, numeroNe: string): Promise<string | null> {
  const exec: ExecRows = async (sql, params) => ((await conn.execute(sql, params))[0] as any[]) || [];
  // FOR UPDATE: no excluir() a NE só é travada aqui; duas transações na
  // mesma NE não calculam o status em cima de um saldo velho.
  const [ne] = await exec('SELECT valor, status FROM notas_empenho WHERE numero = ? FOR UPDATE', [numeroNe]);
  if (!ne) return null;
  const { gasto } = await somarOps(exec, numeroNe);
  const status = statusPeloSaldo(toCents(ne.valor), toCents(gasto as any), ne.status);
  if (status !== ne.status) {
    await conn.execute('UPDATE notas_empenho SET status = ? WHERE numero = ?', [status, numeroNe]);
  }
  return status;
}
