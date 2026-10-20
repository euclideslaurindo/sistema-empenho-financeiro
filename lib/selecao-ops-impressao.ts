/**
 * Quais OPs da NE já abrem marcadas na consulta de impressão: só as da
 * emissão ("Imprimir esta emissão", ?ops=… — T36), se vierem e alguma for
 * desta NE; senão todas (comportamento de sempre).
 */
export function selecaoInicialDasOps(ordens: Array<{ id: string }>, opsDaEmissao: string[] = []): Record<string, boolean> {
  const daNe = new Set(ordens.map((op) => op.id));
  const alvo = opsDaEmissao.filter((id) => daNe.has(id));
  return Object.fromEntries(ordens.map((op) => [op.id, alvo.length === 0 || alvo.includes(op.id)]));
}
