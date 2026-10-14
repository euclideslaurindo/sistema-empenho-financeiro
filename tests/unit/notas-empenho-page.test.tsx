import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('@/hooks/use-elementos', () => ({
  useElementos: () => ({
    elementos: [
      {
        codigo: '3.3.90.14', descricao: 'Diárias', valor: '3.3.90.14 - Diárias', legado: false, ativo: true, retencoes: [],
        subelementos: [
          { codigo: '3.3.90.14.01', descricao: 'Diárias no país', valor: '3.3.90.14.01 - Diárias no país' },
          { codigo: '3.3.90.14.03', descricao: 'Ajuda de custo', valor: '3.3.90.14.03 - Ajuda de custo' },
        ],
      },
      { codigo: '3.3.90.36', descricao: 'Outros serviços PF', valor: '3.3.90.36 - Outros serviços PF', legado: false, ativo: true, retencoes: [], subelementos: [] },
    ],
    loading: false,
    erro: null,
    recarregar: vi.fn(),
  }),
}));
import { apiClient } from '@/lib/api-client';
import NotasEmpenho from '@/app/notas-empenho/page';

const NE_ANTIGA = {
  id: 'ne-1', codigo: '1', numero: '2026NE000001', valor: 100, criadaEm: '2026-10-14',
  unidadeOrcamentaria: 'Secretaria de Educação', elemento: '3.3.90.36 - Outros serviços PF', subelemento: 'Locação',
  gestao: '140101', status: 'EMITIDO', historico: 'Observação antiga', dataProvisaoConcedida: '2026-02-01',
  dataPagamento: '2026-03-10', dataEmissao: '2026-03-01',
};

describe('Tela da Nota de Empenho (T29)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn() as any;
    global.fetch = vi.fn(async () => ({ json: async () => ({ duplicado: false }) })) as any;
    (apiClient.get as any).mockResolvedValue({ notas: [NE_ANTIGA], pagination: { totalPages: 1 } });
  });

  test('título "Cadastro de Nota de Empenho", sem Data de Emissão/Pagamento, com Data de Provisão e "Observações"', async () => {
    render(<NotasEmpenho />);
    expect(await screen.findByRole('heading', { name: 'Cadastro de Nota de Empenho' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Data de Emissão')).toBeNull();
    expect(screen.queryByLabelText('Data de Pagamento')).toBeNull();
    expect(screen.getByLabelText('Data de Provisão')).toBeInTheDocument();
    expect(screen.getByLabelText('Observações')).toBeInTheDocument();
    expect(screen.queryByText('Especificação')).toBeNull();
  });

  test('lista com as colunas "Cadastro" e "Observações", mostrando a data de cadastro', async () => {
    render(<NotasEmpenho />);
    const linha = (await screen.findByText('2026NE000001')).closest('tr')!;
    const cabecalhos = screen.getAllByRole('columnheader').map((th: HTMLElement) => th.textContent);
    expect(cabecalhos).toContain('Cadastro');
    expect(cabecalhos).toContain('Observações');
    expect(within(linha).getByText('14/10/2026')).toBeInTheDocument();
  });

  test('Subelemento aparece antes de escolher o elemento; lista no 3.3.90.14, texto no 3.3.90.36; trocar limpa', async () => {
    render(<NotasEmpenho />);
    await screen.findByRole('heading', { name: 'Cadastro de Nota de Empenho' });
    expect(screen.getByLabelText('Subelemento').tagName).toBe('INPUT');

    fireEvent.change(screen.getByLabelText('Elemento'), { target: { value: '3.3.90.14 - Diárias' } });
    const lista = screen.getByLabelText('Subelemento');
    expect(lista.tagName).toBe('SELECT');
    fireEvent.change(lista, { target: { value: '3.3.90.14.01 - Diárias no país' } });

    fireEvent.change(screen.getByLabelText('Elemento'), { target: { value: '3.3.90.36 - Outros serviços PF' } });
    const texto = screen.getByLabelText('Subelemento') as HTMLInputElement;
    expect(texto.tagName).toBe('INPUT');
    expect(texto.value).toBe('');
  });

  test('editar e salvar uma NE antiga não envia dataPagamento/dataEmissao (o servidor preserva as gravadas)', async () => {
    (apiClient.put as any).mockResolvedValue({ success: true });
    render(<NotasEmpenho />);
    const linha = (await screen.findByText('2026NE000001')).closest('tr')!;
    fireEvent.click(within(linha).getByTitle('Editar'));
    expect((screen.getByLabelText('Subelemento') as HTMLInputElement).value).toBe('Locação');

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalled());
    const [url, payload] = (apiClient.put as any).mock.calls[0];
    expect(url).toBe('/api/notas-empenho/ne-1');
    expect(payload).not.toHaveProperty('dataPagamento');
    expect(payload).not.toHaveProperty('dataEmissao');
    expect(payload).toMatchObject({ historico: 'Observação antiga', subelemento: 'Locação', dataProvisaoConcedida: '2026-02-01' });
  });
});

