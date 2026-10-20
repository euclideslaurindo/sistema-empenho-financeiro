import { describe, test, expect } from 'vitest';
import { toCents, fromCents, calcPercentCents, arredondarMoeda, somarCents, formatarBRL, lerValorMonetario, itensBatemComValor, somaItensCents, totalItemCents } from '@/lib/money';
import { parseFormNumber } from '@/lib/utils';

describe('calcPercentCents', () => {
  test('665,00 a 1,5% = 9,98 (998 centavos)', () => {
    expect(calcPercentCents(66500, 1.5)).toBe(998);
  });

  test('665,00 a 5% = 33,25 (3325 centavos)', () => {
    expect(calcPercentCents(66500, 5)).toBe(3325);
  });

  test('665,00 a 11% = 73,15 (7315 centavos)', () => {
    expect(calcPercentCents(66500, 11)).toBe(7315);
  });

  test('665,00 a 20% = 133,00 (13300 centavos)', () => {
    expect(calcPercentCents(66500, 20)).toBe(13300);
  });

  test('665,00 a 2,5% = 16,63 (1663 centavos)', () => {
    expect(calcPercentCents(66500, 2.5)).toBe(1663);
  });

  test('11,00 a 1,5% = 0,17 (bug histórico: ponto flutuante dava 0,16)', () => {
    expect(calcPercentCents(1100, 1.5)).toBe(17);
  });

  test('0,00 a qualquer alíquota = 0', () => {
    expect(calcPercentCents(0, 1.5)).toBe(0);
    expect(calcPercentCents(0, 100)).toBe(0);
  });

  test('0,01 a 1,5% = 0,00 (arredonda para baixo)', () => {
    expect(calcPercentCents(1, 1.5)).toBe(0);
  });

  test('base de R$ 10 bilhões a 20% não sofre overflow (usa BigInt)', () => {
    const baseCents = toCents(10_000_000_000);
    expect(() => calcPercentCents(baseCents, 20)).not.toThrow();
    expect(calcPercentCents(baseCents, 20)).toBe(200_000_000_000);
  });

  test('lança RangeError para baseCents negativo', () => {
    expect(() => calcPercentCents(-1, 1.5)).toThrow(RangeError);
  });

  test('lança RangeError para alíquota negativa', () => {
    expect(() => calcPercentCents(100, -1)).toThrow(RangeError);
  });

  test('lança RangeError para alíquota acima de 100', () => {
    expect(() => calcPercentCents(100, 101)).toThrow(RangeError);
  });

  test('lança RangeError para baseCents não-inteiro (caller esqueceu toCents)', () => {
    expect(() => calcPercentCents(1000.5, 11)).toThrow(RangeError);
  });

  test('aceita alíquota como string ("1,5")', () => {
    expect(calcPercentCents(66500, '1,5')).toBe(998);
  });

  test('propriedade: resultado bate com uma implementação de referência independente', () => {
    // Reimplementação da fórmula a partir do zero, sem importar de lib/money.ts,
    // só para detectar qualquer regressão/off-by-one na função sob teste.
    function referencia(baseCents: number, aliquotaPercent: number): number {
      const aliquota4 = Math.round(aliquotaPercent * 10_000);
      const numerador = BigInt(baseCents) * BigInt(aliquota4) + 500_000n;
      return Number(numerador / 1_000_000n);
    }

    const aliquotas = [1.5, 2.5, 5, 11, 20];

    for (const aliquota of aliquotas) {
      for (let base = 1; base <= 2000; base++) {
        expect(calcPercentCents(base, aliquota)).toBe(referencia(base, aliquota));
      }
      for (let base = 2000; base <= 2_000_000; base += 977) {
        expect(calcPercentCents(base, aliquota)).toBe(referencia(base, aliquota));
      }
    }
  });
});

describe('arredondarMoeda', () => {
  test('1,005 -> 1,01 (3º decimal 5 sobe)', () => {
    expect(arredondarMoeda(1.005)).toBe(1.01);
  });

  test('2,675 -> 2,68 (3º decimal 5 sobe)', () => {
    expect(arredondarMoeda(2.675)).toBe(2.68);
  });

  test('9,9749 -> 9,97 (3º decimal 4 não sobe)', () => {
    expect(arredondarMoeda(9.9749)).toBe(9.97);
  });

  test('-9,975 -> -9,98 (sinal preservado)', () => {
    expect(arredondarMoeda(-9.975)).toBe(-9.98);
  });

  test('valor negativo que arredonda para zero retorna 0 positivo, nunca -0', () => {
    const resultado = arredondarMoeda(-0.004);
    expect(resultado).toBe(0);
    expect(Object.is(resultado, -0)).toBe(false);
  });

  test('33,333 -> 33,33 (caso do teste de calculos-op.test.ts)', () => {
    expect(arredondarMoeda(33.333)).toBe(33.33);
  });
});

