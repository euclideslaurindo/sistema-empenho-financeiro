import { describe, test, expect } from 'vitest';
import {
  completarMunicipio,
  montarEnderecoFinal,
  normalizarCidade,
  normalizarUf,
  rotuloMunicipio,
  validarMunicipio,
} from '@/lib/credor-endereco';

describe('normalização do município', () => {
  test('cidade: trim e espaços repetidos, mantendo a caixa digitada', () => {
    expect(normalizarCidade('  São   Bento do  Una ')).toBe('São Bento do Una');
    expect(normalizarCidade('   ')).toBeNull();
    expect(normalizarCidade(undefined)).toBeNull();
  });
  test('UF em maiúsculas', () => {
    expect(normalizarUf(' pe ')).toBe('PE');
    expect(normalizarUf('')).toBeNull();
  });
});

describe('validarMunicipio', () => {
  test('aceita vazio (não é obrigatório) e valores válidos', () => {
    expect(validarMunicipio(null, null)).toBeNull();
    expect(validarMunicipio('Garanhuns', 'PE')).toBeNull();
  });
  test('cidade com mais de 100 caracteres', () => {
    expect(validarMunicipio('a'.repeat(101), null)).toContain('100');
  });
  test('UF diferente de 2 letras', () => {
    expect(validarMunicipio(null, 'PER')).toContain('UF inválida');
    expect(validarMunicipio(null, 'P1')).toContain('UF inválida');
  });
});

describe('montarEnderecoFinal', () => {
  test('edição: recompõe com a cidade nova mesmo recebendo o endereço antigo', () => {
    expect(
      montarEnderecoFinal({
        endereco: 'Rua A, Nº 10, Centro, Recife, PE',
        logradouro: 'Rua A',
        numero: '10',
        bairro: 'Centro',
        cidade: 'Garanhuns',
        uf: 'pe',
      })
    ).toBe('Rua A, Nº 10, Centro, Garanhuns, PE');
  });
  test('credor antigo só com endereço livre não perde a rua ao preencher só a cidade', () => {
    expect(montarEnderecoFinal({ endereco: 'Sítio Boa Vista, zona rural', cidade: 'Garanhuns', uf: 'PE' })).toBe(
      'Sítio Boa Vista, zona rural'
    );
  });
  test('sem rua nem texto: usa cidade/UF; sem nada: null', () => {
    expect(montarEnderecoFinal({ cidade: 'Garanhuns', uf: 'PE' })).toBe('Garanhuns, PE');
    expect(montarEnderecoFinal({})).toBeNull();
  });
});

describe('completarMunicipio (CNPJ/CEP)', () => {
  test('não sobrescreve o que o usuário digitou', () => {
    expect(completarMunicipio({ cidade: 'Garanhuns', uf: 'PE' }, { cidade: 'Recife', uf: 'PE' })).toEqual({
      cidade: 'Garanhuns',
      uf: 'PE',
    });
  });
  test('preenche quando vazio', () => {
    expect(completarMunicipio({ cidade: '', uf: undefined }, { cidade: 'Recife', uf: 'PE' })).toEqual({
      cidade: 'Recife',
      uf: 'PE',
    });
  });
  test('API sem município mantém o que havia', () => {
    expect(completarMunicipio({ cidade: '' }, { cidade: null })).toEqual({ cidade: '', uf: undefined });
  });
});

test('rotuloMunicipio', () => {
  expect(rotuloMunicipio('Garanhuns', 'PE')).toBe('Garanhuns/PE');
  expect(rotuloMunicipio('Garanhuns', null)).toBe('Garanhuns');
  expect(rotuloMunicipio(null, null)).toBe('');
});
