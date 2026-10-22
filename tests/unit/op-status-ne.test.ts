import { describe, test, expect, vi, beforeEach } from 'vitest';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
import { withTransaction } from '@/lib/db';

// T31: o status da NE depois de criar/excluir OP vem de recalcularStatusNe
// (regra única, em centavos), e não mais de três cópias da conta.

function mockConn({ valorNe = '100.00', statusNe = 'EMITIDO', pagoAntes = '0', gastoDepois = '0', oldOp = null as any } = {}) {
  const chamadas: Array<[string, any[]]> = [];
  const conn = {
    execute: vi.fn(async (sql: string, params: any[] = []) => {
      chamadas.push([sql, params]);
      if (/^\s*(INSERT|DELETE)/.test(sql)) return [{ affectedRows: 1 }];
      if (sql.startsWith('UPDATE notas_empenho SET status')) return [{ affectedRows: 1 }];
      if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
        return [[{ id: 'ne-1', valor: valorNe, status: statusNe, elemento: '', subelemento: '' }]];
      }
      if (sql.includes('SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago')) return [[{ total_pago: pagoAntes }]];
      // recalcularStatusNe
      if (sql.includes('SELECT valor, status FROM notas_empenho WHERE numero = ? FOR UPDATE')) return [[{ valor: valorNe, status: statusNe }]];
      if (sql.includes('AS gasto')) return [[{ gasto: gastoDepois, qtd: 1 }]];
      if (sql.includes('SELECT * FROM ordens_pagamento WHERE id')) return [oldOp ? [oldOp] : []];
      return [[]];
    }),
  };
  (withTransaction as any).mockImplementation(async (cb: any) => cb(conn));
  const statusGravado = () => chamadas.find(([sql]) => sql.startsWith('UPDATE notas_empenho SET status'))?.[1][0];
  return { chamadas, statusGravado };
}

const criar = (valorPagamento: number) =>
  OrdemPagamentoService.criar({ numeroEmpenho: 'NE-1', credorCpfCnpj: '111.111.111-11', valorPagamento }, 'u1', 'GESTOR');

describe('status da NE pela OP (T31)', () => {
  beforeEach(() => vi.clearAllMocks());

  test('criar OP de 90 numa NE de 100: PARCIALMENTE PAGO e saldoRestante 10', async () => {
    const { statusGravado } = mockConn({ gastoDepois: '90.00' });
    const r = await criar(90);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.saldoRestante).toBe(10);
    expect(statusGravado()).toBe('PARCIALMENTE PAGO');
  });

  test('criar OP que esgota a NE: LIQUIDADO', async () => {
    const { statusGravado } = mockConn({ pagoAntes: '90.00', gastoDepois: '100.00', statusNe: 'PARCIALMENTE PAGO' });
    expect((await criar(10)).success).toBe(true);
    expect(statusGravado()).toBe('LIQUIDADO');
  });

  test('saldo em centavos: 0,30 - 0,10 cabe exatamente 0,20', async () => {
    mockConn({ valorNe: '0.30', pagoAntes: '0.10', gastoDepois: '0.30' });
    expect((await criar(0.2)).success).toBe(true);
    mockConn({ valorNe: '0.30', pagoAntes: '0.10', gastoDepois: '0.30' });
    const r = await criar(0.21);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain('Saldo insuficiente');
  });

  test('excluir a única OP devolve o saldo: EMITIDO', async () => {
    const { chamadas, statusGravado } = mockConn({
      statusNe: 'PARCIALMENTE PAGO',
      gastoDepois: '0',
      oldOp: { id: 'op-1', numero_ne: 'NE-1', valor_pagamento: '90.00' },
    });
    const r = await OrdemPagamentoService.excluir('op-1', 'u1', 'ADMIN', 'TESTE estorno');
    expect(r.success).toBe(true);
    expect(statusGravado()).toBe('EMITIDO');
    // o status é recalculado depois de apagar a OP, na mesma transação
    const iDelete = chamadas.findIndex(([sql]) => sql.startsWith('DELETE FROM ordens_pagamento'));
    const iStatus = chamadas.findIndex(([sql]) => sql.startsWith('UPDATE notas_empenho SET status'));
    expect(iDelete).toBeGreaterThanOrEqual(0);
    expect(iStatus).toBeGreaterThan(iDelete);
    expect(withTransaction).toHaveBeenCalledTimes(1);
  });
});
