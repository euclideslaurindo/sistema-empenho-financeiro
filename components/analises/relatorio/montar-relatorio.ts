// Relatório A4 das Análises: arrumações puras para caber nas folhas fixas.
import { toCents, fromCents } from '@/lib/money';
import type { RespostaAnalises } from '../tela/tipos';

export const MAX_ELEMENTOS_RELATORIO = 6;

/**
 * No máximo 6 linhas: os 5 maiores e "Outros" com a soma do resto (em
 * centavos), para a folha não cortar e o total continuar igual.
 */
export function elementosDoRelatorio(elementos: RespostaAnalises['elementos'], max = MAX_ELEMENTOS_RELATORIO) {
  const linhas = elementos.map((e) => ({ nome: e.codigo ? `${e.codigo} ${e.desc}`.trim() : e.desc, pago: e.pago, pct: e.pct }));
  if (linhas.length <= max) return linhas;
  const principais = linhas.slice(0, max - 1);
  const resto = linhas.slice(max - 1);
  const totalCents = linhas.reduce((t, l) => t + toCents(l.pago), 0);
  const restoCents = resto.reduce((t, l) => t + toCents(l.pago), 0);
  return [
    ...principais,
    { nome: `Outros (${resto.length} elementos)`, pago: fromCents(restoCents), pct: totalCents > 0 ? Math.round((restoCents / totalCents) * 1000) / 10 : 0 },
  ];
}

/**
 * B7b: por tipo de despesa, no mesmo limite de 6 linhas (5 + "Outros"), com
 * NEs, prestadores e pago somados no "Outros" (o pago em centavos).
 */
export function tiposDoRelatorio(tipos: RespostaAnalises['tipos'], max = MAX_ELEMENTOS_RELATORIO) {
  const linhas = tipos.map((x) => ({ nome: x.codigo ? `${x.codigo} ${x.desc}`.trim() : x.desc, qtdNes: x.qtdNes, prestadores: x.prestadores, pago: x.pago }));
  if (linhas.length <= max) return linhas;
  const resto = linhas.slice(max - 1);
  return [
    ...linhas.slice(0, max - 1),
    {
      nome: `Outros (${resto.length} tipos)`,
      qtdNes: resto.reduce((t, l) => t + l.qtdNes, 0),
      prestadores: resto.reduce((t, l) => t + l.prestadores, 0),
      pago: fromCents(resto.reduce((t, l) => t + toCents(l.pago), 0)),
    },
  ];
}

/** Retido por tipo no período (soma dos meses em centavos); a Patronal fica à parte. */
export function retidoPorTipo(meses: RespostaAnalises['meses']) {
  const soma = (f: (m: RespostaAnalises['meses'][number]) => number) => fromCents(meses.reduce((t, m) => t + toCents(f(m)), 0));
  const tipos = [
    { nome: 'INSS', valor: soma((m) => m.inss) },
    { nome: 'ISS', valor: soma((m) => m.iss) },
    { nome: 'IRRF', valor: soma((m) => m.irrf) },
    { nome: 'SEST/SENAT', valor: soma((m) => m.sest) },
  ];
  const total = fromCents(tipos.reduce((t, x) => t + toCents(x.valor), 0));
  return { tipos, total, patronal: soma((m) => m.patronal) };
}

/** As 5 etapas da ponte com o % de cada uma sobre o empenhado (empenhado 0 → 0%). */
export function linhasDaPonte(p: RespostaAnalises['ponte']) {
  const e = toCents(p.empenhado);
  const pct = (v: number) => (e > 0 ? Math.round((toCents(v) / e) * 1000) / 10 : 0);
  return [
    { sinal: '', nome: 'Empenhado', valor: p.empenhado, pct: pct(p.empenhado), forte: true },
    { sinal: '(−)', nome: 'Cancelado', valor: p.cancelado, pct: pct(p.cancelado), forte: false },
    { sinal: '(−)', nome: 'Líquido pago ao credor', valor: p.liquido, pct: pct(p.liquido), forte: false },
    { sinal: '(−)', nome: 'Retenções e descontos', valor: p.retencoes, pct: pct(p.retencoes), forte: false },
    { sinal: '(=)', nome: 'Saldo a pagar', valor: p.saldo, pct: pct(p.saldo), forte: true },
  ];
}
