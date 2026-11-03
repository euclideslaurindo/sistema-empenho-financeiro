// B7b — regras puras: período "Mês", agrupamento por tipo, URL da tela e montagem do cartão.
import { describe, test, expect } from 'vitest';
import { ErroPeriodo, agruparTipos, resolverPeriodo } from '@/lib/analises';
import { toCents } from '@/lib/money';
import { FILTROS_INICIAIS, ajustarTipo, filtrosDaUrl, mesPadrao, montarUrlAnalises, montarUrlOps } from '@/components/analises/tela/url';
import { montarExecucao, montarTipos } from '@/components/analises/tela/montar';
import { nomeArquivoCsvAnalises } from '@/lib/analises-csv';
import { respostaExemplo } from '@/tests/fixtures/analises-resposta';

const sp = (qs: string) => new URLSearchParams(qs);

describe('resolverPeriodo — mês', () => {
  test('fevereiro de ano bissexto: 29 dias, comparado com 28/02 do ano anterior', () => {
    const p = resolverPeriodo({ tipo: 'mes', ano: 2028, mes: 2 }, '2028-12-31');
    expect(p).toMatchObject({ inicio: '2028-02-01', fim: '2028-02-29', fimEfetivo: '2028-02-29', parcial: false, mes: 2, meses: ['2028-02'] });
    expect(p.anterior).toEqual({ inicio: '2027-02-01', fim: '2027-02-28' });
    expect(p.rotulo).toBe('Fevereiro de 2028');
    expect(p.rotuloComparacao).toBe('fev/2027');
  });

  test('mês atual cortado em hoje; mês futuro sai vazio', () => {
    const atual = resolverPeriodo({ tipo: 'mes', ano: 2026, mes: 10 }, '2026-10-27');
    expect(atual).toMatchObject({ fimEfetivo: '2026-10-27', parcial: true, rotulo: 'Outubro de 2026 (até 27/10)', rotuloComparacao: '01/10 a 27/10/2025' });
    expect(atual.anterior).toEqual({ inicio: '2025-10-01', fim: '2025-10-27' });
    const futuro = resolverPeriodo({ tipo: 'mes', ano: 2026, mes: 11 }, '2026-10-27');
    expect(futuro.futuro).toBe(true);
    expect(futuro.meses).toEqual([]);
  });

  test('dezembro termina em 31; sem mês, mês 0 ou 13 → ErroPeriodo', () => {
    expect(resolverPeriodo({ tipo: 'mes', ano: 2025, mes: 12 }, '2026-10-27').fim).toBe('2025-12-31');
    for (const mes of [undefined, null, 0, 13, 1.5]) {
      expect(() => resolverPeriodo({ tipo: 'mes', ano: 2026, mes }, '2026-10-27')).toThrow(ErroPeriodo);
    }
  });

  test('os outros períodos não ganham "mes"', () => {
    expect(resolverPeriodo({ tipo: 'ano', ano: 2026, mes: 3 }, '2026-10-27')).not.toHaveProperty('mes');
  });
});

describe('agruparTipos', () => {
  const ne = (subelemento: string | null, valor: number, prestadores: number, status = 'EMITIDO', elemento = '3.3.90.36 - PF') => ({
    elemento, subelemento, valor: toCents(valor), status, prestadores,
  });

  test('o mesmo código com textos diferentes vira uma linha; a descrição mais longa fica', () => {
    const r = agruparTipos(
      [ne('3.3.90.14.03 - Bolsas', 10, 1, 'EMITIDO', '3.3.90.14 - Diárias'), ne('3.3.90.14.03 - Bolsas de Capacitação', 20, 2, 'EMITIDO', '3.3.90.14 - Diárias')],
      []
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ codigo: '3.3.90.14.03', desc: 'Bolsas de Capacitação', empenhado: 3000, qtdNes: 2, prestadores: 3 });
  });

  test('subelemento com código de outro elemento conta como "sem subelemento" do elemento da NE', () => {
    const r = agruparTipos([ne('3.3.90.14.03 - Bolsas', 10, 1)], []);
    expect(r[0]).toMatchObject({ codigo: null, elementoCodigo: '3.3.90.36', desc: '3.3.90.36 (sem subelemento)' });
  });

  test('NE cancelada fora; prestador negativo/quebrado não soma; centavos exatos', () => {
    const r = agruparTipos(
      [ne('3.3.90.36.08 - Est', 0.57, 2), ne('3.3.90.36.08 - Est', 4.35, -1), ne('3.3.90.36.08 - Est', 9, 9, 'CANCELADO')],
      [{ elemento: '3.3.90.36 - PF', subelemento: '3.3.90.36.08 - Est', pago: toCents(0.1) }, { elemento: '3.3.90.36 - PF', subelemento: '3.3.90.36.08 - Est', pago: toCents(0.2) }]
    );
    expect(r).toEqual([
      { codigo: '3.3.90.36.08', elementoCodigo: '3.3.90.36', desc: 'Est', empenhado: 492, pago: 30, qtdNes: 2, prestadores: 2, pct: 100 },
    ]);
  });

  test('só cancelada e sem pagamento: o tipo não aparece; ordem por pago e depois empenhado', () => {
    expect(agruparTipos([ne('3.3.90.36.08 - Est', 9, 9, 'CANCELADO')], [])).toEqual([]);
    const r = agruparTipos(
      [ne('3.3.90.36.01 - A', 50, 1), ne('3.3.90.36.02 - B', 80, 1)],
      [{ elemento: '3.3.90.36', subelemento: '3.3.90.36.03 - C', pago: 100 }]
    );
    expect(r.map((x) => x.codigo)).toEqual(['3.3.90.36.03', '3.3.90.36.02', '3.3.90.36.01']);
  });
});

