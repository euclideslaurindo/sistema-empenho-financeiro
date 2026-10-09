import { query } from '@/lib/db';

// Atenção ao nome das colunas: em ordens_pagamento, `numero_empenho` guarda o
// número da OP (ex.: 2026.OP.0004) e `numero_ne` guarda a NE.
type ExecRows = (sql: string, params: any[]) => Promise<any[]>;

export interface NumeroOp {
  numeroOp: string;
  sub: string;
}

/**
 * MAX (não COUNT) pra não repetir número quando uma OP do meio é excluída.
 * `travar: true` só dentro da transação do criar(); a previsão nunca trava
 * linhas — é previsão, não reserva.
 */
export async function calcularProximoNumeroOp(
  exec: ExecRows,
  numeroNe: string,
  { travar }: { travar: boolean },
  ano: number = new Date().getFullYear()
): Promise<NumeroOp> {
  const lock = travar ? ' FOR UPDATE' : '';

  const maxOpResult = await exec(
    `SELECT CAST(SUBSTRING_INDEX(numero_empenho, '.', -1) AS UNSIGNED) as seq
           FROM ordens_pagamento WHERE numero_empenho LIKE ?
           ORDER BY seq DESC LIMIT 1${lock}`,
    [`${ano}.OP.%`]
  );
  const maxOp = maxOpResult.length > 0 && maxOpResult[0].seq ? Number(maxOpResult[0].seq) : 0;

  const maxSubResult = await exec(
    `SELECT CAST(sub AS UNSIGNED) as seq
           FROM ordens_pagamento WHERE numero_ne = ?
           ORDER BY seq DESC LIMIT 1${lock}`,
    [numeroNe]
  );
  const maxSub = maxSubResult.length > 0 && maxSubResult[0].seq ? Number(maxSubResult[0].seq) : 0;

  return {
    numeroOp: `${ano}.OP.${String(maxOp + 1).padStart(4, '0')}`,
    sub: String(maxSub + 1).padStart(2, '0'),
  };
}

export type PrevisaoResult =
  | { success: true; data: NumeroOp & { rotulo: string; previsto: true } }
  | { success: false; error: string; status: number };

export async function preverProximoNumeroOp(numeroNe: string): Promise<PrevisaoResult> {
  const neRows = await query<any[]>('SELECT status FROM notas_empenho WHERE numero = ?', [numeroNe]);
  if (!neRows || neRows.length === 0) {
    return { success: false, error: `NE "${numeroNe}" não encontrada.`, status: 404 };
  }
  if (neRows[0].status === 'CANCELADO') {
    return {
      success: false,
      error: `Não é possível criar OP para a NE "${numeroNe}" pois ela está CANCELADA.`,
      status: 409,
    };
  }

  const numero = await calcularProximoNumeroOp((sql, p) => query<any[]>(sql, p), numeroNe, { travar: false });
  return {
    success: true,
    data: { ...numero, rotulo: `NE ${numeroNe}/${numero.sub}`, previsto: true },
  };
}
