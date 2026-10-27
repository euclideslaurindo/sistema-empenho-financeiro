// Resposta da API (B2) → título, legenda, tabela e dados de cada gráfico (puro).
// Os títulos dizem o resultado, com as frases do protótipo aprovado (B1).
import { toCents } from '@/lib/money';
import { brl, curto, pct1 } from '../formato';
import { paleta } from '../paleta';
import type { ItemLegenda } from '../Legenda';
import type { DadosTabela } from '../TabelaDados';
import type { EtapaCascata } from '../graficos/Cascata';
import type { Categoria, Serie, Valores } from '../graficos/BarrasAgrupadas';
import type { ItemVertical } from '../graficos/BarrasVerticais';
import type { ItemHorizontal } from '../graficos/BarrasHorizontais';
import type { RespostaAnalises } from './tipos';

export interface Montado<P> {
  titulo: string;
  vazio: boolean;
  legenda: ItemLegenda[];
  tabela: DadosTabela;
  props: P;
}

const somaC = <T,>(l: T[], f: (x: T) => number) => l.reduce((t, x) => t + toCents(f(x)), 0) / 100;
const categoriasDe = (r: RespostaAnalises): Categoria[] => r.meses.map((m) => ({ chave: m.mes, rotulo: m.rotulo, rotuloLongo: m.longo }));
const indiceDoMaior = (valores: number[]) => valores.reduce((im, v, i) => (v > valores[im] ? i : im), 0);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// ---------------------------------------------------------------------------

export function montarPonte(r: RespostaAnalises): Montado<{ etapas: EtapaCascata[] }> {
  const p = r.ponte;
  const etapas: EtapaCascata[] = [
    { chave: 'empenhado', rotulo: 'Empenhado', valor: p.empenhado, tipo: 'total', fundo: paleta.azulClaro },
    { chave: 'cancelado', rotulo: 'Cancelado', valor: p.cancelado, tipo: 'menos', fundo: paleta.hachuraCinza },
    { chave: 'liquido', rotulo: 'Líquido pago ao credor', valor: p.liquido, tipo: 'menos', fundo: paleta.azul },
    { chave: 'retencoes', rotulo: 'Retenções e descontos', valor: p.retencoes, tipo: 'menos', fundo: paleta.categoricas[0] },
    { chave: 'saldo', rotulo: 'Saldo a pagar', valor: p.saldo, tipo: 'saldo', fundo: paleta.ambar },
  ];
  const vazio = p.empenhado <= 0;
  return {
    titulo: vazio ? 'Nenhuma NE empenhada no período' : `Das NEs do período, ${r.pctPagoDoEmpenhado}% já foi pago e ${curto(p.saldo)} falta pagar`,
    vazio,
    legenda: [],
    tabela: {
      legenda: 'Ponte do orçamento',
      colunas: ['Etapa', 'Valor'],
      linhas: [
        ['Empenhado', brl(p.empenhado)],
        ['(−) Cancelado', brl(p.cancelado)],
        ['(−) Líquido pago ao credor', brl(p.liquido)],
        ['(−) Retenções e descontos', brl(p.retencoes)],
        ['(=) Saldo a pagar', brl(p.saldo)],
      ],
    },
    props: { etapas },
  };
}

export function montarExecucao(r: RespostaAnalises): Montado<{ categorias: Categoria[]; series: Serie[]; valores: Valores; destaque?: string }> {
  const valores: Valores = Object.fromEntries(r.meses.map((m) => [m.mes, { empenhado: m.empenhado, pago: m.pago }]));
  const algumPago = r.meses.some((m) => m.pago > 0);
  const iMax = indiceDoMaior(r.meses.map((m) => m.pago));
  const vazio = !r.meses.some((m) => m.pago > 0 || m.empenhado > 0);
  return {
    titulo: algumPago ? `${r.meses[iMax].longo} teve o maior pagamento: ${curto(r.meses[iMax].pago)}` : 'Sem pagamentos no período',
    vazio,
    legenda: [
      { nome: 'Empenhado', fundo: paleta.azulClaro },
      { nome: 'Pago', fundo: paleta.azul },
    ],
    tabela: {
      legenda: 'Execução mês a mês',
      colunas: ['Mês', 'Empenhado', 'Pago'],
      linhas: r.meses.map((m) => [m.longo, brl(m.empenhado), brl(m.pago)]),
    },
    props: {
      categorias: categoriasDe(r),
      series: [
        { chave: 'empenhado', nome: 'Empenhado', fundo: paleta.azulClaro },
        { chave: 'pago', nome: 'Pago', fundo: paleta.azul },
      ],
      valores,
      destaque: algumPago ? r.meses[iMax].mes : undefined,
    },
  };
}

