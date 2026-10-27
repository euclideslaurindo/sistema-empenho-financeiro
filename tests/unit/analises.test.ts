// B2 (Análises) — regras puras: período, variação, agrupamentos, ponte e resumo.
import { describe, test, expect } from 'vitest';
import {
  ErroPeriodo,
  agruparElementos,
  agruparMunicipios,
  avisosDasNes,
  dataValida,
  escaparLike,
  fecharPonte,
  menosUmAno,
  mesesDoPeriodo,
  montarResumo,
  resolverPeriodo,
  situacaoDaNe,
  valorCurto,
  variacao,
  type DadosResumo,
} from '@/lib/analises';

const HOJE = '2026-10-27';

describe('datas', () => {
  test('dataValida recusa formato errado e dia que não existe', () => {
    expect(dataValida('2026-02-28')).toBe(true);
    expect(dataValida('2028-02-29')).toBe(true);
    for (const v of ['2026-02-29', '2026-02-31', '2026-13-01', '26-01-01', '2026-1-1', '', null, 20260101]) expect(dataValida(v), String(v)).toBe(false);
  });

  test('menosUmAno: 29/02 vira 28/02', () => {
    expect(menosUmAno('2026-10-27')).toBe('2025-10-27');
    expect(menosUmAno('2028-02-29')).toBe('2027-02-28');
  });

  test('mesesDoPeriodo inclui as duas pontas e atravessa o ano', () => {
    expect(mesesDoPeriodo('2026-07-15', '2026-10-27')).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
    expect(mesesDoPeriodo('2025-11-01', '2026-02-01')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('resolverPeriodo', () => {
  test('1º semestre já fechado: inteiro, sem corte, comparação com o 1º sem do ano anterior', () => {
    const p = resolverPeriodo({ tipo: 's1', ano: 2026 }, HOJE);
    expect(p).toMatchObject({ inicio: '2026-01-01', fim: '2026-06-30', fimEfetivo: '2026-06-30', parcial: false, futuro: false });
    expect(p.meses).toHaveLength(6);
    expect(p.anterior).toEqual({ inicio: '2025-01-01', fim: '2025-06-30' });
    expect(p.rotulo).toBe('1º semestre de 2026');
    expect(p.rotuloComparacao).toBe('1º sem/2025');
  });

  test('2º semestre em andamento: corta em hoje e compara o mesmo recorte de dias', () => {
    const p = resolverPeriodo({ tipo: 's2', ano: 2026 }, HOJE);
    expect(p).toMatchObject({ inicio: '2026-07-01', fim: '2026-12-31', fimEfetivo: '2026-10-27', parcial: true });
    expect(p.meses).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
    expect(p.anterior).toEqual({ inicio: '2025-07-01', fim: '2025-10-27' });
    expect(p.rotulo).toBe('2º semestre de 2026 (até 27/10)');
    expect(p.rotuloComparacao).toBe('jul–out/2025');
  });

  test('ano fechado e ano em andamento', () => {
    expect(resolverPeriodo({ tipo: 'ano', ano: 2025 }, HOJE)).toMatchObject({ fimEfetivo: '2025-12-31', parcial: false, rotulo: '2025', rotuloComparacao: '2024' });
    expect(resolverPeriodo({ tipo: 'ano', ano: 2026 }, HOJE)).toMatchObject({ fimEfetivo: '2026-10-27', parcial: true, rotuloComparacao: 'jan–out/2025' });
  });

  test('período que ainda não começou: futuro, sem meses, sem erro', () => {
    const p = resolverPeriodo({ tipo: 'ano', ano: 2027 }, HOJE);
    expect(p.futuro).toBe(true);
    expect(p.parcial).toBe(false);
    expect(p.meses).toEqual([]);
  });

  test('intervalo: dentro de um ano, com o ano tirado da data', () => {
    const p = resolverPeriodo({ tipo: 'intervalo', inicio: '2028-02-01', fim: '2028-02-29' }, '2028-12-01');
    expect(p).toMatchObject({ ano: 2028, inicio: '2028-02-01', fimEfetivo: '2028-02-29', parcial: false });
    expect(p.anterior).toEqual({ inicio: '2027-02-01', fim: '2027-02-28' });
    expect(p.rotulo).toBe('01/02 a 29/02/2028');
  });

  test.each([
    [{ tipo: 'intervalo' as const, inicio: '2025-12-01', fim: '2026-01-31' }, 'mesmo ano'],
    [{ tipo: 'intervalo' as const, inicio: '2026-05-01', fim: '2026-04-01' }, 'depois'],
    [{ tipo: 'intervalo' as const, inicio: '2026-02-31', fim: '2026-03-01' }, 'AAAA-MM-DD'],
    [{ tipo: 'intervalo' as const }, 'AAAA-MM-DD'],
    [{ tipo: 'ano' as const, ano: 1999 }, 'entre'],
    [{ tipo: 's1' as const, ano: null }, 'ano'],
  ])('inválido → ErroPeriodo (%j)', (p: Parameters<typeof resolverPeriodo>[0], trecho: string) => {
    expect(() => resolverPeriodo(p, HOJE)).toThrow(ErroPeriodo);
    expect(() => resolverPeriodo(p, HOJE)).toThrow(new RegExp(trecho));
  });
});

describe('números', () => {
  test('variacao: 1 casa, sinal e sem base', () => {
    expect(variacao(110_00, 100_00)).toBe(10);
    expect(variacao(90_00, 100_00)).toBe(-10);
    expect(variacao(100_00, 300_00)).toBe(-66.7);
    expect(variacao(100_00, 0)).toBeNull();
    expect(variacao(0, 0)).toBeNull();
  });

  test('valorCurto', () => {
    expect(valorCurto(136_303_368)).toBe('R$ 1,36 mi');
    expect(valorCurto(40_726_123)).toBe('R$ 407 mil');
    expect(valorCurto(95_050)).toBe('R$ 950,50');
  });

  test('escaparLike', () => {
    expect(escaparLike('3.3.90.33')).toBe('3.3.90.33');
    expect(escaparLike('a%b_c\\')).toBe('a\\%b\\_c\\\\');
  });
});

describe('agrupamentos', () => {
  test('agruparElementos junta variações pelo código e calcula % em centavos', () => {
    const r = agruparElementos([
      { elemento: '3.3.90.36 - Outros serviços PF', pago: 10_00 },
      { elemento: '3.3.90.36 – Outros serviços de terceiros PF', pago: 20_00 },
      { elemento: '3.3.90.33 - Transporte', pago: 70_00 },
      { elemento: '', pago: 0 },
    ]);
    expect(r).toEqual([
      { codigo: '3.3.90.33', desc: 'Transporte', pago: 70_00, pct: 70 },
      { codigo: '3.3.90.36', desc: 'Outros serviços de terceiros PF', pago: 30_00, pct: 30 },
    ]);
  });

  test('agruparElementos: sem código vira "Sem elemento"', () => {
    expect(agruparElementos([{ elemento: null, pago: 5_00 }])).toEqual([{ codigo: null, desc: 'Sem elemento', pago: 5_00, pct: 100 }]);
  });

  test('agruparMunicipios ignora caixa, espaços e a UF', () => {
    const r = agruparMunicipios([
      { municipio: 'Garanhuns', pago: 10_00 },
      { municipio: 'GARANHUNS ', pago: 5_00 },
      { municipio: 'Garanhuns/PE', pago: 1_00 },
      { municipio: 'São Bento do Una', pago: 30_00 },
      { municipio: null, pago: 2_00 },
      { municipio: '  ', pago: 3_00 },
    ]);
    expect(r).toEqual([
      { nome: 'São Bento do Una', pago: 30_00 },
      { nome: 'Garanhuns', pago: 16_00 },
      { nome: 'Sem município', pago: 5_00 },
    ]);
  });

  test('situacaoDaNe pelos 4 casos (pago acima do valor conta como paga)', () => {
    expect(situacaoDaNe(100_00, 0, 'EMITIDO')).toBe('A pagar');
    expect(situacaoDaNe(100_00, 40_00, 'PARCIALMENTE PAGO')).toBe('Parcial');
    expect(situacaoDaNe(100_00, 100_00, 'LIQUIDADO')).toBe('Paga');
    expect(situacaoDaNe(100_00, 120_00, 'PARCIALMENTE PAGO')).toBe('Paga');
    expect(situacaoDaNe(100_00, 0, 'CANCELADO')).toBe('Cancelada');
    // a posição é a do fim do período, não o status gravado hoje
    expect(situacaoDaNe(100_00, 0, 'LIQUIDADO')).toBe('A pagar');
  });
});

describe('ponte do orçamento', () => {
  test('fecha no centavo; cancelada entra inteira no cancelado', () => {
    const p = fecharPonte([
      { valor: 100_10, status: 'PARCIALMENTE PAGO', pago: 60_20, liquido: 55_10 },
      { valor: 50_00, status: 'CANCELADO', pago: 0, liquido: 0 },
      { valor: 30, status: 'EMITIDO', pago: 0, liquido: 0 },
    ]);
    expect(p).toEqual({ empenhado: 150_40, cancelado: 50_00, liquido: 55_10, retencoes: 5_10, saldo: 40_20 });
    expect(p.empenhado - p.cancelado - p.liquido - p.retencoes).toBe(p.saldo);
  });

  test('lista vazia → zeros', () => {
    expect(fecharPonte([])).toEqual({ empenhado: 0, cancelado: 0, liquido: 0, retencoes: 0, saldo: 0 });
  });

  test('valor que não é centavo inteiro → lança (bug de conversão)', () => {
    expect(() => fecharPonte([{ valor: 10.5, status: null, pago: 0, liquido: 0 }])).toThrow(/não fecha/);
  });

  test('avisos vêm dos dados, não derrubam a ponte', () => {
    expect(avisosDasNes([{ valor: 100_00, status: 'LIQUIDADO', pago: 110_00, liquido: 100_00 }])).toEqual([
      '1 NE(s) com pagamento acima do valor empenhado: o saldo dessas NEs fica negativo.',
    ]);
    expect(avisosDasNes([{ valor: 100_00, status: 'CANCELADO', pago: 1_00, liquido: 1_00 }])).toHaveLength(1);
    expect(avisosDasNes([{ valor: 100_00, status: 'EMITIDO', pago: 0, liquido: 0 }])).toEqual([]);
  });
});

describe('montarResumo', () => {
  const base: DadosResumo = {
    periodo: { ano: 2026, rotulo: '2026 (até 27/10)', rotuloComparacao: 'jan–out/2025', futuro: false },
    pago: 136_303_368, saldo: 40_726_123, empenhado: 194_802_900, restos: 8_475_578,
    qtdCredores: 27, qtdOps: 70, varPago: 8.5, pctTransporte: 30,
  };
  const texto = (r: DadosResumo) => montarResumo(r).map((t) => t.t).join('');

  test('a frase do protótipo, com os números em destaque', () => {
    expect(texto(base)).toBe(
      'Em 2026 (até 27/10) foram pagos R$ 1,36 mi a 27 credores, 8,5% a mais que em jan–out/2025. 30% foi para transporte (3.3.90.33). Das NEs empenhadas no período, restam R$ 407 mil a pagar. O total pago inclui R$ 85 mil de restos a pagar de anos anteriores.'
    );
    expect(montarResumo(base).filter((t) => t.forte).map((t) => t.t)).toEqual(['R$ 1,36 mi', '27 credores', 'R$ 407 mil']);
  });

  test('variação negativa, nula e sem base; sem restos e sem transporte', () => {
    const sem = { ...base, restos: 0, pctTransporte: 0 };
    expect(texto({ ...sem, varPago: -3.2 })).toContain(', 3,2% a menos que em jan–out/2025. Das NEs');
    expect(texto({ ...sem, varPago: 0 })).toContain(', o mesmo que em jan–out/2025.');
    expect(texto({ ...sem, varPago: null })).toContain(', sem base de comparação com jan–out/2025.');
    expect(texto(sem)).not.toMatch(/restos|transporte/);
    expect(texto({ ...sem, qtdCredores: 1 })).toContain('a 1 credor,');
  });

  test('período futuro e período sem movimento', () => {
    expect(texto({ ...base, periodo: { ...base.periodo, rotulo: '2027', futuro: true } })).toBe('O período 2027 ainda não começou.');
    expect(texto({ ...base, qtdOps: 0, empenhado: 0 })).toBe('Nenhuma NE ou OP em 2026 (até 27/10).');
  });
});
