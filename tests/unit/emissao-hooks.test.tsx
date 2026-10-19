import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
import { apiClient } from '@/lib/api-client';
import { useSaldoNe } from '@/hooks/use-saldo-ne';
import { useNumerosPrevistos } from '@/hooks/use-numeros-previstos';

// T35-B: saldo da NE e números previstos da emissão.

const adiado = <T,>() => {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((r) => (resolver = r));
  return { promessa, resolver };
};

describe('useSaldoNe', () => {
  beforeEach(() => vi.clearAllMocks());

  test('carrega o saldo da NE e recarrega sob pedido', async () => {
    (apiClient.get as any).mockResolvedValue({ saldo: { valor: 100, gasto: 30, restante: 70, percentualGasto: 30, qtdOps: 1 } });
    const { result } = renderHook(() => useSaldoNe('NE-1'));
    await waitFor(() => expect(result.current.saldo?.restante).toBe(70));
    expect(apiClient.get).toHaveBeenCalledWith('/api/notas-empenho/saldo?numero=NE-1');
    act(() => result.current.recarregar());
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
  });

  test('sem NE não chama; resposta de uma NE anterior é descartada', async () => {
    const lenta = adiado<any>();
    (apiClient.get as any).mockImplementation((url: string) =>
      url.includes('NE-A') ? lenta.promessa : Promise.resolve({ saldo: { valor: 50, gasto: 0, restante: 50, percentualGasto: 0, qtdOps: 0 } })
    );
    const { result, rerender } = renderHook(({ ne }: { ne: string }) => useSaldoNe(ne), { initialProps: { ne: '' } });
    expect(apiClient.get).not.toHaveBeenCalled();
    rerender({ ne: 'NE-A' });
    rerender({ ne: 'NE-B' });
    await waitFor(() => expect(result.current.saldo?.valor).toBe(50));
    await act(async () => lenta.resolver({ saldo: { valor: 999, gasto: 0, restante: 999, percentualGasto: 0, qtdOps: 0 } }));
    expect(result.current.saldo?.valor).toBe(50);
  });

  test('erro vira mensagem, sem saldo', async () => {
    (apiClient.get as any).mockRejectedValue(new Error('NE não encontrada.'));
    const { result } = renderHook(() => useSaldoNe('NE-X'));
    await waitFor(() => expect(result.current.erro).toBe('NE não encontrada.'));
    expect(result.current.saldo).toBeNull();
  });
});

describe('useNumerosPrevistos', () => {
  beforeEach(() => vi.clearAllMocks());
  const NUMEROS = [
    { numeroOp: '2026.OP.0012', sub: '01', rotulo: 'NE X/01' },
    { numeroOp: '2026.OP.0013', sub: '02', rotulo: 'NE X/02' },
  ];

  test('pede N números da NE', async () => {
    (apiClient.get as any).mockResolvedValue({ numeros: NUMEROS });
    const { result } = renderHook(() => useNumerosPrevistos('NE X', 2, 0));
    await waitFor(() => expect(result.current.numeros).toEqual(NUMEROS));
    expect(apiClient.get).toHaveBeenCalledWith('/api/ordens-pagamento/proximo-numero?numeroNe=NE%20X&quantidade=2');
  });

  test('N = 0 ou sem NE: não chama e não há números', async () => {
    const { result, rerender } = renderHook(({ ne, n }: { ne: string; n: number }) => useNumerosPrevistos(ne, n, 0), { initialProps: { ne: 'NE', n: 0 } });
    rerender({ ne: '', n: 3 });
    await new Promise((r) => setTimeout(r, 20));
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(result.current.numeros).toBeNull();
  });

  test('debounce: adicionar 3 linhas seguidas faz um pedido só, com N = 3', async () => {
    (apiClient.get as any).mockResolvedValue({ numeros: NUMEROS });
    const { rerender } = renderHook(({ n }: { n: number }) => useNumerosPrevistos('NE', n, 40), { initialProps: { n: 1 } });
    rerender({ n: 2 });
    rerender({ n: 3 });
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));
    expect((apiClient.get as any).mock.calls[0][0]).toContain('quantidade=3');
  });

  test('falha no pedido: sem números (a emissão continua possível)', async () => {
    (apiClient.get as any).mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useNumerosPrevistos('NE', 2, 0));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(result.current.numeros).toBeNull();
  });
});
