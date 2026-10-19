import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { useForm, FormProvider, type UseFormReturn } from 'react-hook-form';
import OpTaxesSection from './OpTaxesSection';
import OpItemsTable from './OpItemsTable';
import { InputValorPagamento } from './InputValorPagamento';
import type { ConfigRetencoes, ConfigRetencaoCampo } from '@/hooks/use-retencoes-config';

vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));
import { apiClient } from '@/lib/api-client';

// T35-A: os componentes do formulário da OP servem a várias linhas
// (`credores.0`, `credores.1`) sem uma linha interferir na outra. Campos da
// emissão (elemento, empenho, dataEmissao, saldoAnterior) ficam na raiz.

const CAMPOS: ConfigRetencaoCampo[] = [
  { campo: 'irrf', rotulo: 'IRRF', tipo: 'PERCENTUAL', aliquota: 1.5, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem: 10 },
  { campo: 'iss', rotulo: 'ISS', tipo: 'PERCENTUAL', aliquota: 5, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem: 20 },
  { campo: 'inss', rotulo: 'INSS', tipo: 'PERCENTUAL', aliquota: 11, calculoAutomatico: true, editavelOperador: false, entraDarf: true, ativo: true, ordem: 30 },
  { campo: 'patronal', rotulo: 'Patronal', tipo: 'PERCENTUAL', aliquota: 20, calculoAutomatico: true, editavelOperador: false, entraDarf: true, ativo: true, ordem: 40 },
  { campo: 'sest_senat', rotulo: 'SEST/SENAT', tipo: 'PERCENTUAL', aliquota: 2.5, calculoAutomatico: true, editavelOperador: false, entraDarf: true, ativo: true, ordem: 50 },
  { campo: 'outros', rotulo: 'Outros / IBS-CBS', tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false, editavelOperador: false, entraDarf: false, ativo: true, ordem: 60 },
  { campo: 'taxa_bancaria', rotulo: 'Taxa bancária (expediente)', tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem: 70 },
  { campo: 'taxa_pix', rotulo: 'Taxa PIX', tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem: 80 },
];
const TODOS = ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'];
const CONFIG: ConfigRetencoes = {
  campos: CAMPOS,
  regras: { '3.3.90.36': TODOS, '3.3.90.33': TODOS },
  versao: '2026-01-01T00:00:00.000Z',
};

const linhaVazia = (over: Record<string, unknown> = {}) => ({
  valorPagamento: '',
  cpfCnpj: '',
  dataPagamento: '',
  irrf: '', iss: '', inss: '', patronal: '', sestSenat: '', outrosDescontos: '', taxaBancaria: '', taxaPix: '',
  camposInformados: [],
  previaAvisos: [],
  credorMei: false,
  sobrescreverMei: false,
  ...over,
});

function renderLinhas(defaultValues: Record<string, unknown>, perfil = 'GESTOR') {
  const ref: { methods?: UseFormReturn<any> } = {};
  function Wrapper() {
    const methods = useForm<any>({ defaultValues });
    ref.methods = methods;
    return (
      <FormProvider {...methods}>
        <section data-testid="linha-0">
          <OpTaxesSection userRole={perfil} config={CONFIG} erroConfig={null} basePath="credores.0" />
        </section>
        <section data-testid="linha-1">
          <OpTaxesSection userRole={perfil} config={CONFIG} erroConfig={null} basePath="credores.1" />
        </section>
      </FormProvider>
    );
  }
  render(<Wrapper />);
  return () => ref.methods!;
}

const linha = (i: number) => within(screen.getByTestId(`linha-${i}`));
const liquido = (i: number) => linha(i).getByTestId('resumo-liquido').textContent;
const input = (i: number, rotulo: string) => linha(i).getByLabelText(rotulo) as HTMLInputElement;

