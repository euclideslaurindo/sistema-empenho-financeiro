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
import * as rotaParametros from '@/app/api/configuracoes/calculo-transporte/route';
import * as rotaIrrf from '@/app/api/configuracoes/irrf/route';
import * as rotaIss from '@/app/api/configuracoes/iss-municipios/route';

const URL_BASE = 'http://localhost:3000/api/configuracoes';
async function chamar(handler: (r: NextRequest) => Promise<any>, caminho: string, metodo = 'GET', corpo?: unknown) {
  const req = new NextRequest(`${URL_BASE}/${caminho}`, { method: metodo, ...(corpo ? { body: JSON.stringify(corpo) } : {}) });
  const res = await handler(req);
  return { status: res.status, body: await res.json() };
}

const PARAMETROS = {
  base_percentual: 20,
  inss_percentual: 11,
  patronal_percentual: 20,
  sest_percentual: 1.5,
  senat_percentual: 1,
  irrf_tributavel_percentual: 60,
  desconto_simplificado: 607.2,
  redutor_constante: 978.62,
  redutor_coeficiente: 0.133145,
};
const FAIXAS = [
  { limiteAte: 2428.8, aliquota: 0, parcelaDeduzir: 0 },
  { limiteAte: 2826.65, aliquota: 7.5, parcelaDeduzir: 182.16 },
  { limiteAte: 3751.05, aliquota: 15, parcelaDeduzir: 394.16 },
  { limiteAte: 4664.68, aliquota: 22.5, parcelaDeduzir: 675.49 },
  { limiteAte: null, aliquota: 27.5, parcelaDeduzir: 908.73 },
];

/** Conexão falsa: responde por trecho de SQL e guarda as chamadas. */
function transacao(respostas: Array<[RegExp, unknown[]]> = []) {
  const chamadas: Array<{ sql: string; params: any[] }> = [];
  const conn = {
    execute: vi.fn(async (sql: string, params: any[] = []) => {
      chamadas.push({ sql, params });
      const r = respostas.find(([re]) => re.test(sql));
      return [r ? r[1] : { affectedRows: 1 }];
    }),
  };
  (withTransaction as any).mockImplementation(async (cb: any) => cb(conn));
  return chamadas;
}
const auditorias = (chamadas: Array<{ sql: string; params: any[] }>) => chamadas.filter((c) => c.sql.includes('INSERT INTO auditoria_financeira'));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T12:00:00'));
  (getAuthUser as any).mockResolvedValue({ id: 'admin1', perfil: 'ADMIN' });
});
afterEach(() => vi.useRealTimers());

describe('acesso', () => {
  test('sem login: 401 em todas', async () => {
    (getAuthUser as any).mockResolvedValue(null);
    expect((await chamar(rotaParametros.GET, 'calculo-transporte')).status).toBe(401);
    expect((await chamar(rotaIrrf.GET, 'irrf')).status).toBe(401);
    expect((await chamar(rotaIss.GET, 'iss-municipios')).status).toBe(401);
  });

  test.each(['GESTOR', 'CONSULTA'])('%s não escreve (403) e nada toca o banco', async (perfil: string) => {
    (getAuthUser as any).mockResolvedValue({ id: 'u2', perfil });
    const respostas = [
      await chamar(rotaParametros.PUT, 'calculo-transporte', 'PUT', { vigenteDe: '2027-01-01', parametros: PARAMETROS }),
      await chamar(rotaIrrf.PUT, 'irrf', 'PUT', { vigenteDe: '2027-01-01', faixas: FAIXAS }),
      await chamar(rotaIss.POST, 'iss-municipios', 'POST', { nome: 'Jupi', uf: 'PE', aliquota: 5, taxaExpediente: 6.76 }),
      await chamar(rotaIss.PUT, 'iss-municipios', 'PUT', { chave: 'canhotinho', uf: 'PE', aliquota: 5, taxaExpediente: 16 }),
    ];
    expect(respostas.map((r) => r.status)).toEqual([403, 403, 403, 403]);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('CONSULTA pode ler os parâmetros', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'u3', perfil: 'CONSULTA' });
    (query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('JSON_EXTRACT')) return [{ v: '2026-01-01' }];
      return [
        { chave: 'inss_percentual', valor: '11.000000', vigente_de: '2026-01-01' },
        { chave: 'inss_percentual', valor: '12.000000', vigente_de: '2027-01-01' },
      ];
    });
    const { status, body } = await chamar(rotaParametros.GET, 'calculo-transporte');
    expect(status).toBe(200);
    expect(body.hoje).toBe('2026-10-09');
    expect(body.atual).toBe('2026-01-01');
    expect(body.vigencias).toEqual([
      { vigenteDe: '2026-01-01', parametros: { inss_percentual: '11.000000' }, emUso: true, editavel: false },
      { vigenteDe: '2027-01-01', parametros: { inss_percentual: '12.000000' }, emUso: false, editavel: true },
    ]);
  });
});

