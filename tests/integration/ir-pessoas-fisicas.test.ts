// A2 (Pessoas físicas no IR) — as 4 rotas com o banco simulado pelo texto do SQL.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Nao autenticado' }) }),
  forbiddenResponse: () => ({ status: 403, json: async () => ({ error: 'Acesso negado' }) }),
}));

import { query, withTransaction } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { GET as getRelatorio } from '@/app/api/darf/pessoas-fisicas/route';
import { GET as getDetalhe } from '@/app/api/darf/pessoas-fisicas/[cpf]/route';
import { POST as postInformado } from '@/app/api/darf/pessoas-fisicas/informado/route';
import { GET as getCsv } from '@/app/api/darf/pessoas-fisicas/csv/route';
import { DATA_COMPETENCIA, DIGITOS_CPF } from '@/lib/services/ir-pessoas-fisicas.service';

const BASE = 'http://localhost:3000/api/darf/pessoas-fisicas';
const comoJson = async (res: any) => ({ status: res.status, body: await res.json(), headers: res.headers as Headers });

const relatorio = async (qs = '') => comoJson(await getRelatorio(new NextRequest(`${BASE}${qs}`)));
const detalhe = async (cpf: string, qs = '') =>
  comoJson(await getDetalhe(new NextRequest(`${BASE}/${cpf}${qs}`), { params: Promise.resolve({ cpf }) }));
const marcar = async (body: any) =>
  comoJson(await postInformado(new NextRequest(`${BASE}/informado`, { method: 'POST', body: JSON.stringify(body) })));
const csv = async (qs = '') => {
  const res: any = await getCsv(new NextRequest(`${BASE}/csv${qs}`));
  // Erros (401/400) saem como JSON simulado; o CSV, como Response de texto.
  // Lê os BYTES: res.text() descarta o BOM, e é o byte que o Excel precisa.
  if (typeof res.arrayBuffer !== 'function') return { status: res.status, bytes: new Uint8Array(), texto: '', headers: res.headers as Headers };
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { status: res.status, bytes, texto: new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes), headers: res.headers as Headers };
};

const sqls = () => (query as any).mock.calls.map((c: any[]) => c[0] as string);
const chamadaCom = (trecho: string) => (query as any).mock.calls.find((c: any[]) => c[0].includes(trecho));

const LINHAS = [
  { cpf: '22233344405', nomeCadastro: null, nomeOp: 'Bruno Lima', qtdOps: 1, bruto: '0.20', irrf: '0.20', inss: '0.00', iss: '0.00', liquido: '0.00', elementos: '3.3.90.36 - Outros serviços PF' },
  { cpf: '11122233396', nomeCadastro: 'Álvaro Souza', nomeOp: 'ALVARO S', qtdOps: 2, bruto: '1000.10', irrf: '0.10', inss: '110.00', iss: '50.00', liquido: '840.00', elementos: '3.3.90.33 - Transporte||3.3.90.36 - Outros serviços PF' },
];

