// B8 — IRRF progressivo da pessoa física (3.3.90.36) do banco simulado até a
// prévia, a OP gravada, o lote e a configuração (rota calculo-pessoa-fisica).
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Nao autenticado' }) }),
  forbiddenResponse: () => ({ status: 403, json: async () => ({ error: 'Acesso negado' }) }),
}));

import { query, withTransaction } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { POST as postPrevia } from '@/app/api/ordens-pagamento/previa/route';
import * as rotaPf from '@/app/api/configuracoes/calculo-pessoa-fisica/route';
import * as rotaTransporte from '@/app/api/configuracoes/calculo-transporte/route';
import * as rotaIrrf from '@/app/api/configuracoes/irrf/route';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';
import { calcularRetencoesDaOp, criarCacheCalculo } from '@/lib/services/calculo-op.service';
import { responderPessoaFisica } from '../fixtures/pessoa-fisica-2026';

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

interface Cenario {
  elemento?: string;
  semParametros?: boolean;
}

function responder(sql: string, params: any[] = [], { elemento = '3.3.90.36 - Outros Serviços PF', semParametros = false }: Cenario = {}): any[] {
  const pf = responderPessoaFisica(sql, params, { semParametros });
  if (pf) return pf;
  if (sql.includes('FROM notas_empenho')) {
    return [{ id: 'ne-1', valor: '100000.00', status: 'EMITIDO', elemento, subelemento: '' }];
  }
  if (sql.includes('SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago')) return [{ total_pago: 0 }];
  if (sql.includes('FROM credores')) return [{ municipioExpediente: null, is_mei: 0 }];
  if (sql.includes('SELECT * FROM config_retencoes')) return CONFIG_ROWS;
  if (sql.includes('MAX(updated_at)')) return [{ versao: '2026-01-01T00:00:00.000Z' }];
  if (sql.includes('SELECT codigo FROM elementos_despesa')) return [{ codigo: '3.3.90.36' }, { codigo: '3.3.90.39' }];
  if (sql.includes('FROM elemento_retencoes')) {
    return ['3.3.90.36', '3.3.90.39'].flatMap((el) => TODOS.map((campo) => ({ elemento_codigo: el, campo })));
  }
  if (sql.includes('FROM subelemento_retencoes')) return [];
  return [];
}

async function previa(valorPagamento: number, cenario: Cenario = {}) {
  (query as any).mockImplementation(async (sql: string, params: any[]) => responder(sql, params, cenario));
  const res: any = await postPrevia(
    new NextRequest('http://localhost:3000/api/ordens-pagamento/previa', {
      method: 'POST',
      body: JSON.stringify({ numeroEmpenho: 'NE-1', credorCpfCnpj: '111', valorPagamento, dataPagamento: '2026-10-15' }),
    })
  );
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'GESTOR' });
});

describe('prévia da OP de 3.3.90.36', () => {
  test('R$ 5.200,00 → INSS 572,00 e IRRF 71,62 (redutor 978,62)', async () => {
    const { status, body } = await previa(5200);
    expect(status).toBe(200);
    expect(body.perfil).toBe('PESSOA_FISICA');
    expect(body.itens).toMatchObject({ irrf: 71.62, inss: 572, iss: 260, sest_senat: 130, patronal: 1040 });
    expect(body.valorLiquido).toBe(4166.38);
  });

  test('R$ 4.000,00 → IRRF 0 (isento); R$ 10.000,00 → INSS no teto', async () => {
    expect((await previa(4000)).body.itens).toMatchObject({ irrf: 0, inss: 440 });
    expect((await previa(10000)).body.itens).toMatchObject({ irrf: 1584.88, inss: 932.31 });
  });

  test('busca os parâmetros do perfil PESSOA_FISICA na data da OP e a tabela do IRRF', async () => {
    await previa(5200);
    const chamadas = (query as any).mock.calls as Array<[string, any[]]>;
    const param = chamadas.find(([s]) => s.includes('FROM calculo_parametros'))!;
    expect(param[1]).toEqual(['PESSOA_FISICA', '2026-10-15']);
    expect(chamadas.some(([s]) => s.includes('FROM irrf_faixas'))).toBe(true);
  });

  test('sem a migration_21 (parâmetros não cadastrados): 422 com mensagem clara', async () => {
    const { status, body } = await previa(5200, { semParametros: true });
    expect(status).toBe(422);
    expect(body.error).toContain('Parâmetros do IRRF de pessoa física (3.3.90.36) não cadastrados para a data 15/10/2026');
    expect(body.error).toContain('migration_21.sql');
  });

  test('3.3.90.39 continua no 1,5% e não lê parâmetros', async () => {
    const { body } = await previa(5200, { elemento: '3.3.90.39 - Outros Serviços PJ' });
    expect(body.perfil).toBe('PADRAO');
    expect(body.itens).toMatchObject({ irrf: 78, inss: 572 });
    expect(((query as any).mock.calls as any[]).some(([s]) => s.includes('calculo_parametros'))).toBe(false);
  });
});

