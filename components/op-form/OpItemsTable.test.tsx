import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useForm, FormProvider, UseFormReturn } from 'react-hook-form';
import OpItemsTable from './OpItemsTable';

vi.mock('@/lib/utils', async (importOriginal: any) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    maskCurrency: (val: string) => val,
    parseFormNumber: (val: string) => parseFloat(val.replace(/[^\d,-]/g, '').replace(',', '.')),
    formatCurrency: (val: number) => val.toFixed(2),
  };
});

function renderWithForm(Component: React.ReactNode, defaultValues: any = {}) {
  function Wrapper() {
    const methods = useForm({ defaultValues });
    return <FormProvider {...methods}>{Component}</FormProvider>;
  }
  return render(<Wrapper />);
}

describe('OpItemsTable Component', () => {
  const defaultValues = {
    itens: [
      { especificacao: 'Item 1', quantidade: 2, unidade: 'UN', valorUnitario: '50' },
      { especificacao: 'Item 2', quantidade: 1, unidade: 'M', valorUnitario: '100' },
    ],
    valorPagamento: '200',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Renderiza tabela com itens', () => {
    renderWithForm(<OpItemsTable errors={undefined} />, defaultValues);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  test('Exibe erros inline para campos', () => {
    const errors = {
      itens: {
        0: { especificacao: { message: 'Campo obrigatório' }, unidade: { message: 'Unidade inválida' } },
      },
    };

    renderWithForm(<OpItemsTable errors={errors} />, defaultValues);
    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Unidade inválida')).toBeInTheDocument();
  });

  test('AlertDialog aparece ao clicar remover', async () => {
    renderWithForm(<OpItemsTable errors={undefined} />, defaultValues);

    const removerBtn = screen.getByLabelText('Remover item');
    fireEvent.click(removerBtn);

    const titulo = await screen.findByText(/Remover item/);
    expect(titulo).toBeInTheDocument();
  });

  test('Cancelar no AlertDialog não remove item', async () => {
    renderWithForm(<OpItemsTable errors={undefined} />, defaultValues);

    const removerBtn = screen.getByLabelText('Remover item');
    fireEvent.click(removerBtn);

    const cancelarBtn = await screen.findByRole('button', { name: /Cancelar/i });
    fireEvent.click(cancelarBtn);

    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  test('Confirmar no AlertDialog remove item', async () => {
    renderWithForm(<OpItemsTable errors={undefined} />, defaultValues);

    const removerBtn = screen.getByLabelText('Remover item');
    fireEvent.click(removerBtn);

    const removerDialog = await screen.findByRole('button', { name: /Remover/i });
    fireEvent.click(removerDialog);

    // Item deve desaparecer após confirmação
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
  });
});