describe('PUT /calculo-transporte', () => {
  test('vigência passada: 400 sem abrir transação', async () => {
    const { status, body } = await chamar(rotaParametros.PUT, 'calculo-transporte', 'PUT', { vigenteDe: '2026-01-01', parametros: PARAMETROS });
    expect(status).toBe(400);
    expect(body.error).toMatch(/hoje ou depois/);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('parâmetro inválido: 400 com a mensagem', async () => {
    const { status, body } = await chamar(rotaParametros.PUT, 'calculo-transporte', 'PUT', {
      vigenteDe: '2027-01-01',
      parametros: { ...PARAMETROS, inss_percentual: 150 },
    });
    expect(status).toBe(400);
    expect(body.error).toContain('INSS (% da base): não pode passar de 100%.');
  });

  test('vigência já usada por OP: 409 e nada gravado', async () => {
    const chamadas = transacao([[/JSON_EXTRACT/, [{ v: '2026-10-09' }]]]);
    const { status, body } = await chamar(rotaParametros.PUT, 'calculo-transporte', 'PUT', { vigenteDe: '2026-10-09', parametros: PARAMETROS });
    expect(status).toBe(409);
    expect(body.error).toMatch(/já usada por OP/);
    expect(chamadas.some((c) => /INSERT|UPDATE|DELETE/.test(c.sql.replace('FOR UPDATE', '')))).toBe(false);
  });

  test('vigência futura nova: grava as 9 chaves só nela e audita CREATE', async () => {
    const chamadas = transacao([[/JSON_EXTRACT/, []], [/^\s*SELECT chave, valor FROM calculo_parametros/, []]]);
    const { status } = await chamar(rotaParametros.PUT, 'calculo-transporte', 'PUT', {
      vigenteDe: '2027-01-01',
      parametros: { ...PARAMETROS, inss_percentual: '12' },
    });
    expect(status).toBe(200);
    const inserts = chamadas.filter((c) => c.sql.includes('INSERT INTO calculo_parametros'));
    expect(inserts).toHaveLength(9);
    expect(inserts.every((c) => c.params[3] === '2027-01-01' && c.params[0] === 'TRANSPORTE_AUTONOMO')).toBe(true);
    expect(inserts.find((c) => c.params[1] === 'inss_percentual')!.params[2]).toBe(12);
    expect(chamadas.some((c) => /^\s*(UPDATE|DELETE)/.test(c.sql))).toBe(false);
    const [audit] = auditorias(chamadas);
    expect(audit.params.slice(1, 4)).toEqual(['calculo_parametros', 'TRANSPORTE_AUTONOMO@2027-01-01', 'CREATE']);
    expect(audit.params[4]).toBeNull();
    expect(audit.params[6]).toBe('admin1');
  });

  test('vigência futura existente e sem uso: UPDATE auditado com o antes', async () => {
    const chamadas = transacao([
      [/JSON_EXTRACT/, []],
      [/^\s*SELECT chave, valor FROM calculo_parametros/, [{ chave: 'inss_percentual', valor: '11.000000' }]],
    ]);
    expect((await chamar(rotaParametros.PUT, 'calculo-transporte', 'PUT', { vigenteDe: '2027-01-01', parametros: PARAMETROS })).status).toBe(200);
    const [audit] = auditorias(chamadas);
    expect(audit.params[3]).toBe('UPDATE');
    expect(JSON.parse(audit.params[4])).toEqual({ inss_percentual: '11.000000' });
  });
});

describe('PUT /irrf', () => {
  test('faixas fora de ordem: 400 com a faixa', async () => {
    const faixas = FAIXAS.map((f, i) => (i === 2 ? { ...f, limiteAte: 2000 } : f));
    const { status, body } = await chamar(rotaIrrf.PUT, 'irrf', 'PUT', { vigenteDe: '2027-01-01', faixas });
    expect(status).toBe(400);
    expect(body.error).toContain('Faixa 3: o limite deve ser maior que o da faixa 2.');
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('tabela em uso: 409', async () => {
    transacao([[/JSON_EXTRACT/, [{ v: '2027-01-01' }]]]);
    const { status } = await chamar(rotaIrrf.PUT, 'irrf', 'PUT', { vigenteDe: '2027-01-01', faixas: FAIXAS });
    expect(status).toBe(409);
  });

  test('substitui as faixas daquela vigência na transação; última sem limite; auditada', async () => {
    const antes = [{ ordem: 1, limite_ate: null, aliquota: '0.0000', parcela_deduzir: '0.00' }];
    const chamadas = transacao([[/JSON_EXTRACT/, []], [/^\s*SELECT ordem/, antes]]);
    const { status } = await chamar(rotaIrrf.PUT, 'irrf', 'PUT', { vigenteDe: '2027-01-01', faixas: FAIXAS });
    expect(status).toBe(200);
    const del = chamadas.find((c) => c.sql.startsWith('DELETE FROM irrf_faixas'))!;
    expect(del.params).toEqual(['2027-01-01']);
    const inserts = chamadas.filter((c) => c.sql.startsWith('INSERT INTO irrf_faixas'));
    expect(inserts.map((c) => c.params.slice(0, 5))).toEqual([
      ['2027-01-01', 1, 2428.8, 0, 0],
      ['2027-01-01', 2, 2826.65, 7.5, 182.16],
      ['2027-01-01', 3, 3751.05, 15, 394.16],
      ['2027-01-01', 4, 4664.68, 22.5, 675.49],
      ['2027-01-01', 5, null, 27.5, 908.73],
    ]);
    expect(chamadas.indexOf(del)).toBeLessThan(chamadas.indexOf(inserts[0]));
    const [audit] = auditorias(chamadas);
    expect(audit.params.slice(1, 4)).toEqual(['irrf_faixas', '2027-01-01', 'UPDATE']);
    expect(JSON.parse(audit.params[4])).toEqual(antes);
  });
});

describe('ISS por município', () => {
  const CANHOTINHO = { chave: 'canhotinho', nome: 'Canhotinho', uf: 'PE', aliquota: '5.0000', taxa_expediente: '15.20', apelidos: null, ativo: 1 };

  test('GET devolve camelCase', async () => {
    (query as any).mockResolvedValue([CANHOTINHO]);
    const { body } = await chamar(rotaIss.GET, 'iss-municipios');
    expect(body.municipios).toEqual([
      { chave: 'canhotinho', nome: 'Canhotinho', uf: 'PE', aliquota: '5.0000', taxaExpediente: '15.20', apelidos: null, ativo: true },
    ]);
  });

  test('Canhotinho 15,20 → 16,00: atualiza na hora e audita antes/depois', async () => {
    const chamadas = transacao([[/^\s*SELECT \* FROM iss_municipios/, [CANHOTINHO]]]);
    const { status } = await chamar(rotaIss.PUT, 'iss-municipios', 'PUT', {
      chave: 'canhotinho',
      uf: 'pe',
      aliquota: 5,
      taxaExpediente: 16,
      apelidos: '',
      ativo: true,
    });
    expect(status).toBe(200);
    const upd = chamadas.find((c) => c.sql.startsWith('UPDATE iss_municipios'))!;
    expect(upd.params).toEqual(['PE', 5, 16, null, 1, 'admin1', 'canhotinho']);
    const [audit] = auditorias(chamadas);
    expect(audit.params.slice(1, 4)).toEqual(['iss_municipios', 'canhotinho', 'UPDATE']);
    expect(JSON.parse(audit.params[4]).taxa_expediente).toBe('15.20');
    expect(JSON.parse(audit.params[5]).taxa_expediente).toBe(16);
  });

  test('município inexistente: 404', async () => {
    transacao([[/^\s*SELECT \* FROM iss_municipios/, []]]);
    const { status } = await chamar(rotaIss.PUT, 'iss-municipios', 'PUT', { chave: 'xyz', uf: 'PE', aliquota: 5, taxaExpediente: 0 });
    expect(status).toBe(404);
  });

  test('incluir: chave normalizada, apelidos normalizados, 201 e auditoria', async () => {
    const chamadas = transacao([[/^\s*SELECT chave FROM iss_municipios/, []]]);
    const { status, body } = await chamar(rotaIss.POST, 'iss-municipios', 'POST', {
      nome: '  São  Bento do Una ',
      uf: 'pe',
      aliquota: '5',
      taxaExpediente: '0',
      apelidos: 'S. Bento do Una; SAO BENTO',
    });
    expect(status).toBe(201);
    expect(body.chave).toBe('sao bento do una');
    const ins = chamadas.find((c) => c.sql.includes('INSERT INTO iss_municipios'))!;
    expect(ins.params).toEqual(['sao bento do una', 'São Bento do Una', 'PE', 5, 0, 's. bento do una;sao bento', 'admin1']);
    expect(auditorias(chamadas)[0].params[3]).toBe('CREATE');
  });

  test('município duplicado: 409', async () => {
    const chamadas = transacao([[/^\s*SELECT chave FROM iss_municipios/, [{ chave: 'canhotinho' }]]]);
    const { status, body } = await chamar(rotaIss.POST, 'iss-municipios', 'POST', { nome: 'CANHOTINHO', uf: 'PE', aliquota: 5, taxaExpediente: 1 });
    expect(status).toBe(409);
    expect(body.error).toMatch(/já está cadastrado/);
    expect(chamadas.some((c) => c.sql.includes('INSERT'))).toBe(false);
  });

  test('dados inválidos: 400', async () => {
    const { status } = await chamar(rotaIss.POST, 'iss-municipios', 'POST', { nome: 'Jupi', uf: 'P', aliquota: 120, taxaExpediente: 0 });
    expect(status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
  });
});
