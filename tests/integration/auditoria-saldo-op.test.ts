// Auditoria: o valor empenhado e o saldo anterior que a via imprime vêm do
// servidor (NE + OPs já gravadas), nunca do payload — nem na criação
// individual, nem na edição.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
import { withTransaction } from '@/lib/db';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';

const CONFIG_ROWS = ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'].map((campo, i) => ({
  campo, rotulo: campo, tipo: 'PERCENTUAL', aliquota: '1.0000', calculo_automatico: 1, editavel_operador: 0,
  entra_darf: 0, ativo: 1, ordem: i, updated_at: new Date('2026-01-01'),
}));

function mock({ jaPago = '300.00', oldOp = null as any } = {}) {
  const chamadas: Array<[string, any[]]> = [];
  (withTransaction as any).mockImplementation(async (cb: any) =>
    cb({
      execute: vi.fn(async (sql: string, params: any[] = []) => {
        chamadas.push([sql, params]);
        if (sql.includes('SELECT * FROM ordens_pagamento WHERE id')) return [[oldOp]];
        if (/^\s*(INSERT|UPDATE|DELETE)/.test(sql)) return [{ affectedRows: 1 }];
        if (sql.includes('notas_empenho')) {
          return [[{ id: 'ne-1', valor: '1000.00', status: 'EMITIDO', elemento: '3.3.90.30 - Material', subelemento: '', saldoDisponivel: 700 }]];
        }
        if (sql.includes('total_pago')) return [[{ total_pago: jaPago }]];
        if (sql.includes('FROM credores')) return [[{ municipioExpediente: null, is_mei: 0, is_simples: 0 }]];
        if (sql.includes('SELECT * FROM config_retencoes')) return [CONFIG_ROWS];
        if (sql.includes('SELECT codigo FROM elementos_despesa')) return [[{ codigo: '3.3.90.30' }]];
        if (sql.includes('FROM elemento_retencoes')) return [[]];
        return [[]];
      }),
    })
  );
  return chamadas;
}

beforeEach(() => vi.clearAllMocks());

describe('saldo anterior e valor empenhado da OP', () => {
  test('criação individual: payload com valores errados é ignorado', async () => {
    const chamadas = mock({ jaPago: '300.00' });
    const r = await OrdemPagamentoService.criar(
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '1', valorPagamento: 200, dataPagamento: '2026-10-15', saldoAnterior: 999999, valorEmpenho: 1 },
      'u1',
      'GESTOR'
    );
    expect(r.success).toBe(true);
    const p = chamadas.find(([s]) => s.includes('INSERT INTO ordens_pagamento'))![1];
    expect(p.slice(15, 18)).toEqual([700, 1000, 200]); // saldo anterior = 1000 − 300; empenhado = NE; bruto
  });

  test('edição: mantém os da emissão', async () => {
    const OLD = {
      id: 'op-1', numero_ne: 'NE-1', valor_pagamento: '200.00', credor_cpf_cnpj: '1', elemento: '3.3.90.30 - Material', subelemento: '',
      saldo_anterior: '700.00', valor_empenho: '1000.00', irrf: '0', iss: '0', inss: '0', patronal: '0', sest_senat: '0',
      outros_descontos: '0', taxa_bancaria: '0', taxa_pix: '0', iss_bs: '0', total_descontos: '0', valor_liquido: '200.00',
      data_pagamento: '2026-10-15', retencoes_snapshot: { elemento: '3.3.90.30', subelemento: null, campos: {} },
    };
    const chamadas = mock({ oldOp: OLD });
    const r = await OrdemPagamentoService.atualizar(
      'op-1',
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '1', valorPagamento: 200, dataPagamento: '2026-10-15', historico: 'x', saldoAnterior: 5, valorEmpenho: 5 } as any,
      'u1',
      'GESTOR'
    );
    expect(r.success).toBe(true);
    const [sql, p] = chamadas.find(([s]) => s.includes('UPDATE ordens_pagamento'))!;
    const cols = sql.slice(sql.indexOf('SET') + 3, sql.indexOf('WHERE')).split(',').map((c) => c.trim().split(' ')[0]);
    expect(p[cols.indexOf('saldo_anterior')]).toBe(700);
    expect(p[cols.indexOf('valor_empenho')]).toBe(1000);
  });
});
