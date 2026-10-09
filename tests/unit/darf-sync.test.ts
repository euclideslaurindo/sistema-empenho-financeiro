import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  calcularDarf,
  competenciaDaOp,
  entraDarfDaConfig,
  sincronizarDarfDaOp,
  removerDarfDaOp,
} from '@/lib/services/darf.service';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
import { withTransaction } from '@/lib/db';

// Seed real da T03: INSS, Patronal e SEST/SENAT entram na DARF (D4).
const CONFIG_ROWS = [
  ['irrf', 'IRRF', 'PERCENTUAL', '1.5000', 0],
  ['iss', 'ISS', 'PERCENTUAL', '5.0000', 0],
  ['inss', 'INSS', 'PERCENTUAL', '11.0000', 1],
  ['patronal', 'Patronal', 'PERCENTUAL', '20.0000', 1],
  ['sest_senat', 'SEST/SENAT', 'PERCENTUAL', '2.5000', 1],
  ['outros', 'Outros', 'VALOR_DIGITADO', null, 0],
  ['taxa_bancaria', 'Taxa bancária', 'VALOR_DIGITADO', null, 0],
  ['taxa_pix', 'Taxa PIX', 'VALOR_DIGITADO', null, 0],
].map(([campo, rotulo, tipo, aliquota, entra], i) => ({
  campo, rotulo, tipo, aliquota, calculo_automatico: tipo === 'PERCENTUAL' ? 1 : 0, editavel_operador: 0,
  entra_darf: entra, ativo: 1, ordem: (i + 1) * 10, updated_at: new Date('2026-01-01'),
}));
const CONFIG_MAPEADA = CONFIG_ROWS.map((r) => ({
  campo: r.campo as string, rotulo: r.rotulo as string, tipo: r.tipo as string,
  aliquota: r.aliquota === null ? null : Number(r.aliquota), calculoAutomatico: !!r.calculo_automatico,
  editavelOperador: false, entraDarf: !!r.entra_darf, ativo: true, ordem: r.ordem,
}));

describe('funções puras', () => {
  test('entraDarfDaConfig: só tributários ativos marcados', () => {
    expect(entraDarfDaConfig(CONFIG_MAPEADA)).toEqual(['inss', 'patronal', 'sest_senat']);
    const comIrrf = CONFIG_MAPEADA.map((c) => (c.campo === 'irrf' ? { ...c, entraDarf: true } : c));
    expect(entraDarfDaConfig(comIrrf)).toContain('irrf');
    const inativo = CONFIG_MAPEADA.map((c) => (c.campo === 'inss' ? { ...c, ativo: false } : c));
    expect(entraDarfDaConfig(inativo)).not.toContain('inss');
  });

  test('calcularDarf soma só os campos da DARF, em centavos', () => {
    expect(
      calcularDarf({ irrf: 15, inss: 110, patronal: 200, sest_senat: 25, iss: 50 }, ['inss', 'patronal', 'sest_senat'])
    ).toEqual({ valorCents: 33500, detalhe: { inss: 110, patronal: 200, sest_senat: 25 } });
    expect(calcularDarf({ inss: 0, patronal: 0, sest_senat: 0 }, ['inss', 'patronal', 'sest_senat']).valorCents).toBe(0);
  });

  test('competência: pagamento, senão emissão, senão hoje', () => {
    expect(competenciaDaOp('2026-10-15', '2026-09-30')).toBe('2026-10');
    expect(competenciaDaOp(null, '2026-09-30')).toBe('2026-09');
    expect(competenciaDaOp('', undefined, new Date(2026, 6, 4))).toBe('2026-07');
  });
});

// conn que registra as chamadas e devolve a linha da DARF que existir
function connDarf(linha: any = null) {
  const chamadas: Array<[string, any[]]> = [];
  const conn: any = {
    execute: vi.fn(async (sql: string, params: any[] = []) => {
      chamadas.push([sql, params]);
      if (sql.includes('FROM darf_acompanhamento WHERE ordem_pagamento_id')) return [linha ? [linha] : []];
      return [{ affectedRows: 1 }];
    }),
  };
  return { conn, chamadas, sqls: () => chamadas.map(([s]) => s) };
}

