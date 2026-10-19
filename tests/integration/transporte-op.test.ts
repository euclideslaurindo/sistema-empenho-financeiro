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
import { calcularRetencoesDaOp } from '@/lib/services/calculo-op.service';

const CONFIG_ROWS = [
  ['irrf', 'IRRF', 'PERCENTUAL', '1.5000', 0], ['iss', 'ISS', 'PERCENTUAL', '5.0000', 0],
  ['inss', 'INSS', 'PERCENTUAL', '11.0000', 1], ['patronal', 'Patronal', 'PERCENTUAL', '20.0000', 1],
  ['sest_senat', 'SEST/SENAT', 'PERCENTUAL', '2.5000', 1], ['outros', 'Outros', 'VALOR_DIGITADO', null, 0],
  ['taxa_bancaria', 'Taxa bancária', 'VALOR_DIGITADO', null, 0], ['taxa_pix', 'Taxa PIX', 'VALOR_DIGITADO', null, 0],
].map(([campo, rotulo, tipo, aliquota, entra], i) => ({
  campo, rotulo, tipo, aliquota, calculo_automatico: tipo === 'PERCENTUAL' ? 1 : 0,
  editavel_operador: String(campo).startsWith('taxa') ? 1 : 0, entra_darf: entra, ativo: 1, ordem: i, updated_at: new Date('2026-01-01'),
}));
const PARAMS = Object.entries({
  base_percentual: '20', inss_percentual: '11', patronal_percentual: '20', sest_percentual: '1.5', senat_percentual: '1',
  irrf_tributavel_percentual: '60', desconto_simplificado: '607.20', redutor_constante: '978.62', redutor_coeficiente: '0.133145',
}).map(([chave, valor]) => ({ chave, valor, vigente_de: '2026-01-01' }));
const FAIXAS = [
  [1, '2428.80', '0', '0'], [2, '2826.65', '7.5', '182.16'], [3, '3751.05', '15', '394.16'], [4, '4664.68', '22.5', '675.49'], [5, null, '27.5', '908.73'],
].map(([ordem, limite_ate, aliquota, parcela_deduzir]) => ({ ordem, limite_ate, aliquota, parcela_deduzir }));
const MUNICIPIOS = [
  { chave: 'canhotinho', nome: 'Canhotinho', aliquota: '5', taxa_expediente: '15.20', apelidos: null },
  { chave: 'aguas belas', nome: 'Águas Belas', aliquota: '5', taxa_expediente: '0', apelidos: null },
  { chave: 'sao bento do una', nome: 'São Bento do Una', aliquota: '5', taxa_expediente: '0', apelidos: 'sbu;sao bento' },
];

/** Responde as consultas do cálculo (mesmo formato para query() e conn.execute). */
function responder(
  sql: string,
  {
    expediente = 'Canhotinho' as string | null,
    mei = 0,
    elemento = '3.3.90.33 - Serviços de transporte',
    semParametros = false,
  } = {}
): any[] {
  if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
    return [{ id: 'ne-1', valor: '100000.00', status: 'EMITIDO', elemento, subelemento: '' }];
  }
  if (sql.includes('SELECT elemento, status FROM notas_empenho')) return [{ elemento, status: 'EMITIDO' }];
  if (sql.includes('SELECT COALESCE(SUM(valor_pagamento), 0) as total_pago')) return [{ total_pago: 0 }];
  // T33: o cálculo lê só o Município (Expediente); a `cidade` do endereço não é consultada.
  if (sql.includes('FROM credores')) return [{ municipioExpediente: expediente, is_mei: mei }];
  if (sql.includes('SELECT * FROM config_retencoes ORDER BY ordem')) return CONFIG_ROWS;
  if (sql.includes('SELECT codigo FROM elementos_despesa')) return [{ codigo: '3.3.90.33' }];
  if (sql.includes('FROM elemento_retencoes')) return ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'].map((campo) => ({ elemento_codigo: '3.3.90.33', campo }));
  if (sql.includes('FROM calculo_parametros')) return semParametros ? [] : PARAMS;
  if (sql.includes('MAX(vigente_de)')) return [{ vigente_de: semParametros ? null : '2026-01-01' }];
  if (sql.includes('FROM irrf_faixas WHERE vigente_de = ?')) return FAIXAS;
  if (sql.includes('FROM iss_municipios')) return MUNICIPIOS;
  return [];
}

