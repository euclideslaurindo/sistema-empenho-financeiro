import { describe, test, expect, vi, beforeEach } from 'vitest';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
import { withTransaction } from '@/lib/db';

// T30 (D36): a NE não tem mais credor. ne_credores fica no banco sem uso —
// a OP não confere mais o credor nem o "bruto do credor"; vale só o saldo
// total da NE. (Antes, na T17, credor fora de ne_credores dava 422.)

const NE_CREDORES_ANTIGAS = [
  { credor_cpf_cnpj: '11.111.111/0001-11', credor_nome: 'Credor A', valor_bruto: '6000.00' },
  { credor_cpf_cnpj: '222.222.222-22', credor_nome: 'Credor B', valor_bruto: '4000.00' },
];

function mockConn({ totalPago = 0, oldOp = null as any } = {}) {
  const chamadas: Array<[string, any[]]> = [];
  const conn = {
    execute: vi.fn(async (sql: string, params: any[] = []) => {
      chamadas.push([sql, params]);
      if (sql.includes('INSERT INTO ordens_pagamento')) return [{ affectedRows: 1 }];
      if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
        return [[{ id: 'ne-1', valor: '10000.00', status: 'EMITIDO', elemento: '', subelemento: '' }]];
      }
      if (sql.includes('SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago')) return [[{ total_pago: totalPago }]];
      if (sql.includes('FROM ne_credores')) return [NE_CREDORES_ANTIGAS]; // dados antigos: não podem mais influir
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

describe('OP sem vínculo de credor com a NE (T30) — criar', () => {
  beforeEach(() => vi.clearAllMocks());

  test('credor que não está nas linhas antigas de ne_credores é aceito (antes: 422)', async () => {
    mockConn();
    const r = await criar('999.999.999-99', 100);
    expect(r.success).toBe(true);
  });

  test('valor acima do "bruto antigo" do credor passa, se couber no saldo da NE', async () => {
    mockConn({ totalPago: 0 });
    expect((await criar('222.222.222-22', 9000)).success).toBe(true); // bruto antigo de B era 4.000
  });

  test('o saldo total da NE continua barrando (422 "Saldo insuficiente")', async () => {
    mockConn({ totalPago: 9500 });
    const r = await criar('11.111.111/0001-11', 600);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.status).toBe(422);
      expect(r.error).toContain('Saldo insuficiente');
    }
  });

  test('não consulta ne_credores', async () => {
    const chamadas = mockConn();
    await criar('11.111.111/0001-11', 100);
    expect(chamadas.some(([sql]) => sql.includes('ne_credores'))).toBe(false);
  });
});

describe('OP sem vínculo de credor com a NE (T30) — atualizar', () => {
  beforeEach(() => vi.clearAllMocks());

  const OLD_OP = {
    id: 'op-1', numero_ne: 'NE-1', valor_pagamento: '3500.00', credor_cpf_cnpj: '11.111.111/0001-11',
    elemento: '', subelemento: '', retencoes_snapshot: null,
  };

  test('editar com valor acima do "bruto antigo" do credor passa, se couber no saldo da NE', async () => {
    const chamadas = mockConn({ oldOp: OLD_OP, totalPago: 3500 });
    const r = await OrdemPagamentoService.atualizar(
      'op-1',
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '11.111.111/0001-11', valorPagamento: 8000 },
      'u1',
      'GESTOR'
    );
    expect(r.success).toBe(true);
    expect(chamadas.some(([sql]) => sql.includes('ne_credores'))).toBe(false);
  });
});
