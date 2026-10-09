// Formatos das respostas das APIs de administração do transporte (T27).
import type { FaixaIrrf } from "@/lib/retencoes-transporte";

export interface VigenciaParametros {
  vigenteDe: string;
  parametros: Record<string, string>;
  emUso: boolean;
  editavel: boolean;
}
export interface ListaParametros {
  hoje: string;
  atual: string | null;
  vigencias: VigenciaParametros[];
}

export interface VigenciaIrrf {
  vigenteDe: string;
  faixas: FaixaIrrf[];
  emUso: boolean;
  editavel: boolean;
}
export interface ListaIrrf {
  hoje: string;
  atual: string | null;
  vigencias: VigenciaIrrf[];
}

export interface IssMunicipioAdmin {
  chave: string;
  nome: string;
  uf: string;
  aliquota: string;
  taxaExpediente: string;
  apelidos: string | null;
  ativo: boolean;
}

/** "2026-10-09" -> "09/10/2026" */
export const formatarData = (iso: string) => iso.split("-").reverse().join("/");

/** "15.200000" -> "15,2" (para os inputs, sem zeros à direita). */
export const paraCampo = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "" : String(Number(v)).replace(".", ",");

/** Vigência que vale numa data: a maior com início ≤ data. */
export function vigenciaNaData<T extends { vigenteDe: string }>(vigencias: T[], data: string): T | null {
  return (
    vigencias
      .filter((v) => v.vigenteDe <= data)
      .sort((a, b) => a.vigenteDe.localeCompare(b.vigenteDe))
      .at(-1) ?? null
  );
}

export const motivoSoLeitura = (v: { emUso: boolean; vigenteDe: string }, hoje: string) =>
  v.emUso ? "Já usada por OP — crie uma nova vigência para mudar." : v.vigenteDe < hoje ? "Vigência passada — só leitura." : null;
