import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import { apiClient } from '@/lib/api-client';
import Credores from '@/app/credores/page';

describe('Cadastro de credores — MEI (T26)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockResolvedValue({
      credores: [
        { id: 'c1', nome: 'Maria Cavalcanti ME', cpfCnpj: '11.111.111/0001-11', isMei: 1, cidade: 'Garanhuns', uf: 'PE' },
        { id: 'c2', nome: 'José Silva', cpfCnpj: '222.222.222-22', isMei: 0 },
      ],
      pagination: { totalPages: 1, total: 2 },
    });
  });

  test('campo MEI em destaque com texto de ajuda', async () => {
    render(<Credores />);
    const check = await screen.findByLabelText('Credor MEI (Microempreendedor Individual)');
    expect(check).toHaveAttribute('aria-describedby', 'credor-is-mei-ajuda');
    expect(screen.getByText(/MEI não sofre retenção de IR, ISS, INSS, SEST\/SENAT nem patronal/)).toBeInTheDocument();
  });

  test('aviso quando marca MEI com CPF (não bloqueia)', async () => {
    render(<Credores />);
    fireEvent.change(await screen.findByLabelText(/CPF\/CNPJ|CNPJ\/CPF/), { target: { value: '12345678909' } });
    expect(screen.queryByText(/MEI tem CNPJ/)).toBeNull();
    fireEvent.click(screen.getByLabelText('Credor MEI (Microempreendedor Individual)'));
    expect(screen.getByRole('alert')).toHaveTextContent('MEI tem CNPJ');

    fireEvent.change(screen.getByLabelText(/CPF\/CNPJ|CNPJ\/CPF/), { target: { value: '11222333000181' } });
    await waitFor(() => expect(screen.queryByText(/MEI tem CNPJ/)).toBeNull());
  });

  test('selo MEI na tabela de credores', async () => {
    render(<Credores />);
    const linhaMaria = (await screen.findByText('Maria Cavalcanti ME')).closest('tr')!;
    expect(within(linhaMaria).getByText('MEI')).toBeInTheDocument();
    const linhaJose = screen.getByText('José Silva').closest('tr')!;
    expect(within(linhaJose).queryByText('MEI')).toBeNull();
  });
});
