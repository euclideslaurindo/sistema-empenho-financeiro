// B3 — escala e formato dos gráficos (puro).
import { describe, test, expect } from 'vitest';
import { ESPACO_TOPO, gradeDoEixo, pct, teto } from './escala';
import { brl, curto, pct1 } from './formato';

describe('teto', () => {
  test.each([
    [0, 1],
    [-50, 1],
    [Number.NaN, 1],
    [7, 10],
    [1234, 2000],
    [2000, 2000],
    [2400, 2500],
    [306181.03, 500000],
    [0.3, 0.5],
  ])('%s → %s', (max: number, esperado: number) => {
    expect(teto(max)).toBeCloseTo(esperado, 10);
  });

  test('o teto nunca fica abaixo do máximo', () => {
    for (const v of [1, 9.99, 10.01, 99, 101, 249, 251, 499, 501, 999, 1001, 123456.78]) expect(teto(v)).toBeGreaterThanOrEqual(v);
  });
});

describe('pct', () => {
  test('proporcional, com 2 casas', () => {
    expect(pct(250, 1000)).toBe(25);
    expect(pct(1, 3)).toBe(33.33);
  });
  test('acima do teto → 100; negativo → 0; teto zero ou inválido sem NaN', () => {
    expect(pct(1500, 1000)).toBe(100);
    expect(pct(-50, 1000)).toBe(0);
    expect(pct(10, 0)).toBe(0);
    expect(pct(Number.NaN, 10)).toBe(0);
  });
});

test('gradeDoEixo: metade e teto', () => {
  expect(gradeDoEixo(500000)).toEqual([
    { pos: 50, valor: 250000 },
    { pos: 100, valor: 500000 },
  ]);
});

test('ESPACO_TOPO deixa 12% livres para o rótulo', () => {
  expect(ESPACO_TOPO).toBe(0.88);
});

describe('formato', () => {
  test('brl e curto, com sinal no negativo', () => {
    expect(brl(306181.03)).toBe('R$ 306.181,03');
    expect(brl(-50)).toBe('−R$ 50,00');
    expect(curto(306181.03)).toBe('R$ 306 mil');
    expect(curto(1362033.68)).toBe('R$ 1,36 mi');
    expect(curto(-50)).toBe('−R$ 50,00');
    expect(curto(0)).toBe('R$ 0,00');
  });
  test('pct1', () => {
    expect(pct1(8.5)).toBe('8,5%');
    expect(pct1(60)).toBe('60%');
  });
});
