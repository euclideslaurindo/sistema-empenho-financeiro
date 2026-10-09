import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Nao autenticado' }) }),
  forbiddenResponse: () => ({ status: 403, json: async () => ({ error: 'Acesso negado' }) }),
}));

import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { GET } from '@/app/api/ordens-pagamento/proximo-numero/route';
import { calcularProximoNumeroOp } from '@/lib/services/numeracao-op';

const ANO = new Date().getFullYear();

function mockBanco({ ne, maxOp, maxSub }: { ne: any | null; maxOp: number | null; maxSub: number | null }) {
  (query as any).mockImplementation(async (sql: string) => {
    if (sql.includes('FROM notas_empenho')) return ne ? [ne] : [];
    if (sql.includes('SUBSTRING_INDEX(numero_empenho')) return maxOp === null ? [] : [{ seq: maxOp }];
    if (sql.includes('CAST(sub AS UNSIGNED)')) return maxSub === null ? [] : [{ seq: maxSub }];
    return [];
  });
}

async function chamar(numeroNe?: string) {
  const url = numeroNe
    ? `http://localhost:3000/api/ordens-pagamento/proximo-numero?numeroNe=${encodeURIComponent(numeroNe)}`
    : 'http://localhost:3000/api/ordens-pagamento/proximo-numero';
  const res: any = await GET(new NextRequest(url));
  return { status: res.status, body: await res.json() };
}

describe('GET /api/ordens-pagamento/proximo-numero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'GESTOR' });
  });

  test('NE sem OPs: primeira OP do ano e /01', async () => {
    mockBanco({ ne: { status: 'EMITIDO' }, maxOp: null, maxSub: null });
    const { status, body } = await chamar('2026NE000982');
    expect(status).toBe(200);
    expect(body).toEqual({
      numeroOp: `${ANO}.OP.0001`,
      sub: '01',
      rotulo: 'NE 2026NE000982/01',
      previsto: true,
    });
  });

  test('NE com duas OPs: /03, e o nº da OP segue a sequência do ano', async () => {
    mockBanco({ ne: { status: 'PARCIALMENTE PAGO' }, maxOp: 3, maxSub: 2 });
    const { body } = await chamar('2026NE000982');
    expect(body.numeroOp).toBe(`${ANO}.OP.0004`);
    expect(body.sub).toBe('03');
    expect(body.rotulo).toBe('NE 2026NE000982/03');
  });

  test('previsão nunca trava linhas (nenhuma query com FOR UPDATE)', async () => {
    mockBanco({ ne: { status: 'EMITIDO' }, maxOp: 1, maxSub: 1 });
    await chamar('2026NE000982');
    const sqls = (query as any).mock.calls.map((c: any[]) => c[0] as string);
    expect(sqls.length).toBe(3);
    expect(sqls.some((s: string) => s.includes('FOR UPDATE'))).toBe(false);
  });

  test('NE inexistente: 404', async () => {
    mockBanco({ ne: null, maxOp: null, maxSub: null });
    const { status } = await chamar('2026NE999999');
    expect(status).toBe(404);
  });

  test('NE cancelada: 409', async () => {
    mockBanco({ ne: { status: 'CANCELADO' }, maxOp: null, maxSub: null });
    const { status, body } = await chamar('2026NE000982');
    expect(status).toBe(409);
    expect(body.error).toContain('CANCELADA');
  });

  test('sem numeroNe: 400', async () => {
    const { status } = await chamar();
    expect(status).toBe(400);
  });

  test('CONSULTA: 403; sem login: 401', async () => {
    (getAuthUser as any).mockResolvedValueOnce({ id: 'u2', perfil: 'CONSULTA' });
    expect((await chamar('2026NE000982')).status).toBe(403);
    (getAuthUser as any).mockResolvedValueOnce(null);
    expect((await chamar('2026NE000982')).status).toBe(401);
  });
});

describe('calcularProximoNumeroOp', () => {
  test('travar: true usa FOR UPDATE nas duas queries (caminho do criar)', async () => {
    const exec = vi.fn().mockResolvedValue([]);
    const r = await calcularProximoNumeroOp(exec, '2026NE000001', { travar: true }, 2026);
    expect(r).toEqual({ numeroOp: '2026.OP.0001', sub: '01' });
    expect(exec).toHaveBeenCalledTimes(2);
    for (const [sql] of exec.mock.calls) expect(sql).toContain('FOR UPDATE');
    expect(exec.mock.calls[0][1]).toEqual(['2026.OP.%']);
    expect(exec.mock.calls[1][1]).toEqual(['2026NE000001']);
  });

  test('zero à esquerda e números grandes', async () => {
    const exec = vi.fn().mockResolvedValueOnce([{ seq: 9999 }]).mockResolvedValueOnce([{ seq: 9 }]);
    expect(await calcularProximoNumeroOp(exec, 'X', { travar: false }, 2027)).toEqual({
      numeroOp: '2027.OP.10000',
      sub: '10',
    });
  });
});