export function montarElementos(r: RespostaAnalises): Montado<{ itens: ItemHorizontal[] }> {
  const els = r.elementos;
  return {
    titulo: els.length ? `${els[0].desc || els[0].codigo} ficou com ${pct1(els[0].pct)} do que foi pago` : 'Sem pagamentos no período',
    vazio: els.length === 0,
    legenda: [],
    tabela: {
      legenda: 'Pago por elemento de despesa',
      colunas: ['Elemento', 'Pago', '% do total'],
      linhas: els.map((e) => [`${e.codigo ?? ''} ${e.desc}`.trim(), brl(e.pago), pct1(e.pct)]),
    },
    props: { itens: els.map((e) => ({ chave: e.codigo ?? 'sem-elemento', rotulo: e.codigo ?? 'Sem elemento', sub: e.codigo ? e.desc : undefined, valor: e.pago, pct: e.pct })) },
  };
}

export function montarPagamentos(r: RespostaAnalises): Montado<{ itens: ItemVertical[]; destaque?: string; ops: Array<{ chave: string; valor: number; rotulo: string }> }> {
  const iMax = indiceDoMaior(r.meses.map((m) => m.pago));
  const media = r.qtdOps ? r.kpis.pago / r.qtdOps : 0;
  return {
    titulo: r.qtdOps ? `${plural(r.qtdOps, 'OP', 'OPs')} no período, com média de ${curto(media)} por OP` : 'Nenhuma OP no período',
    vazio: r.qtdOps === 0,
    legenda: [],
    tabela: {
      legenda: 'Pagamentos por mês',
      colunas: ['Mês', 'Pago', 'OPs'],
      linhas: r.meses.map((m) => [m.longo, brl(m.pago), String(m.ops)]),
    },
    props: {
      itens: r.meses.map((m) => ({ chave: m.mes, rotulo: m.rotulo, rotuloLongo: m.longo, valor: m.pago, dica: plural(m.ops, 'OP', 'OPs') })),
      destaque: r.qtdOps ? r.meses[iMax].mes : undefined,
      ops: r.meses.map((m) => ({ chave: m.mes, valor: m.ops, rotulo: m.longo })),
    },
  };
}

export function montarCredores(r: RespostaAnalises): Montado<{ itens: ItemHorizontal[] }> {
  const top = somaC(r.credores, (c) => c.pago);
  const pctTop = r.kpis.pago > 0 ? Math.round((top / r.kpis.pago) * 100) : 0;
  return {
    titulo: r.credores.length ? `Os ${r.credores.length} maiores receberam ${pctTop}% do total pago` : 'Nenhum credor pago no período',
    vazio: r.credores.length === 0,
    legenda: [],
    tabela: {
      legenda: 'Os 10 maiores credores',
      colunas: ['Credor', 'Pago'],
      linhas: r.credores.map((c) => [c.nome, brl(c.pago)]),
    },
    props: { itens: r.credores.map((c, i) => ({ chave: `${i}-${c.nome}`, rotulo: c.nome, valor: c.pago })) },
  };
}

const SERIES_RETENCAO = [
  { chave: 'inss', nome: 'INSS', fundo: paleta.categoricas[0] },
  { chave: 'iss', nome: 'ISS', fundo: paleta.categoricas[1] },
  { chave: 'irrf', nome: 'IRRF', fundo: paleta.categoricas[2] },
  { chave: 'sest', nome: 'SEST/SENAT', fundo: paleta.categoricas[3] },
  { chave: 'patronal', nome: 'Patronal (informativa)', fundo: paleta.hachuraPatronal },
] as const;

