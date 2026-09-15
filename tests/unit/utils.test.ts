import { describe, test, expect } from 'vitest';
import { maskCurrency, parseFormNumber, numeroPorExtenso } from '@/lib/utils';

describe('maskCurrency', () => {
  test('formata 1500 como "1.500,00"', () => {
    expect(maskCurrency(1500)).toBe('1.500,00');
  });

  test('formata 0 como "0,00"', () => {
    expect(maskCurrency(0)).toBe('0,00');
  });

  test('formata 1234567.89 como "1.234.567,89"', () => {
    expect(maskCurrency(1234567.89)).toBe('1.234.567,89');
  });

  test('converte string "1500.5" corretamente', () => {
    expect(maskCurrency('1500.5')).toBe('1.500,50');
  });
});

describe('parseFormNumber', () => {
  test('converte "1.500,00" para 1500', () => {
    expect(parseFormNumber('1.500,00')).toBe(1500);
  });

  test('converte string vazia para 0', () => {
    expect(parseFormNumber('')).toBe(0);
  });

  test('mantém números decimais corretos', () => {
    expect(parseFormNumber('1.234.567,89')).toBe(1234567.89);
  });
});

describe('numeroPorExtenso', () => {
  test('converte 1500 para "um mil e quinhentos reais"', () => {
    const resultado = numeroPorExtenso(1500).toLowerCase();
    expect(resultado).toContain('mil');
    expect(resultado).toContain('quinhentos');
  });

  test('converte 1 para "um real"', () => {
    expect(numeroPorExtenso(1).toLowerCase()).toBe('um real');
  });
});
