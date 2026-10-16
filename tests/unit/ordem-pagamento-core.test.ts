import { describe, test, expect, vi, beforeEach } from 'vitest';

// T34-A: o miolo da criação de OP roda dentro de uma transação aberta por quem
// chama; não abre transação, não confere cheque, não trava a NE e não mexe no
// status dela.

const chamadas: Array<[string, any[]]> = [];
let proximoSub = 1;

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('@/lib/services/numeracao-op', () => ({
  calcularProximoNumeroOp: vi.fn(async () => {
    const n = proximoSub++;
    return { numeroOp: `2026.OP.000${n}`, sub: String(n).padStart(2, '0') };
  }),
}));
vi.mock('@/lib/services/calculo-op.service', () => ({
  calcularRetencoesDaOp: vi.fn(async (_conn: any, e: any) => ({
    resultado: {
      itens: { irrf: 150, iss: 500 },
      totalDescontosCents: 650,
      liquidoCents: e.brutoCents - 650,
      snapshot: { mei_sobrescrito: !!e.sobrescreverMei },
      avisos: [],
    },
    configCampos: [],
  })),
}));
vi.mock('@/lib/services/darf.service', () => ({
  entraDarfDaConfig: vi.fn(() => []),
  removerDarfDaOp: vi.fn(),
  sincronizarDarfDaOp: vi.fn(async () => { chamadas.push(['DARF', []]); }),
}));

import { withTransaction } from '@/lib/db';
import { criarOpNaTransacao, ordemPagamentoSchema } from '@/lib/services/ordem-pagamento-core';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';

function mockConn({ valorNe = '100.00', pagoAntes = '0', gastoDepois = '0' } = {}) {
  const conn: any = {
    execute: vi.fn(async (sql: string, params: any[] = []) => {
      chamadas.push([sql, params]);
      if (/^\s*(INSERT|UPDATE)/.test(sql)) return [{ affectedRows: 1 }];
      if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
        return [[{ id: 'ne-1', valor: valorNe, status: 'EMITIDO', elemento: '3.3.90.36 - Outros', subelemento: 'Locação' }]];
      }
      if (sql.includes('SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago')) return [[{ total_pago: pagoAntes }]];
      if (sql.includes('SELECT valor, status FROM notas_empenho WHERE numero = ? FOR UPDATE')) return [[{ valor: valorNe, status: 'EMITIDO' }]];
      if (sql.includes('AS gasto')) return [[{ gasto: gastoDepois, qtd: 1 }]];
      return [[]];
    }),
  };
  return conn;
}

const NE = { valor: '100.00', elemento: '3.3.90.36 - Outros', subelemento: 'Locação' };
const ctx = (extra: Record<string, any> = {}) => ({ usuarioId: 'u1', perfil: 'GESTOR', neRow: NE, chequeFormatado: null, ...extra });
const dados = (extra: Record<string, any> = {}) =>
  ordemPagamentoSchema.parse({ numeroEmpenho: 'NE-1', credorCpfCnpj: '111.111.111-11', valorPagamento: 90, ...extra });

const inserts = () => chamadas.filter(([sql]) => sql.includes('INSERT INTO ordens_pagamento'));
const erro = async (p: Promise<unknown>) => p.then(() => null, (e) => e);

