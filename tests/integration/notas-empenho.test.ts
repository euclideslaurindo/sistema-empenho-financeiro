import { describe, test, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/notas-empenho/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Não autenticado' }) })
}));

import { getAuthUser } from '@/lib/auth';
import { withTransaction, query } from '@/lib/db';

const CADASTRO = [
  { cpf_cnpj: '11.111.111/0001-11', nome: 'Maria Cavalcanti ME', ativo: 1 },
  { cpf_cnpj: '222.222.222-22', nome: 'José Silva', ativo: 1 },
  { cpf_cnpj: '333.333.333-33', nome: 'Credor Inativo', ativo: 0 },
];

/** conn.execute que responde pelo SQL e registra todas as chamadas. */
function conexaoCriar({ neExistente = false } = {}) {
  const chamadas: Array<[string, any[]]> = [];
  const conn = {
    execute: vi.fn(async (sql: string, params: any[] = []) => {
      chamadas.push([sql, params]);
      if (sql.includes('SELECT id FROM notas_empenho WHERE numero')) return [neExistente ? [{ id: 'ne-existing' }] : []];
      if (sql.includes('FROM credores')) {
        const digitos = new Set(params);
        return [CADASTRO.filter((c) => digitos.has(c.cpf_cnpj.replace(/\D/g, '')))];
      }
      if (sql.includes('SELECT id FROM usuarios')) return [[{ id: '123' }]];
      return [{ affectedRows: 1 }];
    }),
  };
  (withTransaction as any).mockImplementationOnce(async (cb: any) => cb(conn));
  return chamadas;
}

const postar = (body: any) =>
  POST(new NextRequest('http://localhost:3000/api/notas-empenho', { method: 'POST', body: JSON.stringify(body) })) as any;

