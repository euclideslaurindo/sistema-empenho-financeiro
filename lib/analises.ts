// Análises da execução financeira (B2): regras puras de período, comparação,
// agrupamentos, ponte do orçamento e resumo em texto. Sem banco: o service
// passa as somas já lidas. Dinheiro sempre em centavos inteiros por dentro.
import { fromCents, type Centavos } from '@/lib/money';
import { extrairCodigoElemento } from '@/lib/elementos';
import { statusPeloSaldo } from '@/lib/status-ne';
import { normalizarMunicipio } from '@/lib/perfis-calculo';

export type TipoPeriodo = 's1' | 's2' | 'ano' | 'intervalo';
export type Base = 'civil' | 'exercicio';
export type SituacaoNe = 'A pagar' | 'Parcial' | 'Paga' | 'Cancelada';

export const SITUACOES: SituacaoNe[] = ['A pagar', 'Parcial', 'Paga', 'Cancelada'];
export const ELEMENTO_TRANSPORTE = '3.3.90.33';
export const ANO_MIN = 2000;
export const ANO_MAX = 2100;

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Período inválido pedido pela tela: vira 400 com a mensagem. */
export class ErroPeriodo extends Error {}

// ---------------------------------------------------------------------------
// Datas (texto AAAA-MM-DD, sem fuso: o banco guarda DATE)
// ---------------------------------------------------------------------------

