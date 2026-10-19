import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// T35-B: tela de emissão com lista de credores (uma OP por credor, via lote).

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('@/hooks/use-retencoes-config', () => ({
  useRetencoesConfig: () => ({
    config: {
      campos: [
        { campo: 'irrf', rotulo: 'IRRF', tipo: 'PERCENTUAL', aliquota: 1.5, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem: 10 },
        { campo: 'taxa_bancaria', rotulo: 'Taxa bancária (expediente)', tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem: 70 },
      ],
      regras: { '3.3.90.36': ['irrf'] },
      versao: 'x',
    },
    elementos: [],
    loading: false,
    erro: null,
    recarregar: vi.fn(),
  }),
}));

import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import OrdemPagamento from '@/app/ordem-pagamento/page';

const NE = {
  id: 'ne-1', numero: '2026NE000001', valor: '100.00', status: 'EMITIDO', historico: 'Transporte escolar',
  unidadeOrcamentaria: 'Educação', gestao: '140101', elemento: '3.3.90.36 - Serviços PF', subelemento: 'Locação',
  saldo: { valor: 100, gasto: 10, restante: 90, percentualGasto: 10, qtdOps: 1 },
};
const OUTRA_NE = { ...NE, id: 'ne-2', numero: '2026NE000002' };
const CREDORES = [
  { id: 'c1', cpfCnpj: '111.111.111-11', nome: 'Ana Motorista', isMei: 0, municipioExpediente: 'Canhotinho', rg: '123', endereco: 'Rua A', banco: '001', agencia: '1', contaCorrente: '2', pix: '' },
  { id: 'c2', cpfCnpj: '222.222.222-22', nome: 'Bruno Motorista', isMei: 1, municipioExpediente: null, rg: '456', endereco: 'Rua B' },
  { id: 'c3', cpfCnpj: '333.333.333-33', nome: 'Carla Motorista', isMei: 0, municipioExpediente: null },
];
let saldoRestante = 90;

function rotear() {
  (apiClient.get as any).mockImplementation(async (url: string) => {
    if (url === '/api/perfil') return { usuario: { perfil: 'GESTOR' } };
    if (url.startsWith('/api/ordens-pagamento/proximo-numero')) {
      const n = Number(new URL(url, 'http://x').searchParams.get('quantidade'));
      return { numeros: Array.from({ length: n }, (_, i) => ({ numeroOp: `2026.OP.00${12 + i}`, sub: String(2 + i).padStart(2, '0'), rotulo: `NE 2026NE000001/${String(2 + i).padStart(2, '0')}` })) };
    }
    if (url.startsWith('/api/ordens-pagamento')) return { ordens: [] };
    if (url.startsWith('/api/notas-empenho/saldo')) return { saldo: { valor: 100, gasto: 100 - saldoRestante, restante: saldoRestante, percentualGasto: 0, qtdOps: 1 } };
    if (url.startsWith('/api/notas-empenho?numero=')) {
      const numero = decodeURIComponent(url.split('numero=')[1]);
      return { ne: numero === OUTRA_NE.numero ? OUTRA_NE : NE };
    }
    if (url.startsWith('/api/notas-empenho?busca=')) return { notas: [NE] };
    if (url.startsWith('/api/credores?busca=')) {
      const busca = decodeURIComponent(url.split('busca=')[1].split('&')[0]).toLowerCase();
      return { credores: CREDORES.filter((c) => c.nome.toLowerCase().includes(busca) || c.cpfCnpj.includes(busca)) };
    }
    return {};
  });
}

async function carregarNe(numero = NE.numero) {
  fireEvent.change(screen.getByLabelText('Nota de Empenho (NE)'), { target: { value: numero } });
  fireEvent.click(screen.getByRole('button', { name: 'Carregar a NE' }));
  await screen.findByTestId('faixa-saldo-emissao');
}

async function adicionar(nome: string) {
  const busca = screen.getByLabelText(/Adicionar credor/);
  fireEvent.change(busca, { target: { value: nome.slice(0, 4) } });
  const opcao = await screen.findByRole('option', { name: new RegExp(nome) });
  fireEvent.mouseDown(opcao);
}