const OP = {
  id: 'op-1', numeroNe: 'NE-1', numeroOp: '2026.OP.0001', sub: '01', credorCpfCnpj: '1', credorNome: 'C',
  dataPagamento: '2026-10-15', dataEmissao: '2026-10-01',
  valores: { inss: 110, patronal: 200, sest_senat: 25 },
};
const ENTRA = { entraDarf: ['inss', 'patronal', 'sest_senat'] as any };

describe('sincronizarDarfDaOp', () => {
  test('sem linha e valor > 0 -> INSERT PENDENTE com competência', async () => {
    const { conn, chamadas } = connDarf();
    await sincronizarDarfDaOp(conn, OP, ENTRA);
    const ins = chamadas.find(([s]) => s.includes('INSERT INTO darf_acompanhamento'))!;
    expect(ins[0]).toContain("'PENDENTE'");
    expect(ins[1].slice(1, 9)).toEqual(['op-1', 'NE-1', '2026.OP.0001', '01', '1', 'C', '2026-10', 335]);
  });

  test('sem linha e valor 0 (ex.: elemento .14) -> nada', async () => {
    const { conn, sqls } = connDarf();
    await sincronizarDarfDaOp(conn, { ...OP, valores: {} }, ENTRA);
    expect(sqls().some((s) => /^\s*(INSERT|UPDATE|DELETE)/.test(s))).toBe(false);
  });

  test('PENDENTE e valor > 0 -> UPDATE', async () => {
    const { conn, chamadas } = connDarf({ id: 'd1', status: 'PENDENTE', valor_darf: '100.00', competencia: '2026-09' });
    await sincronizarDarfDaOp(conn, OP, ENTRA);
    const upd = chamadas.find(([s]) => s.includes('UPDATE darf_acompanhamento'))!;
    expect(upd[1]).toContain(335);
    expect(upd[1]).toContain('2026-10');
  });

  test('PENDENTE e valor 0 -> DELETE', async () => {
    const { conn, sqls } = connDarf({ id: 'd1', status: 'PENDENTE', valor_darf: '100.00', competencia: '2026-10' });
    await sincronizarDarfDaOp(conn, { ...OP, valores: {} }, ENTRA);
    expect(sqls().some((s) => s.includes('DELETE FROM darf_acompanhamento'))).toBe(true);
  });

  test('PAGA sem mudança de valor/competência -> nada', async () => {
    const { conn, sqls } = connDarf({ id: 'd1', status: 'PAGA', valor_darf: '335.00', competencia: '2026-10' });
    await sincronizarDarfDaOp(conn, OP, ENTRA);
    expect(sqls().some((s) => /^\s*(INSERT|UPDATE|DELETE)/.test(s))).toBe(false);
  });

  test('PAGA com valor ou competência diferente -> 409', async () => {
    const pago = { id: 'd1', status: 'PAGA', valor_darf: '335.00', competencia: '2026-10' };
    await expect(sincronizarDarfDaOp(connDarf(pago).conn, { ...OP, valores: { inss: 1 } }, ENTRA)).rejects.toMatchObject({ status: 409 });
    await expect(sincronizarDarfDaOp(connDarf(pago).conn, { ...OP, dataPagamento: '2026-11-01' }, ENTRA)).rejects.toMatchObject({ status: 409 });
  });

  test('manterValorExistente: config mudou depois, DARF paga não é recalculada', async () => {
    const { conn, sqls } = connDarf({ id: 'd1', status: 'PAGA', valor_darf: '335.00', detalhe_json: { inss: 110 }, competencia: '2026-10' });
    await sincronizarDarfDaOp(conn, { ...OP, valores: { inss: 999 } }, { manterValorExistente: true });
    expect(sqls().some((s) => /^\s*(UPDATE|DELETE)/.test(s))).toBe(false);
  });

  test('removerDarfDaOp: PAGA -> 409; PENDENTE -> DELETE', async () => {
    await expect(removerDarfDaOp(connDarf({ id: 'd1', status: 'PAGA' }).conn, 'op-1')).rejects.toMatchObject({ status: 409 });
    const { conn, sqls } = connDarf({ id: 'd1', status: 'PENDENTE' });
    await removerDarfDaOp(conn, 'op-1');
    expect(sqls().some((s) => s.includes('DELETE FROM darf_acompanhamento'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integração com o OrdemPagamentoService (mesma transação)
// ---------------------------------------------------------------------------

function connOp({ elemento = '3.3.90.36', darf = null as any, oldOp = null as any, falharDarf = false } = {}) {
  const chamadas: Array<[string, any[]]> = [];
  const conn = {
    execute: vi.fn(async (sql: string, params: any[] = []) => {
      chamadas.push([sql, params]);
      if (falharDarf && sql.includes('INSERT INTO darf_acompanhamento')) throw new Error('falha simulada na DARF');
      if (sql.includes('INSERT INTO') || sql.startsWith('UPDATE') || sql.startsWith('DELETE')) return [{ affectedRows: 1 }];
      if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
        return [[{ id: 'ne-1', valor: '10000.00', status: 'EMITIDO', elemento: `${elemento} - X`, subelemento: '' }]];
      }
      if (sql.includes('SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago')) return [[{ total_pago: 0 }]];
      if (sql.includes('SELECT * FROM config_retencoes ORDER BY ordem')) return [CONFIG_ROWS];
      if (sql.includes('SELECT codigo FROM elementos_despesa')) return [[{ codigo: '3.3.90.36' }, { codigo: '3.3.90.14' }]];
      if (sql.includes('SELECT elemento_codigo, campo FROM elemento_retencoes')) {
        return [['irrf', 'iss', 'inss', 'patronal', 'sest_senat'].map((campo) => ({ elemento_codigo: '3.3.90.36', campo }))];
      }
      if (sql.includes('FROM darf_acompanhamento WHERE ordem_pagamento_id')) return [darf ? [darf] : []];
      if (sql.includes('SELECT * FROM ordens_pagamento WHERE id')) return [[oldOp]];
      if (sql.includes('saldoDisponivel')) {
        return [[{ valor: '10000.00', status: 'EMITIDO', elemento: `${elemento} - X`, subelemento: '', saldoDisponivel: 10000 }]];
      }
      return [[]];
    }),
  };
  let resultadoTransacao: Promise<any> | undefined;
  (withTransaction as any).mockImplementation((cb: any) => (resultadoTransacao = cb(conn)));
  return { chamadas, transacao: () => resultadoTransacao! };
}

const criarOp = (over: object = {}) =>
  OrdemPagamentoService.criar(
    { numeroEmpenho: 'NE-1', credorCpfCnpj: '1', credorNome: 'C', valorPagamento: 1000, dataPagamento: '2026-10-15', ...over },
    'u1',
    'GESTOR'
  );

const OLD_OP = {
  id: 'op-1', numero_ne: 'NE-1', numero_empenho: '2026.OP.0001', sub: '01', valor_pagamento: '1000.00',
  credor_cpf_cnpj: '1', elemento: '3.3.90.36 - X', subelemento: '',
  irrf: '15.00', iss: '50.00', inss: '110.00', patronal: '200.00', sest_senat: '25.00',
  outros_descontos: '0.00', taxa_bancaria: '0.00', taxa_pix: '0.00', total_descontos: '400.00', valor_liquido: '600.00',
  retencoes_snapshot: { elemento: '3.3.90.36' }, data_pagamento: '2026-10-15',
};

describe('OP x DARF', () => {
  beforeEach(() => vi.clearAllMocks());

  test('criar OP com INSS/Patronal/SEST -> 1 linha PENDENTE na competência certa', async () => {
    const { chamadas } = connOp();
    const r = await criarOp();
    expect(r.success).toBe(true);
    const ins = chamadas.filter(([s]) => s.includes('INSERT INTO darf_acompanhamento'));
    expect(ins).toHaveLength(1);
    expect(ins[0][1][7]).toBe('2026-10'); // competência
    expect(ins[0][1][8]).toBe(335); // 110 + 200 + 25
  });

  test('OP do elemento .14 não cria linha', async () => {
    const { chamadas } = connOp({ elemento: '3.3.90.14' });
    expect((await criarOp()).success).toBe(true);
    expect(chamadas.some(([s]) => s.includes('INSERT INTO darf_acompanhamento'))).toBe(false);
  });

  test('falha na sincronização desfaz a OP (a transação rejeita)', async () => {
    const { transacao } = connOp({ falharDarf: true });
    const r = await criarOp();
    expect(r.success).toBe(false);
    await expect(transacao()).rejects.toThrow('falha simulada na DARF');
  });

  test('editar o valor com DARF PENDENTE atualiza o valor_darf', async () => {
    const { chamadas } = connOp({ oldOp: OLD_OP, darf: { id: 'd1', status: 'PENDENTE', valor_darf: '335.00', competencia: '2026-10' } });
    const r = await OrdemPagamentoService.atualizar(
      'op-1', { numeroEmpenho: 'NE-1', credorCpfCnpj: '1', valorPagamento: 2000, dataPagamento: '2026-10-15' }, 'u1', 'GESTOR'
    );
    expect(r.success).toBe(true);
    const upd = chamadas.find(([s]) => s.includes('UPDATE darf_acompanhamento'))!;
    expect(upd[1]).toContain(670);
  });

  test('editar o valor com DARF PAGA -> 409', async () => {
    connOp({ oldOp: OLD_OP, darf: { id: 'd1', status: 'PAGA', valor_darf: '335.00', competencia: '2026-10' } });
    const r = await OrdemPagamentoService.atualizar(
      'op-1', { numeroEmpenho: 'NE-1', credorCpfCnpj: '1', valorPagamento: 2000, dataPagamento: '2026-10-15' }, 'u1', 'GESTOR'
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.status).toBe(409);
      expect(r.error).toContain('DARF já paga');
    }
  });

  test('editar só o histórico com DARF PAGA continua permitido', async () => {
    connOp({ oldOp: OLD_OP, darf: { id: 'd1', status: 'PAGA', valor_darf: '335.00', detalhe_json: {}, competencia: '2026-10' } });
    const r = await OrdemPagamentoService.atualizar(
      'op-1',
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '1', valorPagamento: 1000, dataPagamento: '2026-10-15', historico: 'corrigido' },
      'u1',
      'GESTOR'
    );
    expect(r.success).toBe(true);
  });

  test('excluir OP com DARF PAGA -> 409 e a OP não é apagada', async () => {
    const { chamadas } = connOp({ darf: { id: 'd1', status: 'PAGA' } });
    (withTransaction as any).mockImplementationOnce(async (cb: any) => {
      const conn = {
        execute: vi.fn(async (sql: string, params: any[] = []) => {
          chamadas.push([sql, params]);
          if (sql.includes('SELECT * FROM ordens_pagamento WHERE id')) return [[OLD_OP]];
          if (sql.includes('FROM darf_acompanhamento WHERE ordem_pagamento_id')) return [[{ id: 'd1', status: 'PAGA' }]];
          return [{ affectedRows: 1 }];
        }),
      };
      return cb(conn);
    });
    const r = await OrdemPagamentoService.excluir('op-1', 'u1', 'GESTOR');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.status).toBe(409);
    expect(chamadas.some(([s]) => s.includes('DELETE FROM ordens_pagamento'))).toBe(false);
  });
});
