// B9 — IR de PJ pela natureza (3.3.90.39) e credor do Simples Nacional, do
// banco simulado até a prévia, a OP gravada, a configuração e o cadastro.
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
import { POST as postPrevia } from '@/app/api/ordens-pagamento/previa/route';
import { GET as getConfig } from '@/app/api/configuracoes/retencoes/route';
import { PUT as putIrrf } from '@/app/api/configuracoes/retencoes/subelementos/irrf/route';
import { POST as postCredor, GET as getCredores } from '@/app/api/credores/route';
import { PUT as putCredor } from '@/app/api/credores/[id]/route';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';
import { obterConfigRetencoes, salvarAliquotaIrrfSubelemento } from '@/lib/services/config-retencoes.service';

const CONFIG_ROWS = [
  ['irrf', 'IRRF', 'PERCENTUAL', '1.5000', 0], ['iss', 'ISS', 'PERCENTUAL', '5.0000', 0],
  ['inss', 'INSS', 'PERCENTUAL', '11.0000', 1], ['patronal', 'Patronal', 'PERCENTUAL', '20.0000', 1],
  ['sest_senat', 'SEST/SENAT', 'PERCENTUAL', '2.5000', 1], ['outros', 'Outros', 'VALOR_DIGITADO', null, 0],
  ['taxa_bancaria', 'Taxa bancária', 'VALOR_DIGITADO', null, 0], ['taxa_pix', 'Taxa PIX', 'VALOR_DIGITADO', null, 0],
].map(([campo, rotulo, tipo, aliquota, entra], i) => ({
  campo, rotulo, tipo, aliquota, calculo_automatico: tipo === 'PERCENTUAL' ? 1 : 0,
  editavel_operador: String(campo).startsWith('taxa') ? 1 : 0, entra_darf: entra, ativo: 1, ordem: i, updated_at: new Date('2026-01-01'),
}));
const LIMPEZA = '3.3.90.39.22 - Limpeza';
const semTabela = Object.assign(new Error("Table 'empenho.subelemento_irrf' doesn't exist"), { code: 'ER_NO_SUCH_TABLE', errno: 1146 });

interface Cenario {
  subelemento?: string;
  simples?: boolean;
  /** null = a tabela subelemento_irrf não existe (migration_22 não rodou). */
  aliquotas?: Array<{ subelemento_codigo: string; aliquota: string }> | null;
}

function responder(sql: string, { subelemento = LIMPEZA, simples = false, aliquotas = [{ subelemento_codigo: '3.3.90.39.22', aliquota: '4.8000' }] }: Cenario = {}): any[] {
  if (sql.includes('FROM notas_empenho')) {
    return [{ id: 'ne-1', valor: '100000.00', status: 'EMITIDO', elemento: '3.3.90.39 - Outros Serviços de Terceiros - PJ', subelemento }];
  }
  if (sql.includes('SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago')) return [{ total_pago: 0 }];
  if (sql.includes('FROM credores')) return [{ municipioExpediente: null, is_mei: 0, is_simples: simples ? 1 : 0 }];
  if (sql.includes('SELECT * FROM config_retencoes')) return CONFIG_ROWS;
  if (sql.includes('MAX(updated_at)')) return [{ versao: '2026-01-01T00:00:00.000Z' }];
  if (sql.includes('SELECT codigo FROM elementos_despesa')) return [{ codigo: '3.3.90.39' }, { codigo: '3.3.90.30' }];
  // Matriz depois do ajuste na tela: 3.3.90.39 só com IRRF e ISS.
  if (sql.includes('FROM elemento_retencoes')) {
    return [
      { elemento_codigo: '3.3.90.39', campo: 'irrf' }, { elemento_codigo: '3.3.90.39', campo: 'iss' },
      ...['irrf', 'iss', 'inss', 'patronal', 'sest_senat'].map((campo) => ({ elemento_codigo: '3.3.90.30', campo })),
    ];
  }
  if (sql.includes('FROM subelemento_retencoes')) return [];
  if (sql.includes('FROM subelemento_irrf')) {
    if (aliquotas === null) throw semTabela;
    return aliquotas;
  }
  return [];
}

