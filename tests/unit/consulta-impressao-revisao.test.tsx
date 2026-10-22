import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';

// Revisão da aba 5 (Consulta / Impressão): cheque inventado (I1), datas da via
// (I2, I3), edição no lote (I4), total dos itens (I5), botões (I6, I7),
// janela "Consultar NE" (I8) e valor por extenso (I9).

let params = new URLSearchParams();
vi.mock('next/navigation', () => ({ useSearchParams: () => params, useRouter: () => ({ push: vi.fn() }), usePathname: () => '/consulta-impressao' }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import ConsultaImpressao from '@/app/consulta-impressao/page';
import { datasDaVia, dataNaVia, itensParaImpressao } from '@/lib/impressao-op';
import { numeroPorExtenso } from '@/lib/utils';

const OP = (id: string, nome: string, cheque: string | null, extra: Record<string, unknown> = {}) => ({
  id, numeroEmpenho: '2026.OP.0012', sub: id === 'a' ? '01' : '02', credorNome: nome, credorCpfCnpj: '111',
  valorPagamento: '15.50', valorLiquido: '15.50', totalDescontos: '0.00', valorEmpenho: '100.00', saldoAnterior: '100.00',
  numeroCheque: cheque, dataEmissao: '2026-10-20', dataPagamento: '2026-10-25',
  itensJson: [{ especificacao: 'TESTE item', quantidade: 1.5, unidade: 'UN', valorUnitario: 10.33 }],
  ...extra,
});
const NE = { numero: '2026NE000001', valor: '100.00', historico: 'TESTE obs', gestao: '140101', dataProvisaoConcedida: '2026-02-01' };

function rotear(ops = [OP('a', 'TESTE Ana', null), OP('b', 'TESTE Bruno', '777')]) {
  (apiClient.get as any).mockImplementation(async (url: string) => {
    if (url.startsWith('/api/ordens-pagamento')) return { ordens: ops };
    if (url.startsWith('/api/notas-empenho?numero=')) return { ne: NE };
    if (url.startsWith('/api/notas-empenho')) return { notas: [] };
    return {};
  });
}

const gerarIndividual = async (container: HTMLElement) => {
  await screen.findByText(/OPs encontradas/);
  fireEvent.click(screen.getByRole('button', { name: /GERAR DOCUMENTO\(S\) SELECIONADO\(S\)/ }));
  await waitFor(() => expect(container.querySelector('#doc-0-frente')).not.toBeNull(), { timeout: 3000 });
  fireEvent.click(await screen.findByText('Modo Leitura'));
};
const texto = (container: HTMLElement, id: string) => container.querySelector(id)!.textContent || '';

describe('Consulta / Impressão — revisão da aba 5', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams('ne=2026NE000001');
    rotear();
  });

  test('I1: OP sem cheque sai com o número em branco; com cheque, o número dela', async () => {
    const { container } = render(<ConsultaImpressao />);
    await gerarIndividual(container);
    expect(texto(container, '#doc-0-verso')).not.toMatch(/04049\d/);
    expect(texto(container, '#doc-0-frente')).not.toMatch(/04049\d/);
    expect(texto(container, '#doc-1-verso')).toContain('777');
  });

  test('I2 e I3: data do pagamento da OP em "PAGO — DATA" e Data de Provisão da NE', async () => {
    const { container } = render(<ConsultaImpressao />);
    await gerarIndividual(container);
    const frente = texto(container, '#doc-0-frente');
    expect(frente).toContain('25/10/2026'); // pagamento da OP
    expect(frente).toContain('01/02/2026'); // provisão da NE
    expect(frente).not.toContain('20/10/2026'); // emissão da OP não vai para a provisão
  });

  test('I5: total do item em centavos, com 2 casas', async () => {
    const { container } = render(<ConsultaImpressao />);
    await gerarIndividual(container);
    const frente = texto(container, '#doc-0-frente');
    expect(frente).not.toContain('15,495');
    expect(frente).toContain('15,50');
    expect(frente).toContain('1,5');
  });

  test('I4: no lote, editar o nome no 1º documento não muda os outros', async () => {
    params = new URLSearchParams();
    const { container } = render(<ConsultaImpressao />);
    fireEvent.mouseDown(screen.getByText('Impressão em Lote'));
    fireEvent.click(screen.getByText('Impressão em Lote'));
    fireEvent.change(await screen.findByPlaceholderText('Ex: 2026NE000123'), { target: { value: '2026NE000001' } });
    fireEvent.click(screen.getByText('BUSCAR PARCELAS'));
    fireEvent.click(await screen.findByText(/GERAR LOTE/));
    await waitFor(() => expect(container.querySelector('#doc-1-verso')).not.toBeNull(), { timeout: 3000 });
    const nome = Array.from(container.querySelectorAll('#doc-0-frente input')).find((i: any) => i.value === 'TESTE Ana') as HTMLInputElement;
    fireEvent.change(nome, { target: { value: 'TESTE Ana Corrigida' } });
    const doc1 = Array.from(container.querySelectorAll('#doc-1-frente input')).map((i: any) => i.value);
    expect(doc1).toContain('TESTE Bruno');
    expect(doc1).not.toContain('TESTE Ana Corrigida');
    // cheque: o 1º documento (OP sem cheque) ganha um número; o 2º continua com o dele (antes virava sequência)
    const chequeDoc0 = container.querySelector('#doc-0-verso input') as HTMLInputElement;
    expect(chequeDoc0.value).toBe('');
    fireEvent.change(chequeDoc0, { target: { value: '500' } });
    expect((container.querySelector('#doc-1-verso input') as HTMLInputElement).value).toBe('777');
  });

  test('I6: um botão só, "Imprimir / Salvar PDF", que abre a impressão', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { container } = render(<ConsultaImpressao />);
    await gerarIndividual(container);
    expect(screen.queryByRole('button', { name: /BAIXAR PDF/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /IMPRIMIR \/ SALVAR PDF/ }));
    expect(imprimir).toHaveBeenCalledTimes(1);
  });

  test('I7: "Gerar Documento em Branco" com OPs marcadas gera só o documento em branco', async () => {
    const { container } = render(<ConsultaImpressao />);
    await screen.findByText(/OPs encontradas/);
    fireEvent.click(screen.getByRole('button', { name: /Gerar Documento em Branco/ }));
    await waitFor(() => expect(container.querySelector('#doc-0-frente')).not.toBeNull(), { timeout: 3000 });
    expect(container.querySelector('#doc-1-frente')).toBeNull();
    fireEvent.click(await screen.findByText('Modo Leitura'));
    const doc = texto(container, '#doc-0-frente') + texto(container, '#doc-0-verso');
    expect(doc).not.toContain('TESTE Ana');
    expect(doc).not.toMatch(/04049\d/);
    expect(doc).toContain('01/02/2026');
  });

  test('gerar sem OP marcada avisa e não gera', async () => {
    const { container } = render(<ConsultaImpressao />);
    await screen.findByText(/OPs encontradas/);
    fireEvent.click(screen.getByText('Desmarcar Todos'));
    fireEvent.click(screen.getByRole('button', { name: /GERAR DOCUMENTO\(S\) SELECIONADO\(S\)/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Marque ao menos uma OP, ou use "Gerar Documento em Branco".'));
    expect(container.querySelector('#doc-0-frente')).toBeNull();
  });

  describe('I8: janela "Consultar NE"', () => {
    test('pesquisa pelo número, sem "Credor: -"; sem resultado diz "Nenhuma NE encontrada"', async () => {
      params = new URLSearchParams();
      (apiClient.get as any).mockImplementation(async (url: string) => (url.startsWith('/api/notas-empenho') ? { notas: [] } : {}));
      render(<ConsultaImpressao />);
      fireEvent.click(screen.getByRole('button', { name: 'Consultar NE cadastrada' }));
      const dialogo = await screen.findByRole('dialog');
      expect(within(dialogo).getByPlaceholderText('Pesquisar pelo número da NE...')).toBeInTheDocument();
      expect(await within(dialogo).findByText('Nenhuma NE encontrada.')).toBeInTheDocument();
      expect(within(dialogo).queryByText(/Carregando/)).toBeNull();
    });

    test('lista as NEs sem as linhas vazias; resposta antiga não sobrescreve a nova', async () => {
      params = new URLSearchParams();
      let soltarAntiga: (v: any) => void = () => {};
      (apiClient.get as any).mockImplementation((url: string) => {
        if (url === '/api/notas-empenho') return Promise.resolve({ notas: [{ numero: '2026NE000001', valor: '1234.5', historico: 'TESTE' }] });
        if (url === '/api/notas-empenho?busca=1') return new Promise((r) => { soltarAntiga = r; });
        if (url === '/api/notas-empenho?busca=12') return Promise.resolve({ notas: [{ numero: '2026NE000012', valor: '10', historico: '' }] });
        return Promise.resolve({});
      });
      render(<ConsultaImpressao />);
      fireEvent.click(screen.getByRole('button', { name: 'Consultar NE cadastrada' }));
      const dialogo = await screen.findByRole('dialog');
      expect(await within(dialogo).findByText('NE: 2026NE000001')).toBeInTheDocument();
      expect(within(dialogo).getByText('R$ 1.234,50')).toBeInTheDocument();
      expect(within(dialogo).queryByText(/Credor:/)).toBeNull();
      expect(within(dialogo).queryByText(/Empenho:/)).toBeNull();

      const busca = within(dialogo).getByPlaceholderText('Pesquisar pelo número da NE...');
      fireEvent.change(busca, { target: { value: '1' } });
      await waitFor(() => expect((apiClient.get as any).mock.calls.some(([u]: any[]) => u === '/api/notas-empenho?busca=1')).toBe(true));
      fireEvent.change(busca, { target: { value: '12' } });
      expect(await within(dialogo).findByText('NE: 2026NE000012')).toBeInTheDocument();
      await act(async () => soltarAntiga({ notas: [{ numero: 'NE VELHA', valor: '1' }] }));
      expect(within(dialogo).queryByText('NE: NE VELHA')).toBeNull();
    });
  });
});

describe('regras da via (lib/impressao-op)', () => {
  test('I5: itensParaImpressao arredonda cada item em centavos', () => {
    const r = itensParaImpressao([
      { especificacao: 'A', quantidade: 1.5, unidade: 'UN', valorUnitario: 10.33 },
      { especificacao: 'B', quantidade: 3, unidade: 'KG', valorUnitario: '0.1' },
    ]);
    expect(r.valorTotal).toBe('15,50\n0,30');
    expect(r.valorUnitario).toBe('10,33\n0,10');
    expect(r.quantidade).toBe('1,5\n3');
    expect(itensParaImpressao('[{"especificacao":"X","quantidade":2,"valorUnitario":1.005}]').valorTotal).toBe('2,02');
    expect(itensParaImpressao('não é json').especificacao).toBe('');
  });

  test('I2/I3: datasDaVia usa o pagamento da OP e a provisão da NE; sem data, vazio (não "-")', () => {
    expect(datasDaVia({ dataPagamento: '2026-10-25' }, { dataProvisaoConcedida: '2026-02-01' })).toEqual({
      provisaoData: '01/02/2026', pagoData: '25/10/2026', deduzidoData: '25/10/2026', liquidadoData: '25/10/2026', pagamentoData: '25/10/2026',
    });
    expect(datasDaVia({ dataPagamento: null }, null)).toEqual({ provisaoData: '', pagoData: '', deduzidoData: '', liquidadoData: '', pagamentoData: '' });
    expect(dataNaVia('2026-10-25T03:00:00.000Z')).toBe('25/10/2026');
  });

  test.each([
    [0, 'zero real'],
    [1000000, 'um milhão de reais'],
    [2000000, 'dois milhões de reais'],
    [1000000.5, 'um milhão de reais e cinquenta centavos'],
    [1500000, 'um milhão quinhentos mil reais'],
    [19.99, 'dezenove reais e noventa e nove centavos'],
    [0.1 + 0.2, 'trinta centavos'],
    [1, 'um real'],
  ])('I9: numeroPorExtenso(%d) = "%s"', (valor: number, esperado: string) => {
    expect(numeroPorExtenso(valor)).toBe(esperado);
  });
});
