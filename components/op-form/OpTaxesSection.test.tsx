import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { useForm, FormProvider, type UseFormReturn } from 'react-hook-form';
import OpTaxesSection from './OpTaxesSection';
import type { ConfigRetencoes, ConfigRetencaoCampo } from '@/hooks/use-retencoes-config';

// Igual à seed real da T03 (database/migration_12.sql). Motor, máscara e
// formatação são os reais — nada mockado — pra o teste valer como paridade
// com o servidor.
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
const SEM_ISS = ['irrf', 'inss', 'patronal', 'sest_senat'];

const CONFIG: ConfigRetencoes = {
  campos: CAMPOS,
  regras: {
    '3.3.90.14': [],
    '3.3.90.30': SEM_ISS,
    '3.3.90.36': TODOS,
    '3.3.90.39': TODOS,
  },
  versao: '2026-01-01T00:00:00.000Z',
};

function comCampo(campo: string, mudancas: Partial<ConfigRetencaoCampo>): ConfigRetencoes {
  return { ...CONFIG, campos: CAMPOS.map((c) => (c.campo === campo ? { ...c, ...mudancas } : c)) };
}

function renderSecao({
  perfil = 'GESTOR',
  config = CONFIG,
  elemento = '3.3.90.36 - Serviços de terceiros PF',
  valorPagamento = '1.000,00',
}: { perfil?: string; config?: ConfigRetencoes | null; elemento?: string; valorPagamento?: string } = {}) {
  const ref: { methods?: UseFormReturn<any> } = {};
  function Wrapper() {
    const methods = useForm<any>({
      defaultValues: {
        valorPagamento,
        elemento,
        irrf: '', iss: '', inss: '', patronal: '', sestSenat: '', outrosDescontos: '', taxaBancaria: '', taxaPix: '',
        camposInformados: [],
      },
    });
    ref.methods = methods;
    return (
      <FormProvider {...methods}>
        <OpTaxesSection userRole={perfil} config={config} erroConfig={null} />
      </FormProvider>
    );
  }
  render(<Wrapper />);
  return () => ref.methods!;
}

const input = (rotulo: string | RegExp) => screen.getByLabelText(rotulo) as HTMLInputElement;
const liquido = () => screen.getByTestId('resumo-liquido').textContent;
const descontos = () => screen.getByTestId('resumo-descontos').textContent;

describe('OpTaxesSection — casos do README (paridade com o servidor)', () => {
  test('Caso A: 1.000,00 no .36 -> líquido 600,00', async () => {
    renderSecao();
    await waitFor(() => expect(liquido()).toBe('R$ 600,00'));
    expect(input('IRRF (1,5%)').value).toBe('15,00');
    expect(input('ISS (5%)').value).toBe('50,00');
    expect(input('INSS (11%)').value).toBe('110,00');
    expect(input('Patronal (20%)').value).toBe('200,00');
    expect(input('SEST/SENAT (2,5%)').value).toBe('25,00');
    expect(descontos()).toBe('- R$ 400,00');
  });

  test('Caso B: 665,00 no .36 -> arredondamento do 3º decimal, líquido 398,99', async () => {
    renderSecao({ valorPagamento: '665,00' });
    await waitFor(() => expect(liquido()).toBe('R$ 398,99'));
    expect(input('IRRF (1,5%)').value).toBe('9,98');
    expect(input('SEST/SENAT (2,5%)').value).toBe('16,63');
    expect(descontos()).toBe('- R$ 266,01');
  });

  test('Caso C: 1.000,00 no .30 -> ISS desabilitado e zerado, líquido 650,00', async () => {
    renderSecao({ elemento: '3.3.90.30 - Material de consumo' });
    await waitFor(() => expect(liquido()).toBe('R$ 650,00'));
    const iss = input('ISS (5%)');
    expect(iss.disabled).toBe(true);
    expect(iss.value).toBe('');
    expect(iss.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('Não se aplica a 3.3.90.30')).toBeInTheDocument();
    expect(input('IRRF (1,5%)').value).toBe('15,00');
  });

  test('Caso D: .14 -> todos os impostos desabilitados e zerados, líquido = bruto', async () => {
    renderSecao({ elemento: '3.3.90.14 - Diárias', perfil: 'ADMIN' });
    await waitFor(() => expect(liquido()).toBe('R$ 1.000,00'));
    for (const rotulo of ['IRRF (1,5%)', 'ISS (5%)', 'INSS (11%)', 'Patronal (20%)', 'SEST/SENAT (2,5%)']) {
      expect(input(rotulo).disabled).toBe(true);
      expect(input(rotulo).value).toBe('');
    }
    expect(screen.getAllByText('Não se aplica a 3.3.90.14')).toHaveLength(5);
  });

  test('Caso E: Taxa bancária 8,50 entra no total e reduz o líquido (390,49)', async () => {
    renderSecao({ valorPagamento: '665,00' });
    await waitFor(() => expect(liquido()).toBe('R$ 398,99'));
    fireEvent.change(input('Taxa bancária (expediente)'), { target: { value: '850' } });
    expect(input('Taxa bancária (expediente)').value).toBe('8,50');
    await waitFor(() => expect(liquido()).toBe('R$ 390,49'));
    expect(descontos()).toBe('- R$ 274,51');
  });

  test('Caso F: 11,00 no .36 -> IRRF 0,17', async () => {
    renderSecao({ valorPagamento: '11,00' });
    await waitFor(() => expect(input('IRRF (1,5%)').value).toBe('0,17'));
  });
});

