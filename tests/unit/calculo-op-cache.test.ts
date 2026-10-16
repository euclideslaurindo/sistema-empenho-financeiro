import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));

import { query } from '@/lib/db';
import { calcularRetencoesDaOp, criarCacheCalculo } from '@/lib/services/calculo-op.service';
import { VIGENCIA_SEED, responderCalculoTransporte } from '../fixtures/seed-transporte';

// T34-C: no lote, o mesmo cache serve a todas as OPs da requisição.

const entrada = (cpf: string, dataPagamento = VIGENCIA_SEED) => ({
  brutoCents: 100000,
  elementoCodigo: '3.3.90.33',
  credorCpfCnpj: cpf,
  dataPagamento,
  informados: {},
  perfilUsuario: 'GESTOR' as const,
});

const contar = (trecho: string) =>
  (query as any).mock.calls.filter((c: any[]) => String(c[0]).includes(trecho)).length;

describe('cache do cálculo por requisição', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (query as any).mockImplementation(async (sql: string) =>
      responderCalculoTransporte(sql, { municipioExpediente: 'Canhotinho', is_mei: 0 })
    );
  });

  test('3 credores com o mesmo cache: config, parâmetros, IRRF e ISS lidos uma vez', async () => {
    const cache = criarCacheCalculo();
    const semCache = await calcularRetencoesDaOp(undefined, entrada('111.111.111-11'));
    vi.clearAllMocks();
    const resultados = [];
    for (const cpf of ['111.111.111-11', '222.222.222-22', '333.333.333-33']) {
      resultados.push(await calcularRetencoesDaOp(undefined, entrada(cpf), cache));
    }
    expect(contar('FROM config_retencoes ORDER BY ordem')).toBe(1);
    expect(contar('FROM calculo_parametros')).toBe(1);
    expect(contar('MAX(vigente_de)')).toBe(1);
    expect(contar('FROM iss_municipios')).toBe(1);
    expect(contar('FROM credores')).toBe(3); // um por credor
    // mesmo resultado que sem cache (fora o horário do cálculo no snapshot)
    expect(resultados[0].resultado).toEqual({
      ...semCache.resultado,
      snapshot: { ...semCache.resultado.snapshot, calculadoEm: expect.any(String) },
    });
  });

  test('o mesmo credor duas vezes não consulta o cadastro de novo', async () => {
    const cache = criarCacheCalculo();
    await calcularRetencoesDaOp(undefined, entrada('111.111.111-11'), cache);
    await calcularRetencoesDaOp(undefined, entrada('11111111111'), cache);
    expect(contar('FROM credores')).toBe(1);
  });

  test('datas de pagamento diferentes: parâmetros e IRRF lidos uma vez por data', async () => {
    const cache = criarCacheCalculo();
    await calcularRetencoesDaOp(undefined, entrada('111.111.111-11', '2026-10-20'), cache);
    await calcularRetencoesDaOp(undefined, entrada('222.222.222-22', '2026-11-05'), cache);
    await calcularRetencoesDaOp(undefined, entrada('333.333.333-33', '2026-11-05'), cache);
    expect(contar('FROM calculo_parametros')).toBe(2);
    expect(contar('MAX(vigente_de)')).toBe(2);
  });

  test('sem cache: lê tudo a cada cálculo, como antes', async () => {
    await calcularRetencoesDaOp(undefined, entrada('111.111.111-11'));
    await calcularRetencoesDaOp(undefined, entrada('111.111.111-11'));
    expect(contar('FROM config_retencoes ORDER BY ordem')).toBe(2);
    expect(contar('FROM credores')).toBe(2);
  });

  test('a recusa também é memorizada (422 de vigência vale para a mesma data)', async () => {
    (query as any).mockImplementation(async (sql: string) =>
      sql.includes('FROM calculo_parametros') ? [] : responderCalculoTransporte(sql, { municipioExpediente: null, is_mei: 0 })
    );
    const cache = criarCacheCalculo();
    await expect(calcularRetencoesDaOp(undefined, entrada('1'), cache)).rejects.toMatchObject({ status: 422 });
    await expect(calcularRetencoesDaOp(undefined, entrada('2'), cache)).rejects.toMatchObject({ status: 422 });
    expect(contar('FROM calculo_parametros')).toBe(1);
  });
});
