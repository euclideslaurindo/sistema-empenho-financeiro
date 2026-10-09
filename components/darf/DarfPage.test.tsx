import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import DarfPage from '@/app/darf/page';
import { DarfBaixaModal } from './DarfBaixaModal';
import { hojeIso, mesAtual } from './tipos';

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { apiClient } from '@/lib/api-client';

const op = (i: number, status = 'PENDENTE') => ({
  id: `d${i}`, ordemPagamentoId: `op${i}`, numeroNe: `2026NE00000${i}`, numeroOp: `2026.OP.000${i}`, sub: '01',
  credorCpfCnpj: `${i}${i}${i}.000.000-00`, credorNome: `Credor ${i}`, municipio: 'Garanhuns/PE',
  competencia: '2026-10', valorDarf: 335, detalhe: { inss: 110, patronal: 200, sest_senat: 25 },
  status, dataPagamento: status === 'PAGA' ? '2026-10-05' : null, observacao: null,
});

const TOTAIS = { pendente: { qtd: 3, valor: 1005, credores: 3 }, paga: { qtd: 1, valor: 335, credores: 1 } };

function mockApi({ perfil = 'GESTOR', totalPages = 1 } = {}) {
  (apiClient.get as any).mockImplementation(async (url: string) => {
    if (url.startsWith('/api/perfil')) return { usuario: { perfil } };
    const params = new URL(url, 'http://x').searchParams;
    if (params.get('agrupar') === 'credor') {
      return {
        agrupar: 'credor',
        itens: [{ credorCpfCnpj: '111', credorNome: 'Credor 1', municipio: 'Garanhuns/PE', qtd: 2, total: 670, totalPendente: 335 }],
        totais: TOTAIS,
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      };
    }
    return {
      agrupar: 'op',
      itens: [op(1), op(2), op(3), op(4, 'PAGA')],
      totais: TOTAIS,
      pagination: { page: Number(params.get('page')), limit: 50, total: 4, totalPages },
    };
  });
  (apiClient.post as any).mockResolvedValue({ atualizadas: 3 });
}

const urlsDarf = () => (apiClient.get as any).mock.calls.map((c: any[]) => c[0] as string).filter((u: string) => u.startsWith('/api/darf'));
const ultimaUrl = () => new URL(urlsDarf().at(-1)!, 'http://x').searchParams;

describe('Tela /darf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  test('abre no mês atual, mostra as DARFs e os cartões de resumo', async () => {
    render(<DarfPage />);
    expect(await screen.findByText('Credor 1')).toBeInTheDocument();
    expect(new URL(urlsDarf()[0], 'http://x').searchParams.get('competencia')).toBe(mesAtual());
    expect(screen.getByTestId('resumo-pendentes')).toHaveTextContent('R$ 1.005,00');
    expect(screen.getByTestId('resumo-pendentes')).toHaveTextContent('3 credores');
    expect(screen.getByTestId('resumo-total')).toHaveTextContent('R$ 1.340,00');
    expect(screen.getAllByText('Garanhuns/PE').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '2026.OP.0001' })).toHaveAttribute('href', '/consulta-impressao?ne=2026NE000001');
  });

  test('"Por credor" pede agrupar=credor, mostra a soma e esconde a seleção', async () => {
    render(<DarfPage />);
    await screen.findByText('Credor 1');
    fireEvent.click(screen.getByRole('radio', { name: 'Por credor' }));
    expect(await screen.findByText('R$ 670,00')).toBeInTheDocument();
    expect(ultimaUrl().get('agrupar')).toBe('credor');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText(/volte para a visão Por OP/)).toBeInTheDocument();
  });

  test('marcar 3 como pagas: modal pede a data, envia os 3 ids e recarrega lista e cartões', async () => {
    render(<DarfPage />);
    await screen.findByText('Credor 1');
    for (const n of [1, 2, 3]) fireEvent.click(screen.getByLabelText(`Selecionar DARF da OP 2026.OP.000${n}`));
    expect(screen.getByText('3 selecionada(s) nesta página')).toBeInTheDocument();

    const chamadasAntes = urlsDarf().length;
    fireEvent.click(screen.getByRole('button', { name: /Marcar como paga/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('3 DARF(s) · R$ 1.005,00')).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Data de pagamento')));

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar pagamento' }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/api/darf/status', { ids: ['d1', 'd2', 'd3'], status: 'PAGA', dataPagamento: hojeIso() })
    );
    await waitFor(() => expect(urlsDarf().length).toBeGreaterThan(chamadasAntes));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('0 selecionada(s) nesta página')).toBeInTheDocument();
  });

  test('reabrir pede confirmação e envia PENDENTE', async () => {
    render(<DarfPage />);
    await screen.findByText('Credor 4');
    fireEvent.click(screen.getByLabelText('Selecionar DARF da OP 2026.OP.0004'));
    fireEvent.click(screen.getByRole('button', { name: /Reabrir/ }));
    const alerta = await screen.findByRole('alertdialog');
    fireEvent.click(within(alerta).getByRole('button', { name: 'Reabrir' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/darf/status', { ids: ['d4'], status: 'PENDENTE' }));
  });

  test('CONSULTA vê tudo, sem seleção e sem botões de ação', async () => {
    mockApi({ perfil: 'CONSULTA' });
    render(<DarfPage />);
    await screen.findByText('Credor 1');
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/perfil'));
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Marcar como paga/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reabrir/ })).toBeNull();
  });

  test('filtros combinados e paginação; trocar filtro volta para a página 1', async () => {
    mockApi({ totalPages: 3 });
    render(<DarfPage />);
    await screen.findByText('Credor 1');

    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(ultimaUrl().get('page')).toBe('2'));

    fireEvent.change(screen.getByLabelText('Competência'), { target: { value: '2026-09' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'PAGA' } });
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: '2026NE' } });
    await waitFor(() => expect(ultimaUrl().get('busca')).toBe('2026NE'), { timeout: 2000 });

    const p = ultimaUrl();
    expect(p.get('competencia')).toBe('2026-09');
    expect(p.get('status')).toBe('PAGA');
    expect(p.get('page')).toBe('1');
  });

  test('vazio: "Nenhuma DARF neste mês."', async () => {
    (apiClient.get as any).mockImplementation(async (url: string) =>
      url.startsWith('/api/perfil')
        ? { usuario: { perfil: 'GESTOR' } }
        : { agrupar: 'op', itens: [], totais: TOTAIS, pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }
    );
    render(<DarfPage />);
    expect(await screen.findByText('Nenhuma DARF neste mês.')).toBeInTheDocument();
  });
});

describe('DarfBaixaModal', () => {
  test('data futura é bloqueada; Esc fecha', async () => {
    const onConfirmar = vi.fn();
    const onFechar = vi.fn();
    render(<DarfBaixaModal aberto quantidade={1} totalCents={33500} onFechar={onFechar} onConfirmar={onConfirmar} />);
    fireEvent.change(screen.getByLabelText('Data de pagamento'), { target: { value: '2999-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('não pode ser futura');
    expect(onConfirmar).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(onFechar).toHaveBeenCalled());
  });

  test('erro do servidor aparece no modal', async () => {
    render(
      <DarfBaixaModal
        aberto
        quantidade={1}
        totalCents={100}
        onFechar={vi.fn()}
        onConfirmar={async () => {
          throw new Error('1 DARF(s) não encontrada(s). Nenhuma foi alterada.');
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nenhuma foi alterada');
  });
});
