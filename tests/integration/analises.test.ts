// B2 (Análises) — as 2 rotas com o banco simulado pelo texto do SQL.
// "Hoje" é fixado em 27/10/2026 para o corte do período ser previsível.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Nao autenticado' }) }),
  forbiddenResponse: () => ({ status: 403, json: async () => ({ error: 'Acesso negado' }) }),
}));

import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { GET as getAnalises } from '@/app/api/analises/route';
import { GET as getOps } from '@/app/api/analises/ops/route';
import { DATA_OP, EXERCICIO_NE } from '@/lib/sql-op';

const analises = async (qs = '') => {
  const res: any = await getAnalises(new NextRequest(`http://localhost:3000/api/analises${qs}`));
  return { status: res.status, body: await res.json() };
};
const ops = async (qs = '') => {
  const res: any = await getOps(new NextRequest(`http://localhost:3000/api/analises/ops${qs}`));
  return { status: res.status, body: await res.json() };
};

const sqls = (): string[] => (query as any).mock.calls.map((c: any[]) => c[0]);
const chamadas = (trecho: string) => (query as any).mock.calls.filter((c: any[]) => c[0].includes(trecho));

// ---- um ano de 2026 pequeno, com contas que fecham ----
const MESES_2026 = [
  { mes: '2026-02', ops: 2, bruto: '1000.10', irrf: '10.00', iss: '20.00', inss: '110.00', sest: '2.50', patronal: '200.00', liquido: '857.60', restos: '100.00', pagoNesPeriodo: '900.10' },
  { mes: '2026-05', ops: 1, bruto: '0.20', irrf: '0.10', iss: '0.00', inss: '0.00', sest: '0.00', patronal: '0.00', liquido: '0.10', restos: '0.00', pagoNesPeriodo: '0.20' },
];
const NES_2026 = [
  { numero: 'NE1', mes: '2026-02', valor: '1500.00', status: 'PARCIALMENTE PAGO', pago: '900.10', liquido: '800.00' },
  { numero: 'NE2', mes: '2026-05', valor: '0.20', status: 'LIQUIDADO', pago: '0.20', liquido: '0.10' },
  { numero: 'NE3', mes: '2026-03', valor: '300.00', status: 'CANCELADO', pago: '0', liquido: '0' },
  { numero: 'NE4', mes: '2026-09', valor: '200.00', status: 'EMITIDO', pago: '0', liquido: '0' },
];
const MESES_2025 = [{ mes: '2025-02', ops: 1, bruto: '800.24', irrf: '0', iss: '0', inss: '0', sest: '0', patronal: '0', liquido: '800.24', restos: '0', pagoNesPeriodo: '800.24' }];
const NES_2025 = [{ numero: 'NE0', mes: '2025-02', valor: '1000.10', status: 'LIQUIDADO', pago: '1000.10', liquido: '900.00' }];

interface Banco {
  anos?: number[];
  meses?: any[];
  nes?: any[];
  elementos?: any[];
  falhar?: boolean;
}

