import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';

// Revisão da aba 3 (Notas de Empenho): confirmação ao cancelar, aviso de
// duplicidade sem a própria NE, selo PARCIAL, lista que mantém busca e página,
// busca sem resultado velho, perfil Consulta, rodapé e clique na linha.

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('@/hooks/use-elementos', () => ({
  useElementos: () => ({
    elementos: [{ codigo: '3.3.90.36', descricao: 'Outros', valor: '3.3.90.36 - Outros serviços PF', legado: false, ativo: true, retencoes: [], subelementos: [] }],
    loading: false, erro: null, recarregar: vi.fn(),
  }),
}));
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import NotasEmpenho from '@/app/notas-empenho/page';

const NE = {
  id: 'ne-1', numero: '2026NE000001', valor: '100.00', criadaEm: '2026-10-14',
  unidadeOrcamentaria: 'Secretaria de Educação', elemento: '3.3.90.36 - Outros serviços PF', subelemento: 'Locação',
  gestao: '140101', status: 'PARCIALMENTE PAGO', historico: 'TESTE obs',
  saldo: { valor: 100, gasto: 40, restante: 60, percentualGasto: 40, qtdOps: 1 },
};
const lista = (notas: any[] = [NE], totalPages = 3) => ({ notas, pagination: { totalPages } });
const urls = () => (apiClient.get as any).mock.calls.map((c: any[]) => c[0] as string).filter((u: string) => u.startsWith('/api/notas-empenho?'));

