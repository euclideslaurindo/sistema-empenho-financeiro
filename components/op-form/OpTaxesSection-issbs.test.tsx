// B10 — campo ISS-BS (valor livre) e ISS editável pelo GESTOR na OP.
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import OpTaxesSection from './OpTaxesSection';
import type { ConfigRetencoes, ConfigRetencaoCampo } from '@/hooks/use-retencoes-config';

vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));

const pct = (campo: string, rotulo: string, aliquota: number, ordem: number, editavelOperador = false): ConfigRetencaoCampo => ({
  campo, rotulo, tipo: 'PERCENTUAL', aliquota, calculoAutomatico: true, editavelOperador, entraDarf: false, ativo: true, ordem,
});
const config = (issEditavel: boolean): ConfigRetencoes => ({
  campos: [
    pct('irrf', 'IRRF', 1.5, 10), pct('iss', 'ISS', 5, 20, issEditavel),
    { campo: 'iss_bs', rotulo: 'ISS-BS', tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem: 25 },
  ],
  regras: { '3.3.90.39': ['irrf', 'iss'] },
  regrasSubelemento: {},
  versao: '2026-01-01T00:00:00.000Z',
});

function renderSecao(issEditavel = false) {
  function Wrapper() {
    const methods = useForm<any>({
      defaultValues: {
        valorPagamento: '1.000,00', elemento: '3.3.90.39 - PJ', subelemento: '',
        irrf: '', iss: '', issBs: '', inss: '', patronal: '', sestSenat: '', outrosDescontos: '', taxaBancaria: '', taxaPix: '', camposInformados: [],
      },
    });
    return (
      <FormProvider {...methods}>
        <OpTaxesSection userRole="GESTOR" config={config(issEditavel)} erroConfig={null} />
      </FormProvider>
    );
  }
  render(<Wrapper />);
}
const input = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement;
const liquido = () => screen.getByTestId('resumo-liquido').textContent;

describe('OpTaxesSection — ISS-BS e ISS editável (B10)', () => {
  test('GESTOR digita o ISS-BS e o líquido cai', async () => {
    renderSecao();
    await waitFor(() => expect(liquido()).toBe('R$ 935,00'));
    expect(input('ISS-BS').disabled).toBe(false);
    fireEvent.change(input('ISS-BS'), { target: { value: '2000' } });
    await waitFor(() => expect(liquido()).toBe('R$ 915,00'));
  });

  test('ISS travado para o GESTOR por padrão; com "editável pelo operador", ele troca o valor', async () => {
    renderSecao(false);
    await waitFor(() => expect(input('ISS (5%)').value).toBe('50,00'));
    expect(input('ISS (5%)').disabled).toBe(true);
  });

  test('ISS editável: GESTOR digita 30,00 e o cálculo não sobrescreve', async () => {
    renderSecao(true);
    await waitFor(() => expect(input('ISS (5%)').value).toBe('50,00'));
    expect(input('ISS (5%)').disabled).toBe(false);
    fireEvent.change(input('ISS (5%)'), { target: { value: '3000' } });
    await waitFor(() => expect(liquido()).toBe('R$ 955,00'));
    expect(input('ISS (5%)').value).toBe('30,00');
  });
});
