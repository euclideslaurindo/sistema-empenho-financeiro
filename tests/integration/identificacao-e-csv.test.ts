// B5 — Identificação nos relatórios (GET/PUT) e o CSV das Análises.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Nao autenticado' }) }),
  forbiddenResponse: () => ({ status: 403, json: async () => ({ error: 'Acesso negado' }) }),
}));

import { query, withTransaction } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { GET as getIdent, PUT as putIdent } from '@/app/api/configuracoes/identificacao/route';
import { GET as getCsv } from '@/app/api/analises/csv/route';

const semTabela = Object.assign(new Error("Table 'empenho.configuracoes_gerais' doesn't exist"), { code: 'ER_NO_SUCH_TABLE', errno: 1146 });
const json = async (res: any) => ({ status: res.status, body: await res.json() });
const pedirGet = async () => json(await getIdent(new NextRequest('http://localhost:3000/api/configuracoes/identificacao')));
const pedirPut = async (body: any) =>
  json(await putIdent(new NextRequest('http://localhost:3000/api/configuracoes/identificacao', { method: 'PUT', body: JSON.stringify(body) })));

function mockTransacao({ atual = [] as any[], erro = null as any } = {}) {
  const chamadas: Array<[string, any[]]> = [];
  (withTransaction as any).mockImplementation(async (cb: any) =>
    cb({
      execute: vi.fn(async (sql: string, params: any[] = []) => {
        chamadas.push([sql, params]);
        if (erro) throw erro;
        if (sql.startsWith('SELECT chave, valor')) return [atual];
        return [{ affectedRows: 1 }];
      }),
    })
  );
  return chamadas;
}

beforeEach(() => {
  vi.clearAllMocks();
  (getAuthUser as any).mockResolvedValue({ id: 'adm', perfil: 'ADMIN' });
});

describe('GET /api/configuracoes/identificacao', () => {
  test('sem login → 401', async () => {
    (getAuthUser as any).mockResolvedValue(null);
    expect((await pedirGet()).status).toBe(401);
  });

  test('qualquer perfil lê; valores aparados', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'u', perfil: 'CONSULTA' });
    (query as any).mockResolvedValue([{ chave: 'relatorio.orgao', valor: ' Secretaria X ' }, { chave: 'relatorio.setor', valor: null }]);
    expect(await pedirGet()).toEqual({ status: 200, body: { orgao: 'Secretaria X', setor: '' } });
  });

  test('migration_19 não rodada: devolve vazio, sem erro', async () => {
    (query as any).mockRejectedValue(semTabela);
    expect(await pedirGet()).toEqual({ status: 200, body: { orgao: '', setor: '' } });
  });
});