async function previa(cenario: Cenario = {}, valorPagamento = 10000) {
  (query as any).mockImplementation(async (sql: string) => responder(sql, cenario));
  const res: any = await postPrevia(
    new NextRequest('http://localhost:3000/api/ordens-pagamento/previa', {
      method: 'POST',
      body: JSON.stringify({ numeroEmpenho: 'NE-1', credorCpfCnpj: '11.222.333/0001-81', valorPagamento }),
    })
  );
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'GESTOR' });
});

describe('prévia da OP de 3.3.90.39', () => {
  test('Limpeza (4,80%) em R$ 10.000,00: IR 480 + ISS 500 → líquido 9.020', async () => {
    const { status, body } = await previa();
    expect(status).toBe(200);
    expect(body.itens).toMatchObject({ irrf: 480, iss: 500, inss: 0, sest_senat: 0, patronal: 0 });
    expect(body.valorLiquido).toBe(9020);
  });

  test('sem natureza: 1,5%', async () => {
    expect((await previa({ subelemento: '' })).body.itens.irrf).toBe(150);
  });

  test('migration_22 não rodada (sem a tabela): 1,5%, sem erro', async () => {
    const { status, body } = await previa({ aliquotas: null });
    expect(status).toBe(200);
    expect(body.itens.irrf).toBe(150);
  });

  test('credor do Simples: IR 0, ISS continua, com aviso', async () => {
    const { body } = await previa({ simples: true });
    expect(body.itens).toMatchObject({ irrf: 0, iss: 500 });
    expect(body.avisos).toContain('Credor do Simples Nacional: sem retenção de IR.');
    const sql = (query as any).mock.calls.map((c: any[]) => c[0]).find((s: string) => s.includes('FROM credores'));
    expect(sql).toContain('is_simples');
  });
});

describe('OP gravada', () => {
  test('grava o IR pela natureza, o snapshot e não gera DARF', async () => {
    const chamadas: Array<[string, any[]]> = [];
    (withTransaction as any).mockImplementation(async (cb: any) =>
      cb({
        execute: vi.fn(async (sql: string, params: any[] = []) => {
          chamadas.push([sql, params]);
          if (/^\s*(INSERT|UPDATE|DELETE)/.test(sql)) return [{ affectedRows: 1 }];
          return [responder(sql)];
        }),
      })
    );
    const r = await OrdemPagamentoService.criar(
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '11.222.333/0001-81', valorPagamento: 10000, dataPagamento: '2026-10-15' },
      'u1',
      'GESTOR'
    );
    expect(r.success).toBe(true);
    const p = chamadas.find(([s]) => s.includes('INSERT INTO ordens_pagamento'))![1];
    expect(p.slice(18, 23)).toEqual([480, 500, 0, 0, 0]); // irrf, iss, inss, sest_senat, patronal
    expect(p[27]).toBe(9020);
    const snap = JSON.parse(p[28]);
    expect(snap.irrf_natureza).toEqual({ subelemento: '3.3.90.39.22', aliquota: 4.8 });
    expect(snap.campos.irrf.aliquota).toBe(4.8);
    expect(chamadas.some(([s]) => s.includes('INSERT INTO darf_acompanhamento'))).toBe(false);
  });
});

