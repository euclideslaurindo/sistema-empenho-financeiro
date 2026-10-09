import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useForm, FormProvider, type UseFormReturn } from 'react-hook-form';
import { SeletorCredorOp, selecionarCredorOp, credorDaListaNe } from './SeletorCredorOp';
import { EmpenhoVia } from '@/components/consulta-impressao/EmpenhoVia';
import type { NeCredorResposta } from '@/lib/types/db';

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }));
import { apiClient } from '@/lib/api-client';

const A: NeCredorResposta = { cpfCnpj: '11.111.111/0001-11', nome: 'Credor A', valorBruto: 6000, valorPago: 2500, saldo: 3500 };
const B: NeCredorResposta = { cpfCnpj: '222.222.222-22', nome: 'Credor B', valorBruto: 4000, valorPago: 4000, saldo: 0 };

function renderSeletor(credoresNe: NeCredorResposta[]) {
  const ref: { methods?: UseFormReturn<any> } = {};
  function Wrapper() {
    const methods = useForm<any>({
      defaultValues: { credoresNe, nomeCredor: '', cpfCnpj: '', rgCredor: '', enderecoCredor: '', valorPagamento: '' },
    });
    ref.methods = methods;
    return (
      <FormProvider {...methods}>
        <SeletorCredorOp />
      </FormProvider>
    );
  }
  render(<Wrapper />);
  return () => ref.methods!;
}

describe('SeletorCredorOp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockResolvedValue({
      credores: [{ cpfCnpj: '11.111.111/0001-11', rg: 'ISENTO', endereco: 'Rua X, 10' }],
    });
  });

  test('2 credores: mostra bruto, pago e restante de cada um', () => {
    renderSeletor([A, B]);
    expect(screen.getByRole('radiogroup', { name: 'Credor desta OP' })).toBeInTheDocument();
    expect(screen.getByText(/Bruto R\$ 6\.000,00 · Pago R\$ 2\.500,00/)).toBeInTheDocument();
    expect(screen.getByText('Restante R$ 3.500,00')).toBeInTheDocument();
    expect(screen.getByText('Restante R$ 0,00')).toBeInTheDocument();
  });

  test('credor sem restante fica desabilitado', () => {
    renderSeletor([A, B]);
    expect((screen.getByLabelText(/Credor B/) as HTMLInputElement).disabled).toBe(true);
  });

  test('escolher preenche nome/CPF, RG/endereço do cadastro e sugere o restante', async () => {
    const methods = renderSeletor([A, B]);
    fireEvent.click(screen.getByLabelText(/Credor A/));
    await waitFor(() => expect(methods().getValues('enderecoCredor')).toBe('Rua X, 10'));
    expect(methods().getValues('nomeCredor')).toBe('Credor A');
    expect(methods().getValues('cpfCnpj')).toBe('11.111.111/0001-11');
    expect(methods().getValues('rgCredor')).toBe('ISENTO');
    expect(methods().getValues('valorPagamento')).toBe('3.500,00');
    expect(apiClient.get).toHaveBeenCalledWith('/api/credores?busca=11111111000111&limit=5');
    expect((screen.getByLabelText(/Credor A/) as HTMLInputElement).checked).toBe(true);
  });

  test('1 credor ou NE antiga: seletor não aparece', () => {
    renderSeletor([A]);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  test('selecionarCredorOp (usado no auto-select de NE com 1 credor) funciona sem cadastro', async () => {
    (apiClient.get as any).mockRejectedValue(new Error('falhou'));
    const setValue = vi.fn();
    await act(async () => selecionarCredorOp(setValue, A));
    expect(setValue).toHaveBeenCalledWith('cpfCnpj', A.cpfCnpj, expect.anything());
    expect(setValue).toHaveBeenCalledWith('valorPagamento', '3.500,00', expect.anything());
  });

  test('credorDaListaNe compara só os dígitos', () => {
    expect(credorDaListaNe([A, B], '22222222222')).toBe(B);
    expect(credorDaListaNe([A, B], '999')).toBeUndefined();
    expect(credorDaListaNe([A, B], '')).toBeUndefined();
  });
});

describe('EmpenhoVia — relação de credores da NE', () => {
  const base = { credorNome: 'Credor A', credorCpfCnpj: A.cpfCnpj, pessoaTipo: 'JURIDICA' };

  test('NE com 2+ credores imprime a relação com os brutos', () => {
    render(<EmpenhoVia data={{ ...base, credoresNe: [A, B] }} isEditing={false} onChange={vi.fn()} />);
    expect(screen.getByTestId('credores-ne')).toHaveTextContent(
      'Credores da NE: Credor A R$ 6.000,00 · Credor B R$ 4.000,00'
    );
  });

  test('NE de 1 credor: via sem a linha', () => {
    render(<EmpenhoVia data={{ ...base, credoresNe: [A] }} isEditing={false} onChange={vi.fn()} />);
    expect(screen.queryByTestId('credores-ne')).toBeNull();
  });
});
