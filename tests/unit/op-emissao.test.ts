import { describe, test, expect } from 'vitest';
import {
  credorNaLista,
  itensValorizados,
  linhaDoCredor,
  linhaDoErroServidor,
  liquidoLinhaCents,
  montarPayloadLote,
  numeroPrevistoDaLinha,
  numerosQueMudaram,
  resumoItens,
  temErros,
  totaisEmissao,
  validarEmissao,
  type CredorLinha,
} from '@/lib/op-emissao';
import type { ConfigRetencoes } from '@/hooks/use-retencoes-config';

// T35-B: regras puras da lista de credores da OP.

const linha = (over: Partial<CredorLinha> = {}): CredorLinha => ({
  ...linhaDoCredor({ cpfCnpj: '111.111.111-11', nome: 'Ana' }, 'Obs da NE', 'NE-1'),
  ...over,
});

const CONFIG: ConfigRetencoes = {
  campos: [
    { campo: 'irrf', rotulo: 'IRRF', tipo: 'PERCENTUAL', aliquota: 1.5, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem: 10 },
    { campo: 'iss', rotulo: 'ISS', tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem: 20 },
  ],
  regras: { '3.3.90.36': ['irrf'], '3.3.90.39': ['irrf', 'iss'] },
  versao: 'x',
};

describe('linhaDoCredor', () => {
  test('vem do cadastro, com 1 item das Observações da NE e sem valor', () => {
    const l = linhaDoCredor(
      { cpf_cnpj: '222.222.222-22', nome: 'Bruno', is_mei: 1, municipioExpediente: 'Canhotinho', rg: '9', endereco: 'Rua B', pix: 'x@y' },
      '  ',
      'NE-7'
    );
    expect(l).toMatchObject({ cpfCnpj: '222.222.222-22', nomeCredor: 'Bruno', credorMei: true, municipioExpediente: 'Canhotinho', rg: '9', pix: 'x@y', valorPagamento: '' });
    expect(l.itens).toEqual([{ especificacao: 'Pagamento referente ao empenho NE-7', quantidade: 1, unidade: 'UN', valorUnitario: '' }]);
    expect(l.chave).toBeTruthy();
    expect(linhaDoCredor({ cpfCnpj: '1' }, 'Obs', 'NE').chave).not.toBe(l.chave);
  });

  test('credorNaLista compara só os dígitos', () => {
    expect(credorNaLista([linha()], '11111111111')).toBe(true);
    expect(credorNaLista([linha()], '999')).toBe(false);
    expect(credorNaLista([linha()], '')).toBe(false);
  });
});

describe('itens', () => {
  const itens = [
    { especificacao: 'Locomoção', quantidade: 1, unidade: 'UN', valorUnitario: '50,00' },
    { especificacao: 'Alimentação', quantidade: 2, unidade: 'UN', valorUnitario: '35,00' },
    { especificacao: 'Vazio', quantidade: 1, unidade: 'UN', valorUnitario: '' },
  ];
  test('item zerado é descartado; resumo com quantidade e total', () => {
    expect(itensValorizados(itens)).toHaveLength(2);
    expect(resumoItens(itens)).toBe('2 itens · R$ 120,00');
    expect(resumoItens([itens[0]])).toBe('1 item · R$ 50,00');
    expect(resumoItens([itens[2]])).toBe('Sem itens — usa as Observações da NE');
    expect(resumoItens(undefined)).toBe('Sem itens — usa as Observações da NE');
  });
});

describe('totaisEmissao e líquido', () => {
  test('em centavos: 0,10 + 0,20 cabem num restante de 0,30', () => {
    const t = totaisEmissao([{ valorPagamento: '0,10' }, { valorPagamento: '0,20' }], 30);
    expect(t).toEqual({ somaCents: 30, restanteCents: 0, excedeCents: 0 });
  });
  test('excesso quando passa do saldo', () => {
    expect(totaisEmissao([{ valorPagamento: '60,00' }, { valorPagamento: '50,00' }], 10000)).toEqual({ somaCents: 11000, restanteCents: -1000, excedeCents: 1000 });
  });
  test('líquido da linha desconta retenções (patronal no .33 não entra)', () => {
    expect(liquidoLinhaCents(linha({ valorPagamento: '100,00', irrf: '1,50', taxaBancaria: '2,00' }), '3.3.90.36 - X')).toBe(9650);
    expect(liquidoLinhaCents(linha({ valorPagamento: '100,00', patronal: '20,00' }), '3.3.90.33 - Transporte')).toBe(10000);
  });
});