describe('OP do 3.3.90.33 (transporte autônomo)', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockTransacao(opcoes = {}) {
    const chamadas: Array<[string, any[]]> = [];
    (withTransaction as any).mockImplementation(async (cb: any) =>
      cb({
        execute: vi.fn(async (sql: string, params: any[] = []) => {
          chamadas.push([sql, params]);
          if (/^\s*(INSERT|UPDATE|DELETE)/.test(sql)) return [{ affectedRows: 1 }];
          return [responder(sql, opcoes)];
        }),
      })
    );
    return chamadas;
  }

  test('Caso H (Canhotinho): grava SEST+SENAT juntos e total sem a patronal', async () => {
    const chamadas = mockTransacao();
    const r = await OrdemPagamentoService.criar(
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '111.111.111-11', valorPagamento: 6317.5, dataPagamento: '2026-10-15' },
      'u1',
      'GESTOR'
    );
    expect(r.success).toBe(true);
    const p = chamadas.find(([s]) => s.includes('INSERT INTO ordens_pagamento'))![1];
    expect(p.slice(18, 23)).toEqual([0, 331.08, 138.99, 31.59, 252.7]); // irrf, iss, inss, sest_senat, patronal
    expect(p[26]).toBe(501.66); // total de descontos (sem a patronal)
    expect(p[27]).toBe(5815.84); // líquido
    const snap = JSON.parse(p[28]);
    expect(snap).toMatchObject({ perfil: 'TRANSPORTE_AUTONOMO', vigencia: '2026-01-01', sest: 18.95, senat: 12.64, taxa_expediente: 15.2 });
    expect(snap.campos.patronal.rotulo).toBe('Patronal (informativa)');
  });

  test('credor MEI no .33: tudo zerado, líquido = bruto', async () => {
    const chamadas = mockTransacao({ mei: 1 });
    await OrdemPagamentoService.criar(
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '111', valorPagamento: 6317.5, dataPagamento: '2026-10-15' }, 'u1', 'GESTOR'
    );
    const p = chamadas.find(([s]) => s.includes('INSERT INTO ordens_pagamento'))![1];
    expect(p.slice(18, 23)).toEqual([0, 0, 0, 0, 0]);
    expect(p[27]).toBe(6317.5);
    // T26: OP de MEI não gera DARF e, sem sobrescrita, não grava auditoria extra.
    expect(chamadas.some(([s]) => s.includes('INSERT INTO darf_acompanhamento'))).toBe(false);
    expect(chamadas.some(([s]) => s.includes('INSERT INTO auditoria_financeira'))).toBe(false);
  });

  test('ADMIN confirma retenção em credor MEI: valores digitados e linha de auditoria', async () => {
    const chamadas = mockTransacao({ mei: 1 });
    const r = await OrdemPagamentoService.criar(
      {
        numeroEmpenho: 'NE-1', credorCpfCnpj: '111', valorPagamento: 6317.5, dataPagamento: '2026-10-15',
        sobrescreverMei: true, inss: 138.99,
      },
      'u-admin',
      'ADMIN'
    );
    expect(r.success).toBe(true);
    const p = chamadas.find(([s]) => s.includes('INSERT INTO ordens_pagamento'))![1];
    expect(p[20]).toBe(138.99); // inss digitado
    expect(p[18]).toBe(0); // irrf não digitado
    const audit = chamadas.find(([s]) => s.includes('INSERT INTO auditoria_financeira'))!;
    expect(audit[1][3]).toBe('CREATE');
    expect(JSON.parse(audit[1][5]).aviso).toContain('credor MEI');
    expect(audit[1][6]).toBe('u-admin');
  });

  test('GESTOR pedindo sobrescrita em MEI: ignorado (continua isento)', async () => {
    const chamadas = mockTransacao({ mei: 1 });
    await OrdemPagamentoService.criar(
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '111', valorPagamento: 100, dataPagamento: '2026-10-15', sobrescreverMei: true, inss: 10 },
      'u1',
      'GESTOR'
    );
    const p = chamadas.find(([s]) => s.includes('INSERT INTO ordens_pagamento'))![1];
    expect(p[20]).toBe(0);
    expect(chamadas.some(([s]) => s.includes('INSERT INTO auditoria_financeira'))).toBe(false);
  });

  test('sem parâmetros para a data -> 422 e nada é gravado', async () => {
    const chamadas = mockTransacao({ semParametros: true });
    const r = await OrdemPagamentoService.criar(
      { numeroEmpenho: 'NE-1', credorCpfCnpj: '111', valorPagamento: 100, dataPagamento: '2025-01-10' }, 'u1', 'GESTOR'
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.status).toBe(422);
      expect(r.error).toContain('não cadastrados para a data');
    }
    expect(chamadas.some(([s]) => s.includes('INSERT INTO ordens_pagamento'))).toBe(false);
  });
});