describe('Tela da Nota de Empenho — NE sem credor (T30)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn() as any;
    global.fetch = vi.fn(async () => ({ json: async () => ({ duplicado: false }) })) as any;
    (apiClient.get as any).mockResolvedValue({ notas: [NE_ANTIGA], pagination: { totalPages: 1 } });
  });

  test('sem seção de credores no formulário e sem coluna "Credores" na lista', async () => {
    render(<NotasEmpenho />);
    await screen.findByText('2026NE000001');
    expect(screen.queryByText(/Adicionar credor|Soma dos brutos/i)).toBeNull();
    const cabecalhos = screen.getAllByRole('columnheader').map((th: HTMLElement) => th.textContent);
    expect(cabecalhos).not.toContain('Credores');
  });

  test('salva uma NE nova sem credor (POST sem credores)', async () => {
    (apiClient.post as any).mockResolvedValue({ success: true, id: 'ne-novo' });
    render(<NotasEmpenho />);
    await screen.findByRole('heading', { name: 'Cadastro de Nota de Empenho' });
    fireEvent.change(screen.getByLabelText('Número da NE'), { target: { value: '2026NE000300' } });
    fireEvent.change(screen.getByLabelText('Valor R$'), { target: { value: '100,00' } });
    const salvar = screen.getByRole('button', { name: /salvar/i });
    expect(salvar).not.toBeDisabled();
    fireEvent.click(salvar);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    const [url, payload] = (apiClient.post as any).mock.calls[0];
    expect(url).toBe('/api/notas-empenho');
    expect(payload).toMatchObject({ numero: '2026NE000300' });
    expect(payload).not.toHaveProperty('credores');
    expect(payload).not.toHaveProperty('cpfCnpj');
    expect(payload).not.toHaveProperty('credorNome');
  });

  test('aviso de duplicidade envia valor + elemento e o botão "Carregar dados" preenche o formulário', async () => {
    const parecida = {
      id: 'ne-9', numero: '2026NE000009', valor: '100.00', elemento: '3.3.90.36 - Outros serviços PF', subelemento: 'Locação',
      unidadeOrcamentaria: 'Secretaria de Educação', gestao: '140101', historico: 'Obs da parecida', dataProvisaoConcedida: '2026-02-01',
    };
    global.fetch = vi.fn(async () => ({ json: async () => ({ duplicado: true, nota: parecida }) })) as any;
    render(<NotasEmpenho />);
    await screen.findByRole('heading', { name: 'Cadastro de Nota de Empenho' });
    fireEvent.change(screen.getByLabelText('Elemento'), { target: { value: '3.3.90.36 - Outros serviços PF' } });
    fireEvent.change(screen.getByLabelText('Valor R$'), { target: { value: '100,00' } });

    const carregar = await screen.findByText(/Carregar dados da NE 2026NE000009/, {}, { timeout: 2000 });
    const url = String((global.fetch as any).mock.calls.at(-1)[0]);
    expect(url).toContain('elemento=');
    expect(url).not.toContain('credor');

    fireEvent.click(carregar);
    await waitFor(() => expect((screen.getByLabelText('Observações') as HTMLTextAreaElement).value).toBe('Obs da parecida'));
    expect((screen.getByLabelText('Número da NE') as HTMLInputElement).value).toBe('2026NE000009');
    expect((screen.getByLabelText('Subelemento') as HTMLInputElement).value).toBe('Locação');
  });
});

describe('Tela da Nota de Empenho — saldo (T31)', () => {
  const NE_COM_OPS = { ...NE_ANTIGA, id: 'ne-2', numero: '2026NE000002', saldo: { valor: 100, gasto: 90, restante: 10, percentualGasto: 90, qtdOps: 3 } };

  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn() as any;
    global.fetch = vi.fn(async () => ({ json: async () => ({ duplicado: false }) })) as any;
    (apiClient.get as any).mockResolvedValue({ notas: [NE_COM_OPS], pagination: { totalPages: 1 } });
  });

  test('a lista mostra as colunas Gasto e Restante', async () => {
    render(<NotasEmpenho />);
    const linha = (await screen.findByText('2026NE000002')).closest('tr')!;
    const cabecalhos = screen.getAllByRole('columnheader').map((th: HTMLElement) => th.textContent);
    expect(cabecalhos).toEqual(expect.arrayContaining(['Gasto', 'Restante']));
    expect(within(linha).getByText('R$ 90,00')).toBeInTheDocument();
    expect(within(linha).getByText('R$ 10,00')).toBeInTheDocument();
  });

  test('NE nova: faixa com gasto zero e restante acompanhando o valor digitado', async () => {
    render(<NotasEmpenho />);
    await screen.findByText('2026NE000002');
    fireEvent.change(screen.getByLabelText('Valor R$'), { target: { value: '250,00' } });
    const faixa = screen.getByTestId('faixa-saldo-ne');
    expect(within(faixa).getAllByText('R$ 250,00')).toHaveLength(2);
    expect(within(faixa).getByText('R$ 0,00')).toBeInTheDocument();
  });

  test('editar uma NE com OPs: faixa com o gasto dela', async () => {
    render(<NotasEmpenho />);
    const linha = (await screen.findByText('2026NE000002')).closest('tr')!;
    fireEvent.click(within(linha).getByTitle('Editar'));
    const faixa = await screen.findByTestId('faixa-saldo-ne');
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '90'));
    expect(within(faixa).getByText('R$ 90,00')).toBeInTheDocument();
    expect(within(faixa).getByText('R$ 10,00')).toBeInTheDocument();
  });
});
