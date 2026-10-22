import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';

// Revisão da aba 4 (Ordem de Pagamento): exclusão de OP pelo ADMIN (O1),
// perfil Consulta (O5), confirmação no "Nova emissão" (O6) e tabela de OPs
// recentes (O7).

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('@/hooks/use-retencoes-config', () => ({
  useRetencoesConfig: () => ({
    config: { campos: [], regras: {}, versao: 'x' },
    elementos: [],
    loading: false,
    erro: null,
    recarregar: vi.fn(),
  }),
}));

import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import OrdemPagamento from '@/app/ordem-pagamento/page';
import OpRecentTable from '@/components/op-form/OpRecentTable';

const NE = {
  id: 'ne-1', numero: '2026NE000001', valor: '100.00', status: 'EMITIDO', historico: 'TESTE',
  unidadeOrcamentaria: 'Educação', gestao: '140101', elemento: '3.3.90.36 - Serviços PF', subelemento: 'Locação',
  saldo: { valor: 100, gasto: 10, restante: 90, percentualGasto: 10, qtdOps: 1 },
};
const OP = { id: 'op-1', numeroEmpenho: '2026.OP.0012', sub: '02', numeroNe: '2026NE000001', credorNome: 'TESTE Ana', valorPagamento: '90.00', dataEmissao: '2026-10-20', dataPagamento: null };
const CREDOR = { id: 'c1', cpfCnpj: '111.111.111-11', nome: 'TESTE Ana', isMei: 0 };

let perfilApi = 'GESTOR';
let ops: any[] = [OP];
function rotear() {
  (apiClient.get as any).mockImplementation(async (url: string) => {
    if (url === '/api/perfil') return { usuario: { perfil: perfilApi } };
    if (url.startsWith('/api/ordens-pagamento/proximo-numero')) return { numeros: [] };
    if (url.startsWith('/api/ordens-pagamento')) return { ordens: ops };
    if (url.startsWith('/api/notas-empenho/saldo')) return { saldo: { valor: 100, gasto: 10, restante: 90, percentualGasto: 10, qtdOps: 1 } };
    if (url.startsWith('/api/notas-empenho?numero=')) return { ne: NE };
    if (url.startsWith('/api/credores?busca=')) return { credores: [CREDOR] };
    return {};
  });
}

const carregarNe = async () => {
  fireEvent.change(screen.getByLabelText('Nota de Empenho (NE)'), { target: { value: NE.numero } });
  fireEvent.click(screen.getByRole('button', { name: 'Carregar a NE' }));
  await screen.findByTestId('faixa-saldo-emissao');
};
const adicionarCredor = async () => {
  fireEvent.change(screen.getByLabelText(/Adicionar credor/), { target: { value: 'TESTE' } });
  fireEvent.mouseDown(await screen.findByRole('option', { name: /TESTE Ana/ }));
  await screen.findByTestId('linha-credor-0');
};

