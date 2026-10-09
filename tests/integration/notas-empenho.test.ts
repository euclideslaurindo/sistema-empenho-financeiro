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

    test('Payload antigo com credor: grava 1 linha em ne_credores com bruto = valor da NE', async () => {
      const chamadas = conexaoCriar();
      const res = await postar({ numero: 'NE-1', valor: 1000, credorNome: 'Fulano (texto livre)', cpfCnpj: '999.999.999-99' });
      expect(res.status).toBe(201);
      const insert = chamadas.find(([sql]) => sql.includes('INSERT INTO ne_credores'))!;
      expect(insert[1].slice(1, 5)).toEqual(['NE-1', '999.999.999-99', 'Fulano (texto livre)', 1000]);
      // tela antiga não exige credor cadastrado
      expect(chamadas.some(([sql]) => sql.includes('FROM credores'))).toBe(false);
    });

    test('Vários credores: 10.000 = 6.000 + 4.000 -> 201, nomes do cadastro e colunas legadas = 1º credor', async () => {
      const chamadas = conexaoCriar();
      const res = await postar({
        numero: 'NE-2',
        valor: 10000,
        credorNome: 'nome enviado pelo cliente (ignorado)',
        credores: [
          { cpfCnpj: '11111111000111', valorBruto: '6.000,00' },
          { cpfCnpj: '222.222.222-22', valorBruto: 4000 },
        ],
      });
      expect(res.status).toBe(201);

      const insertNe = chamadas.find(([sql]) => sql.includes('INSERT INTO notas_empenho'))!;
      expect(insertNe[1].slice(-2)).toEqual(['Maria Cavalcanti ME', '11.111.111/0001-11']);

      const insertCred = chamadas.find(([sql]) => sql.includes('INSERT INTO ne_credores'))!;
      const p = insertCred[1];
      expect(p.length).toBe(14); // 2 linhas x 7 colunas
      expect(p.slice(1, 6)).toEqual(['NE-2', '11.111.111/0001-11', 'Maria Cavalcanti ME', 6000, 0]);
      expect(p.slice(8, 13)).toEqual(['NE-2', '222.222.222-22', 'José Silva', 4000, 1]);
    });

    test('Soma não fecha: 6.000 + 3.999,99 -> 422 "Falta R$ 0,01"', async () => {
      const res = await postar({
        numero: 'NE-3',
        valor: 10000,
        credores: [
          { cpfCnpj: '11111111000111', valorBruto: 6000 },
          { cpfCnpj: '22222222222', valorBruto: '3.999,99' },
        ],
      });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error).toBe(
        'A soma dos valores brutos (R$ 9.999,99) difere do valor da NE (R$ 10.000,00). Falta R$ 0,01.'
      );
      expect(withTransaction).not.toHaveBeenCalled();
    });

    test('Mesmo credor duas vezes (com e sem máscara) -> 400', async () => {
      const res = await postar({
        numero: 'NE-4',
        valor: 10000,
        credores: [
          { cpfCnpj: '222.222.222-22', valorBruto: 5000 },
          { cpfCnpj: '22222222222', valorBruto: 5000 },
        ],
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('mais de uma vez');
    });

    test('Credor inexistente ou inativo -> 422 e nada é gravado', async () => {
      const chamadas = conexaoCriar();
      const res = await postar({
        numero: 'NE-5',
        valor: 100,
        credores: [{ cpfCnpj: '333.333.333-33', valorBruto: 100 }],
      });
      expect(res.status).toBe(422);
      expect((await res.json()).error).toContain('não encontrado ou inativo');
      expect(chamadas.some(([sql]) => sql.includes('INSERT INTO notas_empenho'))).toBe(false);
    });

    test('Valor bruto zero -> 400', async () => {
      const res = await postar({ numero: 'NE-6', valor: 100, credores: [{ cpfCnpj: '22222222222', valorBruto: 0 }] });
      expect(res.status).toBe(400);
    });

    test('Grava auditoria CREATE com a lista de credores', async () => {
      const chamadas = conexaoCriar();
      await postar({ numero: 'NE-7', valor: 4000, credores: [{ cpfCnpj: '22222222222', valorBruto: 4000 }] });
      const audit = chamadas.find(([sql]) => sql.includes('INSERT INTO auditoria_financeira'))!;
      expect(audit[1][1]).toBe('notas_empenho');
      expect(audit[1][3]).toBe('CREATE');
      expect(JSON.parse(audit[1][5]).credores).toEqual([{ cpfCnpj: '222.222.222-22', nome: 'José Silva', valorBruto: 4000 }]);
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

    test('credores da NE trazem o selo MEI (casando por dígitos, sem JOIN)', async () => {
      mockLeitura(
        [{ id: 'ne-1', numero: 'NE-001', valor: '100.00', cpfCnpj: null, credorNome: null }],
        [
          { numero_ne: 'NE-001', credor_cpf_cnpj: '11111111000111', credor_nome: 'Maria ME', valor_bruto: '60.00' },
          { numero_ne: 'NE-001', credor_cpf_cnpj: '222.222.222-22', credor_nome: 'José', valor_bruto: '40.00' },
        ],
        [],
        1,
        ['11.111.111/0001-11']
      );
      const res: any = await GET(new NextRequest('http://localhost:3000/api/notas-empenho'));
      const { notas } = await res.json();
      expect(notas[0].credores[0].isMei).toBe(true);
      expect(notas[0].credores[1].isMei).toBeUndefined();
      const sqlMei = (query as any).mock.calls.map((c: any[]) => c[0]).find((s: string) => s.includes('FROM credores'));
      expect(sqlMei).toContain('is_mei = 1');
      expect(sqlMei).not.toContain('JOIN');
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

    test('Listagem devolve credores com pago/saldo e o sintetizado legado, com 1 query de credores pra página', async () => {
      mockLeitura(
        [
          { id: 'ne-1', numero: 'NE-001', valor: '10000.00', cpfCnpj: '11.111.111/0001-11', credorNome: 'Maria Cavalcanti ME' },
          { id: 'ne-2', numero: 'NE-002', valor: '500.00', cpfCnpj: '999.999.999-99', credorNome: 'Antigo' },
          { id: 'ne-3', numero: 'NE-003', valor: '100.00', cpfCnpj: null, credorNome: null },
        ],
        [
          { numero_ne: 'NE-001', credor_cpf_cnpj: '11.111.111/0001-11', credor_nome: 'Maria Cavalcanti ME', valor_bruto: '6000.00' },
          { numero_ne: 'NE-001', credor_cpf_cnpj: '222.222.222-22', credor_nome: 'José Silva', valor_bruto: '4000.00' },
        ],
        [
          { numero_ne: 'NE-001', credor_cpf_cnpj: '11.111.111/0001-11', total_pago: '2500.00' },
          { numero_ne: 'NE-002', credor_cpf_cnpj: '999.999.999-99', total_pago: '100.00' },
        ]
      );

      const res: any = await GET(new NextRequest('http://localhost:3000/api/notas-empenho'));
      const { notas } = await res.json();

      expect(notas[0].credores).toEqual([
        { cpfCnpj: '11.111.111/0001-11', nome: 'Maria Cavalcanti ME', valorBruto: 6000, valorPago: 2500, saldo: 3500 },
        { cpfCnpj: '222.222.222-22', nome: 'José Silva', valorBruto: 4000, valorPago: 0, saldo: 4000 },
      ]);
      expect(notas[1].credores).toEqual([
        { cpfCnpj: '999.999.999-99', nome: 'Antigo', valorBruto: 500, valorPago: 100, saldo: 400, legado: true },
      ]);
      expect(notas[2].credores).toEqual([]);

      const sqls = (query as any).mock.calls.map((c: any[]) => c[0] as string);
      expect(sqls.filter((s: string) => s.includes('FROM ne_credores'))).toHaveLength(1);
      expect(sqls.filter((s: string) => s.includes('GROUP BY numero_ne, credor_cpf_cnpj'))).toHaveLength(1);
    });

    test('GET com ?numero= retorna NE específica com saldoDisponivel e credores', async () => {
      mockLeitura([{ id: 'ne-1', numero: 'NE-2026-001', valor: 10000, saldoDisponivel: 5000 }], [], []);
      const res: any = await GET(new NextRequest('http://localhost:3000/api/notas-empenho?numero=NE-2026-001'));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.ne.saldoDisponivel).toBe(5000);
      expect(data.ne.credores).toEqual([]);
    });

    test('GET com ?numero= NE não existente retorna 404', async () => {
      (query as any).mockResolvedValueOnce([]); // não encontrada
      const res: any = await GET(new NextRequest('http://localhost:3000/api/notas-empenho?numero=NE-INEXISTENTE'));
      expect(res.status).toBe(404);
    });
  });
});
