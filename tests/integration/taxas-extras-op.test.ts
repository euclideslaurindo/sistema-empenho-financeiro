// B12 — taxas personalizadas do cadastro (rota) até a OP gravada, a edição,
// a exclusão e a DARF.
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
import { POST as postCampo } from '@/app/api/configuracoes/retencoes/campos/route';
import { PUT as putConfig } from '@/app/api/configuracoes/retencoes/route';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';

const linhaConfig = (campo: string, rotulo: string, tipo: string, aliquota: string | null, entra = 0, editavel = 0, ordem = 0) => ({
  campo, rotulo, tipo, aliquota, calculo_automatico: tipo === 'PERCENTUAL' ? 1 : 0, editavel_operador: editavel,
  entra_darf: entra, ativo: 1, ordem, updated_at: new Date('2026-01-01'),
});
const CONFIG_ROWS = [
  linhaConfig('irrf', 'IRRF', 'PERCENTUAL', '1.5000', 0, 0, 10),
  linhaConfig('iss', 'ISS', 'PERCENTUAL', '5.0000', 0, 0, 20),
  linhaConfig('inss', 'INSS', 'PERCENTUAL', '11.0000', 1, 0, 30),
  linhaConfig('patronal', 'Patronal', 'PERCENTUAL', '20.0000', 1, 0, 40),
  linhaConfig('sest_senat', 'SEST/SENAT', 'PERCENTUAL', '2.5000', 1, 0, 50),
  linhaConfig('x_taxa_ambiental', 'Taxa Ambiental', 'PERCENTUAL', '2.0000', 1, 0, 90),
  linhaConfig('x_contribuicao', 'Contribuição', 'VALOR_DIGITADO', null, 0, 1, 95),
];
const MATRIZ = [
  ...['irrf', 'iss', 'inss', 'patronal', 'sest_senat', 'x_taxa_ambiental'].map((campo) => ({ elemento_codigo: '3.3.90.30', campo })),
];

function responder(sql: string): any[] {
  if (sql.includes('notas_empenho')) {
    return [{ id: 'ne-1', valor: '100000.00', status: 'EMITIDO', elemento: '3.3.90.30 - Material', subelemento: '', saldoDisponivel: 100000 }];
  }
  if (sql.includes('SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago')) return [{ total_pago: 0 }];
  if (sql.includes('FROM credores')) return [{ municipioExpediente: null, is_mei: 0, is_simples: 0 }];
  if (sql.includes('SELECT * FROM config_retencoes')) return CONFIG_ROWS;
  if (sql.includes('MAX(updated_at)')) return [{ versao: '2026-01-01T00:00:00.000Z' }];
  if (sql.includes('SELECT codigo FROM elementos_despesa')) return [{ codigo: '3.3.90.30' }];
  if (sql.includes('FROM elemento_retencoes')) return MATRIZ;
  return [];
}

function mockTransacao({ oldOp = null as any, darfExistente = null as any } = {}) {
  const chamadas: Array<[string, any[]]> = [];
  (withTransaction as any).mockImplementation(async (cb: any) =>
    cb({
      execute: vi.fn(async (sql: string, params: any[] = []) => {
        chamadas.push([sql, params]);
        if (sql.includes('SELECT * FROM ordens_pagamento WHERE id')) return [[oldOp]];
        if (sql.includes('FROM darf_acompanhamento WHERE ordem_pagamento_id')) return [darfExistente ? [darfExistente] : []];
        if (/^\s*(INSERT|UPDATE|DELETE)/.test(sql)) return [{ affectedRows: 1 }];
        return [responder(sql)];
      }),
    })
  );
  return chamadas;
}
const extrasGravadas = (chamadas: Array<[string, any[]]>) =>
  chamadas.filter(([s]) => s.includes('INSERT INTO op_retencoes_extras')).map(([, p]) => p);

beforeEach(() => {
  vi.clearAllMocks();
  (getAuthUser as any).mockResolvedValue({ id: 'adm', perfil: 'ADMIN' });
});

