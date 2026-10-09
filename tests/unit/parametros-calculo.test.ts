import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  dataReferenciaDaOp,
  obterFaixasIrrfVigentes,
  obterIssMunicipio,
  obterParametrosVigentes,
} from '@/lib/services/parametros-calculo.service';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
import { query } from '@/lib/db';

const CHAVES = [
  'base_percentual', 'inss_percentual', 'patronal_percentual', 'sest_percentual', 'senat_percentual',
  'irrf_tributavel_percentual', 'desconto_simplificado', 'redutor_constante', 'redutor_coeficiente',
];

// Simula o banco com as linhas de 2026 e uma tabela de 2027 já cadastrada.
const PARAMS_DB = [
  ...CHAVES.map((chave) => ({ chave, valor: chave === 'desconto_simplificado' ? '607.200000' : '1.000000', vigente_de: '2026-01-01' })),
  { chave: 'desconto_simplificado', valor: '700.000000', vigente_de: '2027-01-01' },
];

function mockBanco() {
  (query as any).mockImplementation(async (sql: string, params: any[]) => {
    if (sql.includes('FROM calculo_parametros')) {
      const [, data] = params;
      return PARAMS_DB.filter((r) => r.vigente_de <= data).sort((a, b) =>
        a.chave === b.chave ? b.vigente_de.localeCompare(a.vigente_de) : a.chave.localeCompare(b.chave)
      );
    }
    if (sql.includes('MAX(vigente_de)')) {
      const [data] = params;
      const v = ['2026-01-01', '2027-01-01'].filter((d) => d <= data).at(-1) ?? null;
      return [{ vigente_de: v }];
    }
    if (sql.includes('FROM irrf_faixas WHERE vigente_de = ?')) {
      return [{ ordem: 1, limite_ate: null, aliquota: params[0] === '2027-01-01' ? '10.0000' : '27.5000', parcela_deduzir: '0' }];
    }
    if (sql.includes('FROM iss_municipios')) {
      return [
        { chave: 'canhotinho', nome: 'Canhotinho', aliquota: '5.0000', taxa_expediente: '15.20', apelidos: null },
        { chave: 'sao bento do una', nome: 'São Bento do Una', aliquota: '5.0000', taxa_expediente: '0.00', apelidos: 'sbu;sao bento' },
      ];
    }
    return [];
  });
}

describe('vigência', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBanco();
  });

  test('data de referência: pagamento > emissão > hoje', () => {
    expect(dataReferenciaDaOp('2026-10-15', '2026-09-01')).toBe('2026-10-15');
    expect(dataReferenciaDaOp(null, '2026-09-01')).toBe('2026-09-01');
    expect(dataReferenciaDaOp(undefined, '', new Date(2026, 6, 4))).toBe('2026-07-04');
  });

  test('tabela de 2027 cadastrada não muda OP de 2026', async () => {
    const r2026 = await obterParametrosVigentes(undefined, 'TRANSPORTE_AUTONOMO', '2026-12-31');
    expect(r2026.parametros.desconto_simplificado).toBe('607.200000');
    expect(r2026.vigencia).toBe('2026-01-01');

    const r2027 = await obterParametrosVigentes(undefined, 'TRANSPORTE_AUTONOMO', '2027-03-01');
    expect(r2027.parametros.desconto_simplificado).toBe('700.000000');
    expect(r2027.parametros.inss_percentual).toBe('1.000000'); // chave sem linha nova continua com a de 2026
    expect(r2027.vigencia).toBe('2027-01-01');

    expect((await obterFaixasIrrfVigentes(undefined, '2026-12-31')).faixas[0].aliquota).toBe('27.5000');
    expect((await obterFaixasIrrfVigentes(undefined, '2027-01-01')).faixas[0].aliquota).toBe('10.0000');
  });

  test('sem parâmetros ou faixas para a data -> 422', async () => {
    await expect(obterParametrosVigentes(undefined, 'TRANSPORTE_AUTONOMO', '2025-06-01')).rejects.toMatchObject({
      status: 422,
      error: expect.stringContaining('Parâmetros de cálculo do transporte não cadastrados para a data 01/06/2025'),
    });
    await expect(obterFaixasIrrfVigentes(undefined, '2025-06-01')).rejects.toMatchObject({ status: 422 });
  });
});

describe('ISS por município', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBanco();
  });

  test('casa pela chave normalizada, com acento/caixa/UF', async () => {
    expect(await obterIssMunicipio(undefined, 'CANHOTINHO/PE')).toEqual({ nome: 'Canhotinho', aliquota: '5.0000', taxaExpediente: '15.20' });
  });
  test('casa por apelido', async () => {
    expect((await obterIssMunicipio(undefined, 'SBU'))?.nome).toBe('São Bento do Una');
  });
  test('sem cadastro ou sem município -> null', async () => {
    expect(await obterIssMunicipio(undefined, 'Recife')).toBeNull();
    expect(await obterIssMunicipio(undefined, '')).toBeNull();
  });
});
