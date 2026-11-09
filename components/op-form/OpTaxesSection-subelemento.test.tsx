// B7a — a prévia da tela segue a regra própria do subelemento, como o servidor.
// B8 — o 3.3.90.36 é pessoa física: a tela pede a prévia ao servidor. Aqui a
// "resposta do servidor" é o motor real (lib/retencoes.ts) com os parâmetros
// de 2026, lendo o subelemento "da NE" — o mesmo caminho do salvar.
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { useForm, FormProvider, type UseFormReturn } from 'react-hook-form';
import OpTaxesSection from './OpTaxesSection';
import type { ConfigRetencoes, ConfigRetencaoCampo } from '@/hooks/use-retencoes-config';

vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));
import { apiClient } from '@/lib/api-client';
import { calcularRetencoes } from '@/lib/retencoes';
import { extrairCodigoElemento } from '@/lib/elementos';
import { FAIXAS_IRRF_2026, PARAMETROS_PF_2026 } from '../../tests/fixtures/pessoa-fisica-2026';

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

/** O que o servidor lê da NE (o subelemento gravado nela) e a config salva. */
const ne = { subelemento: '', config: CONFIG };

beforeEach(() => {
  vi.clearAllMocks();
  (apiClient.post as any).mockImplementation(async (url: string, body: any) => {
    expect(url).toBe('/api/ordens-pagamento/previa');
    const r = calcularRetencoes({
      brutoCents: Math.round(body.valorPagamento * 100),
      elementoCodigo: '3.3.90.36',
      subelementoCodigo: extrairCodigoElemento(ne.subelemento),
      config: ne.config.campos,
      regras: ne.config.regras,
      regrasSubelemento: ne.config.regrasSubelemento,
      informados: {},
      perfil: 'ADMIN',
      pessoaFisica: { parametros: PARAMETROS_PF_2026, faixas: FAIXAS_IRRF_2026, vigencia: '2026-01-01' },
    });
    return { itens: Object.fromEntries(Object.entries(r.itens).map(([c, v]) => [c, v / 100])), avisos: r.avisos };
  });
});

function renderSecao(subelemento: string, config: ConfigRetencoes = CONFIG, valorPagamento = '1.000,00') {
  ne.subelemento = subelemento;
  ne.config = config;
  const ref: { methods?: UseFormReturn<any> } = {};
  function Wrapper() {
    const methods = useForm<any>({
      defaultValues: {
        valorPagamento, elemento: '3.3.90.36 - Serviços PF', subelemento, empenho: '2026NE000001', cpfCnpj: '111.111.111-11',
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
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    for (const rotulo of ['IRRF (tabela progressiva)', 'ISS (5%)', 'INSS (11%)', 'Patronal (20%)', 'SEST/SENAT (2,5%)']) {
      expect(input(rotulo).disabled).toBe(true);
      expect(['', '0,00']).toContain(input(rotulo).value);
    }
    expect(screen.getAllByText('Não se aplica a 3.3.90.36.08').length).toBe(5);
    expect(screen.getByText(/Subelemento 3\.3\.90\.36\.08: sem retenções/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cálculo da pessoa física' })).toBeInTheDocument();
    expect(input('Taxa PIX').disabled).toBe(false);
  });

  test('sem subelemento: as 5 retenções do elemento, com o IRRF da pessoa física', async () => {
    renderSecao('');
    // B8: R$ 1.000,00 é isento de IRRF; INSS 110, ISS 50, SEST/SENAT 25.
    await waitFor(() => expect(liquido()).toBe('R$ 815,00'));
    expect(input('INSS (11%)').value).toBe('110,00');
    expect(['', '0,00']).toContain(input('IRRF (tabela progressiva)').value);
    expect(screen.getByText(/configuração do elemento 3\.3\.90\.36/)).toBeInTheDocument();
    expect(screen.getByText(/IRRF pela tabela progressiva vigente/)).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/ordens-pagamento/previa',
      expect.objectContaining({ numeroEmpenho: '2026NE000001', credorCpfCnpj: '111.111.111-11', valorPagamento: 1000 })
    );
  });

  test('regra parcial e troca de subelemento recalculam', async () => {
    const methods = renderSecao('3.3.90.36.08 - Estagiários', { ...CONFIG, regrasSubelemento: { '3.3.90.36.08': ['irrf'] } }, '5.200,00');
    // Sem INSS retido, a dedução do IR é o desconto simplificado (607,20): IRRF 71,62.
    await waitFor(() => expect(liquido()).toBe('R$ 5.128,38'));
    expect(input('IRRF (tabela progressiva)').value).toBe('71,62');
    expect(screen.getByText(/regra própria do subelemento 3\.3\.90\.36\.08/)).toBeInTheDocument();
    ne.subelemento = '';
    act(() => methods().setValue('subelemento', ''));
    // 5.200 − INSS 572 − IRRF 71,62 − ISS 260 − SEST/SENAT 130 (patronal fora do total).
    await waitFor(() => expect(liquido()).toBe('R$ 4.166,38'));
    expect(input('INSS (11%)').value).toBe('572,00');
    expect(input('IRRF (tabela progressiva)').value).toBe('71,62');
  });

  test('config antiga, sem regrasSubelemento (servidor sem a migration): segue o elemento', async () => {
    const { regrasSubelemento: _sem, ...antiga } = CONFIG;
    renderSecao('3.3.90.36.08 - Estagiários', antiga);
    await waitFor(() => expect(liquido()).toBe('R$ 815,00'));
  });
});
