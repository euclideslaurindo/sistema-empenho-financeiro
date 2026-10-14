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
  credores: [{ cpfCnpj: '222.222.222-22', nome: 'José Silva', valorBruto: 100, valorPago: 0, saldo: 100 }],
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