describe('configuração: alíquota do IR por natureza', () => {
  test('GET devolve irrfSubelemento (número); tabela inexistente → {}; transporte ignorado', async () => {
    (query as any).mockImplementation(async (sql: string) =>
      responder(sql, { aliquotas: [{ subelemento_codigo: '3.3.90.39.22', aliquota: '4.8000' }, { subelemento_codigo: '3.3.90.33.01', aliquota: '1.0000' }] })
    );
    const res: any = await getConfig(new NextRequest('http://localhost:3000/api/configuracoes/retencoes'));
    expect((await res.json()).irrfSubelemento).toEqual({ '3.3.90.39.22': 4.8 });
    (query as any).mockImplementation(async (sql: string) => responder(sql, { aliquotas: null }));
    expect((await obterConfigRetencoes()).irrfSubelemento).toEqual({});
  });

  const put = async (body: any) => {
    const res: any = await putIrrf(
      new NextRequest('http://localhost:3000/api/configuracoes/retencoes/subelementos/irrf', { method: 'PUT', body: JSON.stringify(body) })
    );
    return { status: res.status, body: await res.json() };
  };
  function mockPut({ existe = true, atual = null as string | null, erro = null as any } = {}) {
    const chamadas: Array<[string, any[]]> = [];
    (withTransaction as any).mockImplementation(async (cb: any) =>
      cb({
        execute: vi.fn(async (sql: string, params: any[] = []) => {
          chamadas.push([sql, params]);
          if (sql.includes('FROM subelementos_despesa')) return [existe ? [{ codigo: params[0] }] : []];
          if (sql.includes('FROM subelemento_irrf')) {
            if (erro) throw erro;
            return [atual === null ? [] : [{ aliquota: atual }]];
          }
          return [{ affectedRows: 1 }];
        }),
      })
    );
    return chamadas;
  }

  test.each(['GESTOR', 'CONSULTA'])('%s → 403 sem transação', async (perfil: string) => {
    (getAuthUser as any).mockResolvedValue({ id: 'u', perfil });
    mockPut();
    expect((await put({ subelementoCodigo: '3.3.90.39.22', aliquota: 4.8 })).status).toBe(403);
    expect(withTransaction).not.toHaveBeenCalled();
    expect(await salvarAliquotaIrrfSubelemento({ subelementoCodigo: '3.3.90.39.22', aliquota: 4.8 }, 'u', perfil)).toMatchObject({ status: 403 });
  });

  test('ADMIN grava e audita o antes e o depois', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'adm', perfil: 'ADMIN' });
    const chamadas = mockPut({ atual: '4.8000' });
    const { status, body } = await put({ subelementoCodigo: '3.3.90.39.22', aliquota: 5 });
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, aliquota: 5 });
    const ins = chamadas.find(([s]) => s.includes('INSERT INTO subelemento_irrf'))!;
    expect(ins[1]).toEqual(['3.3.90.39.22', 5, 'adm']);
    const audit = chamadas.find(([s]) => s.includes('INSERT INTO auditoria_financeira'))!;
    expect(audit[1].slice(1, 4)).toEqual(['subelemento_irrf', '3.3.90.39.22', 'UPDATE']);
    expect(JSON.parse(audit[1][4])).toEqual({ aliquota: 4.8 });
    expect(JSON.parse(audit[1][5])).toEqual({ aliquota: 5 });
  });

  test('null tira a alíquota (volta ao padrão); igual ao salvo não grava', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'adm', perfil: 'ADMIN' });
    let chamadas = mockPut({ atual: '4.8000' });
    expect((await put({ subelementoCodigo: '3.3.90.39.22', aliquota: null })).status).toBe(200);
    expect(chamadas.some(([s]) => s.includes('DELETE FROM subelemento_irrf'))).toBe(true);
    chamadas = mockPut({ atual: '4.8000' });
    expect((await put({ subelementoCodigo: '3.3.90.39.22', aliquota: 4.8 })).status).toBe(200);
    expect(chamadas.filter(([s]) => /^\s*(INSERT|DELETE)/.test(s))).toEqual([]);
  });

  test('inválidos: alíquota fora de 0–100, código de elemento, transporte, subelemento inexistente', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'adm', perfil: 'ADMIN' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockPut();
    expect((await put({ subelementoCodigo: '3.3.90.39.22', aliquota: 101 })).status).toBe(400);
    expect((await put({ subelementoCodigo: '3.3.90.39.22', aliquota: -1 })).status).toBe(400);
    expect((await put({ subelementoCodigo: '3.3.90.39', aliquota: 1 })).status).toBe(400);
    expect((await put({ subelementoCodigo: '3.3.90.33.01', aliquota: 1 })).status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
    mockPut({ existe: false });
    expect((await put({ subelementoCodigo: '3.3.90.39.99', aliquota: 1 })).status).toBe(400);
    vi.mocked(console.error).mockRestore();
  });

  test('sem a migration_22: 409 pedindo para rodar', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'adm', perfil: 'ADMIN' });
    mockPut({ erro: semTabela });
    const { status, body } = await put({ subelementoCodigo: '3.3.90.39.22', aliquota: 4.8 });
    expect(status).toBe(409);
    expect(body.error).toContain('migration_22');
  });
});