function mockBanco(b: Banco = {}) {
  const anos = b.anos ?? [2026, 2025];
  (query as any).mockImplementation(async (sql: string, params: any[] = []) => {
    if (b.falhar) throw new Error("ER_BAD_FIELD_ERROR: Unknown column 'op.xyz' in 'field list'");
    if (sql.includes('UNION')) return anos.map((ano) => ({ ano }));
    if (sql.includes('GROUP BY mes')) return String(params[1]).startsWith('2025') ? MESES_2025 : b.meses ?? MESES_2026;
    if (sql.includes('FROM notas_empenho ne')) return String(params[0]).startsWith('2025') ? NES_2025 : b.nes ?? NES_2026;
    if (sql.includes('COUNT(DISTINCT')) return [{ qtd: 2 }];
    if (sql.includes('GROUP BY op.elemento'))
      return b.elementos ?? [{ elemento: '3.3.90.33 - Transporte', pago: '600.30' }, { elemento: '3.3.90.36 - Serviços PF', pago: '400.00' }];
    if (sql.includes('municipioExpediente')) return [{ pago: '600.30', municipio: 'Garanhuns/PE' }];
    if (sql.includes('LIMIT 10')) return [
      { cpf: '11122233396', nomeOp: 'ALVARO S', nomeCadastro: 'Álvaro Souza', pago: '600.30' },
      { cpf: '22233344405', nomeOp: 'Bruno Lima', nomeCadastro: null, pago: '400.00' },
    ];
    if (sql.includes('darf_acompanhamento')) return [
      { competencia: '2026-02', status: 'PAGA', valor: '312.50' },
      { competencia: '2026-09', status: 'PENDENTE', valor: '50.00' },
    ];
    throw new Error(`SQL inesperado: ${sql}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-27T12:00:00'));
  (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'CONSULTA' });
  mockBanco();
});
afterEach(() => vi.useRealTimers());

describe('GET /api/analises — acesso e validação', () => {
  test('sem login → 401, sem consultar o banco', async () => {
    (getAuthUser as any).mockResolvedValue(null);
    expect((await analises()).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  test.each([
    ['?periodo=trimestre', 'Dados inválidos'],
    ['?base=caixa', 'Dados inválidos'],
    ['?ano=1999', 'Dados inválidos'],
    ['?elemento=3.3%25', 'Dados inválidos'],
    ["?elemento=1'%20OR%201=1", 'Dados inválidos'],
    ['?periodo=intervalo&inicio=2025-12-01&fim=2026-01-31', 'mesmo ano'],
    ['?periodo=intervalo&inicio=2026-02-31&fim=2026-03-01', 'AAAA-MM-DD'],
    ['?periodo=intervalo&inicio=2026-05-01&fim=2026-04-01', 'depois'],
  ])('%s → 400 (%s)', async (qs: string, trecho: string) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { status, body } = await analises(qs);
    expect(status).toBe(400);
    expect(body.error).toContain(trecho);
    vi.mocked(console.error).mockRestore();
  });

  test('erro do banco → 500 sem vazar o SQL', async () => {
    mockBanco({ falhar: true });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { status, body } = await analises('?ano=2026');
    vi.mocked(console.error).mockRestore();
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('op.xyz');
  });
});

describe('GET /api/analises — montagem (ano civil de 2026, até 27/10)', () => {
  test('perfil Consulta vê; cartões, restos e "de NEs anteriores" batem em centavos', async () => {
    const { status, body } = await analises('?periodo=ano&ano=2026');
    expect(status).toBe(200);
    expect(body.periodo).toMatchObject({ inicio: '2026-01-01', fimEfetivo: '2026-10-27', parcial: true, rotulo: '2026 (até 27/10)' });
    expect(body.kpis).toEqual({
      empenhado: 2000.2, pago: 1000.3, saldo: 799.9, retido: 142.6,
      varEmpenhado: 100, varPago: 25, varSaldo: null, varRetido: null,
    });
    expect(body).toMatchObject({ restos: 100, pagoDasNes: 900.3, pagoAnteriores: 100, qtdOps: 3, qtdCredores: 2, qtdNes: 4, pctTransporte: 60, vazio: false, avisos: [] });
  });

  test('a ponte fecha no centavo e a situação usa o pago até o fim do período', async () => {
    const { body } = await analises('?ano=2026');
    expect(body.ponte).toEqual({ empenhado: 2000.2, cancelado: 300, liquido: 800.1, retencoes: 100.2, saldo: 799.9 });
    const p = body.ponte;
    expect(Math.round((p.empenhado - p.cancelado - p.liquido - p.retencoes) * 100)).toBe(Math.round(p.saldo * 100));
    expect(body.nes).toEqual([
      { nome: 'A pagar', qtd: 1, valor: 200 },
      { nome: 'Parcial', qtd: 1, valor: 1500 },
      { nome: 'Paga', qtd: 1, valor: 0.2 },
      { nome: 'Cancelada', qtd: 1, valor: 300 },
    ]);
    expect(body.pctPagoDoEmpenhado).toBe(53); // 900,30 / (2000,20 − 300)
  });

  test('meses completos de jan a out, com zero onde não houve movimento', async () => {
    const { body } = await analises('?ano=2026');
    expect(body.meses.map((m: any) => m.mes)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(body.meses[0]).toMatchObject({ rotulo: 'jan', longo: 'Janeiro', pago: 0, ops: 0, empenhado: 0 });
    expect(body.meses[1]).toMatchObject({ pago: 1000.1, ops: 2, empenhado: 1500, inss: 110, patronal: 200 });
    expect(body.meses[2].empenhado).toBe(300);
    expect(body.meses.reduce((t: number, m: any) => t + Math.round(m.pago * 100), 0)).toBe(100030);
    expect(body.darf.filter((d: any) => d.paga || d.pendente)).toEqual([
      { mes: '2026-02', rotulo: 'fev', paga: 312.5, pendente: 0 },
      { mes: '2026-09', rotulo: 'set', paga: 0, pendente: 50 },
    ]);
  });

  test('elementos, credores (nome do cadastro primeiro), municípios, resumo e critérios', async () => {
    const { body } = await analises('?ano=2026');
    expect(body.elementos).toEqual([
      { codigo: '3.3.90.33', desc: 'Transporte', pago: 600.3, pct: 60 },
      { codigo: '3.3.90.36', desc: 'Serviços PF', pago: 400, pct: 40 },
    ]);
    expect(body.credores).toEqual([{ nome: 'Álvaro Souza', pago: 600.3 }, { nome: 'Bruno Lima', pago: 400 }]);
    expect(body.municipios).toEqual([{ nome: 'Garanhuns', pago: 600.3 }]);
    const frase = body.resumo.map((t: any) => t.t).join('');
    expect(frase).toContain('Em 2026 (até 27/10) foram pagos R$ 1 mil a 2 credores, 25% a mais que em jan–out/2025.');
    expect(frase).toContain('restos a pagar');
    expect(body.criterios).toHaveLength(4);
  });

  test('centavos que o ponto flutuante erra (600,30 × 100 = 60029,999…) passam pela ponte exatos', async () => {
    mockBanco({
      nes: [
        { numero: 'NEA', mes: '2026-02', valor: '600.30', status: 'LIQUIDADO', pago: '600.30', liquido: '590.17' },
        { numero: 'NEB', mes: '2026-03', valor: '4.35', status: 'EMITIDO', pago: '0', liquido: '0' },
      ],
    });
    const { status, body } = await analises('?ano=2026');
    expect(status).toBe(200);
    expect(body.ponte).toEqual({ empenhado: 604.65, cancelado: 0, liquido: 590.17, retencoes: 10.13, saldo: 4.35 });
  });

  test('aviso (não erro) para dado inconsistente: NE paga acima do valor e leitura no meio de um lançamento', async () => {
    mockBanco({
      nes: [{ numero: 'NEX', mes: '2026-02', valor: '100.00', status: 'LIQUIDADO', pago: '150.00', liquido: '150.00' }],
      elementos: [{ elemento: '3.3.90.33 - Transporte', pago: '999.00' }],
    });
    const { status, body } = await analises('?ano=2026');
    expect(status).toBe(200);
    expect(body.avisos).toHaveLength(2);
    expect(body.ponte.saldo).toBe(-50);
  });
});

describe('GET /api/analises — SQL', () => {
  test('ano civil: datas como parâmetro, sem filtro de exercício; comparação com as mesmas datas de 2025', async () => {
    await analises('?ano=2026');
    const [atual, anterior] = chamadas('GROUP BY mes');
    expect(atual[1]).toEqual([2026, '2026-01-01', '2026-10-27', '2026-01-01', '2026-10-27']);
    expect(anterior[1]).toEqual([2025, '2025-01-01', '2025-10-27', '2025-01-01', '2025-10-27']);
    expect(atual[0]).toContain(`${DATA_OP} BETWEEN ? AND ?`);
    expect(atual[0]).not.toContain(`${EXERCICIO_NE} = ?`);
    for (const sql of sqls()) expect(sql, sql).not.toMatch(/20\d\d-\d\d/);
  });

  test('exercício da NE: filtra OPs e NEs pelo exercício, como número (sem collation)', async () => {
    await analises('?ano=2026&base=exercicio');
    const [atual] = chamadas('GROUP BY mes');
    expect(atual[0]).toContain(`${EXERCICIO_NE} = ?`);
    expect(atual[1].at(-1)).toBe(2026);
    expect(EXERCICIO_NE).toContain('AS UNSIGNED');
    const [nes] = chamadas('pg.numero_ne = ne.numero');
    expect(nes[0]).toContain(`${EXERCICIO_NE} = ?`);
    expect(nes[1]).toEqual(['2026-10-27', '2026-01-01', '2026-10-27', 2026]);
  });

  test('exercício: restos a pagar ficam zerados', async () => {
    const { body } = await analises('?ano=2026&base=exercicio');
    expect(body.restos).toBe(0);
  });

  test('a ponte lê os pagamentos até o fim efetivo (atual e anterior)', async () => {
    await analises('?ano=2026');
    const [atual, anterior] = chamadas('pg.numero_ne = ne.numero');
    expect(atual[0]).toMatch(/WHERE COALESCE\(o2\.data_pagamento, o2\.data_emissao, DATE\(o2\.created_at\)\) <= \?/);
    expect(atual[1][0]).toBe('2026-10-27');
    expect(anterior[1][0]).toBe('2025-10-27');
  });

  test('elemento vira LIKE "código%" nas OPs e nas NEs; município só busca transporte', async () => {
    await analises('?ano=2026&elemento=3.3.90.33');
    expect(chamadas('GROUP BY mes')[0][1]).toContain('3.3.90.33%');
    expect(chamadas('pg.numero_ne = ne.numero')[0][0]).toContain('ne.elemento LIKE ?');
    expect(chamadas('municipioExpediente')[0][1]).toContain('3.3.90.33%');

    vi.clearAllMocks();
    mockBanco();
    const { body } = await analises('?ano=2026&elemento=3.3.90.36');
    expect(chamadas('municipioExpediente')).toHaveLength(0);
    expect(body.municipios).toEqual([]);
  });

  test('collation: DARF sem JOIN; município do credor só lido, nunca comparado', async () => {
    await analises('?ano=2026');
    const [darf] = chamadas('darf_acompanhamento');
    expect(darf[0]).not.toMatch(/\bJOIN\b/i);
    expect(darf[1]).toEqual(['2026-01', '2026-10']);
    for (const sql of sqls()) expect(sql).not.toMatch(/municipioExpediente\s*(=|LIKE|IN)/i);
  });

  test('sem ano: o mais recente com movimento; sem movimento, o ano atual', async () => {
    mockBanco({ anos: [2025, 2024] });
    expect((await analises()).body.periodo.ano).toBe(2025);
    mockBanco({ anos: [] });
    expect((await analises()).body.periodo.ano).toBe(2026);
  });

  test('período que não começou: vazio, sem consultar as métricas', async () => {
    const { status, body } = await analises('?ano=2027');
    expect(status).toBe(200);
    expect(body.vazio).toBe(true);
    expect(body.resumo[0].t).toBe('O período 2027 ainda não começou.');
    expect(sqls()).toHaveLength(1); // só os anos
  });

  test('1º semestre fechado: corte em 30/06 e comparação com o 1º sem/2025', async () => {
    await analises('?periodo=s1&ano=2026');
    const [atual, anterior] = chamadas('GROUP BY mes');
    expect(atual[1].slice(1, 3)).toEqual(['2026-01-01', '2026-06-30']);
    expect(anterior[1].slice(1, 3)).toEqual(['2025-01-01', '2025-06-30']);
  });
});

describe('GET /api/analises/ops — detalhe do recorte', () => {
  const linha = (i: number, exercicioNe = 2026) => ({
    id: `op${i}`, data: '2026-03-10', numeroOp: `2026.OP.${i}`, numeroNe: 'NE1', sub: '01', credor: 'Fulano', elemento: '3.3.90.33 - Transporte',
    bruto: '100.10', retido: '10.00', liquido: '90.10', exercicioNe,
  });

  function mockOps(n: number, exercicios: number[] = []) {
    (query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(*) AS qtd')) return [{ qtd: n, total: String((n * 100.1).toFixed(2)) }];
      return Array.from({ length: n }, (_, i) => linha(i, exercicios[i] ?? 2026));
    });
  }

  test('sem login → 401', async () => {
    (getAuthUser as any).mockResolvedValue(null);
    expect((await ops('?inicio=2026-03-01&fim=2026-03-31')).status).toBe(401);
  });

  test.each([
    ['?inicio=2026-03-01'],
    ['?inicio=2026-02-30&fim=2026-03-31'],
    ['?inicio=2026-04-01&fim=2026-03-31'],
    ['?inicio=2025-01-01&fim=2026-03-31'],
    ['?inicio=2026-03-01&fim=2026-03-31&cpf=123'],
  ])('%s → 400', async (qs: string) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockOps(0);
    expect((await ops(qs)).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
    vi.mocked(console.error).mockRestore();
  });

  test('filtros como parâmetro (CPF só dígitos), restos marcados e total do recorte', async () => {
    mockOps(2, [2026, 2025]);
    const { status, body } = await ops('?inicio=2026-03-01&fim=2026-03-31&cpf=111.222.333-96&elemento=3.3.90.33');
    expect(status).toBe(200);
    const [sqlLista, paramsLista] = (query as any).mock.calls.find((c: any[]) => c[0].includes('LIMIT 501'));
    expect(sqlLista).toContain('= ?');
    expect(paramsLista).toEqual(['2026-03-01', '2026-03-31', '3.3.90.33%', '11122233396']);
    expect(body.ops.map((o: any) => o.restos)).toEqual([false, true]);
    expect(body.ops[0]).toMatchObject({ bruto: 100.1, retido: 10, liquido: 90.1 });
    expect(body).toMatchObject({ qtd: 2, total: 200.2, limite: 500, truncado: false });
  });

  test('mais de 500 OPs: devolve 500 e avisa que cortou', async () => {
    mockOps(501);
    const { body } = await ops('?inicio=2026-01-01&fim=2026-12-31');
    expect(body.ops).toHaveLength(500);
    expect(body.truncado).toBe(true);
    expect(body.qtd).toBe(501);
  });

  test('exercício: filtra pelo ano do início e não marca restos', async () => {
    mockOps(1, [2025]);
    const { body } = await ops('?inicio=2026-03-01&fim=2026-03-31&base=exercicio');
    const [, params] = (query as any).mock.calls.find((c: any[]) => c[0].includes('LIMIT 501'));
    expect(params).toEqual(['2026-03-01', '2026-03-31', 2026]);
    expect(body.ops[0].restos).toBe(false);
  });
});

describe('database/consultas/conferencia_analises.sql', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'consultas', 'conferencia_analises.sql'), 'utf8');
  const executavel = sql.split(/\r?\n/).map((l) => l.replace(/--.*$/, '')).join('\n');

  test('começa com as datas e usa as regras do sistema', () => {
    expect(executavel).toMatch(/^\s*USE empenho;\s*SET @inicio = '\d{4}-\d{2}-\d{2}';\s*SET @fim = '\d{4}-\d{2}-\d{2}';/);
    expect(executavel).toContain(`${DATA_OP} BETWEEN @inicio AND @fim`);
    expect(executavel).toContain("CAST(NULLIF(ne.exercicio, '') AS UNSIGNED)");
  });

  test('só leitura', () => {
    for (const palavra of ['INSERT', 'UPDATE', 'DELETE', 'REPLACE INTO', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'RENAME', 'GRANT']) {
      expect(executavel).not.toMatch(new RegExp(`\\b${palavra}\\b`, 'i'));
    }
  });
});
