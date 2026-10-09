import { describe, test, expect } from 'vitest';
import {
  diffFaixas,
  diffMunicipio,
  diffParametros,
  numero,
  validarFaixasIrrf,
  validarMunicipio,
  validarParametrosTransporte,
  vigenciaEditavel,
} from '@/lib/transporte-admin';

const PARAMETROS = {
  base_percentual: '20',
  inss_percentual: '11',
  patronal_percentual: '20',
  sest_percentual: '1,5',
  senat_percentual: '1',
  irrf_tributavel_percentual: '60',
  desconto_simplificado: '607,20',
  redutor_constante: '978,62',
  redutor_coeficiente: '0.133145',
};
const FAIXAS = [
  { limiteAte: '2428,80', aliquota: '0', parcelaDeduzir: '0' },
  { limiteAte: '2826,65', aliquota: '7,5', parcelaDeduzir: '182,16' },
  { limiteAte: '3751,05', aliquota: '15', parcelaDeduzir: '394,16' },
  { limiteAte: '4664,68', aliquota: '22,5', parcelaDeduzir: '675,49' },
  { limiteAte: null, aliquota: '27,5', parcelaDeduzir: '908,73' },
];

describe('numero', () => {
  test('aceita vírgula, ponto e milhar no formato BR', () => {
    expect(numero('15,5')).toBe(15.5);
    expect(numero('15.5')).toBe(15.5);
    expect(numero('2.428,80')).toBe(2428.8);
    expect(numero('0.133145')).toBe(0.133145);
    expect(numero(7)).toBe(7);
    expect(numero('')).toBeNaN();
    expect(numero(null)).toBeNaN();
    expect(numero('abc')).toBeNaN();
  });
});

describe('vigenciaEditavel', () => {
  test('hoje ou depois pode; passada não', () => {
    expect(vigenciaEditavel('2026-10-09', '2026-10-09')).toBe(true);
    expect(vigenciaEditavel('2027-01-01', '2026-10-09')).toBe(true);
    expect(vigenciaEditavel('2026-01-01', '2026-10-09')).toBe(false);
  });
});

describe('validarParametrosTransporte', () => {
  test('parâmetros da planilha são válidos', () => {
    expect(validarParametrosTransporte(PARAMETROS)).toEqual([]);
  });
  test('percentual acima de 100, negativo e vazio', () => {
    const erros = validarParametrosTransporte({ ...PARAMETROS, inss_percentual: '101', redutor_constante: '-1', senat_percentual: '' });
    expect(erros).toEqual([
      'INSS (% da base): não pode passar de 100%.',
      'SENAT (% da base): informe um número.',
      'Redutor — constante (R$): não pode ser negativo.',
    ]);
  });
  test('valor em R$ pode passar de 100', () => {
    expect(validarParametrosTransporte({ ...PARAMETROS, redutor_constante: '1500' })).toEqual([]);
  });
});

describe('validarFaixasIrrf', () => {
  test('tabela de 2026 é válida', () => {
    expect(validarFaixasIrrf(FAIXAS)).toEqual([]);
  });
  test('sem faixas', () => {
    expect(validarFaixasIrrf([])).toEqual(['Informe ao menos uma faixa.']);
  });
  test('limites fora de ordem', () => {
    const faixas = FAIXAS.map((f, i) => (i === 2 ? { ...f, limiteAte: '2000' } : f));
    expect(validarFaixasIrrf(faixas)).toContain('Faixa 3: o limite deve ser maior que o da faixa 2.');
  });
  test('limite repetido', () => {
    const faixas = FAIXAS.map((f, i) => (i === 1 ? { ...f, limiteAte: '2428,80' } : f));
    expect(validarFaixasIrrf(faixas)).toContain('Faixa 2: o limite deve ser maior que o da faixa 1.');
  });
  test('última faixa com limite', () => {
    const faixas = FAIXAS.map((f, i) => (i === 4 ? { ...f, limiteAte: '9999' } : f));
    expect(validarFaixasIrrf(faixas)).toEqual(['Faixa 5: a última faixa deve ficar sem limite ("acima de").']);
  });
  test('duas faixas sem limite', () => {
    const faixas = FAIXAS.map((f, i) => (i === 3 ? { ...f, limiteAte: '' } : f));
    expect(validarFaixasIrrf(faixas)).toContain('Faixa 4: só a última faixa pode ficar sem limite.');
  });
  test('alíquota acima de 100 e parcela negativa', () => {
    const faixas = FAIXAS.map((f, i) => (i === 1 ? { ...f, aliquota: '101', parcelaDeduzir: '-5' } : f));
    expect(validarFaixasIrrf(faixas)).toEqual([
      'Faixa 2: alíquota deve estar entre 0 e 100.',
      'Faixa 2: parcela a deduzir inválida.',
    ]);
  });
});

describe('validarMunicipio', () => {
  test('válido e inválido', () => {
    expect(validarMunicipio({ nome: 'Canhotinho', uf: 'pe', aliquota: '5', taxaExpediente: '15,20' })).toEqual([]);
    expect(validarMunicipio({ nome: ' ', uf: 'PER', aliquota: '120', taxaExpediente: '-1' })).toEqual([
      'Informe o nome do município.',
      'UF deve ter 2 letras.',
      'Alíquota do ISS deve estar entre 0 e 100.',
      'Taxa de expediente inválida.',
    ]);
  });
});

describe('diffs para a confirmação', () => {
  test('parâmetros: só o que mudou, sem zeros sobrando', () => {
    expect(diffParametros({ ...PARAMETROS, inss_percentual: '11.000000' }, PARAMETROS)).toEqual([]);
    expect(diffParametros(PARAMETROS, { ...PARAMETROS, sest_percentual: '2' })).toEqual(['SEST (% da base): 1,5 → 2']);
  });
  test('faixas: alíquota, limite, inclusão e remoção', () => {
    const depois = FAIXAS.map((f, i) => (i === 2 ? { ...f, aliquota: '16' } : f));
    expect(diffFaixas(FAIXAS, depois)).toEqual(['Faixa 3: 15% → 16%']);
    const comLimite = FAIXAS.map((f, i) => (i === 0 ? { ...f, limiteAte: '2500' } : f));
    expect(diffFaixas(FAIXAS, comLimite)).toEqual(['Faixa 1: limite 2428,8 → 2500']);
    expect(diffFaixas(FAIXAS, FAIXAS.slice(0, 4))).toContain('Faixa 5 removida');
    expect(diffFaixas(FAIXAS.slice(0, 4), FAIXAS)).toEqual(['Faixa 5 incluída: até — · 27,5% · deduz 908,73']);
  });
  test('município: Canhotinho 15,20 → 16,00 e desativação', () => {
    const antes = { nome: 'Canhotinho', uf: 'PE', aliquota: '5', taxaExpediente: '15.20', apelidos: null, ativo: true };
    expect(diffMunicipio(antes, { ...antes, taxaExpediente: '16,00' })).toEqual(['Canhotinho: taxa de expediente 15,2 → 16']);
    expect(diffMunicipio(antes, { ...antes, ativo: false })).toEqual(['Canhotinho: desativado']);
    expect(diffMunicipio(null, { ...antes, nome: 'Jupi', uf: 'pe' })).toEqual(['Novo município: Jupi/PE · ISS 5% · expediente 15,2']);
  });
});