const linha = (i: number) => within(screen.getByTestId(`linha-credor-${i}`));
const valor = (i: number, v: string) => fireEvent.change(linha(i).getByLabelText('Valor a Pagar R$'), { target: { value: v } });
const botaoEmitir = () => screen.getByRole('button', { name: /^Emitir/ });

describe('Emissão de OP com lista de credores (T35-B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saldoRestante = 90;
    rotear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  test('sem "Número da OP" nem bloco Favorecido; NE no lugar; dados da NE somente leitura', async () => {
    render(<OrdemPagamento />);
    expect(screen.queryByText('Número da OP')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Favorecido' })).toBeNull(); // a coluna das OPs recentes continua
    expect(screen.queryByLabelText('Nº do Cheque')).toBeNull();
    expect(screen.getByLabelText(/Adicionar credor/)).toBeDisabled();
    await carregarNe();
    expect((screen.getByLabelText('Gestão') as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText('Gestão') as HTMLInputElement).value).toBe('140101');
    expect(screen.getByLabelText(/Adicionar credor/)).not.toBeDisabled();
  });

  test('faixa de saldo: Valor · Já gasto · Nesta emissão · Restante', async () => {
    render(<OrdemPagamento />);
    await carregarNe();
    await adicionar('Ana');
    valor(0, '3000');
    const faixa = within(screen.getByTestId('faixa-saldo-emissao'));
    expect(faixa.getByText('R$ 100,00')).toBeInTheDocument();
    expect(faixa.getByText('R$ 10,00')).toBeInTheDocument();
    expect(faixa.getByText('R$ 30,00')).toBeInTheDocument();
    expect(faixa.getByText('R$ 60,00')).toBeInTheDocument();
  });

  test('linhas com MEI, município de expediente só quando existe, número previsto por posição', async () => {
    render(<OrdemPagamento />);
    await carregarNe();
    await adicionar('Ana');
    await adicionar('Bruno');
    expect(linha(0).getByText(/Município \(Expediente\): Canhotinho/)).toBeInTheDocument();
    expect(linha(1).queryByText(/Município \(Expediente\)/)).toBeNull();
    expect(linha(1).getByText('MEI')).toBeInTheDocument();
    await waitFor(() => expect(linha(1).getByText(/NE 2026NE000001\/03 · 2026\.OP\.0013/)).toBeInTheDocument());

    // remover a 1ª (vazia, sem confirmação): o Bruno passa a ter o 1º número
    fireEvent.click(linha(0).getByRole('button', { name: /Remover Ana/ }));
    await waitFor(() => expect(linha(0).getByText(/NE 2026NE000001\/02 · 2026\.OP\.0012/)).toBeInTheDocument());
    expect(linha(0).getByText('Bruno Motorista')).toBeInTheDocument();
  });

  test('credor repetido não entra de novo', async () => {
    render(<OrdemPagamento />);
    await carregarNe();
    await adicionar('Ana');
    await adicionar('Ana');
    expect(toast.warning).toHaveBeenCalledWith('Ana Motorista já está nesta emissão.');
    expect(screen.queryByTestId('linha-credor-1')).toBeNull();
  });

  test('painel começa fechado com o resumo dos itens e abre ao clicar', async () => {
    render(<OrdemPagamento />);
    await carregarNe();
    await adicionar('Ana');
    const alternar = linha(0).getByRole('button', { name: /Detalhes/ });
    expect(alternar).toHaveAttribute('aria-expanded', 'false');
    expect(alternar).toHaveTextContent('Sem itens — usa as Observações da NE');
    expect(linha(0).queryByText('Dados do cadastro (somente leitura)')).toBeNull();
    fireEvent.click(alternar);
    expect(alternar).toHaveAttribute('aria-expanded', 'true');
    expect(linha(0).getByText('Dados do cadastro (somente leitura)')).toBeInTheDocument();
    expect(linha(0).getByDisplayValue('Transporte escolar')).toBeInTheDocument(); // item padrão = Observações da NE
  });

  test('líquido da linha calculado com o painel fechado', async () => {
    render(<OrdemPagamento />);
    await carregarNe();
    await adicionar('Ana');
    valor(0, '10000');
    await waitFor(() => expect(linha(0).getByTestId('liquido-linha-0')).toHaveTextContent('R$ 98,50'));
  });

  test('soma acima do saldo: Emitir desabilitado e o excesso aparece', async () => {
    render(<OrdemPagamento />);
    await carregarNe();
    await adicionar('Ana');
    await adicionar('Bruno');
    valor(0, '5000');
    valor(1, '5000');
    expect(await screen.findByText('A soma passa do saldo da NE em R$ 10,00')).toBeInTheDocument();
    expect(botaoEmitir()).toBeDisabled();
    valor(1, '4000');
    await waitFor(() => expect(botaoEmitir()).not.toBeDisabled());
  });

  test('cheque repetido: erro nas duas linhas e nada é enviado', async () => {
    render(<OrdemPagamento />);
    await carregarNe();
    await adicionar('Ana');
    await adicionar('Bruno');
    valor(0, '1000');
    valor(1, '1000');
    fireEvent.change(linha(0).getByLabelText('Nº do cheque'), { target: { value: '77' } });
    fireEvent.change(linha(1).getByLabelText('Nº do cheque'), { target: { value: '77' } });
    fireEvent.click(botaoEmitir());
    expect(await linha(0).findByText('O cheque nº "77" está repetido nesta emissão.')).toBeInTheDocument();
    expect(linha(1).getByText('O cheque nº "77" está repetido nesta emissão.')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
    // corrigir o cheque some com o erro daquela linha
    fireEvent.change(linha(1).getByLabelText('Nº do cheque'), { target: { value: '78' } });
    await waitFor(() => expect(linha(1).queryByText(/está repetido/)).toBeNull());
  });

  test('itens diferentes do valor: abre o painel da linha e mostra o erro', async () => {
    render(<OrdemPagamento />);
    await carregarNe();
    await adicionar('Ana');
    valor(0, '3000');
    fireEvent.click(linha(0).getByRole('button', { name: /Detalhes/ }));
    const valorItem = screen.getByTestId('linha-credor-0').querySelector('table input[placeholder="0,00"]') as HTMLInputElement;
    fireEvent.change(valorItem, { target: { value: '2000' } });
    fireEvent.click(linha(0).getByRole('button', { name: /Detalhes/ })); // fecha
    fireEvent.click(botaoEmitir());
    expect(await linha(0).findByText(/A soma dos itens \(R\$ 20,00\) deve ser igual ao valor a pagar/)).toBeInTheDocument();
    expect(linha(0).getByRole('button', { name: /Detalhes/ })).toHaveAttribute('aria-expanded', 'true');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  test('emitir 3 credores: payload na ordem, diálogo com os números e lista limpa mantendo a NE', async () => {
    (apiClient.post as any).mockImplementation(async (_url: string, body: any) => ({
      numeroNe: body.numeroNe,
      ops: body.credores.map((c: any, i: number) => ({
        id: `op-${i}`, numeroOp: `2026.OP.00${12 + i}`, sub: String(2 + i).padStart(2, '0'), credorCpfCnpj: c.credorCpfCnpj,
        credorNome: CREDORES[i].nome, valorPagamento: c.valorPagamento, totalDescontos: 0, valorLiquido: c.valorPagamento,
      })),
      resumo: { quantidade: 3, totalBruto: 60, saldoAnterior: 90, saldoRestante: 30, statusNe: 'PARCIALMENTE PAGO' },
    }));
    render(<OrdemPagamento />);
    await carregarNe();
    await adicionar('Ana');
    await adicionar('Bruno');
    await adicionar('Carla');
    valor(0, '1000');
    valor(1, '2000');
    valor(2, '3000');
    fireEvent.change(linha(0).getByLabelText('Nº do cheque'), { target: { value: '1001' } });
    fireEvent.change(linha(2).getByLabelText('Data do pagamento'), { target: { value: '2026-10-25' } });
    await waitFor(() => expect(botaoEmitir()).toHaveTextContent('Emitir 3 ordens de pagamento'));
    fireEvent.click(botaoEmitir());

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    const [url, payload] = (apiClient.post as any).mock.calls.at(-1);
    expect(url).toBe('/api/ordens-pagamento/lote');
    expect(payload.numeroNe).toBe('2026NE000001');
    expect(payload.credores.map((c: any) => [c.credorCpfCnpj, c.valorPagamento])).toEqual([
      ['111.111.111-11', 10],
      ['222.222.222-22', 20],
      ['333.333.333-33', 30],
    ]);
    expect(payload.credores[0].numeroCheque).toBe('1001');
    expect(payload.credores[2].dataPagamento).toBe('2026-10-25');
    expect(payload.credores[0].itens).toEqual([]); // item padrão sem valor não vai
    expect(payload.credores[0]).not.toHaveProperty('irrf'); // calculado: o servidor decide

    const dialogo = within(await screen.findByRole('dialog'));
    expect(dialogo.getByText('3 ordens de pagamento emitidas')).toBeInTheDocument();
    expect(dialogo.getByText('2026.OP.0013')).toBeInTheDocument();
    expect(dialogo.getByRole('link', { name: /Imprimir/ })).toHaveAttribute('href', '/consulta-impressao?ne=2026NE000001');
    expect(screen.queryByTestId('linha-credor-0')).toBeNull();
    expect((screen.getByLabelText('Nota de Empenho (NE)') as HTMLInputElement).value).toBe('2026NE000001');
    // saldo recarregado depois de emitir
    expect((apiClient.get as any).mock.calls.filter((c: any[]) => String(c[0]).startsWith('/api/notas-empenho/saldo')).length).toBeGreaterThanOrEqual(2);
  });

  test('erro do servidor credores[1]: destaca a linha 2 e nada some da lista', async () => {
    (apiClient.post as any).mockRejectedValue(new Error('credores[1]: credor não encontrado ou inativo.'));
    render(<OrdemPagamento />);
    await carregarNe();
    await adicionar('Ana');
    await adicionar('Bruno');
    valor(0, '1000');
    valor(1, '1000');
    fireEvent.click(botaoEmitir());
    expect(await linha(1).findByRole('alert')).toHaveTextContent('credor não encontrado ou inativo.');
    expect(toast.error).toHaveBeenCalledWith('Credor 2 (Bruno Motorista): credor não encontrado ou inativo.');
    expect(screen.getByTestId('linha-credor-0')).toBeInTheDocument();
  });

  test('erro geral do servidor vai para o aviso', async () => {
    (apiClient.post as any).mockRejectedValue(new Error('Soma das OPs (R$ 90,00) maior que o saldo da NE (R$ 80,00).'));
    render(<OrdemPagamento />);
    await carregarNe();
    await adicionar('Ana');
    valor(0, '1000');
    fireEvent.click(botaoEmitir());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Soma das OPs (R$ 90,00) maior que o saldo da NE (R$ 80,00).'));
  });

  test('trocar de NE com credores na lista pede confirmação e limpa a lista', async () => {
    render(<OrdemPagamento />);
    await carregarNe();
    await adicionar('Ana');
    fireEvent.change(screen.getByLabelText('Nota de Empenho (NE)'), { target: { value: OUTRA_NE.numero } });
    fireEvent.click(screen.getByRole('button', { name: 'Carregar a NE' }));
    const confirmar = await screen.findByRole('alertdialog');
    expect(within(confirmar).getByText(/A lista de credores será limpa/)).toBeInTheDocument();
    fireEvent.click(within(confirmar).getByRole('button', { name: 'Trocar e limpar a lista' }));
    await waitFor(() => expect(screen.queryByTestId('linha-credor-0')).toBeNull());
  });

  test('remover linha preenchida pede confirmação', async () => {
    render(<OrdemPagamento />);
    await carregarNe();
    await adicionar('Ana');
    valor(0, '1000');
    fireEvent.click(linha(0).getByRole('button', { name: /Remover Ana/ }));
    const confirmar = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirmar).getByRole('button', { name: 'Remover' }));
    await waitFor(() => expect(screen.queryByTestId('linha-credor-0')).toBeNull());
  });
});