describe('OpTaxesSection — config e permissões', () => {
  test('rótulo mostra a alíquota vigente e o cálculo usa ela', async () => {
    renderSecao({ config: comCampo('irrf', { aliquota: 2 }) });
    await waitFor(() => expect(input('IRRF (2%)').value).toBe('20,00'));
  });

  test('campo inativo não aparece', () => {
    renderSecao({ config: comCampo('taxa_pix', { ativo: false }) });
    expect(screen.queryByLabelText('Taxa PIX')).toBeNull();
  });

  test('GESTOR não edita IRRF automático; Outros também bloqueado; taxas liberadas', () => {
    renderSecao();
    expect(input('IRRF (1,5%)').disabled).toBe(true);
    expect(input('Outros / IBS-CBS').disabled).toBe(true);
    expect(input('Taxa bancária (expediente)').disabled).toBe(false);
    expect(input('Taxa PIX').disabled).toBe(false);
  });

  test('GESTOR edita IRRF quando o admin marca editavelOperador, e o valor digitado não é sobrescrito', async () => {
    const methods = renderSecao({ config: comCampo('irrf', { editavelOperador: true }) });
    await waitFor(() => expect(liquido()).toBe('R$ 600,00'));
    const irrf = input('IRRF (1,5%)');
    expect(irrf.disabled).toBe(false);
    fireEvent.change(irrf, { target: { value: '1000' } });
    await waitFor(() => expect(liquido()).toBe('R$ 605,00'));
    expect(irrf.value).toBe('10,00');
    expect(methods().getValues('camposInformados')).toEqual(['irrf']);
  });

  test('ADMIN edita qualquer campo aplicável', () => {
    renderSecao({ perfil: 'ADMIN' });
    expect(input('IRRF (1,5%)').disabled).toBe(false);
    expect(input('Outros / IBS-CBS').disabled).toBe(false);
  });

  test('imposto não automático aplicável: editável por GESTOR e marcado como obrigatório', async () => {
    renderSecao({ config: comCampo('iss', { tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false }) });
    const iss = input('ISS');
    expect(iss.disabled).toBe(false);
    expect(iss.placeholder).toBe('Informe o valor');
    fireEvent.change(iss, { target: { value: '0' } });
    expect(iss.value).toBe('0,00'); // zero explícito precisa ser possível
  });

  test('elemento sem regra cadastrada: aviso e nenhum imposto calculado', async () => {
    renderSecao({ elemento: '9.9.99.99 - Inexistente' });
    expect(screen.getByRole('status')).toHaveTextContent(/não cadastrado/i);
    await waitFor(() => expect(liquido()).toBe('R$ 1.000,00'));
    expect(input('IRRF (1,5%)').disabled).toBe(true);
  });

  test('sem config carregada: mostra aviso e nenhum input de retenção', () => {
    renderSecao({ config: null });
    expect(screen.getByText(/Carregando configuração/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/IRRF/)).toBeNull();
  });
});

describe('OpTaxesSection — camposInformados (contrato com o servidor da T10)', () => {
  test('digitar inclui o campo; apagar remove', () => {
    const methods = renderSecao();
    fireEvent.change(input('Taxa PIX'), { target: { value: '250' } });
    expect(methods().getValues('camposInformados')).toEqual(['taxa_pix']);
    fireEvent.change(input('Taxa PIX'), { target: { value: '' } });
    expect(methods().getValues('camposInformados')).toEqual([]);
  });

  test('valores do cálculo automático NÃO entram em camposInformados', async () => {
    const methods = renderSecao();
    await waitFor(() => expect(liquido()).toBe('R$ 600,00'));
    expect(methods().getValues('camposInformados')).toEqual([]);
  });

  test('valor digitado que deixa de ser editável (trocou a NE) volta para o cálculo', async () => {
    const methods = renderSecao({ perfil: 'ADMIN' });
    await waitFor(() => expect(liquido()).toBe('R$ 600,00'));
    fireEvent.change(input('IRRF (1,5%)'), { target: { value: '1000' } });
    await waitFor(() => expect(liquido()).toBe('R$ 605,00'));

    act(() => methods().setValue('elemento', '3.3.90.14 - Diárias'));
    await waitFor(() => expect(liquido()).toBe('R$ 1.000,00'));
    expect(input('IRRF (1,5%)').value).toBe('');
    expect(methods().getValues('camposInformados')).toEqual([]);
  });

  test('descontos maiores que o bruto mostram alerta', async () => {
    renderSecao({ valorPagamento: '10,00', elemento: '3.3.90.14 - Diárias' });
    fireEvent.change(input('Taxa bancária (expediente)'), { target: { value: '2000' } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/maior que o valor a pagar/i);
  });
});
