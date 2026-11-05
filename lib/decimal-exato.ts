// Decimal exato em BigInt com 12 casas, usado nos cálculos com tabela do
// IRRF (transporte e pessoa física). Nenhum passo intermediário é
// arredondado — só os itens finais, para centavos (meio para cima, T01).

const CASAS = 12;
export const ESCALA = 10n ** BigInt(CASAS);
export type Dec = bigint;

/** Lê o número como texto (ex.: "978.620000" do DECIMAL do MySQL), sem float. */
export function dec(valor: string | number): Dec {
  const s = typeof valor === "number" ? valor.toString() : String(valor).trim();
  if (!/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(s)) throw new RangeError(`Número inválido: "${valor}"`);
  if (/e/i.test(s)) return dec(Number(s).toFixed(CASAS));
  const negativo = s.startsWith("-");
  const [inteiro, fracao = ""] = s.replace("-", "").split(".");
  const v = BigInt(inteiro) * ESCALA + BigInt((fracao + "0".repeat(CASAS)).slice(0, CASAS));
  return negativo ? -v : v;
}

export const deCentavos = (c: number): Dec => BigInt(c) * (ESCALA / 100n);
export const mul = (a: Dec, b: Dec): Dec => (a * b) / ESCALA;
export const pct = (a: Dec, p: Dec): Dec => mul(a, p) / 100n;
export const maior = (a: Dec, b: Dec): Dec => (a > b ? a : b);

/** Arredonda para centavos, meio para cima (valores negativos viram 0). */
export function paraCentavos(v: Dec): number {
  if (v <= 0n) return 0;
  const metade = ESCALA / 200n;
  return Number((v + metade) / (ESCALA / 100n));
}

/** Para o snapshot: número com até 6 casas, sem arredondar para centavos. */
export function paraNumero(v: Dec): number {
  const negativo = v < 0n;
  const abs = negativo ? -v : v;
  const inteiro = abs / ESCALA;
  const fracao = (abs % ESCALA).toString().padStart(CASAS, "0").slice(0, 6);
  return Number(`${negativo ? "-" : ""}${inteiro}.${fracao}`);
}

export interface FaixaIrrf {
  ordem: number;
  limiteAte: string | number | null; // null = última faixa
  aliquota: string | number; // 7.5 = 7,5%
  parcelaDeduzir: string | number;
}

/** IR pela tabela progressiva: base × alíquota − parcela (nunca negativo; base <= 0 → 0). */
export function irrfDaTabela(base: Dec, faixasIrrf: FaixaIrrf[]): Dec {
  const faixas = [...faixasIrrf].sort((a, b) => a.ordem - b.ordem);
  const faixa = faixas.find((f) => f.limiteAte === null || base <= dec(f.limiteAte)) ?? faixas[faixas.length - 1];
  return base > 0n && faixa ? maior(0n, pct(base, dec(faixa.aliquota)) - dec(faixa.parcelaDeduzir)) : 0n;
}
