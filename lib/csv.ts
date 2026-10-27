// CSV para o Excel em português: BOM, ";", vírgula decimal e CRLF.
// Comum às planilhas do sistema (Pessoas físicas no IR, Análises).
import type { Centavos } from '@/lib/money';

/** Marca UTF-8 no início: sem ela o Excel quebra os acentos. */
export const BOM = String.fromCharCode(0xfeff);
export const SEP = ';';
export const FIM_LINHA = '\r\n';

/** Centavos → "1234,50" (vírgula decimal, sem ponto de milhar). */
export function valorCsv(c: Centavos): string {
  const abs = Math.abs(c);
  return `${c < 0 ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

/** Campo de texto: neutraliza fórmula (= + - @ tab CR no início) e protege ; " e quebras. */
export function textoCsv(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Campos já formatados (texto passado por textoCsv, números por valorCsv) → uma linha. */
export const linhaCsv = (campos: string[]) => campos.join(SEP);

/** Junta as linhas com CRLF, com o BOM no início e CRLF no fim. */
export const arquivoCsv = (linhas: string[]) => BOM + linhas.join(FIM_LINHA) + FIM_LINHA;
