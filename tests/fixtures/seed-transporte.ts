// Seed do cálculo do transporte (3.3.90.33) igual ao da database/migration_16.sql,
// no formato em que o MySQL devolve (DECIMAL como texto). O teste de
// conformidade (T28) confere que estes valores estão de fato na migration.

export const PARAMETROS_SEED: Record<string, string> = {
  base_percentual: '20',
  inss_percentual: '11',
  patronal_percentual: '20',
  sest_percentual: '1.5',
  senat_percentual: '1',
  irrf_tributavel_percentual: '60',
  desconto_simplificado: '607.20',
  redutor_constante: '978.62',
  redutor_coeficiente: '0.133145',
};

export const VIGENCIA_SEED = '2026-01-01';

export const FAIXAS_SEED = [
  { ordem: 1, limite_ate: '2428.80', aliquota: '0.0000', parcela_deduzir: '0.00' },
  { ordem: 2, limite_ate: '2826.65', aliquota: '7.5000', parcela_deduzir: '182.16' },
  { ordem: 3, limite_ate: '3751.05', aliquota: '15.0000', parcela_deduzir: '394.16' },
  { ordem: 4, limite_ate: '4664.68', aliquota: '22.5000', parcela_deduzir: '675.49' },
  { ordem: 5, limite_ate: null, aliquota: '27.5000', parcela_deduzir: '908.73' },
];

export const MUNICIPIOS_SEED = [
  ['aguas belas', 'Águas Belas', '0.00', null],
  ['bom conselho', 'Bom Conselho', '0.00', null],
  ['caetes', 'Caetés', '0.00', null],
  ['canhotinho', 'Canhotinho', '15.20', null],
  ['capoeiras', 'Capoeiras', '3.94', null],
  ['garanhuns', 'Garanhuns', '0.00', null],
  ['iati', 'Iati', '6.90', null],
  ['lajedo', 'Lajedo', '0.00', null],
  ['sao bento do una', 'São Bento do Una', '0.00', 'sbu;sao bento'],
  ['correntes', 'Correntes', '0.00', null],
  ['brejao', 'Brejão', '0.00', null],
  ['jucati', 'Jucati', '3.00', null],
  ['jupi', 'Jupi', '6.76', null],
].map(([chave, nome, taxa_expediente, apelidos]) => ({ chave, nome, uf: 'PE', aliquota: '5.0000', taxa_expediente, apelidos }));

/** Campos de Retenções e Descontos (config_retencoes), todos ativos. */
export const CONFIG_SEED = [
  ['irrf', 'IRRF', 'PERCENTUAL', '1.5000', 0],
  ['iss', 'ISS', 'PERCENTUAL', '5.0000', 0],
  ['inss', 'INSS', 'PERCENTUAL', '11.0000', 1],
  ['patronal', 'Patronal', 'PERCENTUAL', '20.0000', 1],
  ['sest_senat', 'SEST/SENAT', 'PERCENTUAL', '2.5000', 1],
  ['outros', 'Outros', 'VALOR_DIGITADO', null, 0],
  ['taxa_bancaria', 'Taxa bancária', 'VALOR_DIGITADO', null, 0],
  ['taxa_pix', 'Taxa PIX', 'VALOR_DIGITADO', null, 0],
].map(([campo, rotulo, tipo, aliquota, entra], i) => ({
  campo,
  rotulo,
  tipo,
  aliquota,
  calculo_automatico: tipo === 'PERCENTUAL' ? 1 : 0,
  editavel_operador: String(campo).startsWith('taxa') ? 1 : 0,
  entra_darf: entra,
  ativo: 1,
  ordem: i,
  updated_at: new Date('2026-01-01'),
}));

export interface CredorSimulado {
  cidade: string | null;
  uf: string;
  is_mei: number;
}

/**
 * Responde as consultas de `calcularRetencoesDaOp` para o 3.3.90.33, com o seed
 * acima e o credor informado. Mesmo padrão do tests/integration/transporte-op.test.ts.
 */
export function responderCalculoTransporte(sql: string, credor: CredorSimulado): any[] {
  if (sql.includes('FROM credores')) return [credor];
  if (sql.includes('SELECT * FROM config_retencoes ORDER BY ordem')) return CONFIG_SEED;
  if (sql.includes('SELECT codigo FROM elementos_despesa')) return [{ codigo: '3.3.90.33' }];
  if (sql.includes('FROM elemento_retencoes')) {
    return ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'].map((campo) => ({ elemento_codigo: '3.3.90.33', campo }));
  }
  if (sql.includes('FROM calculo_parametros')) {
    return Object.entries(PARAMETROS_SEED).map(([chave, valor]) => ({ chave, valor, vigente_de: VIGENCIA_SEED }));
  }
  if (sql.includes('MAX(vigente_de)')) return [{ vigente_de: VIGENCIA_SEED }];
  if (sql.includes('FROM irrf_faixas WHERE vigente_de = ?')) return FAIXAS_SEED;
  if (sql.includes('FROM iss_municipios')) return MUNICIPIOS_SEED;
  return [];
}
