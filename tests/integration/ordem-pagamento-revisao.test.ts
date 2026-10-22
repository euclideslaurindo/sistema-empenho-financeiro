import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Revisão da aba 4 (Ordem de Pagamento): exclusão de OP só por ADMIN e com
// motivo, líquido negativo recusado, valor em texto no formato brasileiro,
// mensagens em R$ 1.234,56 e busca também pela NE.

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Nao autenticado' }) }),
}));
const calculo = { liquidoCents: 0, totalDescontosCents: 0 };
vi.mock('@/lib/services/calculo-op.service', async (importOriginal: () => Promise<any>) => ({
  ...(await importOriginal()),
  calcularRetencoesDaOp: vi.fn(async () => ({
    resultado: { itens: { outros: calculo.totalDescontosCents }, ...calculo, snapshot: {}, avisos: [], informativos: [] },
    configCampos: [],
    perfilCalculo: 'PADRAO',
  })),
}));
vi.mock('@/lib/services/darf.service', () => ({
  entraDarfDaConfig: vi.fn(() => []),
  removerDarfDaOp: vi.fn(),
  sincronizarDarfDaOp: vi.fn(),
}));

import { query, withTransaction } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { DELETE } from '@/app/api/ordens-pagamento/[id]/route';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';
import { garantirLiquidoNaoNegativo, mensagemItensNaoBatem, ordemPagamentoSchema } from '@/lib/services/ordem-pagamento-core';

/** Conexão simulada pelo texto do SQL; guarda as chamadas. */
function conexao({ valorNe = '1000.00', pago = '0', oldOp = null as any } = {}) {
  const chamadas: Array<[string, any[]]> = [];
  const execute = vi.fn(async (sql: string, params: any[] = []) => {
    chamadas.push([sql, params]);
    if (/^\s*(INSERT|DELETE|UPDATE)/.test(sql)) return [{ affectedRows: 1 }];
    if (sql.includes('FROM notas_empenho')) return [[{ id: 'ne-1', valor: valorNe, status: 'EMITIDO', elemento: '', subelemento: '' }]];
    if (sql.includes('total_pago')) return [[{ total_pago: pago }]];
    if (sql.includes('AS gasto')) return [[{ gasto: '0', qtd: 0 }]];
    if (sql.includes('SELECT * FROM ordens_pagamento WHERE id')) return [oldOp ? [oldOp] : []];
    return [[]];
  });
  (withTransaction as any).mockImplementation(async (cb: any) => cb({ execute }));
  return chamadas;
}

const excluir = (corpo?: unknown) =>
  DELETE(
    new NextRequest('http://localhost:3000/api/ordens-pagamento/op-1', {
      method: 'DELETE',
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    }),
    { params: Promise.resolve({ id: 'op-1' }) }
  ) as any;

describe('O1: excluir OP', () => {
  beforeEach(() => vi.clearAllMocks());

  test.each(['GESTOR', 'CONSULTA'])('perfil %s: 403 e nada é apagado', async (perfil: string) => {
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil });
    const res = await excluir({ motivo: 'TESTE valor errado' });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Só o administrador pode excluir uma ordem de pagamento.');
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test.each([undefined, {}, { motivo: '' }, { motivo: '  abc ' }])('ADMIN sem motivo válido (%j): 400', async (corpo: any) => {
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'ADMIN' });
    const res = await excluir(corpo);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('motivo');
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('ADMIN com motivo: apaga, devolve o saldo e grava o motivo na auditoria', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'ADMIN' });
    const chamadas = conexao({ oldOp: { id: 'op-1', numero_ne: 'NE-1', valor_pagamento: '90.00' } });
    const res = await excluir({ motivo: '  TESTE valor digitado errado  ' });
    expect(res.status).toBe(200);
    expect(chamadas.some(([s]) => s.startsWith('DELETE FROM ordens_pagamento'))).toBe(true);
    const [, params] = chamadas.find(([s]) => s.includes('INSERT INTO auditoria_financeira'))!;
    expect(params[3]).toBe('DELETE');
    expect(JSON.parse(params[4]).valor_pagamento).toBe('90.00');
    expect(JSON.parse(params[5])).toEqual({ motivo: 'TESTE valor digitado errado' });
    expect(params[6]).toBe('u1');
  });
});

