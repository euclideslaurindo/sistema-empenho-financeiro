// B13 — rota da justificativa de sobra: GET (saldo do servidor + salva) e PUT
// (grava com o saldo do servidor, audita; perfis e erros).
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
import { GET, PUT } from '@/app/api/notas-empenho/justificativa/route';

const semTabela = Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE', errno: 1146 });
const NE = { numero: '2026NE000007', exercicio: '2026', historico: 'Transporte escolar', status: 'PARCIALMENTE PAGO', valor: '2000.00' };

function mockLeitura({ ne = NE as any, gasto = '1500.00', salva = null as any, tabela = true } = {}) {
  (query as any).mockImplementation(async (sql: string) => {
    if (sql.includes('FROM notas_empenho WHERE numero = ? LIMIT 1')) return ne ? [ne] : [];
    if (sql.includes('SELECT valor FROM notas_empenho')) return ne ? [{ valor: ne.valor }] : [];
    if (sql.includes('SUM(valor_pagamento)')) return [{ gasto, qtd: 1 }];
    if (sql.includes('FROM justificativas_saldo')) {
      if (!tabela) throw semTabela;
      return salva ? [salva] : [];
    }
    if (sql.includes('FROM usuarios')) return [{ nome: 'Amanda' }];
    return [];
  });
}
function mockGravacao({ antes = null as any, tabela = true } = {}) {
  const chamadas: Array<[string, any[]]> = [];
  (withTransaction as any).mockImplementation(async (cb: any) =>
    cb({
      execute: vi.fn(async (sql: string, params: any[] = []) => {
        chamadas.push([sql, params]);
        if (sql.includes('SELECT valor FROM notas_empenho')) return [[{ valor: NE.valor }]];
        if (sql.includes('SUM(valor_pagamento)')) return [[{ gasto: '1500.00', qtd: 1 }]];
        if (sql.includes('FROM justificativas_saldo')) {
          if (!tabela) throw semTabela;
          return [antes ? [antes] : []];
        }
        return [{ affectedRows: 1 }];
      }),
    })
  );
  return chamadas;
}

const url = (ne = NE.numero) => `http://localhost:3000/api/notas-empenho/justificativa?ne=${encodeURIComponent(ne)}`;
const ler = async (ne?: string) => {
  const res: any = await GET(new NextRequest(url(ne)));
  return { status: res.status, body: await res.json() };
};
const gravar = async (body: any, ne?: string) => {
  const res: any = await PUT(new NextRequest(url(ne), { method: 'PUT', body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};
const CORPO = {
  objeto: 'Transporte escolar', valorAtualizado: 512.3, outros: '', textoDevolucao: 'Devolvido via GR.',
  motivos: [{ codigo: 'parcial', texto: 'Execução parcial do recurso.' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'GESTOR' });
});

describe('GET', () => {
  test('sem justificativa: saldo do servidor e valores iniciais', async () => {
    mockLeitura();
    const { status, body } = await ler();
    expect(status).toBe(200);
    expect(body.saldo).toEqual({ valor: 2000, gasto: 1500, restante: 500 });
    expect(body.dados).toMatchObject({ numeroNe: NE.numero, objeto: 'Transporte escolar', valorSaldo: 500, valorAtualizado: 500, motivos: [] });
    expect(body.salva).toBeNull();
  });

  test('com justificativa salva: volta o salvo, quem e quando', async () => {
    mockLeitura({
      salva: {
        id: 'j1', numero_ne: NE.numero, exercicio: '2026', objeto: 'Salvo', valor_saldo: '600.00', valor_atualizado: '610.00',
        motivos: JSON.stringify([{ codigo: 'prazo', texto: 'Prazo...' }]), outros: 'Outro', texto_devolucao: 'Dev.',
        usuario_id: 'u9', updated_at: '2026-11-10T12:00:00Z',
      },
    });
    const { body } = await ler();
    expect(body.dados).toMatchObject({ objeto: 'Salvo', valorSaldo: 500, valorAtualizado: 610, motivos: [{ codigo: 'prazo', texto: 'Prazo...' }], outros: 'Outro' });
    expect(body.salva).toMatchObject({ por: 'Amanda', valorSaldoSalvo: 600 });
  });

  test('sem a migration_26: abre como nova; NE inexistente: 404', async () => {
    mockLeitura({ tabela: false });
    expect((await ler()).body.salva).toBeNull();
    mockLeitura({ ne: null });
    expect((await ler('XX')).status).toBe(404);
  });
});

describe('PUT', () => {
  test('grava com o saldo do SERVIDOR e audita CREATE', async () => {
    mockLeitura();
    const chamadas = mockGravacao();
    const { status } = await gravar({ ...CORPO, valorSaldo: 99999 });
    expect(status).toBe(200);
    const ins = chamadas.find(([s]) => s.includes('INSERT INTO justificativas_saldo'))!;
    expect(ins[1].slice(1, 6)).toEqual([NE.numero, '2026', 'Transporte escolar', 500, 512.3]);
    expect(JSON.parse(ins[1][6])).toEqual([{ codigo: 'parcial', texto: 'Execução parcial do recurso.' }]);
    expect(ins[1][9]).toBe('u1');
    const audit = chamadas.find(([s]) => s.includes('auditoria_financeira'))!;
    expect(audit[1].slice(1, 4)).toEqual(['justificativa_saldo', NE.numero, 'CREATE']);
  });

  test('edição: mesmo id, auditoria UPDATE com o antes', async () => {
    mockLeitura();
    const chamadas = mockGravacao({ antes: { id: 'j1', numero_ne: NE.numero, objeto: 'Velho', motivos: '[]' } });
    expect((await gravar(CORPO)).status).toBe(200);
    expect(chamadas.find(([s]) => s.includes('INSERT INTO justificativas_saldo'))![1][0]).toBe('j1');
    const audit = chamadas.find(([s]) => s.includes('auditoria_financeira'))!;
    expect(audit[1][3]).toBe('UPDATE');
    expect(JSON.parse(audit[1][4]).objeto).toBe('Velho');
  });

  test('sem motivo: 400; CONSULTA: 403; NE cancelada: 409; sem tabela: 409', async () => {
    mockLeitura();
    mockGravacao();
    expect((await gravar({ ...CORPO, motivos: [], outros: '' })).status).toBe(400);
    (getAuthUser as any).mockResolvedValue({ id: 'c', perfil: 'CONSULTA' });
    expect((await gravar(CORPO)).status).toBe(403);
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'ADMIN' });
    mockLeitura({ ne: { ...NE, status: 'CANCELADO' } });
    expect((await gravar(CORPO)).status).toBe(409);
    mockLeitura();
    mockGravacao({ tabela: false });
    const r = await gravar(CORPO);
    expect(r.status).toBe(409);
    expect(r.body.error).toContain('migration_26');
  });
});
