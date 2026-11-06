// B9 — OP do 3.3.90.39: IRRF pela natureza do subelemento e credor do Simples
// (cálculo local, o mesmo motor do servidor).
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import OpTaxesSection from './OpTaxesSection';
import type { ConfigRetencoes, ConfigRetencaoCampo } from '@/hooks/use-retencoes-config';

vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));
import { apiClient } from '@/lib/api-client';

const pct = (campo: string, rotulo: string, aliquota: number, ordem: number): ConfigRetencaoCampo => ({
  campo, rotulo, tipo: 'PERCENTUAL', aliquota, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem,
});
const CONFIG: ConfigRetencoes = {
  campos: [pct('irrf', 'IRRF', 1.5, 10), pct('iss', 'ISS', 5, 20), pct('inss', 'INSS', 11, 30), pct('patronal', 'Patronal', 20, 40), pct('sest_senat', 'SEST/SENAT', 2.5, 50)],
  regras: { '3.3.90.39': ['irrf', 'iss'] },
  regrasSubelemento: {},
  irrfSubelemento: { '3.3.90.39.22': 4.8 },
  versao: '2026-01-01T00:00:00.000Z',
};

function renderSecao(subelemento: string, extra: Record<string, unknown> = {}) {
  function Wrapper() {
    const methods = useForm<any>({
      defaultValues: {
        valorPagamento: '10.000,00', elemento: '3.3.90.39 - Outros Serviços de Terceiros - PJ', subelemento,
        irrf: '', iss: '', inss: '', patronal: '', sestSenat: '', outrosDescontos: '', taxaBancaria: '', taxaPix: '', camposInformados: [],
        ...extra,
      },
    });
    return (
      <FormProvider {...methods}>
        <OpTaxesSection userRole="GESTOR" config={CONFIG} erroConfig={null} />
      </FormProvider>
    );
  }
  render(<Wrapper />);
}
const input = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement;
const liquido = () => screen.getByTestId('resumo-liquido').textContent;

describe('OpTaxesSection — IR pela natureza (3.3.90.39)', () => {
  test('Limpeza: "IRRF (4,8%)" 480,00 + ISS 500,00 → líquido R$ 9.020,00, sem chamar o servidor', async () => {
    renderSecao('3.3.90.39.22 - Limpeza');
    await waitFor(() => expect(liquido()).toBe('R$ 9.020,00'));
    expect(input('IRRF (4,8%)').value).toBe('480,00');
    expect(input('ISS (5%)').value).toBe('500,00');
    expect(screen.getAllByText('Não se aplica a 3.3.90.39').length).toBe(3); // INSS, Patronal, SEST/SENAT
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  test('sem natureza: "IRRF (1,5%)" 150,00', async () => {
    renderSecao('');
    await waitFor(() => expect(liquido()).toBe('R$ 9.350,00'));
    expect(input('IRRF (1,5%)').value).toBe('150,00');
  });

  test('credor do Simples: IR 0 com a dica e o aviso; ISS continua', async () => {
    renderSecao('3.3.90.39.22 - Limpeza', { credorSimples: true });
    await waitFor(() => expect(liquido()).toBe('R$ 9.500,00'));
    expect(['', '0,00']).toContain(input('IRRF (4,8%)').value);
    expect(screen.getByText('Isento de IR (Simples Nacional)')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Credor do Simples Nacional: sem retenção de IR');
    expect(input('ISS (5%)').value).toBe('500,00');
  });
});
