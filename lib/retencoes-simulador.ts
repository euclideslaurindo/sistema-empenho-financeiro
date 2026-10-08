// Simulador da tela de admin (T07) — reproduz o cálculo "padrão" (matriz ×
// config) usando as peças já existentes de lib/money.ts (T01). NÃO é o motor
// de produção (isso é lib/retencoes.ts, entrega da T10): não trata perfis de
// cálculo alternativos (ex.: transporte autônomo, T25), MEI, nem valores
// digitados manualmente pelo operador. Serve só para o admin conferir o
// efeito da configuração ATUAL DA TELA (ainda não salva) antes de salvar.
import { calcPercentCents, somarCents, toCents } from "@/lib/money";
import { parseFormNumber } from "@/lib/utils";

export const CAMPOS_TRIBUTARIOS = ["irrf", "iss", "inss", "patronal", "sest_senat"] as const;
export type CampoTributario = (typeof CAMPOS_TRIBUTARIOS)[number];

export interface SimuladorCampoConfig {
  campo: string;
  tipo: string; // 'PERCENTUAL' | 'VALOR_DIGITADO'
  aliquota: string; // formato BR, ex. "1,5"
  calculoAutomatico: boolean;
  ativo: boolean;
}

export interface SimuladorEntrada {
  brutoReais: number;
  regrasElemento: string[]; // campos tributários que se aplicam ao elemento escolhido
  camposConfig: SimuladorCampoConfig[];
  taxaBancariaReais?: number;
  taxaPixReais?: number;
}

export interface SimuladorResultado {
  itensCents: Record<string, number>;
  taxaBancariaCents: number;
  taxaPixCents: number;
  totalDescontosCents: number;
  liquidoCents: number;
  brutoCents: number;
}

export function simularRetencoes(entrada: SimuladorEntrada): SimuladorResultado {
  const brutoCents = toCents(entrada.brutoReais);
  const itensCents: Record<string, number> = {};
  let totalDescontosCents = 0;

  for (const c of entrada.camposConfig) {
    if (!(CAMPOS_TRIBUTARIOS as readonly string[]).includes(c.campo)) continue;

    const aplicaAoElemento = c.ativo && entrada.regrasElemento.includes(c.campo);
    const valor =
      aplicaAoElemento && c.calculoAutomatico && c.tipo === "PERCENTUAL"
        ? calcPercentCents(brutoCents, parseFormNumber(c.aliquota))
        : 0;

    itensCents[c.campo] = valor;
    totalDescontosCents = somarCents(totalDescontosCents, valor);
  }

  const taxaBancariaCents = toCents(entrada.taxaBancariaReais || 0);
  const taxaPixCents = toCents(entrada.taxaPixReais || 0);
  totalDescontosCents = somarCents(totalDescontosCents, taxaBancariaCents, taxaPixCents);

  return {
    itensCents,
    taxaBancariaCents,
    taxaPixCents,
    totalDescontosCents,
    liquidoCents: brutoCents - totalDescontosCents,
    brutoCents,
  };
}
