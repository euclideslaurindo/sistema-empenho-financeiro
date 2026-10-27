// B4 — regras puras da tela: URLs, intervalo, recorte do mês e montagem dos gráficos.
import { describe, test, expect } from 'vitest';
import { respostaExemplo } from '@/tests/fixtures/analises-resposta';
import { FILTROS_INICIAIS, montarUrlAnalises, montarUrlOps, recorteDoMes, validarIntervalo } from './url';
import {
  montarCredores,
  montarDarf,
  montarElementos,
  montarExecucao,
  montarMunicipios,
  montarNes,
  montarPagamentos,
  montarPonte,
  montarRetencoes,
} from './montar';

describe('url', () => {
  test('ao abrir: período ano, base civil, sem ano (o servidor escolhe)', () => {
    expect(montarUrlAnalises(FILTROS_INICIAIS)).toBe('/api/analises?periodo=ano&base=civil');
  });

  test('ano, base e elemento entram; campo vazio não', () => {
    expect(montarUrlAnalises({ ...FILTROS_INICIAIS, periodo: 's1', ano: 2025, base: 'exercicio', elemento: '3.3.90.33' })).toBe(
      '/api/analises?periodo=s1&ano=2025&base=exercicio&elemento=3.3.90.33'
    );
  });

  test('intervalo: só com as duas datas válidas; o ano não vai junto', () => {
    const f = { ...FILTROS_INICIAIS, periodo: 'intervalo' as const, ano: 2026 };
    expect(montarUrlAnalises({ ...f, inicio: '2026-03-01', fim: '' })).toBeNull();
    expect(montarUrlAnalises({ ...f, inicio: '2026-05-01', fim: '2026-04-01' })).toBeNull();
    expect(montarUrlAnalises({ ...f, inicio: '2026-03-01', fim: '2026-03-31' })).toBe('/api/analises?periodo=intervalo&inicio=2026-03-01&fim=2026-03-31&base=civil');
  });

  test.each([
    ['2026-02-30', '2026-03-01', 'Informe as datas'],
    ['', '2026-03-01', 'Informe as datas'],
    ['2025-12-01', '2026-01-31', 'mesmo ano'],
    ['2026-05-01', '2026-04-01', 'depois'],
  ])('validarIntervalo(%s, %s) → "%s"', (inicio: string, fim: string, trecho: string) => {
    expect(validarIntervalo(inicio, fim)).toContain(trecho);
  });

  test('recorte do mês: inteiro, cortado no início do intervalo e no fim efetivo', () => {
    const p = { inicio: '2026-01-01', fimEfetivo: '2026-10-27' };
    expect(recorteDoMes('2026-04', p)).toEqual({ inicio: '2026-04-01', fim: '2026-04-30' });
    expect(recorteDoMes('2026-02', p)).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' });
    expect(recorteDoMes('2026-10', p)).toEqual({ inicio: '2026-10-01', fim: '2026-10-27' });
    expect(recorteDoMes('2026-03', { inicio: '2026-03-15', fimEfetivo: '2026-12-31' })).toEqual({ inicio: '2026-03-15', fim: '2026-03-31' });
    expect(recorteDoMes('2028-02', { inicio: '2028-01-01', fimEfetivo: '2028-12-31' }).fim).toBe('2028-02-29');
  });

  test('url do detalhe', () => {
    expect(montarUrlOps({ inicio: '2026-04-01', fim: '2026-04-30', base: 'civil', ano: 2026 })).toBe('/api/analises/ops?inicio=2026-04-01&fim=2026-04-30&base=civil&ano=2026');
    expect(montarUrlOps({ inicio: '2026-04-01', fim: '2026-04-30', base: 'exercicio', ano: 2026, elemento: '3.3.90.33' })).toContain('&elemento=3.3.90.33');
  });
});

