// A2 (Pessoas físicas no IR) — regras puras: ano, CPF, natureza, totais e CSV.
import { describe, test, expect } from 'vitest';
import {
  cpfDoTexto,
  lerAno,
  montarCsvIr,
  naturezasDosElementos,
  ordenarPessoas,
  pessoaDaLinha,
  totaisDoAno,
  type LinhaIr,
  type PessoaFisicaIr,
} from '@/lib/ir-pessoas-fisicas';

const linha = (o: Partial<LinhaIr> = {}): LinhaIr => ({
  cpf: '12345678909',
  nomeCadastro: 'Maria da Silva',
  nomeOp: 'MARIA SILVA',
  qtdOps: 2,
  bruto: '1500.00',
  irrf: '10.50',
  inss: '165.00',
  iss: '75.00',
  liquido: '1249.50',
  elementos: '3.3.90.36 - Outros serviços PF',
  ...o,
});

const pessoa = (o: Partial<LinhaIr> = {}, informado: PessoaFisicaIr['informado'] = null) => pessoaDaLinha(linha(o), informado);

describe('lerAno', () => {
  test('ano de 4 dígitos entre 2000 e 2100', () => {
    expect(lerAno('2026')).toBe(2026);
    expect(lerAno(' 2026 ')).toBe(2026);
    expect(lerAno(2026)).toBe(2026);
    expect(lerAno('2000')).toBe(2000);
    expect(lerAno('2100')).toBe(2100);
  });

  test.each(['', 'abc', '1999', '2101', '2026.5', '26', '02026', null, undefined, 2026.5])('%s → null', (v: unknown) => {
    expect(lerAno(v)).toBeNull();
  });
});

describe('cpfDoTexto', () => {
  test('com ou sem máscara → só os 11 dígitos', () => {
    expect(cpfDoTexto('123.456.789-09')).toBe('12345678909');
    expect(cpfDoTexto('12345678909')).toBe('12345678909');
  });

  test('CNPJ (14 dígitos), 10 dígitos e vazio → null', () => {
    expect(cpfDoTexto('12.345.678/0001-90')).toBeNull();
    expect(cpfDoTexto('1234567890')).toBeNull();
    expect(cpfDoTexto('')).toBeNull();
    expect(cpfDoTexto(null)).toBeNull();
  });
});

describe('naturezasDosElementos', () => {
  test('separa código e descrição, tira repetidos e ordena por código', () => {
    expect(
      naturezasDosElementos('3.3.90.36 - Outros serviços PF||3.3.90.33 - Transporte||3.3.90.36 - Outros serviços PF')
    ).toEqual([
      { codigo: '3.3.90.33', descricao: 'Transporte' },
      { codigo: '3.3.90.36', descricao: 'Outros serviços PF' },
    ]);
  });

  test('ordem numérica do código (3.3.90.4 antes de 3.3.90.36)', () => {
    expect(naturezasDosElementos('3.3.90.36 - B||3.3.90.4 - A').map((n) => n.codigo)).toEqual(['3.3.90.4', '3.3.90.36']);
  });

  test('null, vazio e partes em branco → nada', () => {
    expect(naturezasDosElementos(null)).toEqual([]);
    expect(naturezasDosElementos('')).toEqual([]);
    expect(naturezasDosElementos('||  ||')).toEqual([]);
  });

  test('texto sem código fica com codigo null, por último', () => {
    expect(naturezasDosElementos('Serviço avulso||3.3.90.36 - Outros')).toEqual([
      { codigo: '3.3.90.36', descricao: 'Outros' },
      { codigo: null, descricao: 'Serviço avulso' },
    ]);
  });
});

describe('pessoaDaLinha', () => {
  test('valores do banco (texto DECIMAL) viram reais; CPF formatado', () => {
    const p = pessoa();
    expect(p).toMatchObject({
      cpf: '12345678909',
      cpfFormatado: '123.456.789-09',
      nome: 'Maria da Silva',
      qtdOps: 2,
      bruto: 1500,
      irrf: 10.5,
      inss: 165,
      iss: 75,
      liquido: 1249.5,
      informado: null,
    });
  });

  test('sem cadastro, usa o nome da OP; NULL nas retenções vira 0', () => {
    const p = pessoa({ nomeCadastro: null, irrf: null, iss: null });
    expect(p.nome).toBe('MARIA SILVA');
    expect(p.irrf).toBe(0);
    expect(p.iss).toBe(0);
  });

  test('CPF com máscara vindo do banco é normalizado', () => {
    expect(pessoa({ cpf: '123.456.789-09' }).cpf).toBe('12345678909');
  });
});

describe('ordenarPessoas', () => {
  test('ordem por nome com acento (Álvaro antes de Bruno)', () => {
    const lista = ordenarPessoas([pessoa({ nomeCadastro: 'Bruno' }), pessoa({ nomeCadastro: 'Álvaro' }), pessoa({ nomeCadastro: 'carla' })]);
    expect(lista.map((p) => p.nome)).toEqual(['Álvaro', 'Bruno', 'carla']);
  });
});

