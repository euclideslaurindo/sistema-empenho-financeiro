import { nomeArquivoCsvIr } from "@/lib/ir-pessoas-fisicas";
import { baixarArquivo } from "@/lib/baixar-arquivo";
import { URL_IR } from "./tipos-ir";

/** Baixa a planilha do ano (a resposta é conferida antes: erro não vira arquivo). */
export async function baixarCsvIr(ano: number): Promise<void> {
  await baixarArquivo(`${URL_IR}/csv?ano=${ano}`, nomeArquivoCsvIr(ano));
}