describe('toCents', () => {
  test('"1.500,00" -> 150000', () => {
    expect(toCents('1.500,00')).toBe(150000);
  });

  test('"1500.00" -> 150000', () => {
    expect(toCents('1500.00')).toBe(150000);
  });

  test('1500 (number) -> 150000', () => {
    expect(toCents(1500)).toBe(150000);
  });

  test('33.333 -> 3333', () => {
    expect(toCents(33.333)).toBe(3333);
  });

  test('null/undefined/"" -> 0', () => {
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    expect(toCents('')).toBe(0);
  });

  test('valor negativo preserva o sinal', () => {
    expect(toCents(-15.5)).toBe(-1550);
  });

  test('valor negativo que arredonda para zero retorna 0 positivo, nunca -0', () => {
    const resultado = toCents(-0.004);
    expect(resultado).toBe(0);
    expect(Object.is(resultado, -0)).toBe(false);
  });
});

describe('fromCents', () => {
  test('998 -> 9,98', () => {
    expect(fromCents(998)).toBe(9.98);
  });

  test('150000 -> 1500', () => {
    expect(fromCents(150000)).toBe(1500);
  });
});

describe('somarCents', () => {
  test('soma vários valores em centavos', () => {
    expect(somarCents(100, 200, 300)).toBe(600);
  });

  test('sem argumentos retorna 0', () => {
    expect(somarCents()).toBe(0);
  });

  test('lança RangeError se algum valor for NaN (não mascara bug upstream)', () => {
    expect(() => somarCents(100, NaN, 200)).toThrow(RangeError);
  });

  test('lança RangeError se algum valor for Infinity', () => {
    expect(() => somarCents(100, Infinity)).toThrow(RangeError);
  });
});

describe('formatarBRL', () => {
  test('150000 -> "1.500,00"', () => {
    expect(formatarBRL(150000)).toBe('1.500,00');
  });

  test('-150000 -> "-1.500,00"', () => {
    expect(formatarBRL(-150000)).toBe('-1.500,00');
  });

  test('0 -> "0,00"', () => {
    expect(formatarBRL(0)).toBe('0,00');
  });

  test('998 -> "9,98"', () => {
    expect(formatarBRL(998)).toBe('9,98');
  });

  test('lança RangeError para NaN (nunca imprime "NaN,NaN" num recibo)', () => {
    expect(() => formatarBRL(NaN)).toThrow(RangeError);
  });

  test('lança RangeError para Infinity', () => {
    expect(() => formatarBRL(Infinity)).toThrow(RangeError);
  });
});

describe('lerValorMonetario', () => {
  test.each([
    ['100.00', 100], // como o MySQL devolve DECIMAL (era lido como 10000)
    ['1234.50', 1234.5],
    ['1234.5', 1234.5],
    ['100,00', 100],
    ['1.234,56', 1234.56],
    ['12.345.678,90', 12345678.9],
    ['1,5', 1.5],
    ['1.234', 1234], // só milhar
    ['1.234.567', 1234567],
    ['250', 250],
    ['R$ 1.234,56', 1234.56],
    [' 100,00 ', 100],
    [100, 100],
    [1234.5, 1234.5],
  ])('%s -> %s', (entrada: string | number, esperado: number) => {
    expect(lerValorMonetario(entrada)).toBe(esperado);
  });

  test.each(['', 'abc', '1.2.3', '1,2,3', '10.5.3,1', null, undefined, NaN, Infinity])('inválido: %s -> NaN', (entrada: unknown) => {
    expect(lerValorMonetario(entrada)).toBeNaN();
  });

  test('o caso que o parseFormNumber erra (milhar sem vírgula) sai certo aqui', () => {
    expect(parseFormNumber('1.234')).toBe(1.234);
    expect(lerValorMonetario('1.234')).toBe(1234);
  });
});

describe('itens em centavos (mesma conta na tela e no servidor)', () => {
  test('10,10 + 20,20 bate com 30,30 (em ponto flutuante dava 30,2999…)', () => {
    const soma = somaItensCents([{ quantidade: 1, valorUnitario: '10,10' }, { quantidade: 1, valorUnitario: '20,20' }]);
    expect(soma).toBe(3030);
    expect(itensBatemComValor(soma, toCents('30,30'))).toBe(true);
    expect(0.1 + 0.2 === 0.3).toBe(false); // o motivo da correção
  });
  test('cada item arredondado no item; quantidade fracionada', () => {
    expect(totalItemCents(2.5, '12,34')).toBe(3085); // 30,85
    expect(totalItemCents(3, 33.33)).toBe(9999);
    expect(totalItemCents('abc', '10,00')).toBe(0);
    expect(somaItensCents(undefined)).toBe(0);
  });
  test('tolerância de 1 centavo, nem mais nem menos', () => {
    expect(itensBatemComValor(3030, 3031)).toBe(true);
    expect(itensBatemComValor(3030, 3032)).toBe(false);
  });
});
