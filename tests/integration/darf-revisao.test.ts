import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Revisão da aba 6 (DARF), servidor: DARF já no status pedido é recusada (D1)
// e a busca acha CPF/CNPJ só com dígitos e OP por trecho (D3).

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

const post = async (body: any) => {
  const res: any = await POST(new NextRequest('http://localhost:3000/api/darf/status', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

/** DARFs existentes com o status de cada uma. */
function banco(status: Record<string, string>) {
  const chamadas: Array<[string, any[]]> = [];
  (withTransaction as any).mockImplementationOnce(async (cb: any) =>
    cb({
      execute: vi.fn(async (sql: string, params: any[] = []) => {
        chamadas.push([sql, params]);
        if (sql.includes('SELECT * FROM darf_acompanhamento')) {
          return [params.filter((id) => status[id]).map((id) => ({ id, status: status[id], data_pagamento: status[id] === 'PAGA' ? '2026-10-01' : null }))];
        }
        return [{ affectedRows: 1 }];
      }),
    })
  );
  return chamadas;
}
const gravou = (chamadas: Array<[string, any[]]>) => chamadas.some(([s]) => /^\s*(UPDATE|INSERT)/.test(s));

describe('D1: status já no pedido', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'GESTOR' });
  });

  test('marcar como paga uma DARF já paga: 409 e nada regravado (nem a data)', async () => {
    const chamadas = banco({ d1: 'PENDENTE', d2: 'PAGA' });
    const r = await post({ ids: ['d1', 'd2'], status: 'PAGA', dataPagamento: '2026-10-10' });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('1 DARF(s) já está(ão) paga(s). Nenhuma foi alterada.');
    expect(gravou(chamadas)).toBe(false);
  });

  test('reabrir uma DARF já pendente: 409', async () => {
    const chamadas = banco({ d1: 'PENDENTE' });
    const r = await post({ ids: ['d1'], status: 'PENDENTE' });
    expect(r.status).toBe(409);
    expect(r.body.error).toContain('pendente(s)');
    expect(gravou(chamadas)).toBe(false);
  });

  test('só pendentes para pagar: grava normalmente', async () => {
    const chamadas = banco({ d1: 'PENDENTE', d2: 'PENDENTE' });
    const r = await post({ ids: ['d1', 'd2'], status: 'PAGA', dataPagamento: '2026-10-10' });
    expect(r.status).toBe(200);
    expect(r.body.atualizadas).toBe(2);
    expect(gravou(chamadas)).toBe(true);
  });
});

describe('D3: busca', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'CONSULTA' });
    (query as any).mockImplementation(async (sql: string) => (/^\s*SELECT COUNT\(/.test(sql) ? [{ total: 0 }] : []));
  });
  const buscar = async (busca: string) => {
    await GET(new NextRequest(`http://localhost:3000/api/darf?busca=${encodeURIComponent(busca)}`));
    return (query as any).mock.calls.find((c: any[]) => c[0].includes('ORDER BY d.competencia'));
  };

  test('CPF só com dígitos compara o documento sem pontuação', async () => {
    const [sql, params] = await buscar('11111111111');
    expect(sql).toContain("REPLACE(REPLACE(REPLACE(REPLACE(d.credor_cpf_cnpj");
    expect(params).toContain('11111111111%');
  });

  test('OP por trecho: "0012" acha "2026.OP.0012"', async () => {
    const [sql, params] = await buscar('0012');
    expect(sql).toContain('(d.numero_ne LIKE ? OR d.numero_op LIKE ?');
    // ordem dos parâmetros: NE, OP, CPF/CNPJ, nome, (dígitos)
    expect(params[0]).toBe('0012%');
    expect(params[1]).toBe('%0012%');
  });

  test('nome curto (sem 4 dígitos) não usa a comparação por dígitos', async () => {
    const [sql] = await buscar('Ana');
    expect(sql).not.toContain('REPLACE(');
  });
});
