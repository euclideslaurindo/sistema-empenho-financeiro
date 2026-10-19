import { query } from '@/lib/db';

// Atenção ao nome das colunas: em ordens_pagamento, `numero_empenho` guarda o
// número da OP (ex.: 2026.OP.0004) e `numero_ne` guarda a NE.
export type ExecRows = (sql: string, params: any[]) => Promise<any[]>;

export interface NumeroOp {
  numeroOp: string;
  sub: string;
}

/** Limite de OPs numa mesma emissão (T34). */
export const MAX_OPS_POR_EMISSAO = 100;

export function quantidadeValida(quantidade: number): boolean {
  return Number.isInteger(quantidade) && quantidade >= 1 && quantidade <= MAX_OPS_POR_EMISSAO;
}

/**
 * Próximos `quantidade` números em sequência (T34-B), com um MAX de OP e um de
 * sub — não importa quantos. MAX (não COUNT) pra não repetir número quando uma
 * OP do meio é excluída. `travar: true` só dentro da transação de gravação; a
 * previsão nunca trava linhas — é previsão, não reserva.
 */
export async function calcularProximosNumerosOp(
  exec: ExecRows,
  numeroNe: string,
  quantidade: number,
  { travar }: { travar: boolean },
  ano: number = new Date().getFullYear()
): Promise<NumeroOp[]> {
  if (!quantidadeValida(quantidade)) {
    throw new Error(`Quantidade de OPs inválida: ${quantidade} (de 1 a ${MAX_OPS_POR_EMISSAO}).`);
  }
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

  return Array.from({ length: quantidade }, (_, i) => ({
    numeroOp: `${ano}.OP.${String(maxOp + 1 + i).padStart(4, '0')}`,
    sub: String(maxSub + 1 + i).padStart(2, '0'),
  }));
}

/** O próximo número (uma OP). Na gravação, chamado por OP na mesma conexão. */
export async function calcularProximoNumeroOp(
  exec: ExecRows,
  numeroNe: string,
  opcoes: { travar: boolean },
  ano: number = new Date().getFullYear()
): Promise<NumeroOp> {
  const [numero] = await calcularProximosNumerosOp(exec, numeroNe, 1, opcoes, ano);
  return numero;
}

export type NumeroPrevisto = NumeroOp & { rotulo: string };

export type PrevisaoResult =
  | { success: true; data: NumeroPrevisto & { previsto: true; numeros?: NumeroPrevisto[] } }
  | { success: false; error: string; status: number };

/**
 * Previsão do número da OP. Sem `quantidade`, o formato de sempre (T13); com
 * `quantidade`, também `numeros` — um por linha da emissão, em ordem.
 */
export async function preverProximoNumeroOp(numeroNe: string, quantidade?: number): Promise<PrevisaoResult> {
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

  const numeros = (
    await calcularProximosNumerosOp((sql, p) => query<any[]>(sql, p), numeroNe, quantidade ?? 1, { travar: false })
  ).map((n) => ({ ...n, rotulo: `NE ${numeroNe}/${n.sub}` }));
  return {
    success: true,
    data: { ...numeros[0], previsto: true, ...(quantidade === undefined ? {} : { numeros }) },
  };
}
