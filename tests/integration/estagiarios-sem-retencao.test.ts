// B7a — estagiários (3.3.90.36.08) sem retenção: regra própria por subelemento,
// do banco simulado até a OP gravada, a prévia e a configuração (PUT).
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
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';
import { POST as postPrevia } from '@/app/api/ordens-pagamento/previa/route';
import { GET as getConfig } from '@/app/api/configuracoes/retencoes/route';
import { PUT as putSub } from '@/app/api/configuracoes/retencoes/subelementos/route';
import { obterConfigRetencoes, salvarRegraSubelemento } from '@/lib/services/config-retencoes.service';

const CONFIG_ROWS = [
  ['irrf', 'IRRF', 'PERCENTUAL', '1.5000', 0], ['iss', 'ISS', 'PERCENTUAL', '5.0000', 0],
  ['inss', 'INSS', 'PERCENTUAL', '11.0000', 1], ['patronal', 'Patronal', 'PERCENTUAL', '20.0000', 1],
  ['sest_senat', 'SEST/SENAT', 'PERCENTUAL', '2.5000', 1], ['outros', 'Outros', 'VALOR_DIGITADO', null, 0],
  ['taxa_bancaria', 'Taxa bancária', 'VALOR_DIGITADO', null, 0], ['taxa_pix', 'Taxa PIX', 'VALOR_DIGITADO', null, 0],
].map(([campo, rotulo, tipo, aliquota, entra], i) => ({
  campo, rotulo, tipo, aliquota, calculo_automatico: tipo === 'PERCENTUAL' ? 1 : 0,
  editavel_operador: String(campo).startsWith('taxa') ? 1 : 0, entra_darf: entra, ativo: 1, ordem: i, updated_at: new Date('2026-01-01'),
}));
const TODOS = ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'];
const ESTAGIARIOS = '3.3.90.36.08 - Estagiários - Pagamento Direto';
const semTabela = Object.assign(new Error("Table 'empenho.subelemento_retencoes' doesn't exist"), { code: 'ER_NO_SUCH_TABLE', errno: 1146 });

interface Cenario {
  subelemento?: string;
  /** Linhas de subelemento_retencoes; null = a tabela não existe (migration_20 não rodou). */
  regrasSub?: Array<{ subelemento_codigo: string; campos: string }> | null;
}

/** Responde as consultas do cálculo (mesmo formato para query() e conn.execute). */
function responder(sql: string, { subelemento = ESTAGIARIOS, regrasSub = [{ subelemento_codigo: '3.3.90.36.08', campos: '' }] }: Cenario = {}): any[] {
  if (sql.includes('FROM notas_empenho')) {
    return [{ id: 'ne-1', valor: '100000.00', status: 'EMITIDO', elemento: '3.3.90.36 - Outros Serviços PF', subelemento }];
  }
  if (sql.includes('SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago')) return [{ total_pago: 0 }];
  if (sql.includes('FROM credores')) return [{ municipioExpediente: 'Canhotinho', is_mei: 0 }];
  if (sql.includes('SELECT * FROM config_retencoes')) return CONFIG_ROWS;
  if (sql.includes('MAX(updated_at)')) return [{ versao: '2026-01-01T00:00:00.000Z' }];
  if (sql.includes('SELECT codigo FROM elementos_despesa')) return [{ codigo: '3.3.90.36' }, { codigo: '3.3.90.33' }];
  if (sql.includes('FROM elemento_retencoes')) {
    return ['3.3.90.36', '3.3.90.33'].flatMap((el) => TODOS.map((campo) => ({ elemento_codigo: el, campo })));
  }
  if (sql.includes('FROM subelemento_retencoes')) {
    if (regrasSub === null) throw semTabela;
    return regrasSub;
  }
  return [];
}

function mockTransacao(cenario: Cenario = {}) {
  const chamadas: Array<[string, any[]]> = [];
  (withTransaction as any).mockImplementation(async (cb: any) =>
    cb({
      execute: vi.fn(async (sql: string, params: any[] = []) => {
        chamadas.push([sql, params]);
        if (/^\s*(INSERT|UPDATE|DELETE)/.test(sql)) return [{ affectedRows: 1 }];
        return [responder(sql, cenario)];
      }),
    })
  );
  return chamadas;
}

