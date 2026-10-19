import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Não autenticado' }) }),
}));

import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { GET } from '@/app/api/notas-empenho/saldo/route';

const consultar = async (qs: string) => {
  const res: any = await GET(new NextRequest(`http://localhost:3000/api/notas-empenho/saldo?${qs}`));
  return { status: res.status, body: await res.json() };
};

describe('GET /api/notas-empenho/saldo (T31)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'CONSULTA' });
  });

  test('NE de 100 com 90 gastos em 3 OPs', async () => {
    (query as any).mockImplementation(async (sql: string) =>
      sql.includes('FROM notas_empenho') ? [{ valor: '100.00' }] : [{ gasto: '90.00', qtd: 3 }]
    );
    const { status, body } = await consultar('numero=2026NE000123');
    expect(status).toBe(200);
    expect(body).toEqual({ numero: '2026NE000123', saldo: { valor: 100, gasto: 90, restante: 10, percentualGasto: 90, qtdOps: 3 } });
  });

  test('NE inexistente -> 404', async () => {
    (query as any).mockResolvedValue([]);
    expect((await consultar('numero=NE-X')).status).toBe(404);
  });

  test('sem número -> 400', async () => {
    expect((await consultar('')).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('sem login -> 401', async () => {
    (getAuthUser as any).mockResolvedValue(null);
    expect((await consultar('numero=NE-1')).status).toBe(401);
  });
});
