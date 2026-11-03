// B7b — Análises por tipo de despesa: período "Mês", filtro de tipo (subelemento),
// nº de NEs e nº de prestadores. Banco simulado pelo texto do SQL; "hoje" = 27/10/2026.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

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
import { GET as getCsv } from '@/app/api/analises/csv/route';

const analises = async (qs = '') => {
  const res: any = await getAnalises(new NextRequest(`http://localhost:3000/api/analises${qs}`));
  return { status: res.status, body: await res.json() };
};
const chamadas = (trecho: string) => (query as any).mock.calls.filter((c: any[]) => c[0].includes(trecho));

const EST = '3.3.90.36.08 - Estagiários - Pagamento Direto';
const PF = '3.3.90.36 - Outros Serviços de Terceiros - PF';
const TR = '3.3.90.33 - Passagens e Despesas com Locomoção';

/** NE A (estagiários, 3 credores nas OPs) e NE B (estagiários, NE antiga: 2) → 5 prestadores no tipo. */
const NES = [
  { numero: 'A', mes: '2026-02', valor: '1000.00', status: 'PARCIALMENTE PAGO', pago: '600.00', liquido: '600.00', elemento: PF, subelemento: EST, prestadores: 3 },
  { numero: 'B', mes: '2026-02', valor: '500.00', status: 'EMITIDO', pago: '0', liquido: '0', elemento: PF, subelemento: EST, prestadores: 2 },
  { numero: 'C', mes: '2026-03', valor: '200.00', status: 'CANCELADO', pago: '0', liquido: '0', elemento: PF, subelemento: EST, prestadores: 4 },
  { numero: 'D', mes: '2026-05', valor: '300.00', status: 'EMITIDO', pago: '0', liquido: '0', elemento: TR, subelemento: '', prestadores: 1 },
  { numero: 'E', mes: '2026-05', valor: '50.00', status: 'EMITIDO', pago: '0', liquido: '0', elemento: PF, subelemento: 'Locação', prestadores: 1 },
];
const MESES = [
  { mes: '2026-02', ops: 3, bruto: '700.00', irrf: '0', iss: '0', inss: '0', sest: '0', patronal: '0', liquido: '700.00', restos: '100.00', pagoNesPeriodo: '600.00' },
];
const POR_TIPO = [
  { elemento: PF, subelemento: EST, pago: '600.00' },
  // OP de restos a pagar (NE de 2025, sem subelemento) também entra no total por tipo
  { elemento: PF, subelemento: null, pago: '100.00' },
];

