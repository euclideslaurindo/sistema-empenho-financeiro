// B9 — credor optante pelo Simples Nacional no cadastro.
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import { apiClient } from '@/lib/api-client';
import Credores from '@/app/credores/page';
import { linhaDoCredor } from '@/lib/op-emissao';

describe('Cadastro de credores — Simples Nacional (B9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockResolvedValue({
      credores: [
        { id: 'c1', nome: 'Limpa Tudo LTDA', cpfCnpj: '11.222.333/0001-81', isMei: 0, isSimples: 1 },
        { id: 'c2', nome: 'Maria ME', cpfCnpj: '11.111.111/0001-11', isMei: 1, isSimples: 1 },
        { id: 'c3', nome: 'Grande S/A', cpfCnpj: '33.000.167/0001-01', isMei: 0, isSimples: 0 },
      ],
      pagination: { totalPages: 1, total: 3 },
    });
  });

  test('caixa do Simples com ajuda; aviso se marcar com CPF', async () => {
    render(<Credores />);
    const check = await screen.findByLabelText('Optante pelo Simples Nacional');
    expect(check).toHaveAttribute('aria-describedby', 'credor-is-simples-ajuda');
    expect(screen.getByText(/Não sofre retenção de IR\. ISS e as demais retenções seguem a regra do elemento/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/CPF\/CNPJ|CNPJ\/CPF/), { target: { value: '12345678909' } });
    fireEvent.click(check);
    expect(screen.getByRole('alert')).toHaveTextContent('Simples Nacional é de empresa (CNPJ)');
  });

  test('selo SIMPLES na tabela (o MEI mostra só MEI)', async () => {
    render(<Credores />);
    const limpa = (await screen.findByText('Limpa Tudo LTDA')).closest('tr')!;
    expect(within(limpa).getByText('Simples')).toBeInTheDocument();
    const maria = screen.getByText('Maria ME').closest('tr')!;
    expect(within(maria).queryByText('Simples')).toBeNull();
    expect(within(maria).getByText('MEI')).toBeInTheDocument();
    expect(within(screen.getByText('Grande S/A').closest('tr')!).queryByText('Simples')).toBeNull();
  });

  test('a linha da OP leva o Simples do cadastro', () => {
    expect(linhaDoCredor({ cpfCnpj: '1', isSimples: 1 }, '', 'NE').credorSimples).toBe(true);
    expect(linhaDoCredor({ cpf_cnpj: '1', is_simples: 0 }, '', 'NE').credorSimples).toBe(false);
    expect(linhaDoCredor({ cpfCnpj: '1' }, '', 'NE').credorSimples).toBe(false);
  });
});
