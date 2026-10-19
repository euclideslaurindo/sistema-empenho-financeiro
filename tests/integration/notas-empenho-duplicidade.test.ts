import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Não autenticado' }) }),
}));

import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { GET } from '@/app/api/notas-empenho/duplicidade/route';

const consultar = async (qs: string) => {
  const res: any = await GET(new NextRequest(`http://localhost:3000/api/notas-empenho/duplicidade?${qs}`));
  return { status: res.status, body: await res.json() };
};

describe('GET /api/notas-empenho/duplicidade (T30, D33)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'GESTOR' });
  });

  test('regra: valor + elemento + subelemento; sem credor e sem ne_credores', async () => {
    (query as any).mockResolvedValue([]);
    await consultar('valor=100&elemento=3.3.90.36%20-%20Outros&subelemento=Loca%C3%A7%C3%A3o&credor=Fulano&cpfCnpj=1');
    const [sql, params] = (query as any).mock.calls[0];
    expect(sql).toContain('ne.valor = ?');
    expect(sql).toContain("(ne.elemento = ? OR ? = '')");
    expect(sql).toContain("(ne.subelemento = ? OR ? = '')");
    expect(sql).not.toMatch(/credor|ne_credores|cpf_cnpj/);
    expect(params).toEqual([100, '3.3.90.36 - Outros', '3.3.90.36 - Outros', 'Locação', 'Locação']);
  });

  test('devolve os dados da NE parecida para o "Carregar dados da NE"', async () => {
    const nota = {
      id: 'ne-9', numero: '2026NE000009', valor: '100.00', elemento: '3.3.90.36 - Outros', subelemento: 'Locação',
      unidadeOrcamentaria: 'Secretaria de Educação', gestao: '140101', historico: 'Obs', dataProvisaoConcedida: '2026-02-01', criadaEm: '2026-10-10',
    };
    (query as any).mockResolvedValue([nota]);
    const { body } = await consultar('valor=100');
    expect(body).toEqual({ duplicado: true, nota });
    const [sql] = (query as any).mock.calls[0];
    for (const campo of ['ne.id', 'ne.historico', 'unidadeOrcamentaria', 'dataProvisaoConcedida', 'criadaEm']) {
      expect(sql).toContain(campo);
    }
  });

  test('sem valor ou valor inválido: não consulta', async () => {
    expect((await consultar('elemento=x')).body).toEqual({ duplicado: false });
    expect((await consultar('valor=abc')).body).toEqual({ duplicado: false });
    expect(query).not.toHaveBeenCalled();
  });

  test('sem login: 401', async () => {
    (getAuthUser as any).mockResolvedValue(null);
    expect((await consultar('valor=100')).status).toBe(401);
  });
});
