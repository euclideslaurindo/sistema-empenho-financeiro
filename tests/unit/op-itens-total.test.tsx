import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import OpItemsTable from '@/components/op-form/OpItemsTable';

// Sem mocks de lib/utils: as contas reais. Antes, 10,10 + 20,20 = 30,2999… em
// ponto flutuante e a tela mostrava "Deve ser exatamente igual" com valores iguais.
function renderItens(itens: Array<[number, string]>, valorPagamento: string) {
  function Wrapper() {
    const methods = useForm<any>({
      defaultValues: {
        valorPagamento,
        itens: itens.map(([quantidade, valorUnitario], i) => ({ especificacao: `Item ${i}`, quantidade, unidade: 'UN', valorUnitario })),
      },
    });
    return (
      <FormProvider {...methods}>
        <OpItemsTable />
      </FormProvider>
    );
  }
  render(<Wrapper />);
}

const AVISO = /Deve ser exatamente igual ao Valor a Pagar/;

describe('total dos itens da OP', () => {
  test.each([
    [[[1, '10,10'], [1, '20,20']], '30,30'],
    [[[1, '0,10'], [1, '0,20']], '0,30'],
    [[[1, '1,15'], [1, '2,30']], '3,45'],
  ] as Array<[Array<[number, string]>, string]>)('itens %j somando %s: sem aviso falso', (itens: Array<[number, string]>, valor: string) => {
    renderItens(itens, valor);
    expect(screen.queryByText(AVISO)).toBeNull();
    // o "V. Total dos Itens" mostra exatamente o valor (sem 30,2999…)
    expect(screen.getByText((texto: string) => texto.startsWith('R$') && texto.endsWith(valor))).toBeInTheDocument();
  });

  test('diferença real (mais de 1 centavo) continua avisando', () => {
    renderItens([[1, '10,00'], [1, '20,00']], '30,30');
    expect(screen.getByText(AVISO)).toBeInTheDocument();
  });
});