describe('Notas de Empenho — revisão da aba 3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn() as any;
    useAppStore.setState({ userProfile: null });
    global.fetch = vi.fn(async () => ({ json: async () => ({ duplicado: false }) })) as any;
    (apiClient.get as any).mockResolvedValue(lista());
  });
  afterEach(() => useAppStore.setState({ userProfile: null }));

  const abrirNe = async () => {
    const linha = (await screen.findByText('2026NE000001')).closest('tr')!;
    fireEvent.click(within(linha).getByTitle('Editar'));
  };

  test('N1: "Cancelar NE" pede confirmação; "Voltar" não cancela', async () => {
    render(<NotasEmpenho />);
    await abrirNe();
    expect(screen.queryByRole('button', { name: /^Excluir$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar NE' }));
    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveTextContent('não tem volta');
    expect(apiClient.delete).not.toHaveBeenCalled();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Voltar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  test('N1: confirmando, cancela a NE', async () => {
    (apiClient.delete as any).mockResolvedValue({ success: true });
    render(<NotasEmpenho />);
    await abrirNe();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar NE' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar NE' }));
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/api/notas-empenho/ne-1'));
    expect(toast.success).toHaveBeenCalledWith('NE cancelada com sucesso!');
  });

  test('N2: editando, a consulta de duplicidade ignora a própria NE', async () => {
    render(<NotasEmpenho />);
    await abrirNe();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled(), { timeout: 2000 });
    const url = String((global.fetch as any).mock.calls.at(-1)[0]);
    expect(url).toContain('ignorarId=ne-1');
  });

  test('N2: NE nova não manda ignorarId', async () => {
    render(<NotasEmpenho />);
    await screen.findByText('2026NE000001');
    fireEvent.change(screen.getByLabelText('Valor R$'), { target: { value: '10000' } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled(), { timeout: 2000 });
    expect(String((global.fetch as any).mock.calls.at(-1)[0])).not.toContain('ignorarId');
  });

  test.each([
    ['EMITIDO', 'A PAGAR'],
    ['PARCIALMENTE PAGO', 'PARCIAL'],
    ['LIQUIDADO', 'PAGO'],
    ['CANCELADO', 'CANCELADO'],
  ])('N3: status %s mostra o selo %s', async (status: string, selo: string) => {
    (apiClient.get as any).mockResolvedValue(lista([{ ...NE, status }]));
    render(<NotasEmpenho />);
    const linha = (await screen.findByText('2026NE000001')).closest('tr')!;
    expect(within(linha).getByText(selo, { selector: 'span' })).toBeInTheDocument();
  });

  test('N4: depois de salvar, recarrega com a mesma busca e a mesma página', async () => {
    (apiClient.put as any).mockResolvedValue({ success: true });
    render(<NotasEmpenho />);
    await screen.findByText('2026NE000001');
    fireEvent.change(screen.getByPlaceholderText('Buscar nota...'), { target: { value: '0001' } });
    await waitFor(() => expect(urls()).toContain('/api/notas-empenho?page=1&busca=0001'));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(urls()).toContain('/api/notas-empenho?page=2&busca=0001'));
    await waitFor(() => expect(screen.getByText('Página 2 de 3')).toBeInTheDocument());
    await abrirNe();
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalled());
    await waitFor(() => expect(urls().filter((u: string) => u === '/api/notas-empenho?page=2&busca=0001')).toHaveLength(2));
    expect(urls().at(-1)).toBe('/api/notas-empenho?page=2&busca=0001');
  });

  test('N5: digitando rápido, consulta uma vez só; resposta antiga não sobrescreve', async () => {
    let soltarAntiga: (v: any) => void = () => {};
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url.includes('busca=1&')) return Promise.resolve(lista());
      if (url.endsWith('busca=1')) return new Promise((r) => { soltarAntiga = r; });
      if (url.endsWith('busca=12')) return Promise.resolve(lista([{ ...NE, id: 'ne-12', numero: '2026NE000012' }], 1));
      return Promise.resolve(lista());
    });
    render(<NotasEmpenho />);
    await screen.findByText('2026NE000001');
    const busca = screen.getByPlaceholderText('Buscar nota...');
    fireEvent.change(busca, { target: { value: '1' } });
    await waitFor(() => expect(urls()).toContain('/api/notas-empenho?page=1&busca=1'));
    fireEvent.change(busca, { target: { value: '12' } });
    await screen.findByText('2026NE000012');
    await act(async () => soltarAntiga(lista([{ ...NE, id: 'velha', numero: 'NE VELHA' }])));
    expect(screen.queryByText('NE VELHA')).toBeNull();
    expect(screen.getByText('2026NE000012')).toBeInTheDocument();

    for (const v of ['2', '20', '202']) fireEvent.change(busca, { target: { value: v } });
    await waitFor(() => expect(urls()).toContain('/api/notas-empenho?page=1&busca=202'));
    expect(urls().filter((u: string) => /busca=20?$/.test(u))).toHaveLength(0);
  });

  test('N7: perfil Consulta vê o aviso e os botões desabilitados', async () => {
    useAppStore.setState({ userProfile: { id: 'u', nome: 'X', email: 'x', perfil: 'CONSULTA' } });
    render(<NotasEmpenho />);
    await screen.findByText('2026NE000001');
    expect(screen.getByRole('status')).toHaveTextContent('Seu perfil é Consulta');
    expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar NE' })).toBeDisabled();
  });

  test('N7: outros perfis com os botões habilitados', async () => {
    useAppStore.setState({ userProfile: { id: 'u', nome: 'X', email: 'x', perfil: 'ADMIN' } });
    render(<NotasEmpenho />);
    await screen.findByText('2026NE000001');
    expect(screen.queryByText(/Seu perfil é Consulta/)).toBeNull();
    expect(screen.getByRole('button', { name: /salvar/i })).toBeEnabled();
  });

  test('N8: rodapé sem os links que não faziam nada', async () => {
    render(<NotasEmpenho />);
    await screen.findByText('2026NE000001');
    for (const t of ['Privacidade', 'Termos de Uso', 'Suporte Técnico']) expect(screen.queryByText(t)).toBeNull();
  });

  test('N9: clicar na linha abre a NE para edição; NE cancelada não abre', async () => {
    (apiClient.get as any).mockResolvedValue(lista([NE, { ...NE, id: 'ne-c', numero: '2026NE000777', status: 'CANCELADO' }]));
    render(<NotasEmpenho />);
    fireEvent.click(await screen.findByText('2026NE000777'));
    expect(screen.queryByText('Modo Edição')).toBeNull();
    fireEvent.click(screen.getByText('2026NE000001'));
    expect(screen.getByText('Modo Edição')).toBeInTheDocument();
    expect((screen.getByLabelText('Número da NE') as HTMLInputElement).value).toBe('2026NE000001');
    expect((screen.getByLabelText('Valor R$') as HTMLInputElement).value).toBe('100,00');
  });
});
