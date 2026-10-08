// Funções puras para elementos/subelementos de despesa (projeto Retenções v2, T04).
// Sem dependência de React/DB — usadas pelo serviço, pela cascata de telas (T05) e
// pelo motor de cálculo (T10) para extrair o código do elemento a partir do texto
// completo já gravado em notas_empenho/ordens_pagamento (ex.: "3.3.90.36 - Outros...").

const REGEX_EXTRAIR_CODIGO = /^\s*(\d(?:\.\d+)+)/;

/**
 * Extrai o código do elemento/subelemento do início de um texto gravado.
 * "3.3.90.36 - Outros Serviços..." -> "3.3.90.36"
 * "3.3.90.14.01 - Diárias..." -> "3.3.90.14.01" (regex gulosa já captura os 5 grupos)
 * "" | null | undefined -> null
 */
export function extrairCodigoElemento(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const match = texto.match(REGEX_EXTRAIR_CODIGO);
  return match ? match[1] : null;
}

/**
 * Corta o último segmento de um código de subelemento para achar o elemento pai.
 * "3.3.90.14.01" -> "3.3.90.14"
 */
export function codigoDoElementoPai(codigoSubelemento: string): string {
  const i = codigoSubelemento.lastIndexOf('.');
  return i === -1 ? codigoSubelemento : codigoSubelemento.slice(0, i);
}

/** Monta o texto "<codigo> - <descricao>" gravado em elemento/subelemento. */
export function montarValorElemento(item: { codigo: string; descricao: string }): string {
  return `${item.codigo} - ${item.descricao}`;
}
