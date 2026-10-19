import { describe, test, expect } from 'vitest';
import { somenteDigitos } from '@/lib/ne-credores';

// Os helpers de "vários credores na NE" (T15/T16) saíram na T30: a NE não tem
// mais credor. Fica só o utilitário usado pelo seletor de credor da OP.
describe('somenteDigitos', () => {
  test('tira máscara de CPF e CNPJ', () => {
    expect(somenteDigitos('222.222.222-22')).toBe('22222222222');
    expect(somenteDigitos('11.111.111/0001-11')).toBe('11111111000111');
  });
  test('vazio, null e undefined viram string vazia', () => {
    expect(somenteDigitos('')).toBe('');
    expect(somenteDigitos(null)).toBe('');
    expect(somenteDigitos(undefined)).toBe('');
  });
});