describe('cadastro do credor: Simples Nacional', () => {
  test('POST grava is_simples; GET devolve isSimples', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'adm', perfil: 'ADMIN' });
    (query as any).mockImplementation(async (sql: string) => (sql.includes('ativo = 0') ? [] : [{ id: '1' }]));
    const res: any = await postCredor(
      new NextRequest('http://localhost:3000/api/credores', {
        method: 'POST',
        body: JSON.stringify({ nome: 'Empresa Simples LTDA', cpfCnpj: '11.222.333/0001-81', isSimples: true }),
      })
    );
    expect(res.status).toBe(201);
    const insert = (query as any).mock.calls.find((c: any[]) => String(c[0]).includes('INSERT INTO credores'));
    const colunas = String(insert[0]).slice(String(insert[0]).indexOf('(') + 1, String(insert[0]).indexOf(')')).split(',').map((x) => x.trim());
    expect(insert[1][colunas.indexOf('is_simples')]).toBe(1);
    expect(insert[1][colunas.indexOf('is_mei')]).toBe(0);

    vi.mocked(query).mockClear();
    (query as any).mockImplementation(async (sql: string) =>
      sql.includes('COUNT(*)') ? [{ total: 1 }] : [{ id: 'c1', nome: 'Empresa', isSimples: 1 }]
    );
    await getCredores(new NextRequest('http://localhost:3000/api/credores', { method: 'GET' }));
    const sql = (query as any).mock.calls.find((c: any[]) => String(c[0]).includes('FROM credores') && !String(c[0]).includes('COUNT'))[0];
    expect(sql).toContain('is_simples as isSimples');
  });

  test('PUT grava is_simples', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'adm', perfil: 'ADMIN' });
    const sqls: Array<[string, any[]]> = [];
    (withTransaction as any).mockImplementation(async (cb: any) =>
      cb({
        execute: vi.fn(async (sql: string, params: any[] = []) => {
          sqls.push([sql, params]);
          if (sql.includes('FOR UPDATE')) return [[{ id: 'c1' }]];
          if (sql.includes('SELECT id FROM usuarios')) return [[{ id: 'adm' }]];
          if (sql.includes('UPDATE credores')) return [{ affectedRows: 1 }];
          return [[]];
        }),
      })
    );
    (query as any).mockResolvedValue([]);
    const chamar = async (extra: object) =>
      putCredor(
        new NextRequest('http://localhost:3000/api/credores/c1', {
          method: 'PUT',
          body: JSON.stringify({ nome: 'Empresa', cpfCnpj: '11.222.333/0001-81', ...extra }),
        }),
        { params: Promise.resolve({ id: 'c1' }) } as any
      );
    const res: any = await chamar({ isSimples: true });
    expect(res.status).toBe(200);
    const upd = sqls.find(([s]) => s.includes('UPDATE credores'));
    expect(upd).toBeDefined();
    const cols = upd![0].slice(upd![0].indexOf('SET') + 3, upd![0].indexOf('WHERE')).split(',').map((x) => x.trim().split(' ')[0]);
    expect(upd![1][cols.indexOf('is_simples')]).toBe(1);
  });
});
