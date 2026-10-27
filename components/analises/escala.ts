// Escala dos gráficos da aba Análises: puro, a mesma conta em todos.

/** Fração livre no alto para o rótulo da maior barra não sair do quadro. */
export const ESPACO_TOPO = 0.88;

/** Teto "redondo" acima do máximo: 1, 2, 2,5, 5 ou 10 × 10^n. Zero ou negativo → 1 (sem NaN). */
export function teto(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / e;
  const passo = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return passo * e;
}

/** % do teto com 2 casas, entre 0 e 100. Negativo → 0: a barra não inverte (o rótulo mostra o sinal). */
export function pct(valor: number, tetoEscala: number): number {
  if (!Number.isFinite(valor) || !Number.isFinite(tetoEscala) || tetoEscala <= 0 || valor <= 0) return 0;
  return Math.round(Math.min(100, (valor / tetoEscala) * 100) * 100) / 100;
}

/** Linhas de grade: só a metade e o teto, para não poluir. */
export function gradeDoEixo(tetoEscala: number): Array<{ pos: number; valor: number }> {
  return [
    { pos: 50, valor: tetoEscala / 2 },
    { pos: 100, valor: tetoEscala },
  ];
}