describe('O3: líquido negativo', () => {
  beforeEach(() => vi.clearAllMocks());

  test('garantirLiquidoNaoNegativo recusa com os valores em R$', () => {
    expect(() => garantirLiquidoNaoNegativo({ liquidoCents: 0, totalDescontosCents: 100000 }, 100000)).not.toThrow();
    expect(() => garantirLiquidoNaoNegativo({ liquidoCents: -1, totalDescontosCents: 100001 }, 100000)).toThrow();
    try {
      garantirLiquidoNaoNegativo({ liquidoCents: -50000, totalDescontosCents: 150000 }, 100000);
    } catch (e: any) {
      expect(e).toEqual({ status: 400, error: 'O total de descontos (R$ 1.500,00) é maior que o valor a pagar (R$ 1.000,00).' });
    }
  });

  test('criar OP com descontos maiores que o bruto: 400 e nada gravado', async () => {
    calculo.liquidoCents = -50000;
    calculo.totalDescontosCents = 150000;
    const chamadas = conexao();
    const r = await OrdemPagamentoService.criar(
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '111.111.111-11', valorPagamento: 1000, outrosDescontos: 1500 },
      'u1',
      'GESTOR'
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.status).toBe(400);
      expect(r.error).toContain('O total de descontos (R$ 1.500,00)');
    }
    expect(chamadas.some(([s]) => s.includes('INSERT INTO ordens_pagamento'))).toBe(false);
  });

  test('líquido zero ou positivo continua gravando', async () => {
    calculo.liquidoCents = 0;
    calculo.totalDescontosCents = 100000;
    const chamadas = conexao();
    const r = await OrdemPagamentoService.criar(
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '111.111.111-11', valorPagamento: 1000, outrosDescontos: 1000 },
      'u1',
      'GESTOR'
    );
    expect(r.success).toBe(true);
    expect(chamadas.some(([s]) => s.includes('INSERT INTO ordens_pagamento'))).toBe(true);
  });
});

describe('O4: valor em texto', () => {
  const base = { numeroEmpenho: 'NE-1', credorCpfCnpj: '1' };
  test.each([
    ['1.234,56', 1234.56],
    ['1234.56', 1234.56],
    ['100,00', 100],
    [1500, 1500],
  ])('valorPagamento %j é lido como %d', (valor: any, esperado: number) => {
    expect(ordemPagamentoSchema.parse({ ...base, valorPagamento: valor }).valorPagamento).toBe(esperado);
  });

  test('texto inválido continua recusado (valor zero)', () => {
    expect(ordemPagamentoSchema.safeParse({ ...base, valorPagamento: 'abc' }).success).toBe(false);
  });

  test('retenção informada em texto BR também', () => {
    expect(ordemPagamentoSchema.parse({ ...base, valorPagamento: 2000, outrosDescontos: '1.000,50' }).outrosDescontos).toBe(1000.5);
  });
});

describe('O8: mensagens em R$ 1.234,56', () => {
  beforeEach(() => vi.clearAllMocks());

  test('itens que não batem: sem "Fraude", com os valores em R$', () => {
    expect(mensagemItensNaoBatem(123450, 100000)).toBe(
      'A soma dos itens (R$ 1.234,50) não bate com o valor a pagar da OP (R$ 1.000,00). Confira os itens.'
    );
  });

  test('saldo insuficiente com ponto de milhar e vírgula', async () => {
    conexao({ valorNe: '1500.00', pago: '0' });
    const r = await OrdemPagamentoService.criar({ numeroEmpenho: 'NE-1', credorCpfCnpj: '1', valorPagamento: 2000.5 }, 'u1', 'GESTOR');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe('Saldo insuficiente. Saldo disponível da NE: R$ 1.500,00. Valor solicitado: R$ 2.000,50');
  });
});

describe('O7: busca das OPs também pelo número da NE', () => {
  beforeEach(() => vi.clearAllMocks());

  test('a busca compara numero_ne', async () => {
    (query as any).mockImplementation(async (sql: string) => (sql.includes('COUNT(*)') ? [{ total: 0 }] : []));
    await OrdemPagamentoService.listar({ busca: '2026NE0001' });
    for (const [sql, params] of (query as any).mock.calls) {
      expect(sql).toContain('numero_ne LIKE ?');
      expect(params.filter((p: any) => p === '%2026NE0001%')).toHaveLength(4);
    }
  });
});
