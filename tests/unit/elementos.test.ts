import { describe, test, expect } from 'vitest';
import { extrairCodigoElemento, codigoDoElementoPai, montarValorElemento } from '@/lib/elementos';

const CODIGOS_SEMEADOS = [
  '3.3.90.14',
  '3.3.90.30',
  '3.3.90.33',
  '3.3.90.36',
  '3.3.90.39',
  '3.3.90.47',
  '3.3.90.32',
  '3.3.90.35',
  '3.3.90.40',
  '4.4.90.51',
  '4.4.90.52',
];

describe('extrairCodigoElemento', () => {
  test.each(CODIGOS_SEMEADOS)('extrai "%s" de "%s - Descrição qualquer"', (codigo: string) => {
    expect(extrairCodigoElemento(`${codigo} - Descrição qualquer`)).toBe(codigo);
  });

  test('extrai código de subelemento com 5 segmentos: "3.3.90.14.01 - Diárias..."', () => {
    expect(extrairCodigoElemento('3.3.90.14.01 - Diárias Pessoal Civil Dentro do Estado')).toBe('3.3.90.14.01');
  });

  test('extrai "3.3.90.39" de "3.3.90.39 - Outros Serviços de Terceiros - Pessoa Jurídica" (texto real gravado em NE)', () => {
    expect(extrairCodigoElemento('3.3.90.39 - Outros Serviços de Terceiros - Pessoa Jurídica')).toBe('3.3.90.39');
  });

  test('string vazia retorna null', () => {
    expect(extrairCodigoElemento('')).toBeNull();
  });

  test('null retorna null', () => {
    expect(extrairCodigoElemento(null)).toBeNull();
  });

  test('undefined retorna null', () => {
    expect(extrairCodigoElemento(undefined)).toBeNull();
  });

  test('texto sem código no início retorna null', () => {
    expect(extrairCodigoElemento('Outros Serviços sem código')).toBeNull();
  });

  test('tolera espaço em branco no início', () => {
    expect(extrairCodigoElemento('  3.3.90.36 - Outros Serviços de Terceiros - Pessoa Física')).toBe('3.3.90.36');
  });
});

describe('codigoDoElementoPai', () => {
  test('"3.3.90.14.01" -> "3.3.90.14"', () => {
    expect(codigoDoElementoPai('3.3.90.14.01')).toBe('3.3.90.14');
  });

  test('"3.3.90.14.03" -> "3.3.90.14"', () => {
    expect(codigoDoElementoPai('3.3.90.14.03')).toBe('3.3.90.14');
  });

  test('código sem ponto retorna o próprio valor', () => {
    expect(codigoDoElementoPai('semponto')).toBe('semponto');
  });
});

describe('montarValorElemento', () => {
  test('monta "<codigo> - <descricao>"', () => {
    expect(montarValorElemento({ codigo: '3.3.90.14', descricao: 'Diárias - Civil' })).toBe('3.3.90.14 - Diárias - Civil');
  });

  test('bate exatamente com o texto gravado em NEs antigas (3.3.90.39)', () => {
    expect(
      montarValorElemento({ codigo: '3.3.90.39', descricao: 'Outros Serviços de Terceiros - Pessoa Jurídica' })
    ).toBe('3.3.90.39 - Outros Serviços de Terceiros - Pessoa Jurídica');
  });
});