const emitir = (valorPagamento = 1000) =>
  OrdemPagamentoService.criar(
    { numeroEmpenho: 'NE-1', credorCpfCnpj: '111.111.111-11', valorPagamento, dataPagamento: '2026-10-15' },
    'u1',
    'GESTOR'
  );
const gravada = (chamadas: Array<[string, any[]]>) => chamadas.find(([s]) => s.includes('INSERT INTO ordens_pagamento'))![1];
const geraDarf = (chamadas: Array<[string, any[]]>) => chamadas.some(([s]) => s.includes('INSERT INTO darf_acompanhamento'));

beforeEach(() => {
  vi.clearAllMocks();
  (getAuthUser as any).mockResolvedValue({ id: 'adm', perfil: 'ADMIN' });
});

describe('OP de estagiário (3.3.90.36.08)', () => {
  test('R$ 1.000,00 → nenhum desconto, líquido R$ 1.000,00 e sem DARF', async () => {
    const chamadas = mockTransacao();
    expect((await emitir()).success).toBe(true);
    const p = gravada(chamadas);
    expect(p.slice(18, 23)).toEqual([0, 0, 0, 0, 0]); // irrf, iss, inss, sest_senat, patronal
    expect(p[26]).toBe(0); // total de descontos
    expect(p[27]).toBe(1000); // líquido
    expect(geraDarf(chamadas)).toBe(false);
    const snap = JSON.parse(p[28]);
    expect(snap).toMatchObject({ elemento: '3.3.90.36', subelemento: '3.3.90.36.08', origemRegra: 'subelemento', regraCodigo: '3.3.90.36.08' });
    expect(snap.campos.inss.aplica).toBe(false);
  });

  test('o mesmo valor no 3.3.90.36 sem subelemento continua com as 5 retenções e a DARF', async () => {
    const chamadas = mockTransacao({ subelemento: '' });
    await emitir();
    const p = gravada(chamadas);
    expect(p.slice(18, 23)).toEqual([15, 50, 110, 25, 200]);
    expect(p[27]).toBe(800);
    expect(geraDarf(chamadas)).toBe(true);
    expect(JSON.parse(p[28])).toMatchObject({ origemRegra: 'elemento', regraCodigo: '3.3.90.36', subelemento: null });
  });

  test('regra própria parcial (só IRRF) vale só para o subelemento', async () => {
    const chamadas = mockTransacao({ regrasSub: [{ subelemento_codigo: '3.3.90.36.08', campos: 'irrf' }] });
    await emitir();
    const p = gravada(chamadas);
    expect(p.slice(18, 23)).toEqual([15, 0, 0, 0, 0]);
    expect(p[27]).toBe(985);
  });

  test('outro subelemento do 3.3.90.36, sem regra própria, segue o elemento', async () => {
    const chamadas = mockTransacao({ subelemento: '3.3.90.36.01 - Outro' });
    await emitir();
    expect(gravada(chamadas)[27]).toBe(800);
  });

  test('migration_20 não rodada: tudo como antes (retém pelo elemento), sem erro', async () => {
    const chamadas = mockTransacao({ regrasSub: null });
    expect((await emitir()).success).toBe(true);
    expect(gravada(chamadas)[27]).toBe(800);
  });

  test('a prévia dá o mesmo valor da emissão, sem gravar nada', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'GESTOR' });
    (query as any).mockImplementation(async (sql: string) => responder(sql));
    const res: any = await postPrevia(
      new NextRequest('http://localhost:3000/api/ordens-pagamento/previa', {
        method: 'POST',
        body: JSON.stringify({ numeroEmpenho: 'NE-1', credorCpfCnpj: '111', valorPagamento: 1000 }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.valorLiquido).toBe(1000);
    expect(body.totalDescontos).toBe(0);
    expect(body.avisos).toEqual([]);
    expect(withTransaction).not.toHaveBeenCalled();
  });
});