describe('criar taxa (POST /api/configuracoes/retencoes/campos)', () => {
  const post = async (body: any) => {
    const res: any = await postCampo(new NextRequest('http://localhost:3000/api/configuracoes/retencoes/campos', { method: 'POST', body: JSON.stringify(body) }));
    return { status: res.status, body: await res.json() };
  };
  function mockCriar(existentes = CONFIG_ROWS) {
    const chamadas: Array<[string, any[]]> = [];
    (withTransaction as any).mockImplementation(async (cb: any) =>
      cb({
        execute: vi.fn(async (sql: string, params: any[] = []) => {
          chamadas.push([sql, params]);
          if (sql.includes('SELECT campo, ordem FROM config_retencoes')) return [existentes];
          return [{ affectedRows: 1 }];
        }),
      })
    );
    return chamadas;
  }

  test('ADMIN cria percentual: slug, ordem depois da última, auditada', async () => {
    const chamadas = mockCriar();
    const { status, body } = await post({ rotulo: 'Taxa Nova', tipo: 'PERCENTUAL', aliquota: 3, entraDarf: true });
    expect(status).toBe(201);
    expect(body.campo).toMatchObject({ campo: 'x_taxa_nova', aliquota: 3, entraDarf: true, ordem: 105 });
    const ins = chamadas.find(([s]) => s.includes('INSERT INTO config_retencoes'))!;
    expect(ins[1]).toEqual(['x_taxa_nova', 'Taxa Nova', 'PERCENTUAL', 3, 1, 0, 1, 105, 'adm']);
    expect(chamadas.find(([s]) => s.includes('auditoria_financeira'))![1].slice(1, 4)).toEqual(['config_retencoes', 'x_taxa_nova', 'CREATE']);
  });

  test('digitada: sem alíquota, editável, fora da DARF', async () => {
    const chamadas = mockCriar();
    expect((await post({ rotulo: 'Taxa Livre', tipo: 'VALOR_DIGITADO', entraDarf: true })).status).toBe(201);
    expect(chamadas.find(([s]) => s.includes('INSERT INTO config_retencoes'))![1]).toEqual(['x_taxa_livre', 'Taxa Livre', 'VALOR_DIGITADO', null, 0, 1, 0, 105, 'adm']);
  });

  test('colisão → 409; GESTOR → 403; inválidos → 400', async () => {
    mockCriar();
    expect((await post({ rotulo: 'Taxa Ambiental', tipo: 'PERCENTUAL', aliquota: 1 })).status).toBe(409);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await post({ rotulo: '???', tipo: 'PERCENTUAL', aliquota: 1 })).status).toBe(400);
    expect((await post({ rotulo: 'Sem alíquota', tipo: 'PERCENTUAL' })).status).toBe(400);
    expect((await post({ rotulo: 'X', tipo: 'OUTRO' })).status).toBe(400);
    vi.mocked(console.error).mockRestore();
    (getAuthUser as any).mockResolvedValue({ id: 'g', perfil: 'GESTOR' });
    (withTransaction as any).mockClear();
    expect((await post({ rotulo: 'Taxa Nova', tipo: 'PERCENTUAL', aliquota: 1 })).status).toBe(403);
    expect(withTransaction).not.toHaveBeenCalled();
  });
});

describe('Matriz com "x_"', () => {
  const put = async (regras: any) => {
    const campos = CONFIG_ROWS.map((r) => ({
      campo: r.campo, rotulo: r.rotulo, tipo: r.tipo, aliquota: r.aliquota === null ? null : Number(r.aliquota),
      calculoAutomatico: !!r.calculo_automatico, editavelOperador: !!r.editavel_operador, entraDarf: !!r.entra_darf, ativo: true, ordem: r.ordem,
    }));
    const res: any = await putConfig(new NextRequest('http://localhost:3000/api/configuracoes/retencoes', { method: 'PUT', body: JSON.stringify({ campos, regras }) }));
    return res.status;
  };
  test('percentual existente: grava; inexistente ou digitada: 400', async () => {
    const chamadas = mockTransacao();
    expect(await put({ '3.3.90.30': ['irrf', 'x_taxa_ambiental'] })).toBe(200);
    expect(chamadas.some(([s, p]) => s.includes('INSERT INTO elemento_retencoes') && p[1] === 'x_taxa_ambiental')).toBe(true);
    mockTransacao();
    expect(await put({ '3.3.90.30': ['x_nao_existe'] })).toBe(400);
    mockTransacao();
    expect(await put({ '3.3.90.30': ['x_contribuicao'] })).toBe(400);
  });
});

