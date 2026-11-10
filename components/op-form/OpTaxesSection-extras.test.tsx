// B12 — taxas criadas pelo ADMIN aparecem na OP e mudam o líquido.
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import OpTaxesSection from './OpTaxesSection';
import type { ConfigRetencoes, ConfigRetencaoCampo } from '@/hooks/use-retencoes-config';

vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));

const pct = (campo: string, rotulo: string, aliquota: number, ordem: number): ConfigRetencaoCampo => ({
  campo, rotulo, tipo: 'PERCENTUAL', aliquota, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem,
});
const CONFIG: ConfigRetencoes = {
  campos: [
    pct('irrf', 'IRRF', 1.5, 10),
    pct('x_taxa_ambiental', 'Taxa Ambiental', 2, 90),
    { campo: 'x_contribuicao', rotulo: 'Contribuição', tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem: 95 },
  ],
  regras: { '3.3.90.39': ['irrf', 'x_taxa_ambiental'] },
  regrasSubelemento: {},
  versao: '2026-01-01T00:00:00.000Z',
};

function Wrapper() {
  const methods = useForm<any>({
    defaultValues: { valorPagamento: '1.000,00', elemento: '3.3.90.39 - PJ', subelemento: '', irrf: '', camposInformados: [] },
  });
  return (
    <FormProvider {...methods}>
      <OpTaxesSection userRole="GESTOR" config={CONFIG} erroConfig={null} />
    </FormProvider>
  );
}
const liquido = () => screen.getByTestId('resumo-liquido').textContent;

describe('OpTaxesSection — taxas personalizadas', () => {
  test('percentual calcula pela Matriz; digitada muda o líquido', async () => {
    render(<Wrapper />);
    await waitFor(() => expect(liquido()).toBe('R$ 965,00')); // 1000 − 15 − 20
    expect((screen.getByLabelText('Taxa Ambiental (2%)') as HTMLInputElement).value).toBe('20,00');
    const contrib = screen.getByLabelText('Contribuição') as HTMLInputElement;
    expect(contrib.disabled).toBe(false);
    fireEvent.change(contrib, { target: { value: '700' } });
    await waitFor(() => expect(liquido()).toBe('R$ 958,00'));
  });
});
