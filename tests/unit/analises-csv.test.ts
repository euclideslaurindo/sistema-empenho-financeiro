// B5 — CSV comum e a planilha das Análises (puro).
import { describe, test, expect } from 'vitest';
import { BOM, arquivoCsv, linhaCsv, textoCsv, valorCsv } from '@/lib/csv';
import { SECOES_CSV_ANALISES, montarCsvAnalises, nomeArquivoCsvAnalises } from '@/lib/analises-csv';
import { elementosDoRelatorio, linhasDaPonte, retidoPorTipo } from '@/components/analises/relatorio/montar-relatorio';
import { respostaExemplo } from '@/tests/fixtures/analises-resposta';

describe('lib/csv', () => {
  test('BOM, valor com vírgula e sinal', () => {
    expect(BOM.charCodeAt(0)).toBe(0xfeff);
    expect(BOM).toHaveLength(1);
    expect(valorCsv(123456)).toBe('1234,56');
    expect(valorCsv(5)).toBe('0,05');
    expect(valorCsv(-5000)).toBe('-50,00');
  });

  test('textoCsv neutraliza fórmula e protege ; " e quebras', () => {
    expect(textoCsv('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(textoCsv('+1')).toBe("'+1");
    expect(textoCsv('a;b')).toBe('"a;b"');
    expect(textoCsv(null)).toBe('');
  });

  test('arquivo: BOM no início, CRLF entre as linhas e no fim', () => {
    expect(arquivoCsv([linhaCsv(['a', 'b']), 'c'])).toBe(`${BOM}a;b\r\nc\r\n`);
  });
});

describe('montarCsvAnalises', () => {
  const linhas = (csv: string) => csv.slice(1).split('\r\n');

  test('as 12 seções, na ordem, separadas por linha vazia', () => {
    const l = linhas(montarCsvAnalises(respostaExemplo()));
    const titulos = l.filter((x, i) => i === 0 || l[i - 1] === '');
    expect(titulos).toEqual([...SECOES_CSV_ANALISES]);
    expect(montarCsvAnalises(respostaExemplo()).startsWith(BOM)).toBe(true);
  });

  test('cartões e ponte com vírgula decimal; variação vazia sem base de comparação', () => {
    const l = linhas(montarCsvAnalises(respostaExemplo()));
    expect(l).toContain('Empenhado;2000,20;100');
    expect(l).toContain('Saldo a pagar;799,90;');
    expect(l).toContain('Retido dos credores;142,60;-3,2');
    expect(l).toContain('(-) Retenções e descontos;100,20');
  });

  test('TOTAL dos meses e dos elementos somado em centavos', () => {
    const r = respostaExemplo();
    r.meses[0].pago = 0.57;
    r.meses[2].pago = 4.35;
    r.meses[3].pago = 0;
    r.meses[1].pago = 0;
    r.meses[4].pago = 0;
    const l = linhas(montarCsvAnalises(r));
    expect(l.find((x) => x.startsWith('TOTAL;') && x.split(';').length === 4)).toBe('TOTAL;2000,20;4,92;12');
    expect(l).toContain('TOTAL;;307181,33;100');
  });

  test('nome de credor que parece fórmula sai protegido', () => {
    const r = respostaExemplo();
    r.credores[0].nome = '=CMD|calc';
    expect(montarCsvAnalises(r)).toContain("1;'=CMD|calc;200000,00");
  });

  test('período vazio: sem NaN, sem undefined', () => {
    const r = respostaExemplo();
    const csv = montarCsvAnalises({ ...r, meses: [], elementos: [], credores: [], municipios: [], darf: [], avisos: [] });
    expect(csv).not.toMatch(/NaN|undefined|Infinity/);
  });

  test('nome do arquivo: só letras, dígitos e hífen', () => {
    const r = respostaExemplo();
    expect(nomeArquivoCsvAnalises(r)).toBe('analises-2026-civil.csv');
    expect(nomeArquivoCsvAnalises({ ...r, base: 'exercicio', periodo: { ...r.periodo, tipo: 's1' } })).toBe('analises-1o-semestre-2026-exercicio.csv');
    expect(nomeArquivoCsvAnalises({ ...r, elemento: '3.3.90.33', periodo: { ...r.periodo, tipo: 'intervalo', inicio: '2026-03-01', fim: '2026-03-31' } })).toBe(
      'analises-2026-03-01-a-2026-03-31-civil-el-339033.csv'
    );
  });
});

describe('montar-relatorio', () => {
  test('elementos: 9 viram 5 + "Outros", com o mesmo total em centavos', () => {
    const els = Array.from({ length: 9 }, (_, i) => ({ codigo: `3.3.90.${10 + i}`, desc: `E${i}`, pago: [0.57, 4.35, 1.15, 0.29, 10.07, 1.01, 2.2, 3.3, 0.1][i], pct: 11.1 }));
    const r = elementosDoRelatorio(els);
    expect(r).toHaveLength(6);
    expect(r[5].nome).toBe('Outros (4 elementos)');
    const somaC = (l: Array<{ pago: number }>) => l.reduce((t, x) => t + Math.round(x.pago * 100), 0);
    expect(somaC(r)).toBe(somaC(els));
  });

  test('até 6 elementos ficam como estão', () => {
    expect(elementosDoRelatorio(respostaExemplo().elementos)).toHaveLength(2);
  });

  test('retido por tipo: o total é o do cartão "Retido"; a Patronal fica à parte', () => {
    const r = respostaExemplo();
    const x = retidoPorTipo(r.meses);
    expect(x.total).toBe(r.kpis.retido);
    expect(x.patronal).toBe(200);
    expect(x.tipos.map((t) => t.nome)).toEqual(['INSS', 'ISS', 'IRRF', 'SEST/SENAT']);
  });

  test('ponte: % sobre o empenhado; empenhado zero → 0%', () => {
    const l = linhasDaPonte(respostaExemplo().ponte);
    expect(l.map((x) => x.pct)).toEqual([100, 15, 40, 5, 40]);
    expect(linhasDaPonte({ empenhado: 0, cancelado: 0, liquido: 0, retencoes: 0, saldo: 0 }).every((x) => x.pct === 0)).toBe(true);
  });
});
