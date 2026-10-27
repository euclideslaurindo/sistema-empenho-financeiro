// Planilha da aba Análises (B5): os números de todos os gráficos num CSV só,
// em seções, no mesmo formato do CSV do IR (Excel em português).
import { toCents } from '@/lib/money';
import { arquivoCsv, linhaCsv, textoCsv, valorCsv } from '@/lib/csv';
import type { obterAnalises } from '@/lib/services/analises.service';

type Resposta = Awaited<ReturnType<typeof obterAnalises>>;

const v = (reais: number) => valorCsv(toCents(reais));
/** % com vírgula ("8,5"); vazio quando não há base de comparação. */
const pctCsv = (p: number | null | undefined) => (p === null || p === undefined ? '' : String(p).replace('.', ','));
const dataBR = (iso: string) => iso.split('-').reverse().join('/');
const t = textoCsv;

const TITULOS = [
  'Identificação',
  'Resumo',
  'Cartões',
  'Ponte do orçamento',
  'Execução mês a mês',
  'Retenções e encargos por mês',
  'Pago por elemento de despesa',
  'Os 10 maiores credores',
  'Transporte (3.3.90.33) por município',
  'DARF por competência',
  'Situação das NEs do período',
  'Critérios e avisos',
] as const;
export const SECOES_CSV_ANALISES = TITULOS;

/** Linha de TOTAL somada em centavos (0,10 + 0,20 = 0,30 exato). */
const total = <T,>(lista: T[], f: (x: T) => number) => valorCsv(lista.reduce((s, x) => s + toCents(f(x)), 0));

export function montarCsvAnalises(r: Resposta, emitidoEm: string = r.atualizadoEm): string {
  const linhas: string[] = [];
  const secao = (i: number, cabecalho: string[], corpo: string[][]) => {
    if (linhas.length) linhas.push('');
    linhas.push(t(TITULOS[i]));
    linhas.push(linhaCsv(cabecalho.map(t)));
    for (const l of corpo) linhas.push(linhaCsv(l));
  };
  const p = r.periodo;
  const emissao = new Date(emitidoEm);

  secao(0, ['Campo', 'Valor'], [
    [t('Período'), t(p.rotulo)],
    [t('De'), t(dataBR(p.inicio))],
    [t('Até'), t(dataBR(p.fimEfetivo))],
    [t('Base'), t(r.base === 'civil' ? 'Ano civil (data do pagamento)' : 'Exercício da NE')],
    [t('Elemento'), t(r.elemento ?? 'Todos')],
    [t('Comparação'), t(p.rotuloComparacao)],
    [t('Emitido em'), t(`${emissao.toLocaleDateString('pt-BR')} ${emissao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)],
  ]);

  secao(1, ['Resumo'], [[t(r.resumo.map((x) => x.t).join(''))]]);

  const k = r.kpis;
  secao(2, ['Indicador', 'Valor (R$)', 'Variação (%)'], [
    [t('Empenhado'), v(k.empenhado), pctCsv(k.varEmpenhado)],
    [t('Pago no período'), v(k.pago), pctCsv(k.varPago)],
    [t('  das NEs do período'), v(r.pagoDasNes), ''],
    [t('  de NEs anteriores'), v(r.pagoAnteriores), ''],
    [t('Saldo a pagar'), v(k.saldo), pctCsv(k.varSaldo)],
    [t('Retido dos credores'), v(k.retido), pctCsv(k.varRetido)],
    [t('Restos a pagar pagos'), v(r.restos), ''],
    [t('Quantidade de OPs'), String(r.qtdOps), ''],
    [t('Credores pagos'), String(r.qtdCredores), ''],
    [t('NEs do período'), String(r.qtdNes), ''],
  ]);

  const pt = r.ponte;
  secao(3, ['Etapa', 'Valor (R$)'], [
    [t('Empenhado'), v(pt.empenhado)],
    [t('(-) Cancelado'), v(pt.cancelado)],
    [t('(-) Líquido pago ao credor'), v(pt.liquido)],
    [t('(-) Retenções e descontos'), v(pt.retencoes)],
    [t('(=) Saldo a pagar'), v(pt.saldo)],
  ]);

  secao(4, ['Mês', 'Empenhado (R$)', 'Pago (R$)', 'OPs'], [
    ...r.meses.map((m) => [t(m.longo), v(m.empenhado), v(m.pago), String(m.ops)]),
    [t('TOTAL'), total(r.meses, (m) => m.empenhado), total(r.meses, (m) => m.pago), String(r.meses.reduce((s, m) => s + m.ops, 0))],
  ]);

  secao(5, ['Mês', 'INSS (R$)', 'ISS (R$)', 'IRRF (R$)', 'SEST/SENAT (R$)', 'Patronal informativa (R$)'], [
    ...r.meses.map((m) => [t(m.longo), v(m.inss), v(m.iss), v(m.irrf), v(m.sest), v(m.patronal)]),
    [t('TOTAL'), total(r.meses, (m) => m.inss), total(r.meses, (m) => m.iss), total(r.meses, (m) => m.irrf), total(r.meses, (m) => m.sest), total(r.meses, (m) => m.patronal)],
  ]);

  secao(6, ['Código', 'Descrição', 'Pago (R$)', '% do total'], [
    ...r.elementos.map((e) => [t(e.codigo ?? ''), t(e.desc), v(e.pago), pctCsv(e.pct)]),
    [t('TOTAL'), '', total(r.elementos, (e) => e.pago), r.elementos.length ? '100' : ''],
  ]);

  secao(7, ['Nº', 'Credor', 'Pago (R$)'], r.credores.map((c, i) => [String(i + 1), t(c.nome), v(c.pago)]));
  secao(8, ['Município', 'Pago (R$)'], r.municipios.map((m) => [t(m.nome), v(m.pago)]));
  secao(9, ['Competência', 'Paga (R$)', 'Pendente (R$)'], r.darf.map((d, i) => [t(r.meses[i]?.longo ?? d.mes), v(d.paga), v(d.pendente)]));
  secao(10, ['Situação', 'NEs', 'Valor (R$)'], r.nes.map((n) => [t(n.nome), String(n.qtd), v(n.valor)]));
  secao(11, ['Texto'], [...r.criterios.map((c) => [t(c)]), ...r.avisos.map((a) => [t(`Aviso: ${a}`)])]);

  return arquivoCsv(linhas);
}

/** analises-2026-civil.csv · analises-1o-semestre-2026-exercicio.csv · analises-2026-03-01-a-2026-03-31-civil.csv */
export function nomeArquivoCsvAnalises(r: Pick<Resposta, 'periodo' | 'base' | 'elemento'>): string {
  const p = r.periodo;
  const recorte = p.tipo === 'intervalo' ? `${p.inicio}-a-${p.fim}` : p.tipo === 's1' ? `1o-semestre-${p.ano}` : p.tipo === 's2' ? `2o-semestre-${p.ano}` : String(p.ano);
  const partes = ['analises', recorte, r.base, r.elemento ? `el-${r.elemento.replace(/\./g, '')}` : ''].filter(Boolean);
  return `${partes.join('-').replace(/[^A-Za-z0-9-]/g, '')}.csv`;
}