describe('edição da OP (D12) com subelemento', () => {
  function mockEdicao(snapshot: Record<string, any>, cenario: Cenario = {}) {
    const chamadas: Array<[string, any[]]> = [];
    const oldOp = {
      id: 'op-1', numero_ne: 'NE-1', valor_pagamento: '1000.00', credor_cpf_cnpj: '111.111.111-11',
      elemento: '3.3.90.36 - Outros Serviços PF', subelemento: ESTAGIARIOS, retencoes_snapshot: snapshot,
      irrf: '15.00', iss: '50.00', inss: '110.00', sest_senat: '25.00', patronal: '200.00', outros_descontos: '0',
      taxa_bancaria: '0', taxa_pix: '0', total_descontos: '200.00', valor_liquido: '800.00', data_pagamento: '2026-10-15',
    };
    (withTransaction as any).mockImplementation(async (cb: any) =>
      cb({
        execute: vi.fn(async (sql: string, params: any[] = []) => {
          chamadas.push([sql, params]);
          if (sql.includes('SELECT * FROM ordens_pagamento WHERE id')) return [[oldOp]];
          if (sql.includes('saldoDisponivel')) {
            return [[{ valor: '100000.00', status: 'EMITIDO', elemento: oldOp.elemento, subelemento: ESTAGIARIOS, saldoDisponivel: '99000.00' }]];
          }
          if (/^\s*(INSERT|UPDATE|DELETE)/.test(sql)) return [{ affectedRows: 1 }];
          return [responder(sql, cenario)];
        }),
      })
    );
    return chamadas;
  }
  const editar = () =>
    OrdemPagamentoService.atualizar(
      'op-1',
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '111.111.111-11', valorPagamento: 1000, dataPagamento: '2026-10-15', historico: 'novo' },
      'u1',
      'GESTOR'
    );
  const liquidoGravado = (chamadas: Array<[string, any[]]>) => {
    const [sql, p] = chamadas.find(([s]) => s.includes('UPDATE ordens_pagamento'))!;
    const colunas = sql.slice(sql.indexOf('SET') + 3, sql.indexOf('WHERE')).split(',').map((c) => c.trim().split(' ')[0]);
    return p[colunas.indexOf('valor_liquido')];
  };

  test('snapshot antigo (sem subelemento): edição só de histórico não recalcula', async () => {
    const chamadas = mockEdicao({ elemento: '3.3.90.36', campos: {} });
    const r = await editar();
    expect(r.success).toBe(true);
    expect(liquidoGravado(chamadas)).toBe(800);
  });

  test('snapshot com outro subelemento: recalcula pela regra do subelemento atual', async () => {
    const chamadas = mockEdicao({ elemento: '3.3.90.36', subelemento: null, campos: {} });
    const r = await editar();
    expect(r.success).toBe(true);
    expect(liquidoGravado(chamadas)).toBe(1000);
  });
});

