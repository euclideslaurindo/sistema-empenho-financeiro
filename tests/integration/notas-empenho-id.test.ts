import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PUT, DELETE } from '@/app/api/notas-empenho/[id]/route';
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
import { withTransaction } from '@/lib/db';

describe('Integração API Notas de Empenho [id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PUT — Atualizar Nota de Empenho', () => {
    test('Atualização válida retorna 200', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('FOR UPDATE')) return [[{ numero: 'NE-001', valor: 10000, status: 'EMITIDO' }]];
            if (sql.includes('SELECT id FROM notas_empenho WHERE numero')) return [[]];
            if (sql.includes('SUM(op.valor_pagamento)')) return [[{ total_pago: 3000 }]];
            if (sql.includes('SELECT id FROM usuarios')) return [[{ id: '123' }]];
            if (sql.includes('UPDATE notas_empenho')) return [{ affectedRows: 1 }];
            return [[]];
          }),
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'PUT',
        body: JSON.stringify({
          numero: 'NE-001',
          valor: 8000, // reduz, mas acima do total já pago
        }),
      });

      const res: any = await PUT(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(200);
    });

    test('Reduzir valor abaixo do total já pago retorna 409', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('FOR UPDATE')) return [[{ numero: 'NE-001', valor: 10000, status: 'EMITIDO' }]];
            if (sql.includes('SELECT id FROM notas_empenho WHERE numero')) return [[]];
            if (sql.includes('SUM(op.valor_pagamento)')) return [[{ total_pago: 5000 }]];
            if (sql.includes('SELECT id FROM usuarios')) return [[{ id: '123' }]];
            return [[]];
          }),
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'PUT',
        body: JSON.stringify({
          numero: 'NE-001',
          valor: 4000, // menor que 5k já pago → falha
        }),
      });

      const res: any = await PUT(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('Não é possível reduzir');
    });

    test('Número duplicado com outro registro retorna 409', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[{ numero: 'NE-001', valor: 10000 }]]) // SELECT for UPDATE
            .mockResolvedValueOnce([[{ id: 'ne-999' }]]), // outro registro com este número
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'PUT',
        body: JSON.stringify({
          numero: 'NE-EXISTENTE', // já usado por outro
          valor: 10000,
        }),
      });

      const res: any = await PUT(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(409);
    });
  });

  describe('PUT — vários credores (T15)', () => {
    const CADASTRO = [
      { cpf_cnpj: '11.111.111/0001-11', nome: 'Maria Cavalcanti ME', ativo: 1 },
      { cpf_cnpj: '222.222.222-22', nome: 'José Silva', ativo: 1 },
      { cpf_cnpj: '444.444.444-44', nome: 'Ana Souza', ativo: 1 },
    ];

    function conexaoEditar({
      ne = { id: 'ne-123', numero: 'NE-001', valor: '10000.00', status: 'EMITIDO' },
      linhas = [] as any[],
      pagos = [] as any[],
    } = {}) {
      const chamadas: Array<[string, any[]]> = [];
      const totalPago = pagos.reduce((t, p) => t + Number(p.total_pago), 0);
      const conn = {
        execute: vi.fn(async (sql: string, params: any[] = []) => {
          chamadas.push([sql, params]);
          if (sql.includes('FROM notas_empenho WHERE id = ? FOR UPDATE')) return [[ne]];
          if (sql.includes('SELECT id FROM notas_empenho WHERE numero')) return [[]];
          if (sql.includes('SUM(op.valor_pagamento)')) return [[{ total_pago: totalPago }]];
          if (sql.includes('FROM ne_credores WHERE numero_ne')) return [linhas];
          if (sql.includes('GROUP BY credor_cpf_cnpj')) return [pagos];
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

    const LINHAS_2 = [
      { credor_cpf_cnpj: '11.111.111/0001-11', credor_nome: 'Maria Cavalcanti ME', valor_bruto: '6000.00' },
      { credor_cpf_cnpj: '222.222.222-22', credor_nome: 'José Silva', valor_bruto: '4000.00' },
    ];

    const editar = (body: any) =>
      PUT(new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', { method: 'PUT', body: JSON.stringify(body) }), {
        params: Promise.resolve({ id: 'ne-123' }),
      }) as any;

    test('Substitui a lista: DELETE + INSERT, colunas legadas = 1º credor, auditoria UPDATE com antes/depois', async () => {
      const chamadas = conexaoEditar({ linhas: LINHAS_2 });
      const res = await editar({
        numero: 'NE-001',
        valor: 10000,
        credores: [
          { cpfCnpj: '44444444444', valorBruto: 7000 },
          { cpfCnpj: '22222222222', valorBruto: 3000 },
        ],
      });
      expect(res.status).toBe(200);

      const update = chamadas.find(([sql]) => sql.includes('UPDATE notas_empenho'))!;
      expect(update[1].slice(-3)).toEqual(['Ana Souza', '444.444.444-44', 'ne-123']);
      expect(chamadas.find(([sql]) => sql.includes('DELETE FROM ne_credores'))![1]).toEqual(['NE-001']);
      expect(chamadas.find(([sql]) => sql.includes('INSERT INTO ne_credores'))![1].length).toBe(14);

      const audit = chamadas.find(([sql]) => sql.includes('INSERT INTO auditoria_financeira'))!;
      expect(audit[1][3]).toBe('UPDATE');
      expect(JSON.parse(audit[1][4]).credores).toHaveLength(2);
      expect(JSON.parse(audit[1][5]).credores.map((c: any) => c.nome)).toEqual(['Ana Souza', 'José Silva']);
    });

    test('Tirar credor que já recebeu OP -> 409', async () => {
      conexaoEditar({ linhas: LINHAS_2, pagos: [{ credor_cpf_cnpj: '222.222.222-22', total_pago: '100.00' }] });
      const res = await editar({ numero: 'NE-001', valor: 10000, credores: [{ cpfCnpj: '11111111000111', valorBruto: 10000 }] });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toContain('já recebeu OP');
    });

    test('Bruto abaixo do que o credor já recebeu -> 409', async () => {
      conexaoEditar({ linhas: LINHAS_2, pagos: [{ credor_cpf_cnpj: '222.222.222-22', total_pago: '3500.00' }] });
      const res = await editar({
        numero: 'NE-001',
        valor: 10000,
        credores: [
          { cpfCnpj: '11111111000111', valorBruto: 7000 },
          { cpfCnpj: '22222222222', valorBruto: 3000 },
        ],
      });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toContain('não pode ficar abaixo');
    });

    test('NE cancelada não aceita alteração de credores -> 409', async () => {
      conexaoEditar({ ne: { id: 'ne-123', numero: 'NE-001', valor: '100.00', status: 'CANCELADO' } });
      const res = await editar({ numero: 'NE-001', valor: 100, credores: [{ cpfCnpj: '22222222222', valorBruto: 100 }] });
      expect(res.status).toBe(409);
    });

    test('Soma não fecha na edição -> 422 com "Sobra"', async () => {
      const res = await editar({ numero: 'NE-001', valor: 100, credores: [{ cpfCnpj: '22222222222', valorBruto: 150 }] });
      expect(res.status).toBe(422);
      expect((await res.json()).error).toContain('Sobra R$ 50,00');
    });

    test('Tela antiga + NE com vários credores + valor mudou -> 422', async () => {
      conexaoEditar({ linhas: LINHAS_2 });
      const res = await editar({ numero: 'NE-001', valor: 12000, credorNome: 'X', cpfCnpj: '1' });
      expect(res.status).toBe(422);
      expect((await res.json()).error).toContain('vários credores');
    });

    test('Tela antiga + NE com vários credores + mesmo valor: linhas preservadas, legado = 1º credor', async () => {
      const chamadas = conexaoEditar({ linhas: LINHAS_2 });
      const res = await editar({ numero: 'NE-001', valor: 10000, credorNome: 'Outro', cpfCnpj: '000' });
      expect(res.status).toBe(200);
      expect(chamadas.some(([sql]) => sql.includes('DELETE FROM ne_credores'))).toBe(false);
      const update = chamadas.find(([sql]) => sql.includes('UPDATE notas_empenho'))!;
      expect(update[1].slice(-3, -1)).toEqual(['Maria Cavalcanti ME', '11.111.111/0001-11']);
    });

    test('Tela antiga + NE de credor único: linha acompanha valor e credor do payload', async () => {
      const chamadas = conexaoEditar({ linhas: [LINHAS_2[0]] });
      const res = await editar({ numero: 'NE-001', valor: 12000, credorNome: 'Novo', cpfCnpj: '555' });
      expect(res.status).toBe(200);
      const insert = chamadas.find(([sql]) => sql.includes('INSERT INTO ne_credores'))!;
      expect(insert[1].slice(1, 5)).toEqual(['NE-001', '555', 'Novo', 12000]);
    });

    test('NE anterior à T15 com OP de outro credor continua editável pela tela antiga', async () => {
      conexaoEditar({ pagos: [{ credor_cpf_cnpj: '777', total_pago: '50.00' }] });
      const res = await editar({ numero: 'NE-001', valor: 10000, credorNome: 'Legado', cpfCnpj: '888' });
      expect(res.status).toBe(200);
    });

    test('Trocar o número da NE leva os credores junto', async () => {
      const chamadas = conexaoEditar({ linhas: LINHAS_2 });
      const res = await editar({ numero: 'NE-001-NOVO', valor: 10000 });
      expect(res.status).toBe(200);
      const upd = chamadas.find(([sql]) => sql.includes('UPDATE ne_credores SET numero_ne'))!;
      expect(upd[1]).toEqual(['NE-001-NOVO', 'NE-001']);
    });
  });

  describe('DELETE — Cancelar Nota de Empenho', () => {
    test('Cancelar NE sem OPs vinculadas retorna 200', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[{ numero: 'NE-001' }]]) // SELECT for UPDATE
            .mockResolvedValueOnce([[{ total_pago: 0 }]]) // nenhuma OP
            .mockResolvedValueOnce([{ affectedRows: 1 }]), // UPDATE status = CANCELADO
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'DELETE',
      });

      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(200);
    });

    test('Cancelar NE com OPs vinculadas retorna 409', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[{ numero: 'NE-001' }]]) // SELECT for UPDATE
            .mockResolvedValueOnce([[{ total: 3 }]]), // 3 OPs vinculadas
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'DELETE',
      });

      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('3'); // menciona a contagem de OPs
    });

    test('Cancelar NE inexistente retorna 404', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn().mockResolvedValueOnce([[]]), // não encontrada
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-inexistente', {
        method: 'DELETE',
      });

      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'ne-inexistente' }) });
      expect(res.status).toBe(404);
    });
  });
});
