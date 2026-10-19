import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// T34-C: emissão em lote. Banco simulado em memória COM transação: as linhas só
// ficam se o callback do withTransaction terminar sem erro (rollback real).
// Numeração, saldo, status e core são os reais; o motor de retenções é
// simulado (tem testes próprios) e registra com que entrada foi chamado.

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Nao autenticado' }) }),
  forbiddenResponse: () => ({ status: 403, json: async () => ({ error: 'Acesso negado' }) }),
}));
vi.mock('@/lib/services/calculo-op.service', async (importOriginal: () => Promise<any>) => {
  const real = await importOriginal();
  return {
    ...real,
    calcularRetencoesDaOp: vi.fn(async (_conn: any, e: any) => {
      const iss = Math.round(e.brutoCents * 0.05);
      return {
        resultado: {
          itens: { iss },
          totalDescontosCents: iss,
          liquidoCents: e.brutoCents - iss,
          snapshot: {},
          avisos: [],
          informativos: [],
        },
        configCampos: [],
        perfilCalculo: 'PADRAO',
      };
    }),
  };
});
vi.mock('@/lib/services/darf.service', () => ({
  entraDarfDaConfig: vi.fn(() => []),
  removerDarfDaOp: vi.fn(),
  sincronizarDarfDaOp: vi.fn(async (_conn: any, op: any) => {
    darfs.push(op.id);
  }),
}));

import { query, withTransaction } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { calcularRetencoesDaOp } from '@/lib/services/calculo-op.service';
import { POST as postLote } from '@/app/api/ordens-pagamento/lote/route';
import { POST as postPrevia } from '@/app/api/ordens-pagamento/previa-lote/route';

const ANO = new Date().getFullYear();
let darfs: string[] = [];

interface Op { id: string; numero_ne: string; numero_empenho: string; sub: string; valor_pagamento: number; numero_cheque: string | null; params: any[] }

const CADASTRO = [
  { cpf_cnpj: '111.111.111-11', nome: 'Ana Motorista', rg: '123', endereco: 'Rua A, 1 - Canhotinho/PE', ativo: 1 },
  { cpf_cnpj: '222.222.222-22', nome: 'Bruno Motorista', rg: '456', endereco: 'Rua B, 2', ativo: 1 },
  { cpf_cnpj: '333.333.333-33', nome: 'Carla Motorista', rg: '789', endereco: 'Rua C, 3', ativo: 1 },
  { cpf_cnpj: '444.444.444-44', nome: 'Inativo', rg: null, endereco: null, ativo: 0 },
];