export function dataValida(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** O mesmo dia um ano antes; 29/02 vira 28/02. */
export function menosUmAno(iso: string): string {
  const [a, m, d] = iso.split('-');
  const dia = m === '02' && d === '29' ? '28' : d;
  return `${String(Number(a) - 1).padStart(4, '0')}-${m}-${dia}`;
}

const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const diaMesBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const mesCurto = (iso: string) => MESES_CURTOS[Number(iso.slice(5, 7)) - 1];

/** ['2026-01', …, '2026-10'] entre as duas datas (inclusive). */
export function mesesDoPeriodo(inicio: string, fim: string): string[] {
  const meses: string[] = [];
  let a = Number(inicio.slice(0, 4));
  let m = Number(inicio.slice(5, 7));
  const af = Number(fim.slice(0, 4));
  const mf = Number(fim.slice(5, 7));
  while (a < af || (a === af && m <= mf)) {
    meses.push(`${a}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return meses;
}

export const rotuloMes = (mes: string) => MESES_CURTOS[Number(mes.slice(5, 7)) - 1];
export const rotuloMesLongo = (mes: string) => MESES_LONGOS[Number(mes.slice(5, 7)) - 1];

export interface Periodo {
  tipo: TipoPeriodo;
  ano: number;
  inicio: string;
  fim: string;
  /** O menor entre o fim e hoje (R2). */
  fimEfetivo: string;
  parcial: boolean;
  /** Ainda não começou: a resposta sai vazia, sem erro. */
  futuro: boolean;
  meses: string[];
  anterior: { inicio: string; fim: string };
  rotulo: string;
  rotuloComparacao: string;
}

/** R1–R3: limites do período, corte em hoje e o mesmo recorte do ano anterior. */
export function resolverPeriodo(
  p: { tipo: TipoPeriodo; ano?: number | null; inicio?: string | null; fim?: string | null },
  hoje: string
): Periodo {
  let ano: number;
  let inicio: string;
  let fim: string;

  if (p.tipo === 'intervalo') {
    if (!dataValida(p.inicio) || !dataValida(p.fim)) throw new ErroPeriodo('Informe as datas de início e fim (AAAA-MM-DD).');
    inicio = p.inicio;
    fim = p.fim;
    if (inicio > fim) throw new ErroPeriodo('A data de início é depois da data de fim.');
    if (inicio.slice(0, 4) !== fim.slice(0, 4)) throw new ErroPeriodo('O intervalo precisa ficar dentro de um mesmo ano.');
    ano = Number(inicio.slice(0, 4));
  } else {
    ano = Number(p.ano);
    if (!Number.isInteger(ano)) throw new ErroPeriodo('Informe o ano.');
    const [mi, mf] = p.tipo === 's1' ? ['01-01', '06-30'] : p.tipo === 's2' ? ['07-01', '12-31'] : ['01-01', '12-31'];
    inicio = `${ano}-${mi}`;
    fim = `${ano}-${mf}`;
  }
  if (ano < ANO_MIN || ano > ANO_MAX) throw new ErroPeriodo(`O ano deve estar entre ${ANO_MIN} e ${ANO_MAX}.`);

  const futuro = inicio > hoje;
  const fimEfetivo = futuro || fim <= hoje ? fim : hoje;
  const parcial = !futuro && fimEfetivo < fim;

  const base = p.tipo === 's1' ? `1º semestre de ${ano}` : p.tipo === 's2' ? `2º semestre de ${ano}` : p.tipo === 'ano' ? String(ano) : `${diaMesBR(inicio)} a ${dataBR(fim)}`;
  const rotulo = parcial ? `${base} (até ${diaMesBR(fimEfetivo)})` : base;

  const anterior = { inicio: menosUmAno(inicio), fim: menosUmAno(fimEfetivo) };
  let rotuloComparacao: string;
  if (p.tipo === 'intervalo') rotuloComparacao = `${diaMesBR(anterior.inicio)} a ${dataBR(anterior.fim)}`;
  else if (parcial) rotuloComparacao = `${mesCurto(inicio)}–${mesCurto(fimEfetivo)}/${ano - 1}`;
  else rotuloComparacao = p.tipo === 's1' ? `1º sem/${ano - 1}` : p.tipo === 's2' ? `2º sem/${ano - 1}` : String(ano - 1);

  return {
    tipo: p.tipo, ano, inicio, fim, fimEfetivo, parcial, futuro,
    meses: futuro ? [] : mesesDoPeriodo(inicio, fimEfetivo),
    anterior, rotulo, rotuloComparacao,
  };
}

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

/** R11: variação % com 1 casa; null sem base de comparação. */
export function variacao(atual: Centavos, anterior: Centavos): number | null {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

/** Participação % com 1 casa, sobre centavos. */
export const participacao = (parte: Centavos, total: Centavos) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : 0);

/** 1_362_000_00 → "R$ 1,36 mi"; 407_261_23 → "R$ 407 mil". */
export function valorCurto(c: Centavos): string {
  const v = fromCents(c);
  const a = Math.abs(v);
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  if (a >= 1e3) return `R$ ${Math.round(v / 1e3).toLocaleString('pt-BR')} mil`;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const pct1 = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/** Valor do usuário em LIKE: escapa `\`, `%` e `_`. */
export const escaparLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// ---------------------------------------------------------------------------
// Agrupamentos
// ---------------------------------------------------------------------------

export interface ElementoPago {
  codigo: string | null;
  desc: string;
  pago: Centavos;
  pct: number;
}

/** Junta as variações de texto do mesmo elemento pelo código (a maior descrição fica). */
export function agruparElementos(linhas: Array<{ elemento: string | null; pago: Centavos }>): ElementoPago[] {
  const porChave = new Map<string, { codigo: string | null; desc: string; pago: Centavos }>();
  for (const l of linhas) {
    const texto = String(l.elemento ?? '').trim();
    const codigo = extrairCodigoElemento(texto);
    const desc = codigo ? texto.slice(texto.indexOf(codigo) + codigo.length).replace(/^[\s\-–—:]+/, '').trim() : '';
    const chave = codigo ?? '#sem';
    const atual = porChave.get(chave) ?? { codigo, desc: codigo ? '' : 'Sem elemento', pago: 0 };
    atual.pago += l.pago;
    if (codigo && desc.length > atual.desc.length) atual.desc = desc;
    porChave.set(chave, atual);
  }
  const total = [...porChave.values()].reduce((t, e) => t + e.pago, 0);
  return [...porChave.values()]
    .filter((e) => e.pago !== 0)
    .map((e) => ({ ...e, pct: participacao(e.pago, total) }))
    .sort((a, b) => b.pago - a.pago || String(a.codigo).localeCompare(String(b.codigo)));
}

/** Junta "Garanhuns", "GARANHUNS " e "Garanhuns/PE"; vazio → "Sem município". */
export function agruparMunicipios(linhas: Array<{ municipio: string | null; pago: Centavos }>): Array<{ nome: string; pago: Centavos }> {
  const porChave = new Map<string, { nome: string; pago: Centavos }>();
  for (const l of linhas) {
    const chave = normalizarMunicipio(l.municipio) || '#sem';
    const nome = chave === '#sem' ? 'Sem município' : String(l.municipio).trim().replace(/\s*[/-]\s*[A-Za-z]{2}\s*$/, '');
    const atual = porChave.get(chave) ?? { nome, pago: 0 };
    atual.pago += l.pago;
    porChave.set(chave, atual);
  }
  return [...porChave.values()].filter((m) => m.pago !== 0).sort((a, b) => b.pago - a.pago || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Situação na posição do fim do período (statusPeloSaldo com o pago até lá). */
export function situacaoDaNe(valor: Centavos, pagoAteFim: Centavos, status: string | null): SituacaoNe {
  const s = statusPeloSaldo(valor, pagoAteFim, status);
  return s === 'CANCELADO' ? 'Cancelada' : s === 'EMITIDO' ? 'A pagar' : s === 'LIQUIDADO' ? 'Paga' : 'Parcial';
}

// ---------------------------------------------------------------------------
// Ponte do orçamento
// ---------------------------------------------------------------------------

export interface NeDoPeriodo {
  valor: Centavos;
  status: string | null;
  /** Bruto pago até o fim efetivo. */
  pago: Centavos;
  /** Líquido pago até o fim efetivo. */
  liquido: Centavos;
}

export interface Ponte {
  empenhado: Centavos;
  cancelado: Centavos;
  liquido: Centavos;
  /** Bruto − líquido: retenções e todos os descontos da OP. */
  retencoes: Centavos;
  saldo: Centavos;
}

/**
 * R7. A NE cancelada entra inteira no cancelado (o sistema só cancela NE sem
 * OP). Erro aqui é bug do código, não dado: por isso lança.
 */
export function fecharPonte(nes: NeDoPeriodo[]): Ponte {
  let empenhado = 0, cancelado = 0, pago = 0, liquido = 0;
  for (const n of nes) {
    empenhado += n.valor;
    if (n.status === 'CANCELADO') cancelado += n.valor;
    pago += n.pago;
    liquido += n.liquido;
  }
  const ponte = { empenhado, cancelado, liquido, retencoes: pago - liquido, saldo: empenhado - cancelado - pago };
  if ([...Object.values(ponte)].some((v) => !Number.isInteger(v)) || ponte.empenhado - ponte.cancelado - ponte.liquido - ponte.retencoes !== ponte.saldo) {
    throw new Error('Ponte do orçamento não fecha.');
  }
  return ponte;
}

/** Diferenças vindas dos DADOS (não do código): viram aviso na tela, não erro. */
export function avisosDasNes(nes: NeDoPeriodo[]): string[] {
  const avisos: string[] = [];
  const acima = nes.filter((n) => n.status !== 'CANCELADO' && n.pago > n.valor).length;
  if (acima) avisos.push(`${acima} NE(s) com pagamento acima do valor empenhado: o saldo dessas NEs fica negativo.`);
  const canceladaPaga = nes.filter((n) => n.status === 'CANCELADO' && n.pago > 0).length;
  if (canceladaPaga) avisos.push(`${canceladaPaga} NE(s) cancelada(s) com OP: confira essas NEs.`);
  return avisos;
}

// ---------------------------------------------------------------------------
// Resumo em texto (R13)
// ---------------------------------------------------------------------------

export interface DadosResumo {
  periodo: Pick<Periodo, 'ano' | 'rotulo' | 'rotuloComparacao' | 'futuro'>;
  pago: Centavos;
  saldo: Centavos;
  empenhado: Centavos;
  restos: Centavos;
  qtdCredores: number;
  qtdOps: number;
  varPago: number | null;
  pctTransporte: number;
}

export type TrechoResumo = { t: string; forte: boolean };

/** A frase do topo, montada só com as contas (sem IA). */
export function montarResumo(r: DadosResumo): TrechoResumo[] {
  const n = (t: string): TrechoResumo => ({ t, forte: false });
  const f = (t: string): TrechoResumo => ({ t, forte: true });
  if (r.periodo.futuro) return [n(`O período ${r.periodo.rotulo} ainda não começou.`)];
  if (r.qtdOps === 0 && r.empenhado === 0) return [n(`Nenhuma NE ou OP em ${r.periodo.rotulo}.`)];

  const trechos: TrechoResumo[] = [
    n(`Em ${r.periodo.rotulo} foram pagos `),
    f(valorCurto(r.pago)),
    n(' a '),
    f(`${r.qtdCredores} ${r.qtdCredores === 1 ? 'credor' : 'credores'}`),
  ];
  if (r.varPago === null) trechos.push(n(`, sem base de comparação com ${r.periodo.rotuloComparacao}. `));
  else if (r.varPago === 0) trechos.push(n(`, o mesmo que em ${r.periodo.rotuloComparacao}. `));
  else trechos.push(n(`, ${pct1(Math.abs(r.varPago))} ${r.varPago > 0 ? 'a mais' : 'a menos'} que em ${r.periodo.rotuloComparacao}. `));
  if (r.pctTransporte > 0) trechos.push(n(`${pct1(r.pctTransporte)} foi para transporte (${ELEMENTO_TRANSPORTE}). `));
  trechos.push(n('Das NEs empenhadas no período, restam '), f(valorCurto(r.saldo)), n(' a pagar.'));
  if (r.restos > 0) trechos.push(n(` O total pago inclui ${valorCurto(r.restos)} de restos a pagar de anos anteriores.`));
  return trechos;
}

/** Critérios impressos no rodapé da tela e do relatório. */
export function criterios(base: Base, periodo: Periodo): string[] {
  return [
    base === 'civil'
      ? 'Ano civil: OPs pela data de pagamento; sem ela, pela data de emissão. Inclui restos a pagar de NEs de anos anteriores.'
      : `Exercício da NE: só OPs de NEs do exercício de ${periodo.ano}, pela data de pagamento (sem ela, pela de emissão).`,
    `Ponte e situação das NEs: NEs empenhadas no período, na posição de ${dataBR(periodo.fimEfetivo)}. NE cancelada conta pela situação atual.`,
    `Comparação com ${periodo.rotuloComparacao}, no mesmo recorte de dias. Valores em R$, somados em centavos.`,
    'DARF: pela competência; não muda com a base nem com o elemento.',
  ];
}
