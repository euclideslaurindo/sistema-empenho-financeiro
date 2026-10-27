import { nomeArquivoCsvIr } from "@/lib/ir-pessoas-fisicas";
import { URL_IR } from "./tipos-ir";

/**
 * Baixa a planilha do ano. Usa fetch (e não um <a href> direto) para conferir
 * a resposta antes: um erro (401/400/500) baixaria o JSON da mensagem como se
 * fosse o CSV.
 */
export async function baixarCsvIr(ano: number): Promise<void> {
  const res = await fetch(`${URL_IR}/csv?ano=${ano}`);
  if (!res.ok) {
    const corpo = await res.json().catch(() => null);
    throw new Error(corpo?.error || "Não foi possível exportar a planilha.");
  }
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivoCsvIr(ano);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