describe('títulos que dizem o resultado', () => {
  const r = respostaExemplo();

  test('os 9 títulos', () => {
    expect(montarPonte(r).titulo).toBe('Das NEs do período, 53% já foi pago e R$ 799,90 falta pagar');
    expect(montarExecucao(r).titulo).toBe('Abril teve o maior pagamento: R$ 306 mil');
    expect(montarElementos(r).titulo).toBe('Transporte ficou com 60% do que foi pago');
    expect(montarPagamentos(r).titulo).toBe('12 OPs no período, com média de R$ 26 mil por OP');
    expect(montarCredores(r).titulo).toBe('Os 2 maiores receberam 100% do total pago');
    expect(montarRetencoes(r).titulo).toBe('R$ 142,60 retidos dos credores no período');
    expect(montarDarf(r).titulo).toBe('R$ 50,00 de DARF ainda a recolher');
    expect(montarNes(r).titulo).toBe('2 de 4 NEs ainda têm saldo a pagar');
    expect(montarMunicipios(r).titulo).toBe('Garanhuns recebeu 81% do transporte');
  });

  test('DARF toda paga e período sem movimento', () => {
    const paga = { ...r, darf: r.darf.map((d) => ({ ...d, pendente: 0 })) };
    expect(montarDarf(paga).titulo).toBe('Todas as DARFs do período estão pagas');

    const vazio = {
      ...r,
      meses: r.meses.map((m) => ({ ...m, empenhado: 0, pago: 0, ops: 0, irrf: 0, iss: 0, inss: 0, sest: 0, patronal: 0 })),
      elementos: [], credores: [], municipios: [], qtdOps: 0, qtdNes: 0,
      darf: r.darf.map((d) => ({ ...d, paga: 0, pendente: 0 })),
      ponte: { empenhado: 0, cancelado: 0, liquido: 0, retencoes: 0, saldo: 0 },
      kpis: { ...r.kpis, pago: 0, retido: 0 },
    };
    for (const m of [montarPonte, montarExecucao, montarElementos, montarPagamentos, montarCredores, montarRetencoes, montarDarf, montarNes, montarMunicipios]) {
      const x = m(vazio as any);
      expect(x.vazio, m.name).toBe(true);
      expect(x.titulo, m.name).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
});

describe('tabelas (os valores cheios, os mesmos do gráfico)', () => {
  const r = respostaExemplo();

  test('execução: uma linha por mês, valores cheios', () => {
    const t = montarExecucao(r).tabela;
    expect(t.colunas).toEqual(['Mês', 'Empenhado', 'Pago']);
    expect(t.linhas).toHaveLength(10);
    expect(t.linhas[3]).toEqual(['Abril', 'R$ 0,00', 'R$ 306.181,03']);
  });

  test('ponte: as 5 etapas com sinais', () => {
    expect(montarPonte(r).tabela.linhas.map((l) => l[0])).toEqual(['Empenhado', '(−) Cancelado', '(−) Líquido pago ao credor', '(−) Retenções e descontos', '(=) Saldo a pagar']);
    expect(montarPonte(r).props.etapas.map((e) => e.tipo)).toEqual(['total', 'menos', 'menos', 'menos', 'saldo']);
  });

  test('retenções: 5 séries na ordem fixa, patronal hachurada', () => {
    const m = montarRetencoes(r);
    expect(m.props.series.map((s) => s.chave)).toEqual(['inss', 'iss', 'irrf', 'sest', 'patronal']);
    expect(m.props.series[4].fundo).toContain('repeating-linear-gradient');
    expect(m.tabela.linhas[1]).toEqual(['Fevereiro', 'R$ 110,00', 'R$ 20,00', 'R$ 10,00', 'R$ 2,50', 'R$ 200,00']);
  });

  test('DARF: legenda com status (ícone + texto)', () => {
    expect(montarDarf(r).legenda.map((l) => l.status)).toEqual(['paga', 'pendente']);
  });

  test('pagamentos: o destaque é o mês de maior pagamento; a faixa tem as OPs na mesma ordem', () => {
    const p = montarPagamentos(r).props;
    expect(p.destaque).toBe('2026-04');
    expect(p.ops.map((o) => o.chave)).toEqual(p.itens.map((i) => i.chave));
  });
});