describe('Ordem de Pagamento — revisão da aba 4', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    perfilApi = 'GESTOR';
    ops = [OP];
    useAppStore.setState({ userProfile: null });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    rotear();
  });
  afterEach(() => useAppStore.setState({ userProfile: null }));

  describe('O1: excluir OP', () => {
    test('GESTOR não vê o botão de excluir', async () => {
      render(<OrdemPagamento />);
      await screen.findByText('2026.OP.0012');
      await act(async () => {});
      expect(screen.queryByRole('button', { name: /Excluir OP/ })).toBeNull();
    });

    test('ADMIN: pede o motivo, envia no DELETE, avisa e recarrega a lista', async () => {
      perfilApi = 'ADMIN';
      (apiClient.delete as any).mockResolvedValue({ success: true });
      render(<OrdemPagamento />);
      fireEvent.click(await screen.findByRole('button', { name: 'Excluir OP 2026.OP.0012 /02' }));
      const dialogo = await screen.findByRole('alertdialog');
      expect(dialogo).toHaveTextContent('volta para o saldo da NE 2026NE000001');
      const confirmar = within(dialogo).getByRole('button', { name: 'Excluir OP' });
      expect(confirmar).toBeDisabled();
      fireEvent.change(within(dialogo).getByLabelText('Motivo da exclusão'), { target: { value: 'abc' } });
      expect(confirmar).toBeDisabled();
      fireEvent.change(within(dialogo).getByLabelText('Motivo da exclusão'), { target: { value: 'TESTE valor errado' } });
      expect(confirmar).toBeEnabled();
      ops = [];
      fireEvent.click(confirmar);
      await waitFor(() => expect(apiClient.delete).toHaveBeenCalled());
      const [url, opcoes] = (apiClient.delete as any).mock.calls[0];
      expect(url).toBe('/api/ordens-pagamento/op-1');
      expect(JSON.parse(opcoes.body)).toEqual({ motivo: 'TESTE valor errado' });
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(toast.success).toHaveBeenCalledWith('OP 2026.OP.0012 /02 excluída. O valor voltou para o saldo da NE 2026NE000001.');
      await screen.findByText('Nenhuma ordem encontrada.');
    });

    test('ADMIN: erro do servidor (ex.: DARF paga) mostra a mensagem e mantém o diálogo', async () => {
      perfilApi = 'ADMIN';
      (apiClient.delete as any).mockRejectedValue(new Error('A DARF desta OP já foi paga.'));
      render(<OrdemPagamento />);
      fireEvent.click(await screen.findByRole('button', { name: /Excluir OP 2026.OP.0012/ }));
      const dialogo = await screen.findByRole('alertdialog');
      fireEvent.change(within(dialogo).getByLabelText('Motivo da exclusão'), { target: { value: 'TESTE valor errado' } });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Excluir OP' }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('A DARF desta OP já foi paga.'));
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  test('O5: perfil Consulta (do login) vê o aviso e não pode emitir', async () => {
    useAppStore.setState({ userProfile: { id: 'u', nome: 'X', email: 'x', perfil: 'CONSULTA' } });
    render(<OrdemPagamento />);
    expect(screen.getByRole('status')).toHaveTextContent('Seu perfil é Consulta');
    await carregarNe();
    expect(screen.getByRole('button', { name: /^Emitir/ })).toBeDisabled();
  });

  test('O5: o perfil do login vale desde o início (Admin não começa como Gestor)', async () => {
    useAppStore.setState({ userProfile: { id: 'u', nome: 'X', email: 'x', perfil: 'ADMIN' } });
    perfilApi = 'GESTOR'; // a consulta própria não sobrepõe o do login
    render(<OrdemPagamento />);
    expect(await screen.findByRole('button', { name: /Excluir OP/ })).toBeInTheDocument();
  });

  describe('O6: "Nova emissão"', () => {
    test('com credores na lista, pede confirmação; "Continuar" mantém tudo', async () => {
      render(<OrdemPagamento />);
      await carregarNe();
      await adicionarCredor();
      fireEvent.click(screen.getByRole('button', { name: 'Nova emissão' }));
      const dialogo = await screen.findByRole('alertdialog');
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Continuar esta emissão' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(screen.getByTestId('linha-credor-0')).toBeInTheDocument();
    });

    test('confirmando, limpa a NE e a lista', async () => {
      render(<OrdemPagamento />);
      await carregarNe();
      await adicionarCredor();
      fireEvent.click(screen.getByRole('button', { name: 'Nova emissão' }));
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Descartar e começar de novo' }));
      await waitFor(() => expect(screen.queryByTestId('linha-credor-0')).toBeNull());
      expect((screen.getByLabelText('Nota de Empenho (NE)') as HTMLInputElement).value).toBe('');
    });

    test('sem credores, limpa direto', async () => {
      render(<OrdemPagamento />);
      await carregarNe();
      fireEvent.click(screen.getByRole('button', { name: 'Nova emissão' }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect((screen.getByLabelText('Nota de Empenho (NE)') as HTMLInputElement).value).toBe('');
    });
  });

  test('O7: a resposta de uma busca antiga não sobrescreve a da busca nova', async () => {
    let soltarAntiga: (v: any) => void = () => {};
    (apiClient.get as any).mockImplementation(async (url: string) => {
      if (url === '/api/perfil') return { usuario: { perfil: 'GESTOR' } };
      if (url === '/api/ordens-pagamento?busca=A') return new Promise((r) => { soltarAntiga = r; });
      if (url === '/api/ordens-pagamento?busca=AB') return { ordens: [{ ...OP, id: 'nova', credorNome: 'TESTE Nova' }] };
      if (url.startsWith('/api/ordens-pagamento')) return { ordens: [] };
      return {};
    });
    render(<OrdemPagamento />);
    const busca = screen.getByPlaceholderText('Buscar OP...');
    fireEvent.change(busca, { target: { value: 'A' } });
    await waitFor(() => expect((apiClient.get as any).mock.calls.some(([u]: any[]) => u === '/api/ordens-pagamento?busca=A')).toBe(true));
    fireEvent.change(busca, { target: { value: 'AB' } });
    await screen.findByText('TESTE Nova');
    await act(async () => soltarAntiga({ ordens: [{ ...OP, id: 'velha', credorNome: 'TESTE Velha' }] }));
    expect(screen.queryByText('TESTE Velha')).toBeNull();
  });
});

describe('OpRecentTable — revisão da aba 4 (O7)', () => {
  test('número com a sub e colunas Emissão e Pagamento', () => {
    render(<OpRecentTable ops={[OP]} onSearch={() => {}} />);
    const linha = screen.getByText('2026.OP.0012').closest('tr')!;
    expect(within(linha).getByText('/02')).toBeInTheDocument();
    expect(within(linha).getByText('20/10/2026')).toBeInTheDocument();
    const cabecalhos = screen.getAllByRole('columnheader').map((th: HTMLElement) => th.textContent);
    expect(cabecalhos).toEqual(expect.arrayContaining(['Emissão', 'Pagamento']));
    expect(cabecalhos).not.toContain('Ações');
  });
});
