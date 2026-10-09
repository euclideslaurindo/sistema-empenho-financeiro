// Regras puras dos credores da NE (T15/T16) — sem banco, usadas no servidor
// (notas-empenho.service.ts) e na tela (NeCredoresField).
import { formatarBRL, fromCents, somarCents, toCents } from "@/lib/money";

export const somenteDigitos = (valor: unknown) => String(valor ?? "").replace(/\D/g, "");

/** null quando a soma fecha; senão a mensagem de erro com "Falta"/"Sobra". */
export function mensagemSomaBrutos(somaCents: number, valorNeCents: number): string | null {
  if (somaCents === valorNeCents) return null;
  const diferenca = Math.abs(valorNeCents - somaCents);
  const sentido = somaCents < valorNeCents ? "Falta" : "Sobra";
  return (
    `A soma dos valores brutos (R$ ${formatarBRL(somaCents)}) difere do valor da NE ` +
    `(R$ ${formatarBRL(valorNeCents)}). ${sentido} R$ ${formatarBRL(diferenca)}.`
  );
}

export interface DiferencaBrutos {
  somaCents: number;
  valorCents: number;
  diferencaCents: number; // valor - soma (positivo = falta)
  texto: string;
}

export function diferencaBrutos(brutos: Array<string | number | null | undefined>, valorNe: string | number | null | undefined): DiferencaBrutos {
  const somaCents = somarCents(...brutos.map((b) => toCents(b)));
  const valorCents = toCents(valorNe);
  const diferencaCents = valorCents - somaCents;
  const texto =
    diferencaCents === 0
      ? "Soma confere"
      : `${diferencaCents > 0 ? "Falta" : "Sobra"} R$ ${formatarBRL(Math.abs(diferencaCents))}`;
  return { somaCents, valorCents, diferencaCents, texto };
}

/** Divide em partes iguais; o último credor fica com o resto dos centavos. */
export function dividirIgualmente(totalCents: number, partes: number): number[] {
  if (partes <= 0) return [];
  const base = Math.floor(totalCents / partes);
  const resto = totalCents - base * partes;
  return Array.from({ length: partes }, (_, i) => (i === partes - 1 ? base + resto : base));
}

export interface CredorFormulario {
  cpfCnpj: string;
  nome: string;
  valorBruto: string;
  valorPago?: number;
  doCadastro: boolean; // escolhido agora no autocomplete (existe no cadastro)
  isMei?: boolean;
  municipio?: string;
  legado?: boolean;
}

/**
 * Formato novo (`credores`) quando há 2+ credores ou o único foi escolhido no
 * cadastro. Um único credor que veio da própria NE vai no formato antigo, pra
 * NE anterior à T15 (credor digitado à mão, talvez fora do cadastro) continuar
 * editável sem o servidor exigir cadastro.
 */
export function montarPayloadCredores(credores: CredorFormulario[]): {
  credores?: Array<{ cpfCnpj: string; valorBruto: number }>;
  credorNome: string | null;
  cpfCnpj: string | null;
} {
  const primeiro = credores[0];
  const credorNome = primeiro?.nome || null;
  const cpfCnpj = primeiro?.cpfCnpj || null;

  if (credores.length >= 2 || (credores.length === 1 && primeiro.doCadastro)) {
    return {
      credores: credores.map((c) => ({ cpfCnpj: c.cpfCnpj, valorBruto: fromCents(toCents(c.valorBruto)) })),
      credorNome,
      cpfCnpj,
    };
  }
  return { credorNome, cpfCnpj };
}
