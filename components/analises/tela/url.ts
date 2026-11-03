// Filtros da tela Análises → endereços da API (puro).
import { dataValida } from '@/lib/analises';

export type PeriodoTela = 's1' | 's2' | 'ano' | 'mes' | 'intervalo';
export type BaseTela = 'civil' | 'exercicio';

export interface FiltrosAnalises {
  periodo: PeriodoTela;
  /** null = o servidor escolhe o ano mais recente com movimento. */
  ano: number | null;
  /** Só no período 'mes' (1–12). */
  mes: number | null;
  inicio: string;
  fim: string;
  base: BaseTela;
  /** Código do elemento ('' = todos). */
  elemento: string;
  /** B7b: tipo de despesa = código do subelemento ('' = todos). */
  subelemento: string;
}

export const FILTROS_INICIAIS: FiltrosAnalises = { periodo: 'ano', ano: null, mes: null, inicio: '', fim: '', base: 'civil', elemento: '', subelemento: '' };

const REGEX_ELEMENTO = /^\d(\.\d+)+$/;
const REGEX_SUBELEMENTO = /^\d(?:\.\d+){4,}$/;
const mesValido = (m: number) => Number.isInteger(m) && m >= 1 && m <= 12;

/** Mês sugerido ao escolher "Mês": o atual no ano corrente; dezembro nos anos passados. */
export function mesPadrao(ano: number, hoje: Date = new Date()): number {
  return ano >= hoje.getFullYear() ? hoje.getMonth() + 1 : 12;
}

/**
 * B7b (T5): o tipo fixa o elemento pai; trocar o elemento tira um tipo que
 * não é dele. Devolve a mudança já ajustada.
 */
export function ajustarTipo(atual: FiltrosAnalises, parcial: Partial<FiltrosAnalises>): Partial<FiltrosAnalises> {
  const r = { ...parcial };
  if (r.subelemento) {
    r.elemento = r.subelemento.slice(0, r.subelemento.lastIndexOf('.'));
  } else if (r.elemento !== undefined && r.subelemento === undefined) {
    const sub = atual.subelemento;
    if (sub && (!r.elemento || !sub.startsWith(`${r.elemento}.`))) r.subelemento = '';
  }
  return r;
}

/** As mesmas regras do servidor (B2), para não pedir o que vai dar 400. */
export function validarIntervalo(inicio: string, fim: string): string | null {
  if (!dataValida(inicio) || !dataValida(fim)) return 'Informe as datas de início e fim.';
  if (inicio.slice(0, 4) !== fim.slice(0, 4)) return 'O intervalo precisa ficar dentro de um mesmo ano.';
  if (inicio > fim) return 'A data de início é depois da data de fim.';
  return null;
}

/** null = ainda não dá para pedir (intervalo incompleto ou inválido, mês sem mês). */
export function montarUrlAnalises(f: FiltrosAnalises): string | null {
  const p = new URLSearchParams();
  p.set('periodo', f.periodo);
  if (f.periodo === 'intervalo') {
    if (validarIntervalo(f.inicio, f.fim)) return null;
    p.set('inicio', f.inicio);
    p.set('fim', f.fim);
  } else if (f.ano !== null) {
    p.set('ano', String(f.ano));
  }
  if (f.periodo === 'mes') {
    if (f.mes === null || !mesValido(f.mes)) return null;
    p.set('mes', String(f.mes));
  }
  p.set('base', f.base);
  if (f.elemento) p.set('elemento', f.elemento);
  if (f.subelemento) p.set('subelemento', f.subelemento);
  return `/api/analises?${p.toString()}`;
}

/**
 * Filtros vindos do endereço (?periodo=…&ano=…), validados: o que não for
 * válido cai no padrão. Assim o endereço da tela pode ser compartilhado, e o
 * relatório volta para a tela com os mesmos filtros.
 */
export function filtrosDaUrl(sp: { get(nome: string): string | null }): FiltrosAnalises {
  const periodo = sp.get('periodo');
  const ano = Number(sp.get('ano'));
  const base = sp.get('base');
  const mes = Number(sp.get('mes'));
  const elemento = sp.get('elemento') ?? '';
  const subelemento = sp.get('subelemento') ?? '';
  const tipoOk = REGEX_SUBELEMENTO.test(subelemento);
  // Período "mes" sem um mês válido não dá para pedir: cai no padrão (ano).
  const periodoOk =
    periodo === 's1' || periodo === 's2' || periodo === 'ano' || periodo === 'intervalo' || (periodo === 'mes' && mesValido(mes)) ? periodo : 'ano';
  const filtros: FiltrosAnalises = {
    periodo: periodoOk,
    ano: Number.isInteger(ano) && ano >= 2000 && ano <= 2100 ? ano : null,
    mes: periodoOk === 'mes' ? mes : null,
    inicio: sp.get('inicio') ?? '',
    fim: sp.get('fim') ?? '',
    base: base === 'exercicio' ? 'exercicio' : 'civil',
    elemento: REGEX_ELEMENTO.test(elemento) ? elemento : '',
    subelemento: '',
  };
  return tipoOk ? { ...filtros, ...ajustarTipo(filtros, { subelemento }) } : filtros;
}

/**
 * Consulta (?…) com os filtros que estão NA TELA, o ano já resolvido: o
 * relatório e o CSV saem exatamente do que a pessoa está vendo.
 */
export function consultaDaTela(f: FiltrosAnalises, anoExibido: number): string | null {
  const url = montarUrlAnalises({ ...f, ano: f.periodo === 'intervalo' ? f.ano : f.ano ?? anoExibido });
  return url ? url.slice(url.indexOf('?')) : null;
}

const ultimoDia = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

/** O mês dentro do período: nunca antes do início nem depois do fim efetivo. */
export function recorteDoMes(mes: string, periodo: { inicio: string; fimEfetivo: string }): { inicio: string; fim: string } {
  const primeiro = `${mes}-01`;
  const ultimo = ultimoDia(mes);
  return {
    inicio: primeiro < periodo.inicio ? periodo.inicio : primeiro,
    fim: ultimo > periodo.fimEfetivo ? periodo.fimEfetivo : ultimo,
  };
}

export function montarUrlOps(r: {
  inicio: string;
  fim: string;
  base: BaseTela;
  ano: number;
  elemento?: string | null;
  subelemento?: string | null;
}): string {
  const p = new URLSearchParams({ inicio: r.inicio, fim: r.fim, base: r.base, ano: String(r.ano) });
  if (r.elemento) p.set('elemento', r.elemento);
  if (r.subelemento) p.set('subelemento', r.subelemento);
  return `/api/analises/ops?${p.toString()}`;
}
