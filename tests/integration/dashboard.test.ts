import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Não autenticado' }) }),
}));

import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

describe('Integração API Dashboard Stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // O cache de estatísticas é uma variável module-level em dashboard.service.ts;
    // resetamos o módulo a cada teste pra não vazar cache entre casos.
    vi.resetModules();
  });

  test('Sem autenticação retorna 401', async () => {
    (getAuthUser as any).mockResolvedValue(null);
    const { GET } = await import('@/app/api/dashboard/stats/route');

    const req = new NextRequest('http://localhost:3000/api/dashboard/stats', { method: 'GET' });
    const res: any = await GET(req);
    expect(res.status).toBe(401);
  });

  test('Retorna estatísticas calculadas a partir das queries', async () => {
    (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'GESTOR' });
    (query as any)
      .mockResolvedValueOnce([{ total: 20 }]) // credoresCount
      .mockResolvedValueOnce([{ total: 10 }]) // credoresMesAnterior
      .mockResolvedValueOnce([{ total: 5 }]) // nesCount
      .mockResolvedValueOnce([{ total: 4 }]) // nesCountAnterior
      .mockResolvedValueOnce([{ total: 1000 }]) // pagamentosPendentes
      .mockResolvedValueOnce([{ total: 500 }]) // pagamentosMesAnterior
      .mockResolvedValueOnce([{ numero: 'NE-001', data: '01/01/2026', valor: 100, status: 'EMITIDO', unidade: 'Sistema' }]) // ultimasNes
      .mockResolvedValueOnce([{ credorNome: 'Fulano', valorPagamento: 100, quando: '01/01/2026 às 10:00' }]); // ultimasOrdens

    const { GET } = await import('@/app/api/dashboard/stats/route');
    const req = new NextRequest('http://localhost:3000/api/dashboard/stats', { method: 'GET' });
    const res: any = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.credoresTotal).toBe(20);
    expect(data.credoresVariacao).toBe(100); // (20-10)/10 * 100
    expect(data.nesUltimos30).toBe(5);
    expect(data.pagamentosPendentesTotal).toBe(1000);
    expect(data.pagamentosVariacao).toBe(100); // (1000-500)/500 * 100
    expect(data.ultimasNes).toHaveLength(1);
    expect(data.ultimasOrdens).toHaveLength(1);
  });

  test('Pagamentos pendentes sem período anterior retorna variação 0 (não 100)', async () => {
    (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'GESTOR' });
    (query as any)
      .mockResolvedValueOnce([{ total: 5 }])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ total: 300 }])
      .mockResolvedValueOnce([{ total: 0 }]) // sem pagamento no período anterior
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/dashboard/stats/route');
    const req = new NextRequest('http://localhost:3000/api/dashboard/stats', { method: 'GET' });
    const res: any = await GET(req);
    const data = await res.json();

    // Assimetria intencional preservada: credores/NE vão a 100% sem base anterior,
    // mas pagamentos pendentes fica em 0% (comportamento original da rota)
    expect(data.credoresVariacao).toBe(100);
    expect(data.nesVariacao).toBe(100);
    expect(data.pagamentosVariacao).toBe(0);
  });

  test('Erro no banco retorna 500', async () => {
    (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'GESTOR' });
    (query as any).mockRejectedValueOnce(new Error('Falha de conexão'));

    const { GET } = await import('@/app/api/dashboard/stats/route');
    const req = new NextRequest('http://localhost:3000/api/dashboard/stats', { method: 'GET' });
    const res: any = await GET(req);
    expect(res.status).toBe(500);
  });
});