describe('validarEmissao', () => {
  const base = { neCarregada: 'NE-1', dataEmissao: '2026-10-19', elemento: '3.3.90.36 - X' };
  const ctx = { perfil: 'GESTOR' as const, config: CONFIG, saldoRestanteCents: 100000 };

  test('emissão válida não tem erros', () => {
    const e = validarEmissao({ ...base, credores: [linha({ valorPagamento: '10,00' })] }, ctx);
    expect(temErros(e)).toBe(false);
  });

  test('gerais: sem NE, sem data, sem credores', () => {
    const e = validarEmissao({ credores: [] }, ctx);
    expect(e.gerais).toEqual(['Carregue a Nota de Empenho.', 'Informe a data de emissão da OP.', 'Adicione ao menos um credor.']);
  });

  test('valor zerado aponta a linha', () => {
    const e = validarEmissao({ ...base, credores: [linha({ valorPagamento: '10,00' }), linha({ valorPagamento: '' })] }, ctx);
    expect(e.linhas).toEqual({ 1: { valorPagamento: 'Informe o valor a pagar.' } });
  });

  test('cheque repetido marca as DUAS linhas (ignorando espaços)', () => {
    const e = validarEmissao(
      { ...base, credores: [linha({ valorPagamento: '1,00', numeroCheque: '77' }), linha({ valorPagamento: '1,00' }), linha({ valorPagamento: '1,00', numeroCheque: ' 77 ' })] },
      ctx
    );
    expect(Object.keys(e.linhas)).toEqual(['0', '2']);
    expect(e.linhas[2].numeroCheque).toBe('O cheque nº "77" está repetido nesta emissão.');
  });

  test('itens com valor diferente do valor a pagar; itens zerados não contam; 1 centavo de tolerância', () => {
    const itens = [{ especificacao: 'A', quantidade: 1, unidade: 'UN', valorUnitario: '9,00' }];
    expect(validarEmissao({ ...base, credores: [linha({ valorPagamento: '10,00', itens })] }, ctx).linhas[0].itens).toContain('R$ 9,00');
    expect(temErros(validarEmissao({ ...base, credores: [linha({ valorPagamento: '10,00' })] }, ctx))).toBe(false); // item padrão sem valor
    const quase = [{ especificacao: 'A', quantidade: 1, unidade: 'UN', valorUnitario: '9,99' }];
    expect(temErros(validarEmissao({ ...base, credores: [linha({ valorPagamento: '10,00', itens: quase })] }, ctx))).toBe(false);
  });

  test('retenção obrigatória (tributo sem cálculo automático no elemento) não informada', () => {
    const e = validarEmissao({ ...base, elemento: '3.3.90.39 - Y', credores: [linha({ valorPagamento: '10,00' })] }, ctx);
    expect(e.linhas[0].retencoes).toBe('Informe o valor de: ISS.');
    const ok = validarEmissao(
      { ...base, elemento: '3.3.90.39 - Y', credores: [linha({ valorPagamento: '10,00', iss: '0,50', camposInformados: ['iss'] })] },
      ctx
    );
    expect(ok.linhas[0]).toBeUndefined();
  });

  test('descontos maiores que o bruto', () => {
    const e = validarEmissao({ ...base, credores: [linha({ valorPagamento: '10,00', taxaBancaria: '11,00' })] }, ctx);
    expect(e.linhas[0].retencoes).toBe('Total de descontos maior que o valor a pagar.');
  });

  test('soma passa do saldo: erro geral com o excesso', () => {
    const e = validarEmissao({ ...base, credores: [linha({ valorPagamento: '600,00' }), linha({ valorPagamento: '500,00' })] }, ctx);
    expect(e.gerais).toEqual(['A soma passa do saldo da NE em R$ 100,00.']);
    // sem saldo conhecido, não acusa (o servidor confere)
    expect(validarEmissao({ ...base, credores: [linha({ valorPagamento: '600,00' })] }, { ...ctx, saldoRestanteCents: null }).gerais).toEqual([]);
  });
});

