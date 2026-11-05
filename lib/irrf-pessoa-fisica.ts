// IRRF progressivo 2026 do perfil PESSOA_FISICA (elemento 3.3.90.36), B8.
// Puro: quem busca parâmetros e faixas por vigência é o serviço.
//
//   INSS da OP    = alíquota do INSS da config (11%) sobre o bruto, até o teto
//   dedução do IR = máx(INSS da OP; desconto simplificado)
//   base do IR    = bruto − dedução
//   bruto <= isenção                -> IRRF = 0
//   isenção < bruto <= redutor_ate  -> IRRF = tabela − redutor
//   bruto > redutor_ate             -> IRRF = tabela
import { calcPercentCents } from "@/lib/money";
import {
  dec,
  deCentavos,
  irrfDaTabela,
  maior,
  mul,
  paraCentavos,
  paraNumero,
  type FaixaIrrf,
} from "@/lib/decimal-exato";

export const CHAVES_PESSOA_FISICA = [
  "inss_teto",
  "desconto_simplificado",
  "isencao_ate",
  "redutor_ate",
  "redutor_constante",
  "redutor_coeficiente",
] as const;

export type ChavePessoaFisica = (typeof CHAVES_PESSOA_FISICA)[number];
export type ParametrosPessoaFisica = Record<ChavePessoaFisica, string | number>;

export interface DadosPessoaFisica {
  parametros: ParametrosPessoaFisica;
  faixas: FaixaIrrf[];
  vigencia: string;
  vigenciaIrrf?: string;
}

/** INSS da OP: percentual da config sobre o bruto, limitado ao teto. */
export function inssPessoaFisica(brutoCents: number, aliquotaInss: number | string, p: ParametrosPessoaFisica): number {
  const teto = paraCentavos(dec(p.inss_teto));
  return Math.min(calcPercentCents(brutoCents, aliquotaInss), teto);
}

export interface ResultadoIrrfPessoaFisica {
  irrfCents: number;
  isento: boolean;
  /** Para o snapshot (até 6 casas, sem arredondar). */
  deducao: number;
  base: number;
  irrfTabela: number;
  redutor: number;
}

/**
 * IRRF da pessoa física. `inssCents` é o INSS efetivamente retido na OP
 * (0 quando o INSS não se aplica — aí a dedução é o desconto simplificado).
 */
export function irrfPessoaFisica(
  brutoCents: number,
  inssCents: number,
  p: ParametrosPessoaFisica,
  faixas: FaixaIrrf[]
): ResultadoIrrfPessoaFisica {
  if (!Number.isInteger(brutoCents) || brutoCents < 0) {
    throw { status: 422, error: "Valor bruto inválido para cálculo de retenções." };
  }
  const bruto = deCentavos(brutoCents);
  const deducao = maior(dec(p.desconto_simplificado), deCentavos(Math.max(0, inssCents)));
  const base = maior(0n, bruto - deducao);
  const tabela = irrfDaTabela(base, faixas);

  const isento = bruto <= dec(p.isencao_ate);
  const comRedutor = !isento && bruto <= dec(p.redutor_ate);
  const redutor = comRedutor ? maior(0n, dec(p.redutor_constante) - mul(dec(p.redutor_coeficiente), bruto)) : 0n;
  const irrf = isento ? 0n : maior(0n, tabela - redutor);

  return {
    irrfCents: paraCentavos(irrf),
    isento,
    deducao: paraNumero(deducao),
    base: paraNumero(base),
    irrfTabela: paraNumero(tabela),
    redutor: paraNumero(redutor),
  };
}
