import { parseFormNumber } from "@/lib/utils";

export type Centavos = number; // sempre inteiro

/**
 * Converte um valor float (reais) para centavos inteiros, aplicando a regra
 * "3º decimal >= 5 sobe" via toFixed(10) + BigInt (sem Math.round(x*100)/100,
 * que carrega o ruído binário do produto original). Preserva o sinal.
 */
function arredondarParaCentavosInteiros(valor: number): number {
  if (!isFinite(valor) || isNaN(valor)) return 0;

  const negativo = valor < 0;
  const abs = Math.abs(valor);

  const fixado = abs.toFixed(10);
  const pontoIdx = fixado.indexOf(".");
  const parteInteira = fixado.slice(0, pontoIdx);
  const parteDecimal = fixado.slice(pontoIdx + 1);

  const doisPrimeiros = parteDecimal.slice(0, 2);
  const terceiroDigito = parteDecimal.charCodeAt(2) - 48;

  let centavos = BigInt(parteInteira) * 100n + BigInt(doisPrimeiros);
  if (terceiroDigito >= 5) centavos += 1n;

  const resultado = Number(centavos);
  if (resultado === 0) return 0; // evita retornar -0 (quebra Object.is/toBe em testes)
  return negativo ? -resultado : resultado;
}

/** "1.500,00" | "1500.00" | 1500 -> 150000. Usa parseFormNumber e arredonda a entrada. */
export function toCents(valor: string | number | null | undefined): Centavos {
  if (valor === null || valor === undefined || valor === "") return 0;
  const numero = typeof valor === "number" ? valor : parseFormNumber(valor);
  if (!isFinite(numero) || isNaN(numero)) return 0;
  return arredondarParaCentavosInteiros(numero);
}

/** 150000 -> 1500 (para gravar em DECIMAL) */
export function fromCents(c: Centavos): number {
  return c / 100;
}

/**
 * Percentual do valor-base com a regra do 3º decimal, inteiramente em BigInt
 * (nunca multiplica float por float). aliquotaPercent aceita até 4 casas
 * decimais (ex.: 2.5, 11, 0.8333).
 */
export function calcPercentCents(
  baseCents: Centavos,
  aliquotaPercent: number | string
): Centavos {
  if (!Number.isFinite(baseCents) || !Number.isInteger(baseCents) || baseCents < 0) {
    throw new RangeError("baseCents deve ser um inteiro >= 0 (centavos)");
  }

  const aliquotaNum =
    typeof aliquotaPercent === "string" ? parseFormNumber(aliquotaPercent) : aliquotaPercent;

  if (!isFinite(aliquotaNum) || isNaN(aliquotaNum) || aliquotaNum < 0 || aliquotaNum > 100) {
    throw new RangeError("aliquotaPercent deve estar entre 0 e 100");
  }

  const aliquota4 = Math.round(aliquotaNum * 10_000); // 1.5 -> 15000
  const baseBig = BigInt(baseCents);
  const aliqBig = BigInt(aliquota4);

  const numerador = baseBig * aliqBig + 500_000n;
  const resultado = numerador / 1_000_000n;

  return Number(resultado);
}

/** Para valores que já vieram em ponto flutuante: aplica a regra do 3º decimal. */
export function arredondarMoeda(valor: number): number {
  return fromCents(arredondarParaCentavosInteiros(valor));
}

export function somarCents(...valores: Centavos[]): Centavos {
  return valores.reduce((acc, v) => {
    if (!Number.isFinite(v)) {
      throw new RangeError("somarCents recebeu um valor não finito (NaN/Infinity)");
    }
    return acc + v;
  }, 0);
}

/** 150000 -> "1.500,00" / -150000 -> "-1.500,00". Opera só em inteiros. */
export function formatarBRL(c: Centavos): string {
  if (!Number.isFinite(c)) {
    throw new RangeError("formatarBRL recebeu um valor não finito (NaN/Infinity)");
  }
  const negativo = c < 0;
  const abs = Math.abs(Math.trunc(c));
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  const reaisStr = reais.toLocaleString("pt-BR");
  const centavosStr = String(centavos).padStart(2, "0");
  return `${negativo ? "-" : ""}${reaisStr},${centavosStr}`;
}
