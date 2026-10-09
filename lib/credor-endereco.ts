// Município e endereço do credor (T18) — regras puras, usadas no servidor
// (credor.service.ts) e na tela de credores.

const textoOuNull = (v: unknown) => {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  return s || null;
};

/** trim + colapsa espaços. Mantém a caixa digitada (D10: só normalizar). */
export const normalizarCidade = (v: unknown): string | null => textoOuNull(v);

export const normalizarUf = (v: unknown): string | null => textoOuNull(v)?.toUpperCase() ?? null;

export const CIDADE_MAX = 100;

export function validarMunicipio(cidade: string | null, uf: string | null): string | null {
  if (cidade && cidade.length > CIDADE_MAX) return `O município deve ter no máximo ${CIDADE_MAX} caracteres.`;
  if (uf && !/^[A-Z]{2}$/.test(uf)) return "UF inválida: use a sigla de 2 letras (ex.: PE).";
  return null;
}

/**
 * O formulário não tem campo de endereço: ele é montado a partir dos campos
 * estruturados. Com logradouro/número/bairro preenchidos, remonta sempre —
 * senão uma edição que reenvia o endereço antigo nunca refletiria a
 * cidade/rua nova. Sem eles, mantém o texto recebido (credor antigo só com
 * endereço livre não perde a rua) e só monta com cidade/UF se não houver texto.
 */
export function montarEnderecoFinal(body: {
  endereco?: unknown;
  logradouro?: unknown;
  numero?: unknown;
  bairro?: unknown;
  cidade?: unknown;
  uf?: unknown;
}): string | null {
  const numero = textoOuNull(body.numero);
  const rua = [textoOuNull(body.logradouro), numero ? `Nº ${numero}` : null, textoOuNull(body.bairro)].filter(Boolean);
  const municipio = [normalizarCidade(body.cidade), normalizarUf(body.uf)].filter(Boolean);
  if (rua.length > 0) return [...rua, ...municipio].join(", ");
  return textoOuNull(body.endereco) ?? (municipio.length > 0 ? municipio.join(", ") : null);
}

/** Preenchimento automático (CNPJ/CEP): só completa cidade/UF vazias. */
export function completarMunicipio<T extends { cidade?: string; uf?: string }>(
  atual: T,
  daApi: { cidade?: string | null; uf?: string | null }
): T {
  return {
    ...atual,
    cidade: atual.cidade?.trim() ? atual.cidade : daApi.cidade || atual.cidade,
    uf: atual.uf?.trim() ? atual.uf : daApi.uf || atual.uf,
  };
}

export function rotuloMunicipio(cidade?: string | null, uf?: string | null): string {
  return [cidade, uf].filter((v) => v && String(v).trim()).join("/");
}