describe('POST /api/ordens-pagamento/previa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'GESTOR' });
  });

  const chamar = async (body: any) => {
    const res: any = await postPrevia(new NextRequest('http://localhost:3000/api/ordens-pagamento/previa', { method: 'POST', body: JSON.stringify(body) }));
    return { status: res.status, body: await res.json() };
  };

  test('Caso G pela prévia: mesmo cálculo do salvar, sem gravar', async () => {
    (query as any).mockImplementation(async (sql: string) => responder(sql, { expediente: 'Águas Belas' }));
    const { status, body } = await chamar({ numeroEmpenho: 'NE-1', credorCpfCnpj: '111', valorPagamento: 11970, dataPagamento: '2026-10-15' });
    expect(status).toBe(200);
    expect(body.perfil).toBe('TRANSPORTE_AUTONOMO');
    expect(body.itens).toMatchObject({ irrf: 899.34, iss: 598.5, inss: 263.34, sest_senat: 59.85, patronal: 478.8 });
    expect(body.valorLiquido).toBe(10148.97);
    expect(body.informativos).toEqual(['patronal']);
    expect(withTransaction).not.toHaveBeenCalled();
    expect((query as any).mock.calls.some((c: any[]) => /^\s*(INSERT|UPDATE|DELETE)/.test(c[0]))).toBe(false);
  });

  test('município de expediente sem cadastro devolve aviso', async () => {
    (query as any).mockImplementation(async (sql: string) => responder(sql, { expediente: 'Recife' }));
    const { body } = await chamar({ numeroEmpenho: 'NE-1', credorCpfCnpj: '111', valorPagamento: 1000 });
    expect(body.avisos.join(' ')).toContain('Município de expediente sem cadastro de ISS');
  });

  test('elemento padrão também funciona (perfil PADRAO)', async () => {
    (query as any).mockImplementation(async (sql: string) => responder(sql, { elemento: '3.3.90.36 - Outros' }));
    const { status, body } = await chamar({ numeroEmpenho: 'NE-1', credorCpfCnpj: '111', valorPagamento: 1000 });
    expect(status).toBe(200);
    expect(body.perfil).toBe('PADRAO');
  });

  test('CONSULTA -> 403; vigência ausente -> 422; NE inexistente -> 404', async () => {
    (getAuthUser as any).mockResolvedValueOnce({ id: 'u2', perfil: 'CONSULTA' });
    expect((await chamar({ numeroEmpenho: 'NE-1', credorCpfCnpj: '1', valorPagamento: 10 })).status).toBe(403);

    (query as any).mockImplementation(async (sql: string) => responder(sql, { semParametros: true }));
    expect((await chamar({ numeroEmpenho: 'NE-1', credorCpfCnpj: '1', valorPagamento: 10 })).status).toBe(422);

    (query as any).mockImplementation(async (sql: string) => (sql.includes('FROM notas_empenho') ? [] : responder(sql)));
    expect((await chamar({ numeroEmpenho: 'NE-X', credorCpfCnpj: '1', valorPagamento: 10 })).status).toBe(404);
  });
});

describe('Município (Expediente) define a taxa de expediente do 3.3.90.33 (T33)', () => {
  beforeEach(() => vi.clearAllMocks());

  async function calcular(expediente: string | null, elemento = '3.3.90.33', brutoReais = 6317.5) {
    (query as any).mockImplementation(async (sql: string) => responder(sql, { expediente }));
    const { resultado } = await calcularRetencoesDaOp(undefined, {
      brutoCents: Math.round(brutoReais * 100),
      elementoCodigo: elemento,
      credorCpfCnpj: '111.111.111-11',
      dataPagamento: '2026-10-15',
      informados: {},
      perfilUsuario: 'GESTOR',
    });
    return resultado;
  }

  test('expediente Canhotinho: ISS 331,08 (315,875 + 15,20)', async () => {
    const r = await calcular('Canhotinho');
    expect(r.itens.iss).toBe(33108);
    expect(r.avisos).toEqual([]);
    expect((r.snapshot as any).taxa_expediente).toBe(15.2);
  });

  test('sem Município (Expediente): ISS 315,88, taxa 0 e sem aviso (D45)', async () => {
    const r = await calcular(null);
    expect(r.itens.iss).toBe(31588);
    expect(r.avisos).toEqual([]);
    expect((r.snapshot as any).taxa_expediente).toBe(0);
    expect((r.snapshot as any).municipio).toBeNull();
  });

  test('apelido (SBU) resolve São Bento do Una', async () => {
    const r = await calcular('SBU');
    expect((r.snapshot as any).municipio).toBe('São Bento do Una');
    expect((r.snapshot as any).municipio_cadastrado).toBe(true);
    expect(r.avisos).toEqual([]);
  });

  test('expediente sem cadastro: 5%, taxa 0 e aviso (não bloqueia)', async () => {
    const r = await calcular('Recife');
    expect(r.itens.iss).toBe(31588);
    expect(r.avisos.join(' ')).toContain('Município de expediente sem cadastro de ISS');
  });

  test('em outro elemento (.36) o expediente não muda nada', async () => {
    const com = await calcular('Canhotinho', '3.3.90.36');
    const sem = await calcular(null, '3.3.90.36');
    expect(com.itens).toEqual(sem.itens);
    expect(com.totalDescontosCents).toBe(sem.totalDescontosCents);
  });

  test('o credor é lido só se estiver ativo e sem a cidade do endereço', async () => {
    await calcular('Canhotinho');
    const sql = (query as any).mock.calls.map((c: any[]) => c[0]).find((s: string) => s.includes('FROM credores'));
    expect(sql).toContain('ativo = 1');
    expect(sql).toContain('municipioExpediente');
    expect(sql).not.toMatch(/\bcidade\b/);
  });
});