describe('OP gravada de 3.3.90.36', () => {
  test('grava os valores e o snapshot da pessoa física', async () => {
    const chamadas: Array<[string, any[]]> = [];
    (withTransaction as any).mockImplementation(async (cb: any) =>
      cb({
        execute: vi.fn(async (sql: string, params: any[] = []) => {
          chamadas.push([sql, params]);
          if (/^\s*(INSERT|UPDATE|DELETE)/.test(sql)) return [{ affectedRows: 1 }];
          return [responder(sql, params)];
        }),
      })
    );
    const r = await OrdemPagamentoService.criar(
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '111.111.111-11', valorPagamento: 5200, dataPagamento: '2026-10-15' },
      'u1',
      'GESTOR'
    );
    expect(r.success).toBe(true);
    const p = chamadas.find(([s]) => s.includes('INSERT INTO ordens_pagamento'))![1];
    expect(p.slice(18, 23)).toEqual([71.62, 260, 572, 130, 1040]); // irrf, iss, inss, sest_senat, patronal
    expect(p[27]).toBe(4166.38);
    expect(JSON.parse(p[28])).toMatchObject({
      perfil: 'PESSOA_FISICA', vigencia: '2026-01-01', vigencia_irrf: '2026-01-01', base_irrf: 4592.8, deducao_irrf: 607.2,
    });
  });
});

