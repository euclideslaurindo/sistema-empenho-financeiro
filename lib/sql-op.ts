// Trechos de SQL repetidos entre relatórios (IR, Análises): uma fonte só,
// conferida nos testes. Esperam os aliases `op` (ordens_pagamento) e `ne`
// (notas_empenho).

/** CPF/CNPJ da OP só com dígitos (a máscara gravada varia). */
export const DIGITOS_CPF =
  "REPLACE(REPLACE(REPLACE(REPLACE(op.credor_cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '')";

/** Data que define o mês e o ano da OP: a mesma regra da competência da DARF. */
export const DATA_OP = 'COALESCE(op.data_pagamento, op.data_emissao, DATE(op.created_at))';

/** Data da NE: a de emissão; sem ela, a do cadastro. */
export const DATA_NE = 'COALESCE(ne.data_emissao, DATE(ne.created_at))';

/**
 * Exercício da NE como NÚMERO: comparar número com número não depende de
 * collation (o banco é compartilhado e as colunas de texto variam).
 */
export const EXERCICIO_NE = `COALESCE(CAST(NULLIF(ne.exercicio, '') AS UNSIGNED), YEAR(${DATA_NE}))`;