describe('Integração API Notas de Empenho', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });
  });

  describe('POST — Criar Nota de Empenho', () => {
    test('Criação válida (payload antigo, sem credor) retorna 201', async () => {
      const chamadas = conexaoCriar();
      const res = await postar({
        numero: 'NE-2026-001',
        valor: '15420.00',
        dataPagamento: '2026-12-31',
        unidadeOrcamentaria: 'Secretaria da Fazenda',
        elemento: '3.3.90.36',
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.id).toBeDefined();
      expect(chamadas.some(([sql]) => sql.includes('INSERT INTO ne_credores'))).toBe(false);
    });

    describe('datas e exercício (T29)', () => {
      const inserida = (chamadas: Array<[string, any[]]>) => chamadas.find(([sql]) => sql.includes('INSERT INTO notas_empenho'))![1];

      test('NE sem nenhuma data -> 201, datas NULL', async () => {
        const chamadas = conexaoCriar();
        const res = await postar({ numero: '2026NE000123', valor: '100.00', elemento: '3.3.90.36' });
        expect(res.status).toBe(201);
        const p = inserida(chamadas);
        expect([p[4], p[5], p[6]]).toEqual([null, null, null]); // data_pagamento, data_provisao, data_emissao
      });

      test('exercício vem do número da NE (D42)', async () => {
        const chamadas = conexaoCriar();
        await postar({ numero: '2025NE000777', valor: '100.00', dataProvisaoConcedida: '2026-01-15' });
        expect(inserida(chamadas)[1]).toBe('2025');
      });

      test('número sem ano: exercício da Data de Provisão', async () => {
        const chamadas = conexaoCriar();
        await postar({ numero: 'NE-777', valor: '100.00', dataProvisaoConcedida: '2024-08-01' });
        expect(inserida(chamadas)[1]).toBe('2024');
      });

      test('sem ano no número nem provisão: ano corrente', async () => {
        const chamadas = conexaoCriar();
        await postar({ numero: 'NE-778', valor: '100.00' });
        expect(inserida(chamadas)[1]).toBe(String(new Date().getFullYear()));
      });

      test('compatibilidade: dataPagamento/dataEmissao vindas no payload são gravadas', async () => {
        const chamadas = conexaoCriar();
        await postar({ numero: '2026NE000124', valor: '100.00', dataPagamento: '2026-12-31', dataEmissao: '2026-12-01' });
        const p = inserida(chamadas);
        expect(p[4]).toBe('2026-12-31');
        expect(p[6]).toBe('2026-12-01');
      });
    });

    test('status do payload é ignorado: NE nova é sempre EMITIDO', async () => {
      const chamadas = conexaoCriar();
      const res = await postar({ numero: 'NE-2026-002', valor: '100.00', elemento: '3.3.90.36', status: 'LIQUIDADO' });
      expect(res.status).toBe(201);
      const insert = chamadas.find(([sql]) => sql.includes('INSERT INTO notas_empenho'))!;
      expect(insert[1][11]).toBe('EMITIDO');
      const audit = chamadas.find(([sql]) => sql.includes('INSERT INTO auditoria_financeira'))!;
      expect(JSON.parse(audit[1][5]).status).toBe('EMITIDO');
    });

    describe('NE sem credor (T30)', () => {
      test('salva sem nenhum credor: 201, nada em ne_credores e colunas de credor NULL', async () => {
        const chamadas = conexaoCriar();
        const res = await postar({ numero: '2026NE000200', valor: 100, elemento: '3.3.90.36' });
        expect(res.status).toBe(201);
        const insert = chamadas.find(([sql]) => sql.includes('INSERT INTO notas_empenho'))!;
        expect(insert[1].slice(-2)).toEqual([null, null]); // credor_nome, cpf_cnpj
        expect(chamadas.some(([sql]) => sql.includes('ne_credores'))).toBe(false);
        expect(chamadas.some(([sql]) => sql.includes('FROM credores'))).toBe(false);
      });

      test('credores/credorNome/cpfCnpj no payload (cliente antigo) são ignorados, inclusive soma que não fecha', async () => {
        const chamadas = conexaoCriar();
        const res = await postar({
          numero: '2026NE000201',
          valor: 10000,
          credorNome: 'Fulano',
          cpfCnpj: '999.999.999-99',
          credores: [
            { cpfCnpj: '11111111000111', valorBruto: 6000 },
            { cpfCnpj: '22222222222', valorBruto: '3.999,99' },
          ],
        });
        expect(res.status).toBe(201);
        const insert = chamadas.find(([sql]) => sql.includes('INSERT INTO notas_empenho'))!;
        expect(insert[1].slice(-2)).toEqual([null, null]);
        expect(chamadas.some(([sql]) => sql.includes('ne_credores'))).toBe(false);
      });

      test('auditoria CREATE sem lista de credores', async () => {
        const chamadas = conexaoCriar();
        await postar({ numero: '2026NE000202', valor: 4000 });
        const audit = chamadas.find(([sql]) => sql.includes('INSERT INTO auditoria_financeira'))!;
        expect(audit[1][1]).toBe('notas_empenho');
        expect(audit[1][3]).toBe('CREATE');
        expect(JSON.parse(audit[1][5])).not.toHaveProperty('credores');
      });
    });

    test('Valor <= 0 retorna 400 (Zod validation)', async () => {
      const res = await postar({ numero: 'NE-2026-001', valor: '0' });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test('Número duplicado retorna 409', async () => {
      conexaoCriar({ neExistente: true });
      const res = await postar({ numero: 'NE-2026-001', valor: '15420.00' });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('já está cadastrada');
    });

    test('Sem autenticação retorna 401', async () => {
      (getAuthUser as any).mockResolvedValue(null);
      const res = await postar({ numero: 'NE-001', valor: '100' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET — Listar Notas de Empenho', () => {
    function mockLeitura(notas: any[], linhasCredores: any[], pagos: any[], total = notas.length, meis: string[] = []) {
      (query as any).mockImplementation(async (sql: string, params: any[] = []) => {
        if (sql.includes('COUNT(*) as total')) return [{ total }];
        if (sql.includes('FROM ne_credores')) return linhasCredores;
        if (sql.includes('GROUP BY numero_ne, credor_cpf_cnpj')) return pagos;
        if (sql.includes('FROM credores')) {
          return meis.filter((m) => params.includes(m.replace(/\D/g, ''))).map((cpf_cnpj) => ({ cpf_cnpj }));
        }
        return notas;
      });
    }

    test('a lista não traz mais credores nem consulta ne_credores/credores; mantém credorNome/cpfCnpj legados (T30)', async () => {
      mockLeitura(
        [
          { id: 'ne-1', numero: 'NE-001', valor: '10000.00', cpfCnpj: '11.111.111/0001-11', credorNome: 'Maria Cavalcanti ME' },
          { id: 'ne-2', numero: 'NE-002', valor: '100.00', cpfCnpj: null, credorNome: null },
        ],
        [{ numero_ne: 'NE-001', credor_cpf_cnpj: '11.111.111/0001-11', credor_nome: 'Maria Cavalcanti ME', valor_bruto: '6000.00' }],
        []
      );
      const res: any = await GET(new NextRequest('http://localhost:3000/api/notas-empenho'));
      const { notas } = await res.json();
      expect(notas[0]).not.toHaveProperty('credores');
      expect(notas[0]).toMatchObject({ credorNome: 'Maria Cavalcanti ME', cpfCnpj: '11.111.111/0001-11' });
      const sqls = (query as any).mock.calls.map((c: any[]) => c[0] as string);
      expect(sqls.some((s: string) => s.includes('ne_credores'))).toBe(false);
      expect(sqls.some((s: string) => s.includes('FROM credores'))).toBe(false);
    });

    test('GET sem parâmetros retorna lista paginada', async () => {
      mockLeitura(
        [
          { id: 'ne-1', numero: 'NE-001', valor: 1000 },
          { id: 'ne-2', numero: 'NE-002', valor: 2000 },
        ],
        [],
        [],
        50
      );
      const res: any = await GET(new NextRequest('http://localhost:3000/api/notas-empenho'));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.totalPages).toBe(1); // 50 total, default 50/page
    });

    test('GET com ?numero= retorna a NE com saldoDisponivel e sem credores', async () => {
      mockLeitura([{ id: 'ne-1', numero: 'NE-2026-001', valor: 10000, saldoDisponivel: 5000 }], [], []);
      const res: any = await GET(new NextRequest('http://localhost:3000/api/notas-empenho?numero=NE-2026-001'));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.ne.saldoDisponivel).toBe(5000);
      expect(data.ne).not.toHaveProperty('credores');
    });

    test('lista e busca devolvem saldo (valor, gasto, restante, %, qtd) da mesma consulta, sem consulta extra (T31)', async () => {
      mockLeitura(
        [
          { id: 'ne-1', numero: 'NE-001', valor: '100.00', gasto: '90.00', qtdOps: 3 },
          { id: 'ne-2', numero: 'NE-002', valor: '50.00', gasto: '0', qtdOps: 0 },
        ],
        [],
        []
      );
      const res: any = await GET(new NextRequest('http://localhost:3000/api/notas-empenho'));
      const { notas } = await res.json();
      expect(notas[0].saldo).toEqual({ valor: 100, gasto: 90, restante: 10, percentualGasto: 90, qtdOps: 3 });
      expect(notas[1].saldo).toEqual({ valor: 50, gasto: 0, restante: 50, percentualGasto: 0, qtdOps: 0 });
      expect(notas[0]).not.toHaveProperty('gasto');
      expect(notas[0]).not.toHaveProperty('qtdOps');
      // 1 consulta de contagem + 1 da página; o gasto vem do LEFT JOIN agregado já existente
      expect((query as any).mock.calls).toHaveLength(2);
      const sqlPagina = (query as any).mock.calls.map((c: any[]) => c[0] as string).find((s: string) => s.includes('LIMIT ?'));
      expect(sqlPagina).toContain('COALESCE(op_sum.total_pago, 0) as gasto');
      expect(sqlPagina).toContain('COUNT(*) as qtd');
    });

    test('lista e busca por número trazem a data de cadastro (criadaEm) — coluna "Cadastro" (T29)', async () => {
      mockLeitura([{ id: 'ne-1', numero: 'NE-001', valor: '100.00', criadaEm: '2026-10-14' }], [], []);
      const lista: any = await GET(new NextRequest('http://localhost:3000/api/notas-empenho'));
      expect((await lista.json()).notas[0].criadaEm).toBe('2026-10-14');
      await GET(new NextRequest('http://localhost:3000/api/notas-empenho?numero=NE-001'));
      const consultas = (query as any).mock.calls.map((c: any[]) => c[0] as string).filter((s: string) => s.includes('FROM notas_empenho ne'));
      expect(consultas.length).toBeGreaterThanOrEqual(2);
      for (const sql of consultas.filter((s: string) => !s.includes('COUNT(*)'))) {
        expect(sql).toContain("DATE_FORMAT(ne.created_at, '%Y-%m-%d') as criadaEm");
      }
    });

    test('GET com ?numero= NE não existente retorna 404', async () => {
      (query as any).mockResolvedValueOnce([]); // não encontrada
      const res: any = await GET(new NextRequest('http://localhost:3000/api/notas-empenho?numero=NE-INEXISTENTE'));
      expect(res.status).toBe(404);
    });
  });
});
