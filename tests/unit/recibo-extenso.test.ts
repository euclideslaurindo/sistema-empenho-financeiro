// Recibo do verso: o valor líquido em número e por extenso sempre iguais.
// Antes, o documento em branco da NE saía "R$ 0,00 (DOIS MIL REAIS)".
import { describe, test, expect } from 'vitest';
import { editarVerso, valoresDoVersoEmBranco } from '@/lib/impressao-op';

describe('documento em branco da NE', () => {
  test('líquido = valor da NE, sem descontos; número e extenso iguais', () => {
    expect(valoresDoVersoEmBranco('2000.00')).toEqual({
      valorBase: '2.000,00',
      valorRecibo: '2.000,00',
      valorExtenso: 'dois mil reais',
      totalDescontos: '0,00',
      descontosExtenso: 'zero real',
    });
  });

  test('centavos e valor numérico', () => {
    const v = valoresDoVersoEmBranco(1500.5);
    expect(v.valorRecibo).toBe('1.500,50');
    expect(v.valorExtenso).toBe('um mil e quinhentos reais e cinquenta centavos');
  });
});

describe('edição do verso na tela', () => {
  const verso = { valorRecibo: '0,00', valorExtenso: 'zero', totalDescontos: '0,00', descontosExtenso: 'zero', referenteA: 'x' };

  test('mudar o valor líquido refaz o extenso', () => {
    expect(editarVerso(verso, 'valorRecibo', '1.234,56')).toMatchObject({
      valorRecibo: '1.234,56',
      valorExtenso: 'um mil duzentos e trinta e quatro reais e cinquenta e seis centavos',
    });
  });

  test('mudar o total de descontos refaz o extenso dos descontos', () => {
    expect(editarVerso(verso, 'totalDescontos', '30,00')).toMatchObject({ totalDescontos: '30,00', descontosExtenso: 'trinta reais' });
  });

  test('outros campos não mexem no extenso; o extenso pode ser corrigido à mão', () => {
    expect(editarVerso(verso, 'referenteA', 'y')).toEqual({ ...verso, referenteA: 'y' });
    expect(editarVerso(verso, 'valorExtenso', 'outro texto').valorExtenso).toBe('outro texto');
  });

  test('não altera o objeto original', () => {
    editarVerso(verso, 'valorRecibo', '9,00');
    expect(verso.valorRecibo).toBe('0,00');
  });
});
