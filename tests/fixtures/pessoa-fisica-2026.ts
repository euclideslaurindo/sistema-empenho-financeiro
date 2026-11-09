// B8 — seeds de 2026 do perfil PESSOA_FISICA (migration_21) e da tabela do
// IRRF (migration_16), como o MySQL devolve DECIMAL: texto.
import type { FaixaIrrf } from '@/lib/decimal-exato';
import type { ParametrosPessoaFisica } from '@/lib/irrf-pessoa-fisica';

export const PARAMETROS_PF_2026: ParametrosPessoaFisica = {
  inss_teto: '932.310000',
  desconto_simplificado: '607.200000',
  isencao_ate: '5000.000000',
  redutor_ate: '7350.000000',
  redutor_constante: '978.620000',
  redutor_coeficiente: '0.133145',
};

export const FAIXAS_IRRF_2026: FaixaIrrf[] = [
  { ordem: 1, limiteAte: '2428.80', aliquota: '0.0000', parcelaDeduzir: '0.00' },
  { ordem: 2, limiteAte: '2826.65', aliquota: '7.5000', parcelaDeduzir: '182.16' },
  { ordem: 3, limiteAte: '3751.05', aliquota: '15.0000', parcelaDeduzir: '394.16' },
  { ordem: 4, limiteAte: '4664.68', aliquota: '22.5000', parcelaDeduzir: '675.49' },
  { ordem: 5, limiteAte: null, aliquota: '27.5000', parcelaDeduzir: '908.73' },
];

/**
 * Responde as consultas de parâmetros/tabela do IRRF (mesmo formato para
 * query() e conn.execute). undefined = não é consulta daqui.
 */
export function responderPessoaFisica(sql: string, params: any[] = [], { semParametros = false } = {}): any[] | undefined {
  if (sql.includes('FROM calculo_parametros')) {
    if (semParametros || params[0] !== 'PESSOA_FISICA') return [];
    return Object.entries(PARAMETROS_PF_2026).map(([chave, valor]) => ({ chave, valor, vigente_de: '2026-01-01' }));
  }
  if (sql.includes('MAX(vigente_de)') && sql.includes('irrf_faixas')) return [{ vigente_de: '2026-01-01' }];
  if (sql.includes('FROM irrf_faixas WHERE vigente_de = ?')) {
    return FAIXAS_IRRF_2026.map((f) => ({
      ordem: f.ordem,
      limite_ate: f.limiteAte,
      aliquota: f.aliquota,
      parcela_deduzir: f.parcelaDeduzir,
    }));
  }
  return undefined;
}