describe('URL da tela', () => {
  test('mês e tipo vão e voltam pelo endereço; o tipo fixa o elemento', () => {
    const f = filtrosDaUrl(sp('periodo=mes&ano=2026&mes=10&subelemento=3.3.90.36.08'));
    expect(f).toMatchObject({ periodo: 'mes', ano: 2026, mes: 10, elemento: '3.3.90.36', subelemento: '3.3.90.36.08' });
    expect(montarUrlAnalises(f)).toBe('/api/analises?periodo=mes&ano=2026&mes=10&base=civil&elemento=3.3.90.36&subelemento=3.3.90.36.08');
  });

  test('mês inválido cai no ano; tipo inválido é ignorado; mês sem número não pede', () => {
    expect(filtrosDaUrl(sp('periodo=mes&ano=2026&mes=13'))).toMatchObject({ periodo: 'ano', mes: null });
    expect(filtrosDaUrl(sp('periodo=mes&ano=2026'))).toMatchObject({ periodo: 'ano', mes: null });
    expect(filtrosDaUrl(sp('subelemento=3.3.90.36'))).toMatchObject({ subelemento: '', elemento: '' });
    expect(filtrosDaUrl(sp("subelemento=3.3.90.36.08'"))).toMatchObject({ subelemento: '' });
    expect(montarUrlAnalises({ ...FILTROS_INICIAIS, periodo: 'mes', ano: 2026, mes: null })).toBeNull();
  });

  test('ajustarTipo: escolher tipo fixa o elemento; trocar o elemento tira o tipo de outro; o do mesmo fica', () => {
    const atual = { ...FILTROS_INICIAIS, elemento: '3.3.90.36', subelemento: '3.3.90.36.08' };
    expect(ajustarTipo(FILTROS_INICIAIS, { subelemento: '3.3.90.14.03' })).toEqual({ subelemento: '3.3.90.14.03', elemento: '3.3.90.14' });
    expect(ajustarTipo(atual, { elemento: '3.3.90.39' })).toEqual({ elemento: '3.3.90.39', subelemento: '' });
    expect(ajustarTipo(atual, { elemento: '' })).toEqual({ elemento: '', subelemento: '' });
    expect(ajustarTipo(atual, { elemento: '3.3.90.36' })).toEqual({ elemento: '3.3.90.36' });
    expect(ajustarTipo(atual, { subelemento: '' })).toEqual({ subelemento: '' });
    expect(ajustarTipo(atual, { base: 'exercicio' })).toEqual({ base: 'exercicio' });
  });

  test('mesPadrao: o mês atual no ano corrente, dezembro nos anteriores', () => {
    const hoje = new Date(2026, 9, 27);
    expect(mesPadrao(2026, hoje)).toBe(10);
    expect(mesPadrao(2025, hoje)).toBe(12);
  });

  test('o painel de OPs leva o tipo', () => {
    expect(montarUrlOps({ inicio: '2026-02-01', fim: '2026-02-28', base: 'civil', ano: 2026, elemento: '3.3.90.36', subelemento: '3.3.90.36.08' })).toBe(
      '/api/analises/ops?inicio=2026-02-01&fim=2026-02-28&base=civil&ano=2026&elemento=3.3.90.36&subelemento=3.3.90.36.08'
    );
  });
});

describe('cartão "Por tipo de despesa" e faixa de NEs', () => {
  test('título, barras com NEs e prestadores, tabela com TOTAL em centavos', () => {
    const m = montarTipos(respostaExemplo());
    expect(m.titulo).toBe('3.3.90.33 (sem subelemento) teve o maior pagamento: R$ 184 mil');
    expect(m.props.itens.map((i) => i.chave)).toEqual(['sem-3.3.90.33', '3.3.90.36.08']);
    expect(m.props.itens[1].sub).toBe('Estagiários - Pagamento Direto · 1 NE · 3 prestadores · empenhado R$ 1.500,00');
    expect(m.tabela.colunas).toEqual(['Tipo de despesa', 'Empenhado', 'Pago', 'NEs', 'Prestadores']);
    expect(m.tabela.linhas.at(-1)).toEqual(['TOTAL', 'R$ 1.700,20', 'R$ 307.181,33', '3', '5']);
  });

  test('sem pagamento mas com NE: título com as NEs; vazio sem tipos', () => {
    const r = respostaExemplo();
    r.tipos = [{ codigo: '3.3.90.36.08', elementoCodigo: '3.3.90.36', desc: 'Est', empenhado: 10, pago: 0, qtdNes: 2, prestadores: 1, pct: 0 }];
    expect(montarTipos(r).titulo).toBe('2 NEs empenhadas, sem pagamentos no período');
    r.tipos = [];
    expect(montarTipos(r)).toMatchObject({ vazio: true, titulo: 'Sem NEs ou pagamentos no período' });
  });

  test('a faixa de NEs acompanha os meses da execução', () => {
    expect(montarExecucao(respostaExemplo()).props.nes.map((x) => x.valor)).toEqual([0, 1, 1, 0, 1, 0, 0, 0, 1, 0]);
  });

  test('nome do CSV: mês e tipo', () => {
    const r = respostaExemplo();
    const mes = { ...r.periodo, tipo: 'mes' as const, inicio: '2026-02-01', fim: '2026-02-28' };
    expect(nomeArquivoCsvAnalises({ ...r, periodo: mes })).toBe('analises-2026-02-civil.csv');
    expect(nomeArquivoCsvAnalises({ ...r, periodo: mes, elemento: '3.3.90.36', subelemento: '3.3.90.36.08' })).toBe('analises-2026-02-civil-tipo-33903608.csv');
  });
});
