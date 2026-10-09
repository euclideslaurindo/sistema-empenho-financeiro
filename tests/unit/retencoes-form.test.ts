import { describe, test, expect } from 'vitest';
import {
  estadoCampo,
  informadosEmCentavos,
  mascararValorDigitado,
  rotuloCampo,
  somarDescontosCents,
} from '@/lib/retencoes-form';
import type { ConfigRetencaoCampoMapeado } from '@/lib/services/config-retencoes.service';

const irrf: ConfigRetencaoCampoMapeado = {
  campo: 'irrf', rotulo: 'IRRF', tipo: 'PERCENTUAL', aliquota: 1.5,
  calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem: 10,
};
const taxa: ConfigRetencaoCampoMapeado = {
  campo: 'taxa_bancaria', rotulo: 'Taxa bancária', tipo: 'VALOR_DIGITADO', aliquota: null,
  calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem: 70,
};
const regras = { '3.3.90.36': ['irrf'], '3.3.90.14': [] as string[] };

describe('mascararValorDigitado', () => {
  test('digitar 0 produz 0,00 (zero explícito)', () => {
    expect(mascararValorDigitado('0', false)).toBe('0,00');
  });
  test('apagar a partir de zero limpa o campo', () => {
    expect(mascararValorDigitado('0,0', true)).toBe('');
  });
  test('valor comum usa a máscara padrão', () => {
    expect(mascararValorDigitado('850', false)).toBe('8,50');
    expect(mascararValorDigitado('0,005', false)).toBe('0,05');
  });
  test('vazio continua vazio', () => {
    expect(mascararValorDigitado('', false)).toBe('');
  });
});

describe('estadoCampo', () => {
  test('automático aplicável: GESTOR não edita, ADMIN edita', () => {
    expect(estadoCampo(irrf, '3.3.90.36', regras, 'GESTOR').editavel).toBe(false);
    expect(estadoCampo(irrf, '3.3.90.36', regras, 'ADMIN').editavel).toBe(true);
  });
  test('não se aplica ao elemento: bloqueado até para ADMIN, com dica', () => {
    expect(estadoCampo(irrf, '3.3.90.14', regras, 'ADMIN')).toEqual({
      editavel: false, obrigatorio: false, dica: 'Não se aplica a 3.3.90.14',
    });
  });
  test('não automático aplicável: qualquer perfil edita e é obrigatório', () => {
    const issDigitado = { ...irrf, tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false };
    expect(estadoCampo(issDigitado, '3.3.90.36', regras, 'GESTOR')).toMatchObject({ editavel: true, obrigatorio: true });
  });
  test('elemento desconhecido: só edita quem tem permissão', () => {
    expect(estadoCampo(irrf, null, regras, 'GESTOR').editavel).toBe(false);
    expect(estadoCampo(irrf, '9.9.99.99', regras, 'ADMIN').editavel).toBe(true);
  });
  test('desconto segue editavelOperador, independente do elemento', () => {
    expect(estadoCampo(taxa, '3.3.90.14', regras, 'GESTOR').editavel).toBe(true);
  });
});

describe('rotuloCampo / somas', () => {
  test('rótulo com alíquota em pt-BR', () => {
    expect(rotuloCampo(irrf)).toBe('IRRF (1,5%)');
    expect(rotuloCampo(taxa)).toBe('Taxa bancária');
  });
  test('informadosEmCentavos só inclui campos da lista', () => {
    expect(informadosEmCentavos({ irrf: '10,00', taxaBancaria: '8,50' }, ['taxa_bancaria'])).toEqual({ taxa_bancaria: 850 });
  });
  test('somarDescontosCents soma os 8 campos mascarados', () => {
    expect(somarDescontosCents({ irrf: '9,98', iss: '33,25', taxaBancaria: '8,50', taxaPix: '' })).toBe(5173);
  });
});
