// Perfil de cálculo por elemento (T25). Fixo no código por decisão do
// projeto: o 3.3.90.33 (transporte) tem cálculo próprio; o 3.3.90.36
// (pessoa física, B8) usa o cálculo padrão com INSS com teto e IRRF pela
// tabela progressiva; o resto usa o cálculo padrão por percentuais (T10).
export type PerfilCalculo = "PADRAO" | "TRANSPORTE_AUTONOMO" | "PESSOA_FISICA";

export const PERFIL_POR_ELEMENTO: Record<string, PerfilCalculo> = {
  "3.3.90.33": "TRANSPORTE_AUTONOMO",
  "3.3.90.36": "PESSOA_FISICA",
};

export const perfilDoElemento = (codigo: string | null | undefined): PerfilCalculo =>
  (codigo && PERFIL_POR_ELEMENTO[codigo]) || "PADRAO";

/**
 * Perfis cujo cálculo depende de tabela/parâmetros por vigência que só o
 * servidor tem: a tela pede a prévia (mesmo cálculo do salvar).
 */
export const calculoNoServidor = (perfil: PerfilCalculo): boolean =>
  perfil === "TRANSPORTE_AUTONOMO" || perfil === "PESSOA_FISICA";

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

/**
 * Acha o município em iss_municipios pela chave ou por um dos apelidos
 * (separados por ";"), comparando sempre normalizado. Usado no cálculo
 * (obterIssMunicipio) e na tela de credores (aviso de município sem cadastro).
 * A comparação é aqui, no código, e não em JOIN no SQL: a coluna
 * credores.municipioExpediente tem collation diferente das tabelas antigas.
 */
export function encontrarIssMunicipio<T extends { chave: string; apelidos?: string | null }>(
  lista: T[],
  nome: string | null | undefined
): T | null {
  const alvo = normalizarMunicipio(nome);
  if (!alvo) return null;
  return (
    lista.find(
      (m) =>
        normalizarMunicipio(m.chave) === alvo ||
        (m.apelidos || "")
          .split(";")
          .map((a) => normalizarMunicipio(a))
          .filter(Boolean)
          .includes(alvo)
    ) ?? null
  );
}
