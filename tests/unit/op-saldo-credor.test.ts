import { describe, test, expect, vi, beforeEach } from 'vitest';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
import { withTransaction } from '@/lib/db';

// NE de 10.000 com 2 credores: A (6.000) e B (4.000).
const NE_CREDORES = [
  { credor_cpf_cnpj: '11.111.111/0001-11', credor_nome: 'Credor A', valor_bruto: '6000.00' },
  { credor_cpf_cnpj: '222.222.222-22', credor_nome: 'Credor B', valor_bruto: '4000.00' },
];

function mockConn({
  credores = NE_CREDORES,
  pagos = [] as Array<{ credor_cpf_cnpj: string; total_pago: string }>,
  oldOp = null as any,
} = {}) {
  const chamadas: Array<[string, any[]]> = [];
  const totalPago = pagos.reduce((t, p) => t + Number(p.total_pago), 0);
  const conn = {
    execute: vi.fn(async (sql: string, params: any[] = []) => {
      chamadas.push([sql, params]);
      if (sql.includes('INSERT INTO ordens_pagamento')) return [{ affectedRows: 1 }];
      if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
        return [[{ id: 'ne-1', valor: '10000.00', status: 'EMITIDO', elemento: '', subelemento: '' }]];
      }
      if (sql.includes('SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago')) return [[{ total_pago: totalPago }]];
      if (sql.includes('FROM ne_credores')) return [credores];
      if (sql.includes('GROUP BY credor_cpf_cnpj')) {
        const ignorar = params[1];
        return [pagos.filter((p: any) => !ignorar || p.id !== ignorar)];
      }
      if (sql.includes('SELECT * FROM ordens_pagamento WHERE id')) return [[oldOp]];
      if (sql.includes('saldoDisponivel')) {
        return [[{ valor: '10000.00', status: 'PARCIALMENTE PAGO', elemento: '', subelemento: '', saldoDisponivel: 10000 - totalPago + Number(oldOp?.valor_pagamento || 0) }]];
      }
      return [[]];
    }),
  };
  (withTransaction as any).mockImplementation(async (cb: any) => cb(conn));
  return chamadas;
}

const criar = (credorCpfCnpj: string, valorPagamento: number) =>
  OrdemPagamentoService.criar({ numeroEmpenho: 'NE-1', credorCpfCnpj, valorPagamento }, 'u1', 'GESTOR');

describe('OP x credores da NE (T17) — criar', () => {
  beforeEach(() => vi.clearAllMocks());

  test('OP de 3.500 para A (bruto 6.000) -> OK', async () => {
    mockConn();
    const r = await criar('11.111.111/0001-11', 3500);
    expect(r.success).toBe(true);
  });

  test('A já recebeu 3.500: nova OP de 3.000 -> 422 com bruto/pago/restante', async () => {
    mockConn({ pagos: [{ credor_cpf_cnpj: '11.111.111/0001-11', total_pago: '3500.00' }] });
    const r = await criar('11.111.111/0001-11', 3000);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.status).toBe(422);
      expect(r.error).toBe('Saldo do credor insuficiente. Bruto R$ 6.000,00, já pago R$ 3.500,00, restante R$ 2.500,00.');
    }
  });

  test('exatamente o restante passa (sem folga de centavo)', async () => {
    mockConn({ pagos: [{ credor_cpf_cnpj: '11.111.111/0001-11', total_pago: '3500.00' }] });
    expect((await criar('11.111.111/0001-11', 2500)).success).toBe(true);
    mockConn({ pagos: [{ credor_cpf_cnpj: '11.111.111/0001-11', total_pago: '3500.00' }] });
    expect((await criar('11.111.111/0001-11', 2500.01)).success).toBe(false);
  });

  test('pago de outro credor não conta para A', async () => {
    mockConn({ pagos: [{ credor_cpf_cnpj: '222.222.222-22', total_pago: '4000.00' }] });
    expect((await criar('11.111.111/0001-11', 6000)).success).toBe(true);
  });

  test('credor que não pertence à NE -> 422', async () => {
    mockConn();
    const r = await criar('999.999.999-99', 100);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.status).toBe(422);
      expect(r.error).toContain('não pertence à NE');
    }
  });

  test('mesmo credor com máscara diferente é aceito', async () => {
    mockConn();
    expect((await criar('22222222222', 100)).success).toBe(true);
  });

  test('NE antiga (sem ne_credores): qualquer credor, só vale o saldo total', async () => {
    const chamadas = mockConn({ credores: [] });
    expect((await criar('999.999.999-99', 9000)).success).toBe(true);
    expect(chamadas.some(([sql]) => sql.includes('GROUP BY credor_cpf_cnpj'))).toBe(false);
  });

  test('trava: NE (FOR UPDATE) antes de ne_credores (FOR UPDATE) antes da soma do credor, tudo na transação', async () => {
    const chamadas = mockConn();
    await criar('11.111.111/0001-11', 100);
    const idx = (trecho: string) => chamadas.findIndex(([sql]) => sql.includes(trecho));
    const iNe = idx('FROM notas_empenho WHERE numero = ? FOR UPDATE');
    const iCred = idx('FROM ne_credores');
    const iSoma = idx('GROUP BY credor_cpf_cnpj');
    expect(iNe).toBeGreaterThanOrEqual(0);
    expect(iNe).toBeLessThan(iCred);
    expect(iCred).toBeLessThan(iSoma);
    expect(chamadas[iCred][0]).toContain('FOR UPDATE');
    expect(withTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('OP x credores da NE (T17) — atualizar', () => {
  beforeEach(() => vi.clearAllMocks());

  const OLD_OP = {
    id: 'op-1', numero_ne: 'NE-1', valor_pagamento: '3500.00', credor_cpf_cnpj: '11.111.111/0001-11',
    elemento: '', subelemento: '', retencoes_snapshot: null,
  };

  test('editar a própria OP mantendo o valor não conta a si mesma', async () => {
    const chamadas = mockConn({
      oldOp: OLD_OP,
      pagos: [{ id: 'op-1', credor_cpf_cnpj: '11.111.111/0001-11', total_pago: '3500.00' } as any],
    });
    const r = await OrdemPagamentoService.atualizar(
      'op-1',
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '11.111.111/0001-11', valorPagamento: 6000 },
      'u1',
      'GESTOR'
    );
    expect(r.success).toBe(true);
    const soma = chamadas.find(([sql]) => sql.includes('GROUP BY credor_cpf_cnpj'))!;
    expect(soma[0]).toContain('AND id <> ?');
    expect(soma[1]).toEqual(['NE-1', 'op-1']);
  });

  test('editar passando do bruto (contando as outras OPs do credor) -> 422', async () => {
    mockConn({
      oldOp: OLD_OP,
      pagos: [
        { id: 'op-1', credor_cpf_cnpj: '11.111.111/0001-11', total_pago: '3500.00' } as any,
        { id: 'op-2', credor_cpf_cnpj: '11.111.111/0001-11', total_pago: '2000.00' } as any,
      ],
    });
    const r = await OrdemPagamentoService.atualizar(
      'op-1',
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '11.111.111/0001-11', valorPagamento: 4500 },
      'u1',
      'GESTOR'
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain('restante R$ 4.000,00');
  });
});
