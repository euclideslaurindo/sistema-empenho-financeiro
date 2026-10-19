import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

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
const caixa = (sub: string) => screen.getByRole('checkbox', { name: new RegExp('Parcela /' + sub) }) as HTMLInputElement;

  test('?ops= (Imprimir esta emissão): só as OPs da emissão abrem marcadas', async () => {
    params = new URLSearchParams('ne=2026NE000001&ops=op-2');
    render(<ConsultaImpressao />);
    await waitFor(() => expect(caixa('02').checked).toBe(true));
    expect(caixa('01').checked).toBe(false);
  });

  test('?ops= com id que não é desta NE: volta ao padrão (todas marcadas)', async () => {
    params = new URLSearchParams('ne=2026NE000001&ops=op-de-outra-ne');
    render(<ConsultaImpressao />);
    await waitFor(() => expect(caixa('01').checked).toBe(true));
    expect(caixa('02').checked).toBe(true);
  });

  test('gerar as vias das OPs não consulta mais credores da NE (código morto da T30 removido)', async () => {
    params = new URLSearchParams('ne=2026NE000001');
    render(<ConsultaImpressao />);
    await waitFor(() => expect(caixa('01').checked).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /GERAR DOCUMENTO\(S\) SELECIONADO\(S\)/ }));
    await waitFor(() => expect(screen.getAllByText(/Ana/).length).toBeGreaterThan(0), { timeout: 3000 });
    expect((apiClient.get as any).mock.calls.some((c: any[]) => String(c[0]).startsWith('/api/notas-empenho?numero='))).toBe(false);
    expect(screen.queryByTestId('credores-ne')).toBeNull();
  });
});

describe('via em branco de NE nova (T36)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockImplementation(async (url: string) => {
      if (url.startsWith('/api/ordens-pagamento')) return { ordens: [] };
      if (url.startsWith('/api/notas-empenho?numero=')) {
        // NE da rodada 2: sem credor e sem datas de pagamento/emissão
        return {
          ne: {
            numero: '2026NE000777', valor: '250.00', historico: 'Obs da NE nova', gestao: '140101',
            unidadeOrcamentaria: 'Educação', elemento: '3.3.90.36 - Serviços PF', subelemento: 'Locação',
            credorNome: null, cpfCnpj: null, dataPagamento: null, dataEmissao: null, dataProvisaoConcedida: null,
          },
        };
      }
      return {};
    });
    global.fetch = vi.fn(async () => ({ json: async () => ({ notas: [] }) })) as any;
  });

  test('sai sem Invalid Date, 01/01/1970 ou undefined, com as Observações da NE', async () => {
    params = new URLSearchParams('ne=2026NE000777');
    const { container } = render(<ConsultaImpressao />);
    const emBranco = await screen.findByRole('button', { name: /Gerar Documento em Branco/ });
    fireEvent.click(emBranco);
    await waitFor(() => expect(screen.getAllByText(/Obs da NE nova/).length).toBeGreaterThan(0), { timeout: 3000 });
    const texto = container.textContent || '';
    expect(texto).not.toMatch(/Invalid Date|01\/01\/1970|undefined|NaN/);
    // a via abre em modo de edição: valores e datas ficam nos campos
    const valores = Array.from(container.querySelectorAll('input')).map((i) => (i as HTMLInputElement).value);
    expect(valores).toContain('250,00');
    expect(valores.join(' ')).not.toMatch(/Invalid Date|01\/01\/1970|undefined|NaN/);
  });

});
