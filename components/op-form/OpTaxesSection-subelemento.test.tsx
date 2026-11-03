// B7a — a prévia da tela segue a regra própria do subelemento, como o servidor.
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { useForm, FormProvider, type UseFormReturn } from 'react-hook-form';
import OpTaxesSection from './OpTaxesSection';
import type { ConfigRetencoes, ConfigRetencaoCampo } from '@/hooks/use-retencoes-config';

vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));

const pct = (campo: string, rotulo: string, aliquota: number, ordem: number): ConfigRetencaoCampo => ({
  campo, rotulo, tipo: 'PERCENTUAL', aliquota, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem,
});
const digitado = (campo: string, rotulo: string, ordem: number): ConfigRetencaoCampo => ({
  campo, rotulo, tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem,
});
const TODOS = ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'];
const CONFIG: ConfigRetencoes = {
  campos: [
    pct('irrf', 'IRRF', 1.5, 10), pct('iss', 'ISS', 5, 20), pct('inss', 'INSS', 11, 30), pct('patronal', 'Patronal', 20, 40),
    pct('sest_senat', 'SEST/SENAT', 2.5, 50), digitado('taxa_bancaria', 'Taxa bancária', 70), digitado('taxa_pix', 'Taxa PIX', 80),
  ],
  regras: { '3.3.90.36': TODOS },
  regrasSubelemento: { '3.3.90.36.08': [] },
  versao: '2026-01-01T00:00:00.000Z',
};

function renderSecao(subelemento: string, config: ConfigRetencoes = CONFIG) {
  const ref: { methods?: UseFormReturn<any> } = {};
  function Wrapper() {
    const methods = useForm<any>({
      defaultValues: {
        valorPagamento: '1.000,00', elemento: '3.3.90.36 - Serviços PF', subelemento,
        irrf: '', iss: '', inss: '', patronal: '', sestSenat: '', outrosDescontos: '', taxaBancaria: '', taxaPix: '', camposInformados: [],
      },
    });
    ref.methods = methods;
    return (
      <FormProvider {...methods}>
        <OpTaxesSection userRole="ADMIN" config={config} erroConfig={null} />
      </FormProvider>
    );
  }
  render(<Wrapper />);
  return () => ref.methods!;
}
const input = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement;
const liquido = () => screen.getByTestId('resumo-liquido').textContent;

describe('OpTaxesSection com subelemento', () => {
  test('estagiário: R$ 1.000,00 → líquido R$ 1.000,00, tributários travados, aviso do subelemento', async () => {
    renderSecao('3.3.90.36.08 - Estagiários - Pagamento Direto');
    await waitFor(() => expect(liquido()).toBe('R$ 1.000,00'));
    for (const rotulo of ['IRRF (1,5%)', 'ISS (5%)', 'INSS (11%)', 'Patronal (20%)', 'SEST/SENAT (2,5%)']) {
      expect(input(rotulo).disabled).toBe(true);
      expect(input(rotulo).value).toBe('');
    }
    expect(screen.getAllByText('Não se aplica a 3.3.90.36.08').length).toBe(5);
    expect(screen.getByRole('status')).toHaveTextContent('Subelemento 3.3.90.36.08: sem retenções');
    expect(input('Taxa PIX').disabled).toBe(false);
  });

  test('sem subelemento: as 5 retenções do elemento, como sempre', async () => {
    renderSecao('');
    await waitFor(() => expect(liquido()).toBe('R$ 800,00'));
    expect(screen.getByText(/configuração do elemento 3\.3\.90\.36/)).toBeInTheDocument();
  });

  test('regra parcial e troca de subelemento recalculam na hora', async () => {
    const methods = renderSecao('3.3.90.36.08 - Estagiários', { ...CONFIG, regrasSubelemento: { '3.3.90.36.08': ['irrf'] } });
    await waitFor(() => expect(liquido()).toBe('R$ 985,00'));
    expect(input('IRRF (1,5%)').value).toBe('15,00');
    expect(screen.getByText(/regra própria do subelemento 3\.3\.90\.36\.08/)).toBeInTheDocument();
    act(() => methods().setValue('subelemento', ''));
    await waitFor(() => expect(liquido()).toBe('R$ 800,00'));
  });

  test('config antiga, sem regrasSubelemento (servidor sem a migration): segue o elemento', async () => {
    const { regrasSubelemento: _sem, ...antiga } = CONFIG;
    renderSecao('3.3.90.36.08 - Estagiários', antiga);
    await waitFor(() => expect(liquido()).toBe('R$ 800,00'));
  });
});