export function montarRetencoes(r: RespostaAnalises): Montado<{ categorias: Categoria[]; series: Serie[]; valores: Valores }> {
  const valores: Valores = Object.fromEntries(r.meses.map((m) => [m.mes, { inss: m.inss, iss: m.iss, irrf: m.irrf, sest: m.sest, patronal: m.patronal }]));
  const vazio = !r.meses.some((m) => m.inss || m.iss || m.irrf || m.sest || m.patronal);
  return {
    titulo: vazio ? 'Nenhuma retenção no período' : `${curto(r.kpis.retido)} retidos dos credores no período`,
    vazio,
    legenda: SERIES_RETENCAO.map((s) => ({ nome: s.nome, fundo: s.fundo })),
    tabela: {
      legenda: 'Retenções e encargos por mês',
      colunas: ['Mês', 'INSS', 'ISS', 'IRRF', 'SEST/SENAT', 'Patronal'],
      linhas: r.meses.map((m) => [m.longo, brl(m.inss), brl(m.iss), brl(m.irrf), brl(m.sest), brl(m.patronal)]),
    },
    props: { categorias: categoriasDe(r), series: SERIES_RETENCAO.map((s) => ({ ...s })), valores },
  };
}

export function montarDarf(r: RespostaAnalises): Montado<{ categorias: Categoria[]; series: Serie[]; valores: Valores }> {
  const pendente = somaC(r.darf, (d) => d.pendente);
  const total = somaC(r.darf, (d) => d.paga + d.pendente);
  return {
    titulo: total <= 0 ? 'Nenhuma DARF no período' : pendente > 0 ? `${curto(pendente)} de DARF ainda a recolher` : 'Todas as DARFs do período estão pagas',
    vazio: total <= 0,
    legenda: [
      { nome: 'Paga', fundo: paleta.verde, status: 'paga' },
      { nome: 'Pendente', fundo: paleta.ambar, status: 'pendente' },
    ],
    tabela: {
      legenda: 'DARF por competência',
      colunas: ['Competência', 'Paga', 'Pendente'],
      linhas: r.darf.map((d, i) => [r.meses[i]?.longo ?? d.mes, brl(d.paga), brl(d.pendente)]),
    },
    props: {
      categorias: categoriasDe(r),
      series: [
        { chave: 'paga', nome: 'Paga', fundo: paleta.verde },
        { chave: 'pendente', nome: 'Pendente', fundo: paleta.ambar },
      ],
      valores: Object.fromEntries(r.darf.map((d) => [d.mes, { paga: d.paga, pendente: d.pendente }])),
    },
  };
}

const FUNDO_SITUACAO: Record<string, string> = { 'A pagar': paleta.azulClaro, Parcial: paleta.azulMedio, Paga: paleta.azul, Cancelada: paleta.hachuraCinza };

export function montarNes(r: RespostaAnalises): Montado<{ itens: ItemVertical[] }> {
  const comSaldo = r.nes.filter((n) => n.nome === 'A pagar' || n.nome === 'Parcial').reduce((t, n) => t + n.qtd, 0);
  return {
    titulo: r.qtdNes ? `${comSaldo} de ${plural(r.qtdNes, 'NE', 'NEs')} ainda ${comSaldo === 1 ? 'tem' : 'têm'} saldo a pagar` : 'Nenhuma NE empenhada no período',
    vazio: r.qtdNes === 0,
    legenda: [],
    tabela: {
      legenda: 'Situação das NEs do período',
      colunas: ['Situação', 'NEs', 'Valor'],
      linhas: r.nes.map((n) => [n.nome, String(n.qtd), brl(n.valor)]),
    },
    props: { itens: r.nes.map((n) => ({ chave: n.nome, rotulo: n.nome, valor: n.valor, fundo: FUNDO_SITUACAO[n.nome], sub: plural(n.qtd, 'NE', 'NEs'), dica: plural(n.qtd, 'NE', 'NEs') })) },
  };
}

export function montarMunicipios(r: RespostaAnalises): Montado<{ itens: ItemHorizontal[] }> {
  const total = somaC(r.municipios, (m) => m.pago);
  const m0 = r.municipios[0];
  return {
    titulo: m0 && total > 0 ? `${m0.nome} recebeu ${Math.round((m0.pago / total) * 100)}% do transporte` : 'Sem transporte no período',
    vazio: r.municipios.length === 0,
    legenda: [],
    tabela: {
      legenda: 'Transporte por município',
      colunas: ['Município', 'Pago'],
      linhas: r.municipios.map((m) => [m.nome, brl(m.pago)]),
    },
    props: { itens: r.municipios.map((m) => ({ chave: m.nome, rotulo: m.nome, valor: m.pago })) },
  };
}