describe('configuração das regras por subelemento', () => {
  test('GET devolve regrasSubelemento; tabela inexistente → {} sem erro', async () => {
    (query as any).mockImplementation(async (sql: string) => responder(sql));
    const res: any = await getConfig(new NextRequest('http://localhost:3000/api/configuracoes/retencoes'));
    expect((await res.json()).regrasSubelemento).toEqual({ '3.3.90.36.08': [] });

    (query as any).mockImplementation(async (sql: string) => responder(sql, { regrasSub: null }));
    expect((await obterConfigRetencoes()).regrasSubelemento).toEqual({});
  });

  test('leitura ignora campo desconhecido e regra de subelemento do transporte', async () => {
    (query as any).mockImplementation(async (sql: string) =>
      responder(sql, {
        regrasSub: [
          { subelemento_codigo: '3.3.90.36.08', campos: 'iss, xyz,irrf' },
          { subelemento_codigo: '3.3.90.33.01', campos: '' },
        ],
      })
    );
    expect((await obterConfigRetencoes()).regrasSubelemento).toEqual({ '3.3.90.36.08': ['irrf', 'iss'] });
  });

  const put = async (body: any) => {
    const res: any = await putSub(
      new NextRequest('http://localhost:3000/api/configuracoes/retencoes/subelementos', { method: 'PUT', body: JSON.stringify(body) })
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
          if (sql.includes('FROM subelemento_retencoes')) {
            if (erro) throw erro;
            return [atual === null ? [] : [{ campos: atual }]];
          }
          if (erro && sql.includes('subelemento_retencoes')) throw erro;
          return [{ affectedRows: 1 }];
        }),
      })
    );
    return chamadas;
  }

  test.each(['GESTOR', 'CONSULTA'])('perfil %s → 403, sem transação', async (perfil: string) => {
    (getAuthUser as any).mockResolvedValue({ id: 'u', perfil });
    mockPut();
    expect((await put({ subelementoCodigo: '3.3.90.36.08', campos: [] })).status).toBe(403);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('o service também recusa quem não é Admin', async () => {
    mockPut();
    expect(await salvarRegraSubelemento({ subelementoCodigo: '3.3.90.36.08', campos: [] }, 'u', 'GESTOR')).toMatchObject({ status: 403 });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('campo fora dos 5 tributários, código de elemento ou campos ausentes → 400', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockPut();
    expect((await put({ subelementoCodigo: '3.3.90.36.08', campos: ['taxa_pix'] })).status).toBe(400);
    expect((await put({ subelementoCodigo: '3.3.90.36', campos: [] })).status).toBe(400);
    expect((await put({ subelementoCodigo: '3.3.90.36.08' })).status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
    vi.mocked(console.error).mockRestore();
  });

  test('subelemento do transporte (3.3.90.33) → 400, sem transação', async () => {
    mockPut();
    const { status, body } = await put({ subelementoCodigo: '3.3.90.33.01', campos: [] });
    expect(status).toBe(400);
    expect(body.error).toContain('transporte');
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('subelemento inexistente → 400 e nada gravado', async () => {
    const chamadas = mockPut({ existe: false });
    expect((await put({ subelementoCodigo: '3.3.90.36.99', campos: [] })).status).toBe(400);
    expect(chamadas.filter(([s]) => /^\s*(INSERT|DELETE)/.test(s))).toEqual([]);
  });

  test('grava em ordem fixa, sem repetir, e audita antes e depois', async () => {
    const chamadas = mockPut({ atual: null });
    const { status, body } = await put({ subelementoCodigo: '3.3.90.36.08', campos: ['iss', 'irrf', 'iss'] });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, subelementoCodigo: '3.3.90.36.08', campos: ['irrf', 'iss'] });
    const [, p] = chamadas.find(([s]) => s.includes('INSERT INTO subelemento_retencoes'))!;
    expect(p).toEqual(['3.3.90.36.08', 'irrf,iss', 'adm']);
    const [, aud] = chamadas.find(([s]) => s.includes('auditoria_financeira'))!;
    expect(aud.slice(1, 4)).toEqual(['subelemento_retencoes', '3.3.90.36.08', 'UPDATE']);
    expect(JSON.parse(aud[4])).toEqual({ campos: null });
    expect(JSON.parse(aud[5])).toEqual({ campos: ['irrf', 'iss'] });
  });

  test('lista vazia grava "" (nenhuma retenção); null tira a regra própria', async () => {
    let chamadas = mockPut({ atual: 'irrf' });
    await put({ subelementoCodigo: '3.3.90.36.08', campos: [] });
    expect(chamadas.find(([s]) => s.includes('INSERT INTO subelemento_retencoes'))![1][1]).toBe('');

    chamadas = mockPut({ atual: '' });
    await put({ subelementoCodigo: '3.3.90.36.08', campos: null });
    expect(chamadas.find(([s]) => s.startsWith('DELETE FROM subelemento_retencoes'))![1]).toEqual(['3.3.90.36.08']);
    expect(JSON.parse(chamadas.find(([s]) => s.includes('auditoria_financeira'))![1][5])).toEqual({ campos: null });
  });

  test('nada mudou: não grava nem audita', async () => {
    const chamadas = mockPut({ atual: '' });
    expect((await put({ subelementoCodigo: '3.3.90.36.08', campos: [] })).status).toBe(200);
    expect(chamadas.filter(([s]) => /^\s*(INSERT|DELETE)/.test(s))).toEqual([]);
  });

  test('migration_20 não rodada → 409 com a orientação', async () => {
    mockPut({ erro: semTabela });
    const { status, body } = await put({ subelementoCodigo: '3.3.90.36.08', campos: [] });
    expect(status).toBe(409);
    expect(body.error).toContain('migration_20');
  });
});
