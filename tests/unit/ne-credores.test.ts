import { describe, test, expect } from 'vitest';
import { montarCredoresDaNe, validarCredoresPayload } from '@/lib/services/notas-empenho.service';
import {
  diferencaBrutos,
  dividirIgualmente,
  mensagemSomaBrutos,
  montarPayloadCredores,
  somenteDigitos,
} from '@/lib/ne-credores';

describe('diferencaBrutos', () => {
  test('soma confere', () => {
    expect(diferencaBrutos(['6.000,00', 4000], '10.000,00')).toMatchObject({ diferencaCents: 0, texto: 'Soma confere' });
  });
  test('falta e sobra de 1 centavo', () => {
    expect(diferencaBrutos(['6.000,00', '3.999,99'], 10000).texto).toBe('Falta R$ 0,01');
    expect(diferencaBrutos(['6.000,00', '4.000,01'], 10000).texto).toBe('Sobra R$ 0,01');
  });
  test('campos vazios contam como zero', () => {
    expect(diferencaBrutos(['', undefined], '100,00').texto).toBe('Falta R$ 100,00');
  });
});

describe('dividirIgualmente', () => {
  test('100,00 em 3 -> último fica com o resto', () => {
    expect(dividirIgualmente(10000, 3)).toEqual([3333, 3333, 3334]);
  });
  test('divisão exata e zero partes', () => {
    expect(dividirIgualmente(10000, 4)).toEqual([2500, 2500, 2500, 2500]);
    expect(dividirIgualmente(10000, 0)).toEqual([]);
  });
});

describe('montarPayloadCredores', () => {
  const c = (over: object) => ({ cpfCnpj: '222.222.222-22', nome: 'José', valorBruto: '1.000,00', doCadastro: false, ...over });

  test('2+ credores -> formato novo, bruto em reais', () => {
    expect(montarPayloadCredores([c({}), c({ cpfCnpj: '1', nome: 'Ana', valorBruto: '0,50' })])).toEqual({
      credores: [
        { cpfCnpj: '222.222.222-22', valorBruto: 1000 },
        { cpfCnpj: '1', valorBruto: 0.5 },
      ],
      credorNome: 'José',
      cpfCnpj: '222.222.222-22',
    });
  });
  test('1 credor escolhido no cadastro -> formato novo', () => {
    expect(montarPayloadCredores([c({ doCadastro: true })]).credores).toHaveLength(1);
  });
  test('1 credor que veio da própria NE -> formato antigo (sem credores)', () => {
    expect(montarPayloadCredores([c({})])).toEqual({ credorNome: 'José', cpfCnpj: '222.222.222-22' });
  });
  test('nenhum credor', () => {
    expect(montarPayloadCredores([])).toEqual({ credorNome: null, cpfCnpj: null });
  });
});

describe('mensagemSomaBrutos', () => {
  test('soma exata -> null', () => {
    expect(mensagemSomaBrutos(1_000_000, 1_000_000)).toBeNull();
  });
  test('falta 1 centavo', () => {
    expect(mensagemSomaBrutos(999_999, 1_000_000)).toBe(
      'A soma dos valores brutos (R$ 9.999,99) difere do valor da NE (R$ 10.000,00). Falta R$ 0,01.'
    );
  });
  test('sobra', () => {
    expect(mensagemSomaBrutos(1_050_000, 1_000_000)).toContain('Sobra R$ 500,00.');
  });
});

describe('validarCredoresPayload', () => {
  test('ok: devolve brutos em centavos (aceita "6.000,00" e número)', () => {
    const r = validarCredoresPayload(
      [
        { cpfCnpj: '11.111.111/0001-11', valorBruto: '6.000,00' },
        { cpfCnpj: '22222222222', valorBruto: 4000 },
      ],
      1_000_000
    );
    expect('brutos' in r && r.brutos.map((b) => b.brutoCents)).toEqual([600_000, 400_000]);
  });
  test('CPF repetido em formatos diferentes -> 400', () => {
    const r = validarCredoresPayload(
      [
        { cpfCnpj: '222.222.222-22', valorBruto: 1 },
        { cpfCnpj: '22222222222', valorBruto: 1 },
      ],
      200
    );
    expect('erro' in r && r.erro.status).toBe(400);
  });
  test('bruto zero ou negativo -> 400', () => {
    const r = validarCredoresPayload([{ cpfCnpj: '1', valorBruto: '0' }], 0);
    expect('erro' in r && r.erro.status).toBe(400);
  });
  test('soma diferente -> 422', () => {
    const r = validarCredoresPayload([{ cpfCnpj: '1', valorBruto: 10 }], 2000);
    expect('erro' in r && r.erro.status).toBe(422);
  });
});

describe('montarCredoresDaNe', () => {
  test('usa as linhas de ne_credores, pago casado por dígitos', () => {
    const pago = new Map([[somenteDigitos('222.222.222-22'), 150_00]]);
    expect(
      montarCredoresDaNe(
        { valor: 1000 },
        [{ credor_cpf_cnpj: '222.222.222-22', credor_nome: 'José', valor_bruto: '1000.00' }],
        pago
      )
    ).toEqual([{ cpfCnpj: '222.222.222-22', nome: 'José', valorBruto: 1000, valorPago: 150, saldo: 850 }]);
  });
  test('sem linhas e com credor legado -> sintetizado com legado: true', () => {
    expect(montarCredoresDaNe({ valor: '500.00', cpfCnpj: '999', credorNome: 'Antigo' }, [], new Map())).toEqual([
      { cpfCnpj: '999', nome: 'Antigo', valorBruto: 500, valorPago: 0, saldo: 500, legado: true },
    ]);
  });
  test('sem linhas e sem credor -> []', () => {
    expect(montarCredoresDaNe({ valor: 500, cpfCnpj: null }, [], new Map())).toEqual([]);
  });
});
