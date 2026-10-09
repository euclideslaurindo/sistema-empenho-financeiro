import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Nao autenticado' }) }),
  forbiddenResponse: () => ({ status: 403, json: async () => ({ error: 'Acesso negado' }) }),
}));

import { query, withTransaction } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { GET } from '@/app/api/darf/route';
import { POST } from '@/app/api/darf/status/route';
import { alterarStatusDarf } from '@/lib/services/darf.service';

const get = async (qs = '') => {
  const res: any = await GET(new NextRequest(`http://localhost:3000/api/darf${qs}`));
  return { status: res.status, body: await res.json() };
};
const post = async (body: any) => {
  const res: any = await POST(new NextRequest('http://localhost:3000/api/darf/status', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

describe('GET /api/darf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'CONSULTA' });
  });

  function mockConsulta({ total = 2, itens = [] as any[], totais = [] as any[] } = {}) {
    (query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY d.status')) return totais;
      if (/^\s*SELECT COUNT\(/.test(sql)) return [{ total }];
      return itens;
    });
  }

  test('CONSULTA pode consultar; filtros viram WHERE e paginação no padrão', async () => {
    mockConsulta({
      itens: [{ id: 'd1', valorDarf: '335.00', status: 'PENDENTE', cidade: null, uf: null }],
      totais: [
        { status: 'PENDENTE', qtd: 2, valor: '535.00', credores: 2 },
        { status: 'PAGA', qtd: 1, valor: '100.00', credores: 1 },
      ],
    });
    const { status, body } = await get('?competencia=2026-10&status=PENDENTE&busca=2026NE&page=1&limit=10');
    expect(status).toBe(200);
    expect(body.itens[0].valorDarf).toBe(335);
    expect(body.itens[0].municipio).toBe('');
    expect(body.itens[0]).not.toHaveProperty('cidade');
    expect(body.pagination).toEqual({ page: 1, limit: 10, total: 2, totalPages: 1 });
    expect(body.totais).toEqual({
      pendente: { qtd: 2, valor: 535, credores: 2 },
      paga: { qtd: 1, valor: 100, credores: 1 },
    });

    const [sqlLista, paramsLista] = (query as any).mock.calls.find((c: any[]) => c[0].includes('ORDER BY d.competencia'));
    expect(sqlLista).toContain('competencia = ?');
    expect(sqlLista).toContain('status = ?');
    expect(paramsLista).toEqual(['2026-10', '2026NE%', '2026NE%', '2026NE%', '%2026NE%', 'PENDENTE', 10, 0]);

    // totais ignoram o filtro de status (mostram pendente e paga)
    const [sqlTotais, paramsTotais] = (query as any).mock.calls.find((c: any[]) => c[0].includes('GROUP BY d.status'));
    expect(sqlTotais).not.toContain('status = ?');
    expect(paramsTotais).not.toContain('PENDENTE');
  });

  test('agrupar=credor soma por credor no mês', async () => {
    mockConsulta({
      total: 1,
      itens: [{ credorCpfCnpj: '1', credorNome: 'Credor A', cidade: 'Garanhuns', uf: 'PE', qtd: 3, total: '1005.00', totalPendente: '670.00' }],
    });
    const { body } = await get('?competencia=2026-10&agrupar=credor');
    expect(body.agrupar).toBe('credor');
    expect(body.itens[0]).toEqual({ credorCpfCnpj: '1', credorNome: 'Credor A', municipio: 'Garanhuns/PE', qtd: 3, total: 1005, totalPendente: 670 });
    const sql = (query as any).mock.calls.map((c: any[]) => c[0]).find((s: string) => s.includes('GROUP BY d.credor_cpf_cnpj'));
    expect(sql).toContain('SUM(d.valor_darf)');
    expect(sql).toContain('LEFT JOIN credores c');
  });

  test('parâmetros inválidos -> 400; sem login -> 401', async () => {
    expect((await get('?competencia=2026-13')).status).toBe(400);
    expect((await get('?status=PAGO')).status).toBe(400);
    expect((await get('?agrupar=ne')).status).toBe(400);
    (getAuthUser as any).mockResolvedValueOnce(null);
    expect((await get()).status).toBe(401);
  });
});

describe('POST /api/darf/status', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `d${i + 1}`);

  function mockTransacao(existentes: string[]) {
    const chamadas: Array<[string, any[]]> = [];
    (withTransaction as any).mockImplementationOnce(async (cb: any) =>
      cb({
        execute: vi.fn(async (sql: string, params: any[] = []) => {
          chamadas.push([sql, params]);
          if (sql.includes('SELECT * FROM darf_acompanhamento')) {
            return [params.filter((p) => existentes.includes(p)).map((id) => ({ id, status: 'PENDENTE', data_pagamento: null }))];
          }
          return [{ affectedRows: 1 }];
        }),
      })
    );
    return chamadas;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'GESTOR' });
  });

  test('marcar 10 como pagas: um UPDATE só, na transação, auditoria por registro', async () => {
    const chamadas = mockTransacao(ids);
    const { status, body } = await post({ ids, status: 'PAGA', dataPagamento: '2026-10-05' });
    expect(status).toBe(200);
    expect(body.atualizadas).toBe(10);
    const updates = chamadas.filter(([s]) => s.startsWith('UPDATE darf_acompanhamento'));
    expect(updates).toHaveLength(1);
    expect(updates[0][1].slice(0, 3)).toEqual(['PAGA', '2026-10-05', 'u1']);
    expect(chamadas.filter(([s]) => s.includes('INSERT INTO auditoria_financeira'))).toHaveLength(10);
    expect(chamadas[0][0]).toContain('FOR UPDATE');
  });

  test('um id inexistente -> 404 e nenhum UPDATE (tudo ou nada)', async () => {
    const chamadas = mockTransacao(ids.slice(0, 9));
    const { status, body } = await post({ ids, status: 'PAGA', dataPagamento: '2026-10-05' });
    expect(status).toBe(404);
    expect(body.error).toContain('Nenhuma foi alterada');
    expect(chamadas.some(([s]) => s.startsWith('UPDATE'))).toBe(false);
  });

  test('PAGA sem data, com data inválida ou futura -> 400', async () => {
    expect((await post({ ids: ['d1'], status: 'PAGA' })).status).toBe(400);
    expect((await post({ ids: ['d1'], status: 'PAGA', dataPagamento: '2026-02-30' })).status).toBe(400);
    const r = await alterarStatusDarf({ ids: ['d1'], status: 'PAGA', dataPagamento: '2026-10-10' }, 'u1', 'GESTOR', new Date(2026, 9, 9));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain('futura');
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('reabrir (PENDENTE) limpa a data de pagamento', async () => {
    const chamadas = mockTransacao(['d1']);
    const { status } = await post({ ids: ['d1'], status: 'PENDENTE', dataPagamento: '2026-10-05' });
    expect(status).toBe(200);
    const upd = chamadas.find(([s]) => s.startsWith('UPDATE darf_acompanhamento'))!;
    expect(upd[1].slice(0, 2)).toEqual(['PENDENTE', null]);
  });

  test('CONSULTA não altera (403); body inválido -> 400', async () => {
    (getAuthUser as any).mockResolvedValueOnce({ id: 'u2', perfil: 'CONSULTA' });
    expect((await post({ ids: ['d1'], status: 'PAGA', dataPagamento: '2026-10-05' })).status).toBe(403);
    expect((await post({ ids: [], status: 'PAGA' })).status).toBe(400);
    expect((await post({ ids: ['d1'], status: 'QUITADA' })).status).toBe(400);
  });
});