describe('OP com taxas personalizadas', () => {
  test('cria: grava as "x_" com valor e a DARF soma a percentual marcada', async () => {
    (query as any).mockImplementation(async (sql: string) => responder(sql));
    const chamadas = mockTransacao();
    const r = await OrdemPagamentoService.criar(
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '1', valorPagamento: 1000, dataPagamento: '2026-10-15', extras: { x_contribuicao: 7 } },
      'u1',
      'GESTOR'
    );
    expect(r.success).toBe(true);
    const id = chamadas.find(([s]) => s.includes('INSERT INTO ordens_pagamento'))![1][0];
    expect(extrasGravadas(chamadas)).toEqual([
      [id, 'x_taxa_ambiental', 20],
      [id, 'x_contribuicao', 7],
    ]);
    const op = chamadas.find(([s]) => s.includes('INSERT INTO ordens_pagamento'))![1];
    // 1000 − IRRF 15 − ISS 50 − INSS 110 − SEST 25 − ambiental 20 − contribuição 7 (patronal fora)
    expect(op[27]).toBe(773);
    const darf = chamadas.find(([s]) => s.includes('INSERT INTO darf_acompanhamento'))!;
    expect(darf[1][8]).toBe(355); // 110 + 200 + 25 + 20
  });

  const OLD = {
    id: 'op-1', numero_ne: 'NE-1', valor_pagamento: '1000.00', credor_cpf_cnpj: '1', elemento: '3.3.90.30 - Material', subelemento: '',
    irrf: '15.00', iss: '0', inss: '110.00', patronal: '200.00', sest_senat: '25.00', outros_descontos: '0', taxa_bancaria: '0',
    taxa_pix: '0', iss_bs: '0', total_descontos: '170.00', valor_liquido: '830.00', data_pagamento: '2026-10-15',
    retencoes_snapshot: { elemento: '3.3.90.30', subelemento: null, campos: {} },
  };
  const editar = (extra: object) =>
    OrdemPagamentoService.atualizar('op-1', { numeroEmpenho: 'NE-1', credorCpfCnpj: '1', dataPagamento: '2026-10-15', ...extra } as any, 'u1', 'GESTOR');

  test('editar com recálculo substitui as extras; sem recálculo não toca', async () => {
    let chamadas = mockTransacao({ oldOp: OLD });
    expect((await editar({ valorPagamento: 2000 })).success).toBe(true);
    expect(chamadas.some(([s]) => s.includes('DELETE FROM op_retencoes_extras'))).toBe(true);
    expect(extrasGravadas(chamadas)).toEqual([['op-1', 'x_taxa_ambiental', 40]]);

    chamadas = mockTransacao({ oldOp: OLD });
    expect((await editar({ valorPagamento: 1000, historico: 'só texto' })).success).toBe(true);
    expect(chamadas.some(([s]) => s.includes('op_retencoes_extras'))).toBe(false);
  });

  test('excluir apaga as extras junto', async () => {
    const chamadas = mockTransacao({ oldOp: OLD });
    (getAuthUser as any).mockResolvedValue({ id: 'adm', perfil: 'ADMIN' });
    const r = await OrdemPagamentoService.excluir('op-1', 'adm', 'ADMIN', 'motivo de teste');
    expect(r.success).toBe(true);
    const ordem = chamadas.map(([s]) => s);
    const iExtras = ordem.findIndex((s) => s.includes('DELETE FROM op_retencoes_extras'));
    const iOp = ordem.findIndex((s) => s.includes('DELETE FROM ordens_pagamento'));
    expect(iExtras).toBeGreaterThan(-1);
    expect(iExtras).toBeLessThan(iOp);
  });

  test('sem a migration_25 e sem valor extra: a OP grava normalmente', async () => {
    const semExtras = CONFIG_ROWS.filter((r) => !r.campo.startsWith('x_'));
    const chamadas: Array<[string, any[]]> = [];
    (withTransaction as any).mockImplementation(async (cb: any) =>
      cb({
        execute: vi.fn(async (sql: string, params: any[] = []) => {
          chamadas.push([sql, params]);
          if (sql.includes('op_retencoes_extras')) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE', errno: 1146 });
          if (sql.includes('SELECT * FROM config_retencoes')) return [semExtras];
          if (/^\s*(INSERT|UPDATE|DELETE)/.test(sql)) return [{ affectedRows: 1 }];
          return [responder(sql)];
        }),
      })
    );
    const r = await OrdemPagamentoService.criar({ numeroEmpenho: 'NE-1', credorCpfCnpj: '1', valorPagamento: 1000, dataPagamento: '2026-10-15' }, 'u1', 'GESTOR');
    expect(r.success).toBe(true);
    expect(chamadas.some(([s]) => s.includes('op_retencoes_extras'))).toBe(false);
  });
});
