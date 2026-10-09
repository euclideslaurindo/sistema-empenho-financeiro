import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { useForm, FormProvider, type UseFormReturn } from 'react-hook-form';
import OpTaxesSection from './OpTaxesSection';
import type { ConfigRetencoes, ConfigRetencaoCampo } from '@/hooks/use-retencoes-config';

vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));
import { apiClient } from '@/lib/api-client';

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
    '3.3.90.33': TODOS,
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

describe('OpTaxesSection — transporte autônomo (3.3.90.33, T25)', () => {
  beforeEach(() => vi.clearAllMocks());

  function renderTransporte(over: Record<string, unknown> = {}) {
    const ref: { methods?: UseFormReturn<any> } = {};
    function Wrapper() {
      const methods = useForm<any>({
        defaultValues: {
          valorPagamento: '11.970,00',
          elemento: '3.3.90.33 - Serviços de transporte',
          empenho: '2026NE000001',
          cpfCnpj: '111.111.111-11',
          dataPagamento: '2026-10-15',
          dataEmissao: '',
          irrf: '', iss: '', inss: '', patronal: '', sestSenat: '', outrosDescontos: '', taxaBancaria: '', taxaPix: '',
          camposInformados: [],
          previaAvisos: [],
          ...over,
        },
      });
      ref.methods = methods;
      return (
        <FormProvider {...methods}>
          <OpTaxesSection userRole="GESTOR" config={CONFIG} erroConfig={null} />
        </FormProvider>
      );
    }
    render(<Wrapper />);
    return () => ref.methods!;
  }

  const PREVIA_G = {
    perfil: 'TRANSPORTE_AUTONOMO',
    itens: { irrf: 899.34, iss: 598.5, inss: 263.34, patronal: 478.8, sest_senat: 59.85, outros: 0, taxa_bancaria: 0, taxa_pix: 0 },
    totalDescontos: 1821.03,
    valorLiquido: 10148.97,
    avisos: [],
    informativos: ['patronal'],
  };

  test('pede a prévia ao servidor e preenche os campos; patronal não entra no total', async () => {
    (apiClient.post as any).mockResolvedValue(PREVIA_G);
    renderTransporte();
    await waitFor(() => expect(liquido()).toBe('R$ 10.148,97'));
    expect(apiClient.post).toHaveBeenCalledWith('/api/ordens-pagamento/previa', expect.objectContaining({
      numeroEmpenho: '2026NE000001', credorCpfCnpj: '111.111.111-11', valorPagamento: 11970, dataPagamento: '2026-10-15',
    }));
    expect(input('IRRF').value).toBe('899,34');
    expect(input('Patronal (informativa)').value).toBe('478,80');
    expect(input('SEST/SENAT').value).toBe('59,85');
    expect(descontos()).toBe('- R$ 1.821,03'); // sem os 478,80 da patronal
    expect(screen.queryByLabelText(/\(1,5%\)/)).toBeNull(); // rótulos sem %
  });

  test('sem credor: não chama a prévia e avisa', async () => {
    renderTransporte({ cpfCnpj: '' });
    expect(await screen.findByText('Escolha o credor para calcular o transporte.')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  test('avisos e erros da prévia aparecem na seção', async () => {
    (apiClient.post as any).mockResolvedValueOnce({ ...PREVIA_G, avisos: ['Município sem cadastro de ISS: usada a alíquota padrão (5%) sem taxa de expediente.'] });
    renderTransporte();
    expect(await screen.findByText(/Município sem cadastro de ISS/)).toBeInTheDocument();
  });

  test('erro 422 de vigência aparece como aviso e limpa os campos', async () => {
    (apiClient.post as any).mockRejectedValueOnce(new Error('Parâmetros de cálculo do transporte não cadastrados para a data 15/10/2026.'));
    renderTransporte();
    expect(await screen.findByText(/não cadastrados para a data/)).toBeInTheDocument();
    expect(input('IRRF').value).toBe('');
  });

  test('elemento padrão não chama a prévia (continua calculando no navegador)', async () => {
    renderTransporte({ elemento: '3.3.90.36 - Outros', valorPagamento: '1.000,00' });
    await waitFor(() => expect(liquido()).toBe('R$ 600,00'));
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});

describe('OpTaxesSection — credor MEI (T26)', () => {
  function renderMei(perfil = 'GESTOR', over: Record<string, unknown> = {}) {
    const ref: { methods?: UseFormReturn<any> } = {};
    function Wrapper() {
      const methods = useForm<any>({
        defaultValues: {
          valorPagamento: '1.000,00',
          elemento: '3.3.90.36 - Serviços',
          irrf: '', iss: '', inss: '', patronal: '', sestSenat: '', outrosDescontos: '', taxaBancaria: '', taxaPix: '',
          camposInformados: [],
          credorMei: true,
          sobrescreverMei: false,
          ...over,
        },
      });
      ref.methods = methods;
      return (
        <FormProvider {...methods}>
          <OpTaxesSection userRole={perfil} config={CONFIG} erroConfig={null} />
        </FormProvider>
      );
    }
    render(<Wrapper />);
    return () => ref.methods!;
  }

  test('banner, tributários zerados e travados, taxa bancária continua valendo', async () => {
    renderMei();
    expect(screen.getByText('Credor MEI — isento de retenções')).toBeInTheDocument();
    await waitFor(() => expect(liquido()).toBe('R$ 1.000,00'));
    for (const r of ['IRRF (1,5%)', 'ISS (5%)', 'INSS (11%)', 'Patronal (20%)', 'SEST/SENAT (2,5%)']) {
      expect(input(r).disabled).toBe(true);
      expect(input(r).value).toBe('');
    }
    expect(screen.getAllByText('Isento (MEI)')).toHaveLength(5);
    const taxa = input('Taxa bancária (expediente)');
    expect(taxa.disabled).toBe(false);
    fireEvent.change(taxa, { target: { value: '850' } });
    await waitFor(() => expect(liquido()).toBe('R$ 991,50'));
  });

  test('GESTOR não vê a opção de sobrescrever', () => {
    renderMei('GESTOR');
    expect(screen.queryByRole('button', { name: /Aplicar retenção mesmo assim/ })).toBeNull();
  });

  test('ADMIN confirma e passa a digitar manualmente (sem cálculo automático)', async () => {
    const methods = renderMei('ADMIN');
    fireEvent.click(screen.getByRole('button', { name: /Aplicar retenção mesmo assim/ }));
    const alerta = await screen.findByRole('alertdialog');
    fireEvent.click(within(alerta).getByRole('button', { name: 'Liberar retenção manual' }));
    await waitFor(() => expect(methods().getValues('sobrescreverMei')).toBe(true));

    const inss = input('INSS (11%)');
    expect(inss.disabled).toBe(false);
    expect(input('IRRF (1,5%)').value).toBe(''); // nada calculado sozinho
    fireEvent.change(inss, { target: { value: '11000' } });
    await waitFor(() => expect(liquido()).toBe('R$ 890,00'));
    expect(screen.getByText(/Retenção manual liberada/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Voltar à isenção' }));
    await waitFor(() => expect(liquido()).toBe('R$ 1.000,00'));
    expect(methods().getValues('camposInformados')).toEqual([]);
  });
});