function mockRelatorio({ anos = [2026, 2025], linhas = LINHAS, informes = [] as any[], usuarios = [] as any[] } = {}) {
  (query as any).mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT DISTINCT YEAR')) return anos.map((ano) => ({ ano }));
    if (sql.includes('FROM ir_informes_pf')) return informes;
    if (sql.includes('FROM usuarios')) return usuarios;
    if (sql.includes('GROUP BY cpf')) return linhas;
    if (sql.includes('ORDER BY data')) return [];
    throw new Error(`SQL inesperado: ${sql}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'CONSULTA' });
});

describe('GET /api/darf/pessoas-fisicas', () => {
  test('sem login → 401, sem consultar o banco', async () => {
    (getAuthUser as any).mockResolvedValue(null);
    mockRelatorio();
    expect((await relatorio('?ano=2026')).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  test.each(['abc', '1999', '2101', '2026.5'])('ano inválido (%s) → 400', async (ano: string) => {
    mockRelatorio();
    expect((await relatorio(`?ano=${ano}`)).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('o SQL filtra o ano pela competência da OP e só CPF (11 dígitos); o ano vai como parâmetro', async () => {
    mockRelatorio();
    await relatorio('?ano=2025');
    const [sql, params] = chamadaCom('GROUP BY cpf');
    expect(sql).toContain('YEAR(COALESCE(op.data_pagamento, op.data_emissao, DATE(op.created_at))) = ?');
    expect(sql).toContain(`CHAR_LENGTH(${DIGITOS_CPF}) = 11`);
    expect(sql).toContain('SUM(COALESCE(op.irrf, 0))');
    expect(sql).toContain('SUM(COALESCE(op.valor_pagamento, 0))');
    expect(sql).not.toMatch(/'2025'|= 2025/);
    expect(params).toEqual([2025]);
  });

  test('o nome do cadastro vem por subconsulta sobre a soma já agrupada (sem JOIN que multiplique valores)', async () => {
    mockRelatorio();
    await relatorio('?ano=2026');
    const [sql] = chamadaCom('GROUP BY cpf');
    expect(sql).not.toMatch(/\bJOIN\b/i);
    expect(sql).toMatch(/\(SELECT MAX\(c\.nome\) FROM credores c WHERE c\.cpf_cnpj = t\.cpfGravado\) AS nomeCadastro/);
  });

  test('nenhum SQL cruza ir_informes_pf com outra tabela; nomes de quem marcou vêm de usuarios WHERE id IN', async () => {
    mockRelatorio({
      informes: [{ cpf: '22233344405', informado_por: 'u9', observacao: 'ok', em: '2026-10-26 09:15' }],
      usuarios: [{ id: 'u9', nome: 'Ana Gestora' }],
    });
    await relatorio('?ano=2026');
    for (const sql of sqls().filter((s: string) => s.includes('ir_informes_pf'))) {
      expect(sql).not.toMatch(/\bJOIN\b/i);
      expect(sql).not.toMatch(/FROM\s+ir_informes_pf\s*,/i);
    }
    const [sqlUsuarios, paramsUsuarios] = chamadaCom('FROM usuarios');
    expect(sqlUsuarios).toContain('WHERE id IN (?)');
    expect(paramsUsuarios).toEqual(['u9']);
  });

  test('sem marcações, não consulta usuarios', async () => {
    mockRelatorio();
    await relatorio('?ano=2026');
    expect(sqls().some((s: string) => s.includes('FROM usuarios'))).toBe(false);
  });

  test('casa a marcação pela pessoa (dígitos), ordena por nome com acento e prefere o nome do cadastro', async () => {
    mockRelatorio({
      linhas: [{ ...LINHAS[0], cpf: '222.333.444-05' }, LINHAS[1]],
      informes: [{ cpf: '22233344405', informado_por: 'u9', observacao: 'Enviado', em: '2026-10-26 09:15' }],
      usuarios: [{ id: 'u9', nome: 'Ana Gestora' }],
    });
    const { status, body, headers } = await relatorio('?ano=2026');
    expect(status).toBe(200);
    expect(headers.get('Cache-Control')).toBe('no-store');
    expect(body.ano).toBe(2026);
    expect(body.anos).toEqual([2026, 2025]);
    expect(body.pessoas.map((p: any) => p.nome)).toEqual(['Álvaro Souza', 'Bruno Lima']);
    expect(body.pessoas[0]).toMatchObject({
      cpf: '11122233396',
      cpfFormatado: '111.222.333-96',
      qtdOps: 2,
      bruto: 1000.1,
      inss: 110,
      informado: null,
      naturezas: [
        { codigo: '3.3.90.33', descricao: 'Transporte' },
        { codigo: '3.3.90.36', descricao: 'Outros serviços PF' },
      ],
    });
    expect(body.pessoas[1]).toMatchObject({
      cpf: '22233344405',
      informado: { em: '2026-10-26 09:15', porNome: 'Ana Gestora', observacao: 'Enviado' },
    });
  });

  test('totais em centavos e contagem de pendentes', async () => {
    mockRelatorio({ informes: [{ cpf: '11122233396', informado_por: null, observacao: null, em: '2026-10-26 09:15' }] });
    const { body } = await relatorio('?ano=2026');
    expect(body.totais).toEqual({
      pessoas: 2,
      informadas: 1,
      pendentes: 1,
      qtdOps: 3,
      bruto: 1000.3,
      irrf: 0.3,
      inss: 110,
      iss: 50,
      liquido: 840,
    });
    expect(body.pessoas[0].informado.porNome).toBeNull();
  });

  test('sem ano, usa o mais recente com movimento', async () => {
    mockRelatorio({ anos: [2025, 2024] });
    const { body } = await relatorio();
    expect(body.ano).toBe(2025);
    expect(chamadaCom('GROUP BY cpf')[1]).toEqual([2025]);
  });

  test('sem nenhum ano com movimento, usa o ano atual e responde lista vazia', async () => {
    mockRelatorio({ anos: [], linhas: [] });
    const { status, body } = await relatorio();
    expect(status).toBe(200);
    expect(body.ano).toBe(new Date().getFullYear());
    expect(body.pessoas).toEqual([]);
    expect(body.totais.pessoas).toBe(0);
  });

  test('a query dos anos usa a mesma competência e o mesmo filtro de CPF', async () => {
    mockRelatorio();
    await relatorio();
    const [sql] = chamadaCom('SELECT DISTINCT YEAR');
    expect(sql).toContain(`YEAR(${DATA_COMPETENCIA})`);
    expect(sql).toContain(`CHAR_LENGTH(${DIGITOS_CPF}) = 11`);
  });

  test('erro do banco → 500 sem vazar o SQL', async () => {
    (query as any).mockRejectedValue(new Error("ER_BAD_FIELD_ERROR: Unknown column 'op.x' in 'field list'"));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { status, body } = await relatorio('?ano=2026');
    spy.mockRestore();
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('op.x');
  });
});

describe('GET /api/darf/pessoas-fisicas/[cpf]', () => {
  test('sem login → 401', async () => {
    (getAuthUser as any).mockResolvedValue(null);
    expect((await detalhe('12345678909', '?ano=2026')).status).toBe(401);
  });

  test.each(['123', '12345678000190', 'abc', '%E0%A4%A'])('CPF inválido (%s) → 400', async (cpf: string) => {
    mockRelatorio();
    expect((await detalhe(cpf, '?ano=2026')).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('ano ausente ou inválido → 400', async () => {
    mockRelatorio();
    expect((await detalhe('12345678909')).status).toBe(400);
    expect((await detalhe('12345678909', '?ano=1999')).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('CPF com máscara (também codificada na URL) → parâmetros [ano, só dígitos]', async () => {
    (query as any).mockResolvedValue([
      { id: 'op1', numeroOp: '0001', sub: '01', numeroNe: '2026NE1', elemento: '3.3.90.36 - X', data: '2026-03-10', bruto: '100.00', irrf: '0.00', inss: '11.00', iss: '5.00', liquido: '84.00' },
    ]);
    const { status, body } = await detalhe('123.456.789-09', '?ano=2026');
    expect(status).toBe(200);
    expect(body).toMatchObject({ ano: 2026, cpf: '12345678909' });
    expect(body.ops[0]).toMatchObject({ id: 'op1', bruto: 100, inss: 11, liquido: 84, data: '2026-03-10' });
    const [sql, params] = (query as any).mock.calls[0];
    expect(sql).toContain(`YEAR(${DATA_COMPETENCIA}) = ?`);
    expect(sql).toContain(`${DIGITOS_CPF} = ?`);
    expect(params).toEqual([2026, '12345678909']);

    await detalhe('123%2E456%2E789-09', '?ano=2026');
    expect((query as any).mock.calls[1][1]).toEqual([2026, '12345678909']);
  });
});

describe('POST /api/darf/pessoas-fisicas/informado', () => {
  type Linha = { id: string; ano: number; cpf: string; informado_por: string | null; observacao: string | null };

  function mockTransacao({ opsNoAno = 1, existente = null as Linha | null, erroInsert = null as any } = {}) {
    const chamadas: Array<[string, any[]]> = [];
    (withTransaction as any).mockImplementation(async (cb: any) =>
      cb({
        execute: vi.fn(async (sql: string, params: any[] = []) => {
          chamadas.push([sql, params]);
          if (sql.includes('SELECT COUNT(*) AS total FROM ordens_pagamento')) return [[{ total: opsNoAno }]];
          if (sql.includes('FROM ir_informes_pf WHERE ano = ? AND cpf = ?')) return [existente ? [existente] : []];
          if (sql.startsWith('INSERT INTO ir_informes_pf') && erroInsert) throw erroInsert;
          return [{ affectedRows: 1 }];
        }),
      })
    );
    return chamadas;
  }

  const escritas = (chamadas: Array<[string, any[]]>) => chamadas.filter(([s]) => /^\s*(INSERT|UPDATE|DELETE)/.test(s));
  const auditorias = (chamadas: Array<[string, any[]]>) => chamadas.filter(([s]) => s.includes('INSERT INTO auditoria_financeira'));

  beforeEach(() => {
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'GESTOR' });
  });

  const MARCADO: Linha = { id: 'ir1', ano: 2026, cpf: '12345678909', informado_por: 'u1', observacao: 'antes' };

  test('sem login → 401', async () => {
    (getAuthUser as any).mockResolvedValue(null);
    expect((await marcar({ ano: 2026, cpf: '12345678909', informado: true })).status).toBe(401);
  });

  test('perfil Consulta → 403, sem abrir transação', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'CONSULTA' });
    mockTransacao();
    expect((await marcar({ ano: 2026, cpf: '12345678909', informado: true })).status).toBe(403);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('Admin também pode marcar', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'ADMIN' });
    const chamadas = mockTransacao();
    expect((await marcar({ ano: 2026, cpf: '12345678909', informado: true })).status).toBe(200);
    expect(escritas(chamadas).length).toBeGreaterThan(0);
  });

  test.each([
    ['ano fora da faixa', { ano: 1999, cpf: '12345678909', informado: true }],
    ['ano em texto', { ano: '2026', cpf: '12345678909', informado: true }],
    ['CNPJ', { ano: 2026, cpf: '12.345.678/0001-90', informado: true }],
    ['informado não booleano', { ano: 2026, cpf: '12345678909', informado: 'sim' }],
    ['observação com mais de 300 caracteres', { ano: 2026, cpf: '12345678909', informado: true, observacao: 'x'.repeat(301) }],
  ])('%s → 400, sem abrir transação', async (_nome: string, body: Record<string, unknown>) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockTransacao();
    expect((await marcar(body)).status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  test('pessoa sem OP no ano → 404 e nada gravado', async () => {
    const chamadas = mockTransacao({ opsNoAno: 0 });
    const { status, body } = await marcar({ ano: 2026, cpf: '123.456.789-09', informado: true });
    expect(status).toBe(404);
    expect(body.error).toContain('2026');
    expect(escritas(chamadas)).toEqual([]);
    const [sql, params] = chamadas[0];
    expect(sql).toContain(`YEAR(${DATA_COMPETENCIA}) = ?`);
    expect(params).toEqual([2026, '12345678909']);
  });

  test('marcar → INSERT (CPF só dígitos, observação aparada) + auditoria CREATE; sem FOR UPDATE em linha que não existe', async () => {
    const chamadas = mockTransacao();
    const { status, body } = await marcar({ ano: 2026, cpf: '123.456.789-09', informado: true, observacao: '  Enviado  ' });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, informado: true });
    expect(chamadas.some(([s]) => s.includes('FOR UPDATE'))).toBe(false);

    const [ins, aud] = escritas(chamadas);
    expect(ins[0]).toContain('INSERT INTO ir_informes_pf');
    expect(ins[1].slice(1)).toEqual([2026, '12345678909', 'u1', 'Enviado']);
    expect(aud[1][1]).toBe('ir_informes_pf');
    expect(aud[1][2]).toBe(ins[1][0]);
    expect(aud[1][3]).toBe('CREATE');
    expect(aud[1][4]).toBeNull();
    expect(JSON.parse(aud[1][5])).toMatchObject({ ano: 2026, cpf: '12345678909', observacao: 'Enviado' });
  });

  test('marcar sem observação grava NULL', async () => {
    const chamadas = mockTransacao();
    await marcar({ ano: 2026, cpf: '12345678909', informado: true, observacao: '   ' });
    expect(escritas(chamadas)[0][1][4]).toBeNull();
  });

  test('marcar de novo com outra observação → trava a linha, UPDATE + auditoria UPDATE', async () => {
    const chamadas = mockTransacao({ existente: MARCADO });
    expect((await marcar({ ano: 2026, cpf: '12345678909', informado: true, observacao: 'depois' })).status).toBe(200);
    expect(chamadas.some(([s]) => s.includes('ir_informes_pf') && s.includes('FOR UPDATE'))).toBe(true);
    const [upd, aud] = escritas(chamadas);
    expect(upd).toEqual(['UPDATE ir_informes_pf SET observacao = ? WHERE id = ?', ['depois', 'ir1']]);
    expect(aud[1][3]).toBe('UPDATE');
    expect(JSON.parse(aud[1][4]).observacao).toBe('antes');
    expect(JSON.parse(aud[1][5]).observacao).toBe('depois');
  });

  test.each([
    ['mesma observação', { observacao: 'antes' }],
    ['sem o campo observação (mantém a gravada)', {}],
  ])('marcar de novo, %s → nada gravado', async (_n: string, extra: Record<string, unknown>) => {
    const chamadas = mockTransacao({ existente: MARCADO });
    expect((await marcar({ ano: 2026, cpf: '12345678909', informado: true, ...extra })).status).toBe(200);
    expect(escritas(chamadas)).toEqual([]);
  });

  test('clique duplo: o INSERT bate na chave única (ER_DUP_ENTRY) → 200, sem auditoria duplicada', async () => {
    const chamadas = mockTransacao({ erroInsert: Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY', errno: 1062 }) });
    const { status, body } = await marcar({ ano: 2026, cpf: '12345678909', informado: true });
    expect(status).toBe(200);
    expect(body.informado).toBe(true);
    expect(auditorias(chamadas)).toEqual([]);
  });

  test('outro erro no INSERT → 500 (não é engolido)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockTransacao({ erroInsert: Object.assign(new Error('Lock wait timeout'), { code: 'ER_LOCK_WAIT_TIMEOUT' }) });
    expect((await marcar({ ano: 2026, cpf: '12345678909', informado: true })).status).toBe(500);
    vi.restoreAllMocks();
  });

  test('desmarcar → DELETE da linha + auditoria DELETE com a linha em "antes"', async () => {
    const chamadas = mockTransacao({ existente: MARCADO });
    const { status, body } = await marcar({ ano: 2026, cpf: '12345678909', informado: false });
    expect(status).toBe(200);
    expect(body.informado).toBe(false);
    const [del, aud] = escritas(chamadas);
    expect(del).toEqual(['DELETE FROM ir_informes_pf WHERE id = ?', ['ir1']]);
    expect(aud[1][3]).toBe('DELETE');
    expect(JSON.parse(aud[1][4])).toMatchObject(MARCADO);
    expect(aud[1][5]).toBeNull();
  });

  test('desmarcar quem não está marcado → 200 sem gravar nada', async () => {
    const chamadas = mockTransacao();
    expect((await marcar({ ano: 2026, cpf: '12345678909', informado: false })).status).toBe(200);
    expect(escritas(chamadas)).toEqual([]);
  });
});

describe('GET /api/darf/pessoas-fisicas/csv', () => {
  test('sem login → 401', async () => {
    (getAuthUser as any).mockResolvedValue(null);
    expect((await csv('?ano=2026')).status).toBe(401);
  });

  test.each(['', '?ano=', '?ano=abc'])('ano ausente ou inválido (%s) → 400', async (qs: string) => {
    mockRelatorio();
    expect((await csv(qs)).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('cabeçalhos de download com o ano, BOM, pessoas ordenadas e TOTAL', async () => {
    mockRelatorio();
    const { status, bytes, texto, headers } = await csv('?ano=2026');
    expect(status).toBe(200);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(headers.get('Content-Disposition')).toBe('attachment; filename="pessoas-fisicas-ir-2026.csv"');
    expect(headers.get('Cache-Control')).toBe('no-store');
    expect(texto.charCodeAt(0)).toBe(0xfeff);
    const linhas = texto.slice(1).split('\r\n').filter(Boolean);
    expect(linhas).toHaveLength(4);
    expect(linhas[1]).toContain('Álvaro Souza');
    expect(linhas[2]).toContain('Bruno Lima');
    expect(linhas[3]).toBe('2026;TOTAL;2 pessoa(s);;3;1000,30;0,30;110,00;50,00;840,00;;;');
    expect(chamadaCom('GROUP BY cpf')[1]).toEqual([2026]);
  });
});

describe('database/consultas/conferencia_ir_pessoas_fisicas.sql', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'consultas', 'conferencia_ir_pessoas_fisicas.sql'), 'utf8');
  const executavel = sql
    .split(/\r?\n/)
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');

  test('define o ano no topo e usa as mesmas regras do sistema', () => {
    expect(executavel).toMatch(/^\s*USE empenho;\s*SET @ano = \d{4};/);
    expect(executavel).toContain('YEAR(COALESCE(op.data_pagamento, op.data_emissao, DATE(op.created_at))) = @ano');
    expect(executavel).toContain(`CHAR_LENGTH(${DIGITOS_CPF}) = 11`);
  });

  test('só leitura: nenhum comando que grave ou altere estrutura', () => {
    for (const palavra of ['INSERT', 'UPDATE', 'DELETE', 'REPLACE INTO', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'RENAME', 'GRANT']) {
      expect(executavel).not.toMatch(new RegExp(`\\b${palavra}\\b`, 'i'));
    }
  });
});