describe('lote: parâmetros lidos uma vez por data', () => {
  test('cache por requisição', async () => {
    (query as any).mockImplementation(async (sql: string, params: any[]) => responder(sql, params));
    const cache = criarCacheCalculo();
    const base = {
      elementoCodigo: '3.3.90.36', credorCpfCnpj: '111', dataPagamento: '2026-10-15', informados: {}, perfilUsuario: 'GESTOR' as const,
    };
    const [a, b] = await Promise.all([
      calcularRetencoesDaOp(undefined, { ...base, brutoCents: 520000 }, cache),
      calcularRetencoesDaOp(undefined, { ...base, brutoCents: 400000 }, cache),
    ]);
    expect(a.resultado.itens.irrf).toBe(7162);
    expect(b.resultado.itens.irrf).toBe(0);
    const calls = (query as any).mock.calls as any[];
    expect(calls.filter(([s]: any) => s.includes('FROM calculo_parametros'))).toHaveLength(1);
    expect(calls.filter(([s]: any) => s.includes('MAX(vigente_de)'))).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Configuração (ADMIN)
// ---------------------------------------------------------------------------
const URL_BASE = 'http://localhost:3000/api/configuracoes';
async function chamar(handler: (r: NextRequest) => Promise<any>, caminho: string, metodo = 'GET', corpo?: unknown) {
  const req = new NextRequest(`${URL_BASE}/${caminho}`, { method: metodo, ...(corpo ? { body: JSON.stringify(corpo) } : {}) });
  const res = await handler(req);
  return { status: res.status, body: await res.json() };
}
const PARAMETROS_PF = {
  inss_teto: 932.31, desconto_simplificado: 607.2, isencao_ate: 5000, redutor_ate: 7350, redutor_constante: 978.62, redutor_coeficiente: 0.133145,
};
function transacao(respostas: Array<[RegExp, unknown[]]> = []) {
  const chamadas: Array<{ sql: string; params: any[] }> = [];
  (withTransaction as any).mockImplementation(async (cb: any) =>
    cb({
      execute: vi.fn(async (sql: string, params: any[] = []) => {
        chamadas.push({ sql, params });
        const r = respostas.find(([re]) => re.test(sql));
        return [r ? r[1] : { affectedRows: 1 }];
      }),
    })
  );
  return chamadas;
}

describe('/api/configuracoes/calculo-pessoa-fisica', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-09T12:00:00'));
    (getAuthUser as any).mockResolvedValue({ id: 'admin1', perfil: 'ADMIN' });
  });
  afterEach(() => vi.useRealTimers());

  test('sem login 401; GESTOR lê mas não grava (403, nada no banco)', async () => {
    (getAuthUser as any).mockResolvedValueOnce(null);
    expect((await chamar(rotaPf.GET, 'calculo-pessoa-fisica')).status).toBe(401);
    (getAuthUser as any).mockResolvedValue({ id: 'g', perfil: 'GESTOR' });
    (query as any).mockResolvedValue([]);
    expect((await chamar(rotaPf.GET, 'calculo-pessoa-fisica')).status).toBe(200);
    expect((await chamar(rotaPf.PUT, 'calculo-pessoa-fisica', 'PUT', { vigenteDe: '2027-01-01', parametros: PARAMETROS_PF })).status).toBe(403);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('GET lista só as vigências do perfil PESSOA_FISICA; em uso = OPs de pessoa física', async () => {
    (query as any).mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('JSON_EXTRACT')) {
        expect(params).toEqual(['PESSOA_FISICA']);
        return [{ v: '2026-01-01' }];
      }
      expect(params).toEqual(['PESSOA_FISICA']);
      return [{ chave: 'redutor_constante', valor: '978.620000', vigente_de: '2026-01-01' }];
    });
    const { status, body } = await chamar(rotaPf.GET, 'calculo-pessoa-fisica');
    expect(status).toBe(200);
    expect(body.vigencias).toEqual([
      { vigenteDe: '2026-01-01', parametros: { redutor_constante: '978.620000' }, emUso: true, editavel: false },
    ]);
  });

  test('isenção >= limite do redutor: 400', async () => {
    const { status, body } = await chamar(rotaPf.PUT, 'calculo-pessoa-fisica', 'PUT', {
      vigenteDe: '2027-01-01',
      parametros: { ...PARAMETROS_PF, isencao_ate: 8000 },
    });
    expect(status).toBe(400);
    expect(body.error).toContain('O limite do redutor deve ser maior que o limite da isenção.');
  });

  test('vigência nova: grava as 6 chaves no perfil PESSOA_FISICA e audita', async () => {
    const chamadas = transacao([[/JSON_EXTRACT/, []], [/^\s*SELECT chave, valor FROM calculo_parametros/, []]]);
    const { status } = await chamar(rotaPf.PUT, 'calculo-pessoa-fisica', 'PUT', { vigenteDe: '2027-01-01', parametros: PARAMETROS_PF });
    expect(status).toBe(200);
    const inserts = chamadas.filter((c) => c.sql.includes('INSERT INTO calculo_parametros'));
    expect(inserts.map((c) => c.params[1]).sort()).toEqual(Object.keys(PARAMETROS_PF).sort());
    expect(inserts.every((c) => c.params[0] === 'PESSOA_FISICA' && c.params[3] === '2027-01-01')).toBe(true);
    expect(inserts.find((c) => c.params[1] === 'redutor_constante')!.params[2]).toBe(978.62);
    const emUso = chamadas.find((c) => c.sql.includes('JSON_EXTRACT'))!;
    expect(emUso.params).toEqual(['PESSOA_FISICA']);
    const audit = chamadas.find((c) => c.sql.includes('INSERT INTO auditoria_financeira'))!;
    expect(audit.params.slice(1, 4)).toEqual(['calculo_parametros', 'PESSOA_FISICA@2027-01-01', 'CREATE']);
  });

  test('o transporte continua gravando no perfil dele', async () => {
    const chamadas = transacao([[/JSON_EXTRACT/, []], [/^\s*SELECT chave, valor FROM calculo_parametros/, []]]);
    const parametros = {
      base_percentual: 20, inss_percentual: 11, patronal_percentual: 20, sest_percentual: 1.5, senat_percentual: 1,
      irrf_tributavel_percentual: 60, desconto_simplificado: 607.2, redutor_constante: 978.62, redutor_coeficiente: 0.133145,
    };
    expect((await chamar(rotaTransporte.PUT, 'calculo-transporte', 'PUT', { vigenteDe: '2027-01-01', parametros })).status).toBe(200);
    const inserts = chamadas.filter((c) => c.sql.includes('INSERT INTO calculo_parametros'));
    expect(inserts).toHaveLength(9);
    expect(inserts.every((c) => c.params[0] === 'TRANSPORTE_AUTONOMO')).toBe(true);
    expect(chamadas.find((c) => c.sql.includes('JSON_EXTRACT'))!.params).toEqual(['TRANSPORTE_AUTONOMO']);
  });
});

describe('tabela do IRRF compartilhada', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-09T12:00:00'));
    (getAuthUser as any).mockResolvedValue({ id: 'admin1', perfil: 'ADMIN' });
  });
  afterEach(() => vi.useRealTimers());

  test('vigência usada só por OP de pessoa física também trava a edição (409)', async () => {
    const chamadas = transacao([[/JSON_EXTRACT/, [{ v: '2027-01-01' }]]]);
    const faixas = [
      { limiteAte: 2428.8, aliquota: 0, parcelaDeduzir: 0 },
      { limiteAte: null, aliquota: 27.5, parcelaDeduzir: 908.73 },
    ];
    const { status } = await chamar(rotaIrrf.PUT, 'irrf', 'PUT', { vigenteDe: '2027-01-01', faixas });
    expect(status).toBe(409);
    const emUso = chamadas.find((c) => c.sql.includes('JSON_EXTRACT'))!;
    expect(emUso.sql).toMatch(/IN \(\?, \?\)/);
    expect(emUso.params).toEqual(['TRANSPORTE_AUTONOMO', 'PESSOA_FISICA']);
  });
});
