// Perfil de cálculo por elemento (T25). Fixo no código por decisão do
// projeto: só o 3.3.90.33 (transporte) tem cálculo próprio; o resto usa o
// cálculo padrão por percentuais (T10).
export type PerfilCalculo = "PADRAO" | "TRANSPORTE_AUTONOMO";

export const PERFIL_POR_ELEMENTO: Record<string, PerfilCalculo> = {
  "3.3.90.33": "TRANSPORTE_AUTONOMO",
};

export const perfilDoElemento = (codigo: string | null | undefined): PerfilCalculo =>
  (codigo && PERFIL_POR_ELEMENTO[codigo]) || "PADRAO";

/** "São Bento do Una/PE" -> "sao bento do una" (chave de iss_municipios). */
export function normalizarMunicipio(nome: string | null | undefined): string {
  return String(nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s*[/-]\s*[a-z]{2}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}