describe('totaisDoAno', () => {
  test('soma em centavos: 0,10 + 0,20 = 0,30 exato', () => {
    const t = totaisDoAno([pessoa({ irrf: '0.10' }), pessoa({ irrf: '0.20' })]);
    expect(t.irrf).toBe(0.3);
    expect(t.bruto).toBe(3000);
    expect(t.qtdOps).toBe(4);
  });

  test('soma em centavos mesmo onde o ponto flutuante erra (0,57 × 100 = 56,999…; 4,35 × 100 = 434,999…)', () => {
    const pessoas = [pessoa({ irrf: '0.57' }), pessoa({ irrf: '4.35' })];
    expect(totaisDoAno(pessoas).irrf).toBe(4.92);
    const total = montarCsvIr(2026, pessoas).split('\r\n').filter(Boolean).at(-1)!;
    expect(total.split(';')[6]).toBe('4,92');
  });

  test('conta informadas e pendentes', () => {
    const t = totaisDoAno([pessoa({}, { em: '2026-10-26 10:00', porNome: 'Ana', observacao: null }), pessoa(), pessoa()]);
    expect(t).toMatchObject({ pessoas: 3, informadas: 1, pendentes: 2 });
  });

  test('lista vazia → zeros', () => {
    expect(totaisDoAno([])).toEqual({ pessoas: 0, informadas: 0, pendentes: 0, qtdOps: 0, bruto: 0, irrf: 0, inss: 0, iss: 0, liquido: 0 });
  });
});

describe('montarCsvIr', () => {
  const linhasDo = (csv: string) => csv.slice(1).split('\r\n').filter(Boolean);

  test('começa com o BOM, usa ";" e CRLF entre as linhas', () => {
    const csv = montarCsvIr(2026, [pessoa()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.slice(1).replace(/\r\n/g, '')).not.toMatch(/\n/);
    const [cab] = linhasDo(csv);
    expect(cab.split(';')).toEqual([
      'Ano', 'CPF', 'Nome', 'Natureza do rendimento', 'Qtd. OPs', 'Rendimento bruto (R$)', 'IRRF retido (R$)',
      'INSS retido (R$)', 'ISS retido (R$)', 'Líquido pago (R$)', 'Informado', 'Informado em', 'Observação',
    ]);
  });

  test('decimal com vírgula, sem ponto de milhar', () => {
    const [, l] = linhasDo(montarCsvIr(2026, [pessoa({ bruto: '1234567.80', irrf: '0.05' })]));
    const campos = l.split(';');
    expect(campos[5]).toBe('1234567,80');
    expect(campos[6]).toBe('0,05');
  });

  test('linha da pessoa: ano, CPF formatado, nome, natureza, qtd e "Não"', () => {
    const [, l] = linhasDo(montarCsvIr(2026, [pessoa()]));
    expect(l).toBe('2026;123.456.789-09;Maria da Silva;3.3.90.36 - Outros serviços PF;2;1500,00;10,50;165,00;75,00;1249,50;Não;;');
  });

  test('quem está informado leva "Sim", a data em dd/mm/aaaa e a observação', () => {
    const [, l] = linhasDo(montarCsvIr(2026, [pessoa({}, { em: '2026-10-26 14:30', porNome: 'Ana', observacao: 'Enviado por e-mail' })]));
    expect(l.split(';').slice(-3)).toEqual(['Sim', '26/10/2026 14:30', 'Enviado por e-mail']);
  });

  test('campo com ";", aspas ou quebra de linha vai entre aspas (aspas dobradas)', () => {
    const csv = montarCsvIr(2026, [pessoa({ nomeCadastro: 'Ana; "Aninha"' }, { em: null, porNome: null, observacao: 'linha 1\nlinha 2' })]);
    expect(csv).toContain(';"Ana; ""Aninha""";');
    expect(csv).toContain('"linha 1\nlinha 2"');
  });

  test('nome que começa com = + - @ não vira fórmula no Excel', () => {
    for (const nome of ['=HYPERLINK("x")', '+1', '-2', '@SOMA(A1)']) {
      const csv = montarCsvIr(2026, [pessoa({ nomeCadastro: nome })]);
      const nomeNoCsv = linhasDo(csv)[1].split(';')[2];
      expect(nomeNoCsv.replace(/^"/, '').startsWith("'")).toBe(true);
    }
  });

  test('última linha é o TOTAL, somado em centavos', () => {
    const linhas = linhasDo(montarCsvIr(2026, [pessoa({ irrf: '0.10' }), pessoa({ irrf: '0.20', qtdOps: 1 })]));
    expect(linhas).toHaveLength(4);
    expect(linhas[3]).toBe('2026;TOTAL;2 pessoa(s);;3;3000,00;0,30;330,00;150,00;2499,00;;;');
  });

  test('sem pessoas: cabeçalho e TOTAL zerado', () => {
    const linhas = linhasDo(montarCsvIr(2026, []));
    expect(linhas).toHaveLength(2);
    expect(linhas[1]).toBe('2026;TOTAL;0 pessoa(s);;0;0,00;0,00;0,00;0,00;0,00;;;');
  });
});