describe('montarPayloadLote', () => {
  test('ordem da lista, só os informados, itens valorizados, MEI só com sobrescrita', () => {
    const p = montarPayloadLote({
      neCarregada: 'NE-1',
      dataEmissao: '2026-10-19',
      credores: [
        linha({
          valorPagamento: '1.234,56', numeroCheque: ' 100 ', dataPagamento: '2026-10-20',
          irrf: '18,52', iss: '61,73', camposInformados: ['iss'],
          itens: [
            { especificacao: ' Locomoção ', quantidade: 1, unidade: 'UN', valorUnitario: '1.234,56' },
            { especificacao: 'Vazio', quantidade: 1, unidade: 'UN', valorUnitario: '' },
          ],
        }),
        linha({ cpfCnpj: '222', valorPagamento: '10,00', credorMei: true, sobrescreverMei: true }),
        linha({ cpfCnpj: '333', valorPagamento: '5,00', credorMei: false, sobrescreverMei: true }),
      ],
    });
    expect(p.numeroNe).toBe('NE-1');
    expect(p.credores[0]).toEqual({
      credorCpfCnpj: '111.111.111-11',
      valorPagamento: 1234.56,
      numeroCheque: '100',
      dataPagamento: '2026-10-20',
      itens: [{ especificacao: 'Locomoção', unidade: 'UN', quantidade: 1, valorUnitario: 1234.56 }],
      iss: 61.73,
    });
    expect(p.credores[0]).not.toHaveProperty('irrf'); // calculado: o servidor decide
    expect(p.credores[1]).toMatchObject({ credorCpfCnpj: '222', numeroCheque: null, dataPagamento: null, itens: [], sobrescreverMei: true });
    expect(p.credores[2]).not.toHaveProperty('sobrescreverMei');
  });
});

describe('erros do servidor e números previstos', () => {
  test('linhaDoErroServidor', () => {
    expect(linhaDoErroServidor('credores[3]: credor não encontrado ou inativo.')).toEqual({ indice: 3, mensagem: 'credor não encontrado ou inativo.' });
    expect(linhaDoErroServidor('Soma das OPs (R$ 90,00) maior que o saldo da NE (R$ 80,00).')).toBeNull();
    expect(linhaDoErroServidor(undefined)).toBeNull();
  });

  const numeros = [
    { numeroOp: '2026.OP.0012', sub: '01', rotulo: 'NE X/01' },
    { numeroOp: '2026.OP.0013', sub: '02', rotulo: 'NE X/02' },
    { numeroOp: '2026.OP.0014', sub: '03', rotulo: 'NE X/03' },
  ];

  test('número pela POSIÇÃO: ao remover a linha 2, a antiga 3ª passa a ser a 2ª', () => {
    const linhas = ['a', 'b', 'c'];
    const depois = linhas.filter((l) => l !== 'b');
    expect(depois.map((_, i) => numeroPrevistoDaLinha(numeros, i)?.sub)).toEqual(['01', '02']);
    expect(numeroPrevistoDaLinha(null, 0)).toBeNull();
    expect(numeroPrevistoDaLinha(numeros, 5)).toBeNull();
  });

  test('numerosQueMudaram', () => {
    expect(numerosQueMudaram(numeros, [{ numeroOp: '2026.OP.0012', sub: '01' }, { numeroOp: '2026.OP.0015', sub: '02' }])).toEqual([
      { indice: 1, previsto: numeros[1], gravado: { numeroOp: '2026.OP.0015', sub: '02' } },
    ]);
    expect(numerosQueMudaram(null, [{ numeroOp: 'x', sub: '01' }])).toEqual([]);
  });
});