describe('OpTaxesSection com basePath (T35-A)', () => {
  beforeEach(() => vi.clearAllMocks());

  test('cálculo local por linha: cada credor com o seu valor, sem tocar na raiz', async () => {
    const form = renderLinhas({
      elemento: '3.3.90.36 - Serviços',
      credores: [linhaVazia({ valorPagamento: '1.000,00' }), linhaVazia({ valorPagamento: '200,00' })],
    });
    await waitFor(() => expect(liquido(0)).toBe('R$ 600,00'));
    await waitFor(() => expect(liquido(1)).toBe('R$ 120,00'));
    expect(form().getValues('credores.0.irrf')).toBe('15,00');
    expect(form().getValues('credores.1.irrf')).toBe('3,00');
    expect(form().getValues('irrf')).toBeUndefined();
    expect(input(0, 'IRRF (1,5%)').value).toBe('15,00');
    expect(input(1, 'IRRF (1,5%)').value).toBe('3,00');
  });

  test('ids únicos por linha e campo digitado marca camposInformados só daquela linha', async () => {
    const form = renderLinhas({
      elemento: '3.3.90.36 - Serviços',
      credores: [linhaVazia({ valorPagamento: '665,00' }), linhaVazia({ valorPagamento: '665,00' })],
    });
    await waitFor(() => expect(liquido(1)).toBe('R$ 398,99'));
    const taxa0 = input(0, 'Taxa bancária (expediente)');
    const taxa1 = input(1, 'Taxa bancária (expediente)');
    expect(taxa0.id).not.toBe(taxa1.id);
    expect(taxa1.id).toBe('op-retencao-taxa_bancaria-credores-1');

    fireEvent.change(taxa1, { target: { value: '850' } });
    expect(taxa1.value).toBe('8,50');
    await waitFor(() => expect(liquido(1)).toBe('R$ 390,49'));
    expect(liquido(0)).toBe('R$ 398,99');
    expect(form().getValues('credores.1.camposInformados')).toEqual(['taxa_bancaria']);
    expect(form().getValues('credores.0.camposInformados')).toEqual([]);
    expect(form().getValues('camposInformados')).toBeUndefined();
  });

  test('3.3.90.33: a prévia usa credor, valor e data da linha, e NE e emissão da raiz', async () => {
    (apiClient.post as any).mockResolvedValue({ itens: { irrf: 10 }, avisos: [] });
    const form = renderLinhas({
      elemento: '3.3.90.33 - Transporte',
      empenho: '2026NE000001',
      dataEmissao: '2026-10-13',
      credores: [
        linhaVazia({ valorPagamento: '500,00', cpfCnpj: '111.111.111-11', dataPagamento: '2026-10-20' }),
        linhaVazia(),
      ],
    });
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    expect(apiClient.post).toHaveBeenCalledWith('/api/ordens-pagamento/previa', {
      numeroEmpenho: '2026NE000001',
      credorCpfCnpj: '111.111.111-11',
      valorPagamento: 500,
      dataPagamento: '2026-10-20',
      dataEmissao: '2026-10-13',
    });
    await waitFor(() => expect(form().getValues('credores.0.irrf')).toBe('10,00'));
    // a linha 1, sem credor, só recebe o aviso
    expect(form().getValues('credores.1.previaAvisos')).toEqual(['Escolha o credor para calcular o transporte.']);
    expect(form().getValues('previaAvisos')).toBeUndefined();
  });

  test('MEI por linha: banner e isenção só no credor MEI', async () => {
    renderLinhas({
      elemento: '3.3.90.36 - Serviços',
      credores: [linhaVazia({ valorPagamento: '1.000,00', credorMei: true }), linhaVazia({ valorPagamento: '1.000,00' })],
    });
    expect(linha(0).getByText('Credor MEI — isento de retenções')).toBeInTheDocument();
    expect(linha(1).queryByText('Credor MEI — isento de retenções')).toBeNull();
    await waitFor(() => expect(liquido(1)).toBe('R$ 600,00'));
    expect(liquido(0)).toBe('R$ 1.000,00');
  });
});

describe('OpItemsTable com basePath (T35-A)', () => {
  test('adiciona item e confirma o valor só na linha', async () => {
    const ref: { methods?: UseFormReturn<any> } = {};
    function Wrapper() {
      const methods = useForm<any>({ defaultValues: { credores: [{ itens: [], valorPagamento: '' }] } });
      ref.methods = methods;
      return (
        <FormProvider {...methods}>
          <OpItemsTable basePath="credores.0" />
        </FormProvider>
      );
    }
    render(<Wrapper />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Item/i }));
    expect(ref.methods!.getValues('credores.0.itens')).toHaveLength(1);
    expect(ref.methods!.getValues('itens')).toBeUndefined();

    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '12000' } });
    expect(ref.methods!.getValues('credores.0.itens.0.valorUnitario')).toBe('120,00');
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Itens/i }));
    await waitFor(() => expect(ref.methods!.getValues('credores.0.valorPagamento')).toBe('120,00'));
    expect(ref.methods!.getValues('valorPagamento')).toBeUndefined();
  });
});

describe('InputValorPagamento (T35-A)', () => {
  function renderValor(basePath?: string) {
    const ref: { methods?: UseFormReturn<any> } = {};
    function Wrapper() {
      const methods = useForm<any>({ defaultValues: { saldoAnterior: 100, credores: [{}, { valorPagamento: '' }] } });
      ref.methods = methods;
      return (
        <FormProvider {...methods}>
          <InputValorPagamento register={methods.register} control={methods.control} setValue={methods.setValue} errors={{}} basePath={basePath} />
        </FormProvider>
      );
    }
    render(<Wrapper />);
    return () => ref.methods!;
  }

  test('sem basePath: id e campo de sempre', () => {
    const form = renderValor();
    const campo = screen.getByLabelText('Valor a Pagar R$') as HTMLInputElement;
    expect(campo.id).toBe('op-valor-pagamento');
    fireEvent.change(campo, { target: { value: '5000' } });
    expect(form().getValues('valorPagamento')).toBe('50,00');
  });

  test('com basePath: grava na linha e acusa quando passa do saldo da NE (raiz)', () => {
    const form = renderValor('credores.1');
    const campo = screen.getByLabelText('Valor a Pagar R$') as HTMLInputElement;
    expect(campo.id).toBe('op-valor-pagamento-credores-1');
    fireEvent.change(campo, { target: { value: '15000' } });
    expect(campo.value).toBe('150,00');
    expect(form().getValues('credores.1.valorPagamento')).toBe('150,00');
    expect(form().getValues('valorPagamento')).toBeUndefined();
    expect(campo.className).toContain('border-red-400');
  });
});