function banco({
  valorNe = '100.00',
  statusNe = 'EMITIDO',
  historicoNe = 'Transporte escolar EJA Campo',
  opsAntes = [] as Array<Partial<Op>>,
  falharInsert = null as null | ((n: number, params: any[]) => any),
} = {}) {
  const estado = {
    ops: opsAntes.map((o, i) => ({ id: `antiga-${i}`, numero_ne: 'NE-1', numero_empenho: `${ANO}.OP.0011`, sub: '01', valor_pagamento: 0, numero_cheque: null, params: [], ...o })) as Op[],
    status: statusNe,
    statusGravados: [] as string[],
    auditorias: [] as any[][],
    chamadas: [] as string[],
    transacoes: 0,
  };
  let inserts = 0;

  (withTransaction as any).mockImplementation(async (cb: any) => {
    estado.transacoes++;
    const ops = [...estado.ops];
    let status = estado.status;
    const statusGravados: string[] = [];
    const auditorias: any[][] = [];
    const conn = {
      execute: vi.fn(async (sql: string, params: any[] = []) => {
        estado.chamadas.push(sql);
        const daNe = (n: string) => ops.filter((o) => o.numero_ne === n);
        if (sql.includes('INSERT INTO ordens_pagamento')) {
          inserts++;
          const erro = falharInsert?.(inserts, params);
          if (erro) throw erro;
          ops.push({ id: params[0], numero_ne: params[2], numero_empenho: params[3], sub: params[4], valor_pagamento: Number(params[17]), numero_cheque: params[29], params });
          return [{ affectedRows: 1 }];
        }
        if (sql.includes('INSERT INTO auditoria_financeira')) { auditorias.push(params); return [{ affectedRows: 1 }]; }
        if (sql.startsWith('UPDATE notas_empenho SET status')) { status = params[0]; statusGravados.push(params[0]); return [{ affectedRows: 1 }]; }
        if (sql.includes('unidade_orcamentaria, gestao, historico FROM notas_empenho')) {
          return [[{ id: 'ne-uuid-1', valor: valorNe, status, elemento: '3.3.90.36 - Serviços PF', subelemento: 'Locação', unidade_orcamentaria: 'Educação', gestao: '140101', historico: historicoNe }]];
        }
        if (sql.includes('SELECT valor, status FROM notas_empenho')) return [[{ valor: valorNe, status }]];
        if (sql.includes('as total_pago')) return [[{ total_pago: daNe(params[0]).reduce((t, o) => t + o.valor_pagamento, 0) }]];
        if (sql.includes('AS gasto')) return [[{ gasto: daNe(params[0]).reduce((t, o) => t + o.valor_pagamento, 0), qtd: daNe(params[0]).length }]];
        if (sql.includes('WHERE numero_cheque IN')) return [ops.filter((o) => o.numero_cheque && params.includes(o.numero_cheque)).map((o) => ({ numero_cheque: o.numero_cheque }))];
        if (sql.includes('FROM credores')) {
          const alvo = new Set(params.map((p: string) => String(p).replace(/\D/g, '')));
          return [CADASTRO.filter((c) => alvo.has(c.cpf_cnpj.replace(/\D/g, '')))];
        }
        if (sql.includes('SUBSTRING_INDEX(numero_empenho')) {
          const max = Math.max(0, ...ops.map((o) => Number(o.numero_empenho.split('.').pop())));
          return [max ? [{ seq: max }] : []];
        }
        if (sql.includes('CAST(sub AS UNSIGNED)')) {
          const max = Math.max(0, ...daNe(params[0]).map((o) => Number(o.sub)));
          return [max ? [{ seq: max }] : []];
        }
        return [[]];
      }),
    };
    const r = await cb(conn); // erro aqui = rollback: nada abaixo roda
    estado.ops = ops;
    estado.status = status;
    estado.statusGravados.push(...statusGravados);
    estado.auditorias.push(...auditorias);
    return r;
  });
  return estado;
}

const linha = (cpf: string, valor: number, extra: Record<string, unknown> = {}) => ({ credorCpfCnpj: cpf, valorPagamento: valor, ...extra });
const corpo = (credores: any[], extra: Record<string, unknown> = {}) => ({ numeroNe: 'NE-1', dataEmissao: '2026-10-13', credores, ...extra });

