import { describe, test, expect } from 'vitest';
import { statusPeloSaldo } from '@/lib/status-ne';

describe('statusPeloSaldo', () => {
  test('sem gasto -> EMITIDO', () => {
    expect(statusPeloSaldo(10000, 0)).toBe('EMITIDO');
  });
  test('gasto parcial -> PARCIALMENTE PAGO', () => {
    expect(statusPeloSaldo(10000, 9000)).toBe('PARCIALMENTE PAGO');
    expect(statusPeloSaldo(10000, 9999)).toBe('PARCIALMENTE PAGO');
  });
  test('gasto igual ou acima do valor -> LIQUIDADO', () => {
    expect(statusPeloSaldo(10000, 10000)).toBe('LIQUIDADO');
    expect(statusPeloSaldo(10000, 10001)).toBe('LIQUIDADO');
  });
  test('CANCELADO nunca é desfeito', () => {
    expect(statusPeloSaldo(10000, 0, 'CANCELADO')).toBe('CANCELADO');
    expect(statusPeloSaldo(10000, 5000, 'CANCELADO')).toBe('CANCELADO');
  });
  test('o status atual (fora CANCELADO) não influencia', () => {
    expect(statusPeloSaldo(10000, 3000, 'EMITIDO')).toBe('PARCIALMENTE PAGO');
    expect(statusPeloSaldo(10000, 0, 'LIQUIDADO')).toBe('EMITIDO');
  });
});
