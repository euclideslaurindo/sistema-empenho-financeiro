import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { useForm, FormProvider, type UseFormReturn } from 'react-hook-form';
import { FaixaNumeroPrevisto } from './FaixaNumeroPrevisto';

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }));
import { apiClient } from '@/lib/api-client';

function renderFaixa() {
  const ref: { methods?: UseFormReturn<any> } = {};
  function Wrapper() {
    const methods = useForm<any>({ defaultValues: { neCarregada: '', previsaoNumero: null } });
    ref.methods = methods;
    return (
      <FormProvider {...methods}>
        <FaixaNumeroPrevisto />
      </FormProvider>
    );
  }
  render(<Wrapper />);
  return () => ref.methods!;
}

const previsao = (ne: string, numeroOp: string, sub: string) => ({ numeroOp, sub, rotulo: `NE ${ne}/${sub}`, previsto: true });

describe('FaixaNumeroPrevisto', () => {
  beforeEach(() => vi.clearAllMocks());

  test('sem NE carregada não busca nem mostra nada', () => {
    renderFaixa();
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('ao carregar NE mostra a faixa e guarda a previsão no form', async () => {
    (apiClient.get as any).mockResolvedValue(previsao('2026NE000982', '2026.OP.0004', '02'));
    const methods = renderFaixa();
    act(() => methods().setValue('neCarregada', '2026NE000982'));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Esta será a OP 2026.OP.0004 · NE 2026NE000982/02 (previsto)'
    );
    expect(apiClient.get).toHaveBeenCalledWith('/api/ordens-pagamento/proximo-numero?numeroNe=2026NE000982');
    expect(methods().getValues('previsaoNumero')).toMatchObject({ numeroOp: '2026.OP.0004', sub: '02' });
  });

  test('trocar de NE atualiza a faixa', async () => {
    (apiClient.get as any)
      .mockResolvedValueOnce(previsao('NE-A', '2026.OP.0004', '02'))
      .mockResolvedValueOnce(previsao('NE-B', '2026.OP.0004', '01'));
    const methods = renderFaixa();
    act(() => methods().setValue('neCarregada', 'NE-A'));
    await screen.findByText(/NE NE-A\/02/);
    act(() => methods().setValue('neCarregada', 'NE-B'));
    await screen.findByText(/NE NE-B\/01/);
  });

  test('limpar a NE (operador digitando outra) esconde a faixa', async () => {
    (apiClient.get as any).mockResolvedValue(previsao('NE-A', '2026.OP.0004', '02'));
    const methods = renderFaixa();
    act(() => methods().setValue('neCarregada', 'NE-A'));
    await screen.findByRole('status');
    act(() => methods().setValue('neCarregada', ''));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(methods().getValues('previsaoNumero')).toBeNull();
  });

  test('resposta atrasada de uma NE anterior é ignorada', async () => {
    let resolverA: (v: any) => void = () => {};
    (apiClient.get as any)
      .mockReturnValueOnce(new Promise((r) => (resolverA = r)))
      .mockResolvedValueOnce(previsao('NE-B', '2026.OP.0005', '01'));
    const methods = renderFaixa();
    act(() => methods().setValue('neCarregada', 'NE-A'));
    act(() => methods().setValue('neCarregada', 'NE-B'));
    await screen.findByText(/NE NE-B\/01/);
    await act(async () => resolverA(previsao('NE-A', '2026.OP.0004', '02')));
    expect(screen.getByRole('status')).toHaveTextContent('NE NE-B/01');
  });

  test('erro na previsão: sem faixa', async () => {
    (apiClient.get as any).mockRejectedValue(new Error('NE não encontrada'));
    const methods = renderFaixa();
    act(() => methods().setValue('neCarregada', 'NE-X'));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();
  });
});
