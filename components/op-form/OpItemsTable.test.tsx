import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OpItemsTable from './OpItemsTable';

vi.mock('@/lib/utils', () => ({
  maskCurrency: (val: string) => val,
  parseFormNumber: (val: string) => parseFloat(val.replace(/[^\d,-]/g, '').replace(',', '.')),
}));

describe('OpItemsTable Component', () => {
  const mockData = [
    { especificacao: 'Item 1', quantidade: 2, unidade: 'UN', valorUnitario: 50 },
    { especificacao: 'Item 2', quantidade: 1, unidade: 'M', valorUnitario: 100 },
  ];

  const mockOnChange = vi.fn();
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Renderiza tabela com itens', () => {
    render(
      <OpItemsTable
        items={mockData}
        onChange={mockOnChange}
        onRemove={mockOnRemove}
        itemErrors={{}}
      />
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  test('Exibe erros inline para campo específico', () => {
    const errors = {
      0: { especificacao: 'Campo obrigatório', unidade: 'Unidade inválida' },
    };

    render(
      <OpItemsTable
        items={mockData}
        onChange={mockOnChange}
        onRemove={mockOnRemove}
        itemErrors={errors}
      />
    );

    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Unidade inválida')).toBeInTheDocument();
  });

  test('AlertDialog aparece ao clicar remover', async () => {
    render(
      <OpItemsTable
        items={mockData}
        onChange={mockOnChange}
        onRemove={mockOnRemove}
        itemErrors={{}}
      />
    );

    const removerButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.includes('Excluir') || btn.textContent?.includes('Trash')
    );

    fireEvent.click(removerButtons[0]);

    // AlertDialog deve aparecer
    const titulo = await screen.findByText(/remover/i);
    expect(titulo).toBeInTheDocument();
  });

  test('Cancelar no AlertDialog não remove item', async () => {
    const { rerender } = render(
      <OpItemsTable
        items={mockData}
        onChange={mockOnChange}
        onRemove={mockOnRemove}
        itemErrors={{}}
      />
    );

    const removerButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.includes('Excluir') || btn.textContent?.includes('Trash')
    );
    fireEvent.click(removerButtons[0]);

    const cancelarBtn = await screen.findByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelarBtn);

    expect(mockOnRemove).not.toHaveBeenCalled();
    expect(screen.getByText('Item 1')).toBeInTheDocument(); // item ainda está lá
  });

  test('Confirmar no AlertDialog chama onRemove', async () => {
    render(
      <OpItemsTable
        items={mockData}
        onChange={mockOnChange}
        onRemove={mockOnRemove}
        itemErrors={{}}
      />
    );

    const removerButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.includes('Excluir') || btn.textContent?.includes('Trash')
    );
    fireEvent.click(removerButtons[0]);

    const confirmarBtn = await screen.findByRole('button', { name: /confirmar|remover|deletar/i });
    fireEvent.click(confirmarBtn);

    expect(mockOnRemove).toHaveBeenCalledWith(0);
  });
});