function mockBanco({ nes = NES, meses = MESES, porTipo = POR_TIPO } = {}) {
  (query as any).mockImplementation(async (sql: string, params: any[] = []) => {
    if (sql.includes('UNION')) return [{ ano: 2026 }, { ano: 2025 }];
    const doAnoAnterior = params.some((p) => String(p).startsWith('2025-'));
    if (sql.includes('GROUP BY mes')) return doAnoAnterior ? [] : meses;
    if (sql.includes('FROM notas_empenho ne')) return doAnoAnterior ? [] : nes;
    if (sql.includes('GROUP BY op.elemento, op.subelemento')) return porTipo;
    if (sql.includes('GROUP BY op.elemento')) return [{ elemento: PF, pago: '700.00' }];
    if (sql.includes('COUNT(DISTINCT')) return [{ qtd: 4 }];
    if (sql.includes('municipioExpediente')) return [];
    if (sql.includes('LIMIT 10')) return [];
    if (sql.includes('darf_acompanhamento')) return [];
    if (sql.includes('COUNT(*) AS qtd')) return [{ qtd: 0, total: 0 }];
    if (sql.includes('ORDER BY data')) return [];
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

describe('por tipo de despesa', () => {
  test('prestadores = credores de cada NE, somados no tipo (3 + 2 = 5); NE cancelada fica fora', async () => {
    const { status, body } = await analises('?periodo=ano&ano=2026');
    expect(status).toBe(200);
    const est = body.tipos.find((t: any) => t.codigo === '3.3.90.36.08');
    expect(est).toEqual({
      codigo: '3.3.90.36.08', elementoCodigo: '3.3.90.36', desc: 'Estagiários - Pagamento Direto',
      empenhado: 1500, pago: 600, qtdNes: 2, prestadores: 5, pct: 85.7,
    });
    expect(body.qtdPrestadores).toBe(7);
  });

  test('sem subelemento (vazio, texto antigo solto ou nulo) cai no "(sem subelemento)" do elemento; o pago fecha', async () => {
    const { body } = await analises('?periodo=ano&ano=2026');
    const semPF = body.tipos.find((t: any) => t.codigo === null && t.elementoCodigo === '3.3.90.36');
    const semTR = body.tipos.find((t: any) => t.codigo === null && t.elementoCodigo === '3.3.90.33');
    expect(semPF).toMatchObject({ desc: '3.3.90.36 (sem subelemento)', empenhado: 50, pago: 100, qtdNes: 1, prestadores: 1 });
    expect(semTR).toMatchObject({ desc: '3.3.90.33 (sem subelemento)', empenhado: 300, pago: 0, qtdNes: 1 });
    const somaPago = body.tipos.reduce((s: number, t: any) => s + Math.round(t.pago * 100), 0);
    expect(somaPago).toBe(Math.round(body.kpis.pago * 100));
    expect(body.avisos).toEqual([]);
  });

  test('o SQL das NEs conta os credores das OPs até o fim do período (sem ne_credores) e usa o credor da NE antiga', async () => {
    await analises('?periodo=ano&ano=2026');
    const [sql, params] = chamadas('AS prestadores')[0];
    expect(sql).toContain("COUNT(DISTINCT NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(o2.credor_cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', ''), '')) AS credores");
    expect(sql).toContain("WHEN TRIM(COALESCE(ne.cpf_cnpj, '')) <> '' THEN 1");
    expect(sql).toContain('ne.elemento, ne.subelemento');
    expect(sql).not.toContain('ne_credores');
    expect(params[0]).toBe('2026-10-27');
  });

  test('NEs por mês na execução', async () => {
    const { body } = await analises('?periodo=ano&ano=2026');
    const nes = Object.fromEntries(body.meses.map((m: any) => [m.mes, m.nes]));
    expect(nes).toMatchObject({ '2026-01': 0, '2026-02': 2, '2026-03': 1, '2026-05': 2, '2026-10': 0 });
  });

  test('a soma por tipo diferente do pago (OP lançada durante a leitura) vira aviso, não erro', async () => {
    mockBanco({ porTipo: [{ elemento: PF, subelemento: EST, pago: '600.00' }] });
    const { status, body } = await analises('?periodo=ano&ano=2026');
    expect(status).toBe(200);
    expect(body.avisos.join(' ')).toContain('recarregue');
  });
});

describe('filtro de tipo (subelemento)', () => {
  test('filtra OPs e NEs por "= código" ou "código + espaço", e fixa o elemento pai', async () => {
    const { status, body } = await analises('?periodo=ano&ano=2026&subelemento=3.3.90.36.08');
    expect(status).toBe(200);
    expect(body.subelemento).toBe('3.3.90.36.08');
    expect(body.elemento).toBe('3.3.90.36');
    const [sqlOps, pOps] = chamadas('GROUP BY mes')[0];
    expect(sqlOps).toContain('op.elemento LIKE ? AND (op.subelemento = ? OR op.subelemento LIKE ?)');
    expect(pOps.slice(-3)).toEqual(['3.3.90.36%', '3.3.90.36.08', '3.3.90.36.08 %']);
    const [sqlNes, pNes] = chamadas('AS prestadores')[0];
    expect(sqlNes).toContain('(ne.subelemento = ? OR ne.subelemento LIKE ?)');
    expect(pNes.slice(-2)).toEqual(['3.3.90.36.08', '3.3.90.36.08 %']);
  });

  test.each([
    ['?subelemento=3.3.90.36.08&elemento=3.3.90.39', 'não é do elemento'],
    ['?subelemento=3.3.90.36', 'Dados inválidos'],
    ["?subelemento=3.3.90.36.08'", 'Dados inválidos'],
    ['?periodo=mes&ano=2026', 'Informe o mês'],
    ['?periodo=mes&ano=2026&mes=13', 'Dados inválidos'],
  ])('%s → 400 (%s)', async (qs: string, trecho: string) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { status, body } = await analises(qs);
    expect(status).toBe(400);
    expect(body.error).toContain(trecho);
    vi.mocked(console.error).mockRestore();
  });

  test('painel de OPs do mês leva o tipo; tipo de outro elemento → 400', async () => {
    const res: any = await getOps(
      new NextRequest('http://localhost:3000/api/analises/ops?inicio=2026-02-01&fim=2026-02-28&ano=2026&subelemento=3.3.90.36.08')
    );
    expect(res.status).toBe(200);
    const [sql, params] = chamadas('ORDER BY data')[0];
    expect(sql).toContain('(op.subelemento = ? OR op.subelemento LIKE ?)');
    expect(params).toEqual(['2026-02-01', '2026-02-28', '3.3.90.36%', '3.3.90.36.08', '3.3.90.36.08 %']);

    const ruim: any = await getOps(
      new NextRequest('http://localhost:3000/api/analises/ops?inicio=2026-02-01&fim=2026-02-28&elemento=3.3.90.39&subelemento=3.3.90.36.08')
    );
    expect(ruim.status).toBe(400);
  });
});

describe('período "Mês"', () => {
  test('mês passado inteiro, comparado com o mesmo mês do ano anterior', async () => {
    const { status, body } = await analises('?periodo=mes&ano=2026&mes=2');
    expect(status).toBe(200);
    expect(body.periodo).toMatchObject({
      tipo: 'mes', mes: 2, inicio: '2026-02-01', fim: '2026-02-28', fimEfetivo: '2026-02-28', parcial: false,
      rotulo: 'Fevereiro de 2026', rotuloComparacao: 'fev/2025', meses: ['2026-02'],
      anterior: { inicio: '2025-02-01', fim: '2025-02-28' },
    });
    expect(chamadas('GROUP BY mes')[0][1].slice(-2)).toEqual(['2026-02-01', '2026-02-28']);
  });

  test('mês atual: cortado em hoje, comparado com os mesmos dias', async () => {
    const { body } = await analises('?periodo=mes&ano=2026&mes=10');
    expect(body.periodo).toMatchObject({
      fimEfetivo: '2026-10-27', parcial: true, rotulo: 'Outubro de 2026 (até 27/10)', rotuloComparacao: '01/10 a 27/10/2025',
    });
  });

  test('CSV do mês com tipo: seção por tipo, NEs por mês e nome do arquivo', async () => {
    const res: any = await getCsv(new NextRequest('http://localhost:3000/api/analises/csv?periodo=mes&ano=2026&mes=2&subelemento=3.3.90.36.08'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="analises-2026-02-civil-tipo-33903608.csv"');
    const texto = new TextDecoder('utf-8', { ignoreBOM: true }).decode(new Uint8Array(await res.arrayBuffer()));
    const linhas = texto.split('\r\n');
    const i = linhas.indexOf('Por tipo de despesa');
    expect(i).toBeGreaterThan(0);
    expect(linhas[i + 1]).toBe('Código;Descrição;Empenhado (R$);Pago (R$);NEs;Prestadores');
    expect(linhas).toContain('3.3.90.36.08;Estagiários - Pagamento Direto;1500,00;600,00;2;5');
    expect(linhas).toContain('Tipo de despesa;3.3.90.36.08');
    expect(linhas).toContain('Mês;Empenhado (R$);Pago (R$);OPs;NEs');
  });
});
