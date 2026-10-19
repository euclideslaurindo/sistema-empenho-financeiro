import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// T35-B: o "Imprimir" da emissão abre /consulta-impressao?ne=… já com as OPs da NE.

let params = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => params,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/consulta-impressao',
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
import { apiClient } from '@/lib/api-client';
import ConsultaImpressao from '@/app/consulta-impressao/page';

describe('consulta-impressao com ?ne=', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockResolvedValue({
      ordens: [
        { id: 'op-1', numeroEmpenho: '2026.OP.0012', sub: '01', credorNome: 'Ana', valorPagamento: 10 },
        { id: 'op-2', numeroEmpenho: '2026.OP.0013', sub: '02', credorNome: 'Bruno', valorPagamento: 20 },
      ],
    });
    global.fetch = vi.fn(async () => ({ json: async () => ({ notas: [] }) })) as any;
  });

  test('abre a NE da URL e lista as OPs dela, uma vez só', async () => {
    params = new URLSearchParams('ne=2026ne000001');
    render(<ConsultaImpressao />);
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/api/ordens-pagamento?numeroNe=2026NE000001')
    );
    expect(await screen.findByDisplayValue('2026NE000001')).toBeInTheDocument();
    expect(
      (apiClient.get as any).mock.calls.filter((c: any[]) => String(c[0]).startsWith('/api/ordens-pagamento?numeroNe=')).length
    ).toBe(1);
  });

  test('sem ?ne= não busca nada ao abrir', async () => {
    params = new URLSearchParams();
    render(<ConsultaImpressao />);
    await new Promise((r) => setTimeout(r, 30));
    expect((apiClient.get as any).mock.calls.some((c: any[]) => String(c[0]).includes('numeroNe='))).toBe(false);
  });
});