async function chamar(rota: typeof postLote, body: unknown) {
  const res: any = await rota(new NextRequest('http://localhost:3000/api/x', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
}
const emitir = (body: unknown) => chamar(postLote, body);

const TRES = [
  linha('111.111.111-11', 30, { numeroCheque: '1001', dataPagamento: '2026-10-20' }),
  linha('222.222.222-22', 40, { numeroCheque: '1002', dataPagamento: '2026-10-21' }),
  linha('333.333.333-33', 20, { numeroCheque: '1003', dataPagamento: '2026-11-05' }),
];

describe('POST /api/ordens-pagamento/lote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    darfs = [];
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'GESTOR' });
  });

  test('NE de 100 + 3 credores somando 90: 3 OPs em sequência, PARCIALMENTE PAGO, restante 10', async () => {
    const db = banco({ opsAntes: [{ numero_ne: 'OUTRA', numero_empenho: `${ANO}.OP.0011` }] });
    const { status, body } = await emitir(corpo(TRES));
    expect(status).toBe(201);
    expect(body.ops.map((o: any) => [o.numeroOp, o.sub])).toEqual([
      [`${ANO}.OP.0012`, '01'],
      [`${ANO}.OP.0013`, '02'],
      [`${ANO}.OP.0014`, '03'],
    ]);
    expect(body.ops[1]).toMatchObject({ credorCpfCnpj: '222.222.222-22', credorNome: 'Bruno Motorista', valorPagamento: 40, totalDescontos: 2, valorLiquido: 38 });
    expect(body.resumo).toEqual({ quantidade: 3, totalBruto: 90, saldoAnterior: 100, saldoRestante: 10, statusNe: 'PARCIALMENTE PAGO' });
    expect(db.statusGravados).toEqual(['PARCIALMENTE PAGO']); // uma vez só
    expect(darfs).toHaveLength(3);

    expect(db.auditorias).toHaveLength(1);
    const [, entidade, entidadeId, acao, , dadosNovos] = db.auditorias[0];
    expect([entidade, entidadeId, acao]).toEqual(['notas_empenho', 'ne-uuid-1', 'CREATE_LOTE']);
    expect(JSON.parse(dadosNovos).ops).toHaveLength(3);
  });

  test('a NE é travada antes de qualquer outra consulta', async () => {
    const db = banco();
    await emitir(corpo(TRES));
    expect(db.chamadas[0]).toContain('FROM notas_empenho WHERE numero = ? FOR UPDATE');
  });

  test('cada OP calcula com o SEU credor e a SUA data de pagamento, com um cache só', async () => {
    banco();
    await emitir(corpo(TRES));
    const calls = (calcularRetencoesDaOp as any).mock.calls;
    expect(calls.map((c: any[]) => [c[1].credorCpfCnpj, c[1].dataPagamento])).toEqual([
      ['111.111.111-11', '2026-10-20'],
      ['222.222.222-22', '2026-10-21'],
      ['333.333.333-33', '2026-11-05'],
    ]);
    expect(calls[0][2]).toBeDefined();
    expect(calls[0][2]).toBe(calls[2][2]);
  });

  test('grava nome, RG, endereço e CPF/CNPJ do cadastro, nunca os do cliente', async () => {
    const db = banco();
    await emitir(corpo([linha('11111111111', 30, { credorNome: 'Falso', credorRg: 'x', credorEndereco: 'y', unidadeOrcamentaria: 'z' })]));
    const p = db.ops[0].params;
    expect(p.slice(5, 9)).toEqual(['Ana Motorista', '111.111.111-11', '123', 'Rua A, 1 - Canhotinho/PE']);
    expect(p[9]).toBe('Educação');
    expect(p[10]).toBe('3.3.90.36 - Serviços PF');
  });

  test('histórico: itens unidos por " | "; sem itens, Observações da NE; sem Observações, texto padrão', async () => {
    const itens = [
      { especificacao: 'Locomoção', quantidade: 1, unidade: 'UN', valorUnitario: 10 },
      { especificacao: 'Alimentação', quantidade: 1, unidade: 'UN', valorUnitario: 20 },
    ];
    let db = banco();
    await emitir(corpo([linha('111.111.111-11', 30, { itens }), linha('222.222.222-22', 10)]));
    expect(db.ops.map((o) => o.params[13])).toEqual(['Locomoção | Alimentação', 'Transporte escolar EJA Campo']);

    db = banco({ historicoNe: '' });
    await emitir(corpo([linha('111.111.111-11', 10)]));
    expect(db.ops[0].params[13]).toBe('Pagamento referente ao empenho NE-1');
  });

  test('saldo anterior corrido por OP e valor do empenho da NE', async () => {
    const db = banco();
    await emitir(corpo(TRES));
    expect(db.ops.map((o) => [o.params[15], o.params[16]])).toEqual([[100, 100], [70, 100], [30, 100]]);
  });

  test('soma > saldo: 422 e nenhuma OP', async () => {
    const db = banco({ opsAntes: [{ valor_pagamento: 20 }] });
    const { status, body } = await emitir(corpo(TRES));
    expect(status).toBe(422);
    expect(body.error).toBe('Soma das OPs (R$ 90,00) maior que o saldo da NE (R$ 80,00).');
    expect(db.ops).toHaveLength(1);
  });

  test('credor repetido no lote: 400 com o índice, sem abrir transação', async () => {
    banco();
    const { status, body } = await emitir(corpo([linha('111.111.111-11', 10), linha('11111111111', 10)]));
    expect(status).toBe(400);
    expect(body.error).toBe('credores[1]: credor repetido nesta emissão.');
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('cheque repetido dentro do lote: 409 com o índice', async () => {
    banco();
    const { status, body } = await emitir(corpo([linha('111.111.111-11', 10, { numeroCheque: '77' }), linha('222.222.222-22', 10, { numeroCheque: ' 77 ' })]));
    expect(status).toBe(409);
    expect(body.error).toContain('credores[1]: o cheque nº "77" está repetido');
  });

  test('cheque já usado no banco: 409 credores[i] e nada gravado', async () => {
    const db = banco({ opsAntes: [{ numero_ne: 'OUTRA', numero_cheque: '1002' }] });
    const { status, body } = await emitir(corpo(TRES));
    expect(status).toBe(409);
    expect(body.error).toBe('credores[1]: o cheque nº "1002" já foi utilizado.');
    expect(db.ops).toHaveLength(1);
  });

  test.each([
    ['inexistente', '999.999.999-99'],
    ['inativo', '444.444.444-44'],
  ])('credor %s: 422 com o índice e nada gravado', async (_caso: string, cpf: string) => {
    const db = banco();
    const { status, body } = await emitir(corpo([TRES[0], TRES[1], linha(cpf, 10)]));
    expect(status).toBe(422);
    expect(body.error).toBe('credores[2]: credor não encontrado ou inativo.');
    expect(db.ops).toHaveLength(0);
    expect(darfs).toHaveLength(2); // as 2 primeiras chegaram a rodar, mas a transação foi desfeita
  });

  test('itens ≠ valor na 3ª linha: 400 credores[2] e rollback das duas primeiras', async () => {
    const db = banco();
    const itens = [{ especificacao: 'X', quantidade: 1, unidade: 'UN', valorUnitario: 5 }];
    const { status, body } = await emitir(corpo([TRES[0], TRES[1], linha('333.333.333-33', 20, { itens })]));
    expect(status).toBe(400);
    expect(body.error).toMatch(/^credores\[2\]: A soma dos itens/);
    expect(db.ops).toHaveLength(0);
    expect(db.statusGravados).toEqual([]);
  });

  test('cheque gravado por outra transação no meio (ER_DUP_ENTRY uq_cheque): 409 na linha certa', async () => {
    const db = banco({
      falharInsert: (n) =>
        n === 2 ? { code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry '1002' for key 'ordens_pagamento.uq_cheque'" } : null,
    });
    const { status, body } = await emitir(corpo(TRES));
    expect(status).toBe(409);
    expect(body.error).toBe('credores[1]: o cheque nº "1002" já foi utilizado.');
    expect(db.ops).toHaveLength(0);
    expect(db.transacoes).toBe(1); // cheque não dispara o retry
  });

  test('colisão do nº da OP (ER_DUP_ENTRY numero_empenho): refaz o lote inteiro', async () => {
    const db = banco({
      falharInsert: (n) =>
        n === 2 ? { code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry '2026.OP.0002' for key 'ordens_pagamento.uq_numero_empenho'" } : null,
    });
    const { status, body } = await emitir(corpo(TRES));
    expect(status).toBe(201);
    expect(db.transacoes).toBe(2);
    expect(db.ops).toHaveLength(3);
    expect(body.ops.map((o: any) => o.sub)).toEqual(['01', '02', '03']);
  });

  test('NE inexistente 404; cancelada 409', async () => {
    (withTransaction as any).mockImplementation(async (cb: any) => cb({ execute: vi.fn(async () => [[]]) }));
    expect((await emitir(corpo(TRES))).status).toBe(404);
    banco({ statusNe: 'CANCELADO' });
    const r = await emitir(corpo(TRES));
    expect(r.status).toBe(409);
    expect(r.body.error).toContain('CANCELADA');
  });

  test('validação: valor 0 -> 400 com índice; sem credores, mais de 100 ou sem NE -> 400', async () => {
    banco();
    const zero = await emitir(corpo([TRES[0], linha('222.222.222-22', 0)]));
    expect(zero.status).toBe(400);
    expect(zero.body.error).toBe('credores[1]: O valor do pagamento deve ser maior que zero.');
    expect((await emitir(corpo([]))).status).toBe(400);
    const cem = Array.from({ length: 101 }, (_, i) => linha(String(i).padStart(11, '0'), 1));
    expect((await emitir(corpo(cem))).body.error).toContain('No máximo 100');
    expect((await emitir({ credores: TRES })).status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('CONSULTA: 403; sem login: 401', async () => {
    (getAuthUser as any).mockResolvedValueOnce({ id: 'u2', perfil: 'CONSULTA' });
    expect((await emitir(corpo(TRES))).status).toBe(403);
    (getAuthUser as any).mockResolvedValueOnce(null);
    expect((await emitir(corpo(TRES))).status).toBe(401);
  });
});

describe('POST /api/ordens-pagamento/previa-lote', () => {
  const NE = { elemento: '3.3.90.33 - Transporte', status: 'EMITIDO' };

  beforeEach(() => {
    vi.clearAllMocks();
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'GESTOR' });
    (query as any).mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM notas_empenho')) return [NE];
      if (sql.includes('FROM credores')) {
        const alvo = new Set(params.map((p: string) => String(p).replace(/\D/g, '')));
        return CADASTRO.filter((c) => alvo.has(c.cpf_cnpj.replace(/\D/g, '')));
      }
      return [];
    });
  });

  test('subconjunto de linhas: devolve só as enviadas, com o índice, sem gravar nada', async () => {
    const { status, body } = await chamar(postPrevia, corpo([
      { indice: 0, ...TRES[0] },
      { indice: 2, ...TRES[2] },
    ]));
    expect(status).toBe(200);
    expect(body.linhas.map((l: any) => [l.indice, l.valorLiquido, l.totalDescontos])).toEqual([[0, 28.5, 1.5], [2, 19, 1]]);
    expect(withTransaction).not.toHaveBeenCalled();
    const sqls = (query as any).mock.calls.map((c: any[]) => String(c[0]));
    expect(sqls.some((s: string) => /^\s*(INSERT|UPDATE|DELETE)/.test(s))).toBe(false);
    // mesma entrada que a gravação usaria: credor do cadastro, data da linha, elemento da NE, um cache só
    const calls = (calcularRetencoesDaOp as any).mock.calls;
    expect(calls[1][1]).toMatchObject({ credorCpfCnpj: '333.333.333-33', dataPagamento: '2026-11-05', elementoCodigo: '3.3.90.33', brutoCents: 2000 });
    expect(calls[0][2]).toBe(calls[1][2]);
  });

  test('a prévia bate com o que o lote grava para a mesma linha', async () => {
    const previa = await chamar(postPrevia, corpo([{ indice: 1, ...TRES[1] }]));
    banco();
    const lote = await emitir(corpo([TRES[1]]));
    expect(previa.body.linhas[0].valorLiquido).toBe(lote.body.ops[0].valorLiquido);
    expect(previa.body.linhas[0].totalDescontos).toBe(lote.body.ops[0].totalDescontos);
  });

  test('erro de uma linha não derruba as outras', async () => {
    (calcularRetencoesDaOp as any).mockImplementationOnce(async () => {
      throw { status: 422, error: 'Sem parâmetros vigentes do transporte em 20/10/2026.' };
    });
    const { status, body } = await chamar(postPrevia, corpo([
      { indice: 0, ...TRES[0] },
      { indice: 1, ...linha('444.444.444-44', 10) },
      { indice: 2, ...TRES[2] },
    ]));
    expect(status).toBe(200);
    expect(body.linhas[0]).toEqual({ indice: 0, erro: 'Sem parâmetros vigentes do transporte em 20/10/2026.' });
    expect(body.linhas[1]).toEqual({ indice: 1, erro: 'credor não encontrado ou inativo.' });
    expect(body.linhas[2]).toMatchObject({ indice: 2, valorLiquido: 19 });
  });

  test('NE inexistente 404; sem índice 400; CONSULTA 403; sem login 401', async () => {
    (query as any).mockImplementationOnce(async () => []);
    expect((await chamar(postPrevia, corpo([{ indice: 0, ...TRES[0] }]))).status).toBe(404);
    expect((await chamar(postPrevia, corpo([TRES[0]]))).status).toBe(400);
    (getAuthUser as any).mockResolvedValueOnce({ id: 'u2', perfil: 'CONSULTA' });
    expect((await chamar(postPrevia, corpo([{ indice: 0, ...TRES[0] }]))).status).toBe(403);
    (getAuthUser as any).mockResolvedValueOnce(null);
    expect((await chamar(postPrevia, corpo([{ indice: 0, ...TRES[0] }]))).status).toBe(401);
  });
});
