import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { NextRequest } from 'next/server';

// Revisão da aba 9 (Dashboard): cache curto, "Atualizado às" e Atualizar
// (B1), aviso de falha (B2), textos e setas (B3), selo PARCIAL (B4) e
// perfil Consulta sem os atalhos de "Novo" (B5).

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/db', () => ({ query: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(async () => ({ id: 'u1', perfil: 'GESTOR' })),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({}) }),
}));
import { query } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import Dashboard from '@/app/page';

const STATS = {
  credoresTotal: 20, credoresVariacao: -5, nesUltimos30: 7, nesVariacao: 40,
  pagamentosPendentesTotal: 1234.5, pagamentosVariacao: -10,
  ultimasNes: [
    { numero: '2026NE000001', data: '20/10/2026', unidade: 'TESTE', valor: 100, status: 'PARCIALMENTE PAGO' },
    { numero: '2026NE000002', data: '20/10/2026', unidade: 'TESTE', valor: 50, status: 'EMITIDO' },
  ],
  atualizadoEm: '2026-10-22T13:05:00.000Z',
};
const resposta = (ok: boolean, corpo: any) => ({ ok, json: async () => corpo });

describe('Dashboard — tela', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ userProfile: null });
    global.fetch = vi.fn(async () => resposta(true, STATS)) as any;
  });
  afterEach(() => useAppStore.setState({ userProfile: null }));

  test('B1: "Atualizado às" e o botão Atualizar busca sem o cache', async () => {
    render(<Dashboard />);
    const hora = new Date(STATS.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    expect(await screen.findByTestId('dashboard-atualizado')).toHaveTextContent(`Atualizado às ${hora}`);
    expect((global.fetch as any).mock.calls[0][0]).toBe('/api/dashboard/stats');
    fireEvent.click(screen.getByRole('button', { name: /Atualizar/ }));
    await waitFor(() => expect((global.fetch as any).mock.calls.at(-1)[0]).toBe('/api/dashboard/stats?atualizar=1'));
  });

  test('B2: falha mostra aviso (e não R$ 0,00); "Tentar de novo" busca de novo', async () => {
    global.fetch = vi.fn(async () => resposta(false, { error: 'falhou' })) as any;
    render(<Dashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o resumo');
    expect(screen.queryByText('R$ 0,00')).toBeNull();
    (global.fetch as any).mockImplementation(async () => resposta(true, STATS));
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText('R$ 1.234,50')).toBeInTheDocument();
  });

  test('B3: textos do período e seta para baixo quando cai', async () => {
    const { container } = render(<Dashboard />);
    expect(await screen.findByText('nos últimos 30 dias')).toBeInTheDocument();
    expect(screen.getByText(/-5% em 30 dias/)).toBeInTheDocument();
    expect(screen.getByText(/vs 30 dias atrás/)).toBeInTheDocument();
    expect(container.querySelectorAll('.lucide-trending-down').length).toBe(2); // credores e total a pagar caíram
    expect(container.querySelectorAll('.lucide-trending-up').length).toBe(1); // NEs subiram
  });

  test('B4: NE paga em parte com o selo PARCIAL', async () => {
    render(<Dashboard />);
    const linha = (await screen.findByText('2026NE000001')).closest('tr')!;
    expect(within(linha).getByText('PARCIAL')).toBeInTheDocument();
    expect(within(screen.getByText('2026NE000002').closest('tr')!).getByText('A PAGAR')).toBeInTheDocument();
  });

  test('B5: perfil Consulta sem "Novo Empenho" e "Novo Credor"', async () => {
    useAppStore.setState({ userProfile: { id: 'c', nome: 'C', email: 'c', perfil: 'CONSULTA' } });
    render(<Dashboard />);
    await screen.findByText('2026NE000001');
    expect(screen.queryByRole('button', { name: 'Novo Empenho' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Novo Credor' })).toBeNull();
  });

  test('B5: outros perfis continuam com os atalhos', async () => {
    useAppStore.setState({ userProfile: { id: 'a', nome: 'A', email: 'a', perfil: 'ADMIN' } });
    render(<Dashboard />);
    expect(await screen.findByRole('button', { name: 'Novo Empenho' })).toBeInTheDocument();
  });
});

describe('Dashboard — servidor', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (query as any).mockImplementation(async (sql: string) => (sql.includes('LIMIT 5') ? [] : [{ total: 1 }]));
  });
  const consultasDeUmaCarga = 7; // 6 contagens/somas + últimas NEs (a das últimas OPs saiu)

  test('B5: não consulta mais as últimas OPs', async () => {
    const { GET } = await import('@/app/api/dashboard/stats/route');
    await GET(new NextRequest('http://localhost:3000/api/dashboard/stats'));
    expect((query as any).mock.calls).toHaveLength(consultasDeUmaCarga);
    expect((query as any).mock.calls.some((c: any[]) => String(c[0]).includes('LIMIT 3'))).toBe(false);
  });

  test('B1: dentro de 1 minuto usa o cache; ?atualizar=1 lê de novo', async () => {
    const { GET } = await import('@/app/api/dashboard/stats/route');
    await GET(new NextRequest('http://localhost:3000/api/dashboard/stats'));
    await GET(new NextRequest('http://localhost:3000/api/dashboard/stats'));
    expect((query as any).mock.calls).toHaveLength(consultasDeUmaCarga);
    await GET(new NextRequest('http://localhost:3000/api/dashboard/stats?atualizar=1'));
    expect((query as any).mock.calls).toHaveLength(2 * consultasDeUmaCarga);
  });

  test('B1: o cache dura no máximo 1 minuto', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const { GET } = await import('@/app/api/dashboard/stats/route');
      await GET(new NextRequest('http://localhost:3000/api/dashboard/stats'));
      vi.setSystemTime(Date.now() + 61 * 1000);
      await GET(new NextRequest('http://localhost:3000/api/dashboard/stats'));
      expect((query as any).mock.calls).toHaveLength(2 * consultasDeUmaCarga);
    } finally {
      vi.useRealTimers();
    }
  });
});