describe('criarOpNaTransacao (T34-A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chamadas.length = 0;
    proximoSub = 1;
  });

  test('grava a OP e devolve número, sub, retenções e saldo restante', async () => {
    const conn = mockConn();
    const op = await criarOpNaTransacao(conn, dados(), ctx({ chequeFormatado: '852963' }));
    expect(op).toMatchObject({
      numeroNe: 'NE-1', numeroOp: '2026.OP.0001', sub: '01', saldoRestante: 10,
      irrf: 1.5, iss: 5, totalDescontos: 6.5, valorLiquido: 83.5,
    });
    expect(inserts()).toHaveLength(1);
    const params = inserts()[0][1];
    expect(params).toContain('852963');
    expect(params).toContain(op.id);
    expect(chamadas.at(-1)?.[0]).toBe('DARF');
  });

  test('não abre transação, não confere cheque, não trava a NE e não grava status', async () => {
    await criarOpNaTransacao(mockConn(), dados({ numeroCheque: '852963' }), ctx({ chequeFormatado: '852963' }));
    expect(withTransaction).not.toHaveBeenCalled();
    const sqls = chamadas.map(([sql]) => sql);
    expect(sqls.some((s) => s.includes('numero_cheque = ?'))).toBe(false);
    expect(sqls.some((s) => s.includes('FROM notas_empenho'))).toBe(false);
    expect(sqls.some((s) => s.startsWith('UPDATE notas_empenho'))).toBe(false);
  });

  test('elemento/subelemento gravados vêm da NE, nunca do payload', async () => {
    await criarOpNaTransacao(mockConn(), dados({ elemento: '3.3.90.33 - Outro', subelemento: 'X' }), ctx());
    const params = inserts()[0][1];
    expect(params).toContain('3.3.90.36 - Outros');
    expect(params).toContain('Locação');
    expect(params).not.toContain('3.3.90.33 - Outro');
  });

  test('saldo em centavos: 422 quando passa do restante da NE', async () => {
    const e: any = await erro(criarOpNaTransacao(mockConn({ pagoAntes: '0.10' }), dados({ valorPagamento: 0.21 }), ctx({ neRow: { ...NE, valor: '0.30' } })));
    expect(e).toMatchObject({ status: 422 });
    expect(e.error).toContain('Saldo insuficiente');
    expect(inserts()).toHaveLength(0);
  });

  test('400 quando a soma dos itens não bate com o valor a pagar', async () => {
    const itens = [{ quantidade: 1, valorUnitario: 50 }];
    expect(await erro(criarOpNaTransacao(mockConn(), dados({ itens }), ctx()))).toMatchObject({ status: 400 });
    expect(inserts()).toHaveLength(0);
  });

  test('400 quando a lista de itens é grande demais', async () => {
    const itens = [{ quantidade: 1, valorUnitario: 90, especificacao: 'x'.repeat(70000) }];
    const e: any = await erro(criarOpNaTransacao(mockConn(), dados({ itens }), ctx()));
    expect(e).toMatchObject({ status: 400 });
    expect(e.error).toContain('muito grande');
  });

  test('MEI sobrescrito grava a auditoria', async () => {
    await criarOpNaTransacao(mockConn(), dados({ sobrescreverMei: true }), ctx({ perfil: 'ADMIN' }));
    expect(chamadas.some(([sql]) => sql.includes('INSERT INTO auditoria_financeira'))).toBe(true);
  });

  test('duas chamadas na mesma conexão gravam duas OPs com números distintos (base do lote)', async () => {
    const conn = mockConn();
    const a = await criarOpNaTransacao(conn, dados({ valorPagamento: 40 }), ctx());
    const b = await criarOpNaTransacao(conn, dados({ valorPagamento: 50 }), ctx());
    expect(inserts()).toHaveLength(2);
    expect([a.sub, b.sub]).toEqual(['01', '02']);
    expect(a.id).not.toBe(b.id);
  });
});

describe('OrdemPagamentoService.criar depois da extração', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chamadas.length = 0;
    proximoSub = 1;
  });

  test('mesma ordem de sempre: cheque → NE travada → soma → INSERT → DARF → status', async () => {
    const conn = mockConn({ gastoDepois: '90.00' });
    (withTransaction as any).mockImplementation(async (cb: any) => cb(conn));
    const r = await OrdemPagamentoService.criar(
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '111.111.111-11', valorPagamento: 90, numeroCheque: ' 852963 ' },
      'u1',
      'GESTOR'
    );
    expect(r).toMatchObject({ success: true, status: 201, data: { numeroOp: '2026.OP.0001', sub: '01', saldoRestante: 10 } });
    if (r.success) expect(r.data).not.toHaveProperty('numeroNe'); // resposta igual à de antes

    const posicao = (trecho: string) => chamadas.findIndex(([sql]) => sql.includes(trecho));
    const ordem = [
      posicao('WHERE numero_cheque = ?'),
      posicao('SELECT id, valor, status, elemento, subelemento FROM notas_empenho'),
      posicao('as total_pago'),
      posicao('INSERT INTO ordens_pagamento'),
      posicao('DARF'),
      posicao('UPDATE notas_empenho SET status'),
    ];
    expect(ordem.every((i) => i >= 0)).toBe(true);
    expect([...ordem].sort((x, y) => x - y)).toEqual(ordem);
    expect(chamadas.find(([sql]) => sql.includes('numero_cheque = ?'))?.[1]).toEqual(['852963']);
  });
});