describe('PUT /api/configuracoes/identificacao', () => {
  test.each(['GESTOR', 'CONSULTA'])('perfil %s → 403, sem transação', async (perfil: string) => {
    (getAuthUser as any).mockResolvedValue({ id: 'u', perfil });
    mockTransacao();
    expect((await pedirPut({ orgao: 'x', setor: 'y' })).status).toBe(403);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('o service também recusa quem não é Admin (segunda trava, além da rota)', async () => {
    const { salvarIdentificacao } = await import('@/lib/services/configuracoes-gerais.service');
    mockTransacao();
    for (const perfil of ['GESTOR', 'CONSULTA']) {
      expect(await salvarIdentificacao({ orgao: 'x', setor: '' }, 'u', perfil)).toMatchObject({ success: false, status: 403 });
    }
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('mais de 120 caracteres → 400', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockTransacao();
    expect((await pedirPut({ orgao: 'x'.repeat(121), setor: '' })).status).toBe(400);
    vi.mocked(console.error).mockRestore();
  });

  test('salva com INSERT … ON DUPLICATE KEY UPDATE, vazio vira NULL, e audita antes e depois', async () => {
    const chamadas = mockTransacao({ atual: [{ chave: 'relatorio.orgao', valor: 'Antiga' }] });
    const { status, body } = await pedirPut({ orgao: '  Secretaria de Educação ', setor: '   ' });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, orgao: 'Secretaria de Educação', setor: '' });
    const upserts = chamadas.filter(([s]) => s.includes('ON DUPLICATE KEY UPDATE'));
    expect(upserts.map(([, p]) => p)).toEqual([
      ['relatorio.orgao', 'Secretaria de Educação', 'adm'],
      ['relatorio.setor', null, 'adm'],
    ]);
    const [, aud] = chamadas.find(([s]) => s.includes('auditoria_financeira'))!;
    expect(aud[1]).toBe('configuracoes_gerais');
    expect(aud[2]).toBe('relatorio.identificacao');
    expect(JSON.parse(aud[4])).toEqual({ orgao: 'Antiga', setor: '' });
    expect(JSON.parse(aud[5])).toEqual({ orgao: 'Secretaria de Educação', setor: '' });
  });

  test('nada mudou: não grava nem audita', async () => {
    const chamadas = mockTransacao({ atual: [{ chave: 'relatorio.orgao', valor: 'A' }, { chave: 'relatorio.setor', valor: 'B' }] });
    expect((await pedirPut({ orgao: 'A', setor: 'B' })).status).toBe(200);
    expect(chamadas.filter(([s]) => !s.startsWith('SELECT'))).toEqual([]);
  });

  test('migration_19 não rodada → 409 com a orientação', async () => {
    mockTransacao({ erro: semTabela });
    const { status, body } = await pedirPut({ orgao: 'x', setor: '' });
    expect(status).toBe(409);
    expect(body.error).toContain('migration_19');
  });
});

describe('GET /api/analises/csv', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T12:00:00'));
    (query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('UNION')) return [{ ano: 2026 }];
      if (sql.includes('GROUP BY mes')) return [{ mes: '2026-02', ops: 1, bruto: '100.10', irrf: '1', iss: '2', inss: '3', sest: '0', patronal: '5', liquido: '94.10', restos: '0', pagoNesPeriodo: '100.10' }];
      if (sql.includes('pg.numero_ne = ne.numero')) return [{ numero: 'NE1', mes: '2026-02', valor: '200.00', status: 'PARCIALMENTE PAGO', pago: '100.10', liquido: '94.10' }];
      if (sql.includes('COUNT(DISTINCT')) return [{ qtd: 1 }];
      if (sql.includes('GROUP BY op.elemento')) return [{ elemento: '3.3.90.36 - PF', pago: '100.10' }];
      return [];
    });
  });
  afterEach(() => vi.useRealTimers());

  const csv = async (qs: string) => {
    const res: any = await getCsv(new NextRequest(`http://localhost:3000/api/analises/csv${qs}`));
    if (typeof res.arrayBuffer !== 'function') return { status: res.status, texto: '', headers: res.headers };
    return { status: res.status, texto: new TextDecoder('utf-8', { ignoreBOM: true }).decode(new Uint8Array(await res.arrayBuffer())), headers: res.headers as Headers };
  };

  test('sem login → 401', async () => {
    (getAuthUser as any).mockResolvedValue(null);
    expect((await csv('?ano=2026')).status).toBe(401);
  });

  test('período inválido → 400', async () => {
    expect((await csv('?periodo=intervalo&inicio=2025-12-01&fim=2026-01-31')).status).toBe(400);
  });

  test('planilha com os números da mesma conta da tela, BOM e nome do arquivo', async () => {
    const { status, texto, headers } = await csv('?periodo=ano&ano=2026&base=exercicio');
    expect(status).toBe(200);
    expect(headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(headers.get('Content-Disposition')).toBe('attachment; filename="analises-2026-exercicio.csv"');
    expect(headers.get('Cache-Control')).toBe('no-store');
    expect(texto.charCodeAt(0)).toBe(0xfeff);
    expect(texto).toContain('Pago no período;100,10;');
    expect(texto).toContain('(=) Saldo a pagar;99,90');
    expect(texto).toContain('Base;Exercício da NE');
  });
});
