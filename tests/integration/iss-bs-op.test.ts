// B10 — ISS-BS do payload até a OP gravada, a edição, a DARF e a listagem.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));

import { query, withTransaction } from '@/lib/db';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';

const CONFIG_ROWS = [
  ['irrf', 'IRRF', 'PERCENTUAL', '1.5000', 0, 0], ['iss', 'ISS', 'PERCENTUAL', '5.0000', 0, 0],
  ['iss_bs', 'ISS-BS', 'VALOR_DIGITADO', null, 0, 1],
  ['inss', 'INSS', 'PERCENTUAL', '11.0000', 1, 0], ['patronal', 'Patronal', 'PERCENTUAL', '20.0000', 1, 0],
  ['sest_senat', 'SEST/SENAT', 'PERCENTUAL', '2.5000', 1, 0], ['outros', 'Outros', 'VALOR_DIGITADO', null, 0, 0],
  ['taxa_bancaria', 'Taxa bancária', 'VALOR_DIGITADO', null, 0, 1], ['taxa_pix', 'Taxa PIX', 'VALOR_DIGITADO', null, 0, 1],
].map(([campo, rotulo, tipo, aliquota, entra, editavel], i) => ({
  campo, rotulo, tipo, aliquota, calculo_automatico: tipo === 'PERCENTUAL' ? 1 : 0,
  editavel_operador: editavel, entra_darf: entra, ativo: 1, ordem: i, updated_at: new Date('2026-01-01'),
}));
const TODOS = ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'];

function responder(sql: string): any[] {
  if (sql.includes('notas_empenho')) {
    return [{ id: 'ne-1', valor: '100000.00', status: 'EMITIDO', elemento: '3.3.90.30 - Material', subelemento: '', saldoDisponivel: 100000 }];
  }
  if (sql.includes('SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago')) return [{ total_pago: 0 }];
  if (sql.includes('FROM credores')) return [{ municipioExpediente: null, is_mei: 0, is_simples: 0 }];
  if (sql.includes('SELECT * FROM config_retencoes')) return CONFIG_ROWS;
  if (sql.includes('MAX(updated_at)')) return [{ versao: '2026-01-01T00:00:00.000Z' }];
  if (sql.includes('SELECT codigo FROM elementos_despesa')) return [{ codigo: '3.3.90.30' }];
  if (sql.includes('FROM elemento_retencoes')) return TODOS.map((campo) => ({ elemento_codigo: '3.3.90.30', campo }));
  return [];
}

function mockTransacao(oldOp: any = null) {
  const chamadas: Array<[string, any[]]> = [];
  (withTransaction as any).mockImplementation(async (cb: any) =>
    cb({
      execute: vi.fn(async (sql: string, params: any[] = []) => {
        chamadas.push([sql, params]);
        if (sql.includes('SELECT * FROM ordens_pagamento WHERE id')) return [[oldOp]];
        if (/^\s*(INSERT|UPDATE|DELETE)/.test(sql)) return [{ affectedRows: 1 }];
        return [responder(sql)];
      }),
    })
  );
  return chamadas;
}

beforeEach(() => vi.clearAllMocks());

describe('OP com ISS-BS', () => {
  test('grava iss_bs (último parâmetro), desconta do líquido e fica fora da DARF', async () => {
    const chamadas = mockTransacao();
    const r = await OrdemPagamentoService.criar(
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '1', valorPagamento: 1000, dataPagamento: '2026-10-15', issBs: 20 },
      'u1',
      'GESTOR'
    );
    expect(r.success).toBe(true);
    const [sql, p] = chamadas.find(([s]) => s.includes('INSERT INTO ordens_pagamento'))!;
    expect(sql).toMatch(/usuario_id, iss_bs\s*\)/);
    expect(p.at(-1)).toBe(20);
    // 1000 − IRRF 15 − ISS 50 − INSS 110 − SEST/SENAT 25 − ISS-BS 20 (patronal fora)
    expect(p[27]).toBe(780);
    const darf = chamadas.find(([s]) => s.includes('INSERT INTO darf_acompanhamento'))!;
    expect(darf[1][8]).toBe(335); // INSS 110 + patronal 200 + SEST/SENAT 25 — sem o ISS-BS
  });

  test('sem ISS-BS: grava 0', async () => {
    const chamadas = mockTransacao();
    await OrdemPagamentoService.criar({ numeroEmpenho: 'NE-1', credorCpfCnpj: '1', valorPagamento: 1000, dataPagamento: '2026-10-15' }, 'u1', 'GESTOR');
    expect(chamadas.find(([s]) => s.includes('INSERT INTO ordens_pagamento'))![1].at(-1)).toBe(0);
  });

  const OLD = {
    id: 'op-1', numero_ne: 'NE-1', valor_pagamento: '1000.00', credor_cpf_cnpj: '1', elemento: '3.3.90.30 - Material', subelemento: '',
    irrf: '15.00', iss: '50.00', inss: '110.00', patronal: '200.00', sest_senat: '25.00', outros_descontos: '0', taxa_bancaria: '0',
    taxa_pix: '0', iss_bs: '20.00', total_descontos: '220.00', valor_liquido: '780.00', data_pagamento: '2026-10-15',
    retencoes_snapshot: { elemento: '3.3.90.30', subelemento: null, campos: {} },
  };
  const editar = (extra: object) =>
    OrdemPagamentoService.atualizar('op-1', { numeroEmpenho: 'NE-1', credorCpfCnpj: '1', dataPagamento: '2026-10-15', ...extra } as any, 'u1', 'GESTOR');
  const gravado = (chamadas: Array<[string, any[]]>, coluna: string) => {
    const [sql, p] = chamadas.find(([s]) => s.includes('UPDATE ordens_pagamento'))!;
    const cols = sql.slice(sql.indexOf('SET') + 3, sql.indexOf('WHERE')).split(',').map((x) => x.trim().split(' ')[0]);
    return p[cols.indexOf(coluna)];
  };

  test('edição só do histórico: mantém o ISS-BS gravado', async () => {
    const chamadas = mockTransacao(OLD);
    expect((await editar({ valorPagamento: 1000, historico: 'novo' })).success).toBe(true);
    expect(gravado(chamadas, 'iss_bs')).toBe(20);
    expect(gravado(chamadas, 'valor_liquido')).toBe(780);
  });

  test('edição que recalcula: vale o ISS-BS novo', async () => {
    const chamadas = mockTransacao(OLD);
    expect((await editar({ valorPagamento: 2000, issBs: 35 })).success).toBe(true);
    expect(gravado(chamadas, 'iss_bs')).toBe(35);
  });

  test('a listagem devolve issBs', async () => {
    (query as any).mockResolvedValue([]);
    await OrdemPagamentoService.listar({ numeroNe: 'NE-1' });
    expect(String((query as any).mock.calls[0][0])).toContain('iss_bs as issBs');
  });
});
