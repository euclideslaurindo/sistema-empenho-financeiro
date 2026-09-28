import React from 'react';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OpRecentTable from './OpRecentTable';

describe('OpRecentTable Component', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('mostra mensagem quando não há ordens', () => {
    render(<OpRecentTable ops={[]} onSearch={() => {}} />);
    expect(screen.getByText(/Nenhuma ordem encontrada/i)).toBeInTheDocument();
  });

  test('renderiza uma linha por ordem, com os dados corretos', () => {
    render(
      <OpRecentTable
        ops={[
          { id: '1', numeroEmpenho: '2026.OP.0001', numeroNe: '2026NE0001', credorNome: 'Fulano Ltda', dataPagamento: '2026-09-28', valorPagamento: 1500.5 },
        ]}
        onSearch={() => {}}
      />
    );

    expect(screen.getByText('2026.OP.0001')).toBeInTheDocument();
    expect(screen.getByText('2026NE0001')).toBeInTheDocument();
    expect(screen.getByText('Fulano Ltda')).toBeInTheDocument();
  });

  test('campos ausentes exibem "-" em vez de undefined', () => {
    render(
      <OpRecentTable
        ops={[{ id: '2', dataPagamento: null, valorPagamento: 0 }]}
        onSearch={() => {}}
      />
    );
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(3); // numeroEmpenho, numeroNe, credorNome
  });

  test('busca é debounced: onSearch só é chamado depois do delay, com o último valor digitado', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();

    render(<OpRecentTable ops={[]} onSearch={onSearch} />);
    const input = screen.getByPlaceholderText('Buscar OP...');

    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.change(input, { target: { value: 'abc' } });

    // ainda dentro do debounce, não deve ter chamado nenhuma vez
    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);

    // só a última chamada (após o debounce reiniciar a cada tecla) dispara
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('abc');
  });
});
