import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReciboVia } from './ReciboVia';

const base = {
  numeroCheque: '000123', valorBase: '665,00', valorRecibo: '390,49', totalDescontos: '274,51',
  irrf: '9,98', iss: '33,25', inss: '73,15', patronal: '133,00', sestSenat: '16,63',
  outrosDescontos: '0,00', taxaBancaria: '8,50', taxaPix: '0,00',
  localData: '', nomeRecebedor: 'FULANO', cpfCnpj: '', rg: '',
};

describe('ReciboVia — discriminação dos descontos', () => {
  test('renderiza as linhas recebidas com os valores', () => {
    render(
      <ReciboVia
        data={{ ...base, linhasDescontos: [
          { chave: 'irrf', rotulo: 'IRRF (2%)' },
          { chave: 'taxaBancaria', rotulo: 'Taxa bancária (expediente)' },
        ] }}
        isEditing={false}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('IRRF (2%)')).toBeInTheDocument();
    expect(screen.getByText('9,98')).toBeInTheDocument();
    expect(screen.getByText('8,50')).toBeInTheDocument();
    expect(screen.queryByText(/ISS/)).toBeNull();
  });

  test('lista vazia (elemento .14 sem descontos ativos) mostra "Sem descontos"', () => {
    render(<ReciboVia data={{ ...base, linhasDescontos: [] }} isEditing={false} onChange={vi.fn()} />);
    expect(screen.getByText('Sem descontos')).toBeInTheDocument();
  });

  test('sem linhasDescontos usa o documento em branco (sem percentual)', () => {
    render(<ReciboVia data={base} isEditing={false} onChange={vi.fn()} />);
    expect(screen.getByText('IRRF')).toBeInTheDocument();
    expect(screen.getByText('Taxa PIX')).toBeInTheDocument();
    expect(screen.queryByText(/\(1,5%\)/)).toBeNull();
  });

  test('modo edição chama onChange com a chave da linha', () => {
    const onChange = vi.fn();
    render(
      <ReciboVia
        data={{ ...base, linhasDescontos: [{ chave: 'taxaPix', rotulo: 'Taxa PIX' }] }}
        isEditing
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText('Taxa PIX'), { target: { value: '1,00' } });
    expect(onChange).toHaveBeenCalledWith('taxaPix', '1,00');
  });
});

describe('ReciboVia — MEI (T26)', () => {
  test('mostra a nota de isenção acima das linhas de desconto', () => {
    render(
      <ReciboVia
        data={{ ...base, notaDescontos: 'Isento de retenções (MEI)', linhasDescontos: [{ chave: 'taxaPix', rotulo: 'Taxa PIX' }] }}
        isEditing={false}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('nota-descontos')).toHaveTextContent('Isento de retenções (MEI)');
    expect(screen.getByText('Taxa PIX')).toBeInTheDocument();
  });

  test('nota sem linhas: não mostra "Sem descontos" junto', () => {
    render(<ReciboVia data={{ ...base, notaDescontos: 'Isento de retenções (MEI)', linhasDescontos: [] }} isEditing={false} onChange={vi.fn()} />);
    expect(screen.queryByText('Sem descontos')).toBeNull();
  });
});
