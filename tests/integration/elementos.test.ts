import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock de lib/db: `query` é a mesma função usada tanto para chamadas diretas
// quanto como `conn.execute` dentro de withTransaction, para que os dois
// caminhos sejam sequenciáveis com a mesma fila de mockResolvedValueOnce.
vi.mock('@/lib/db', () => {
  const query = vi.fn();
  return {
    query,
    withTransaction: vi.fn(async (fn: any) => fn({ execute: query })),
  };
});

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Nao autenticado' }) }),
  forbiddenResponse: () => ({ status: 403, json: async () => ({ error: 'Acesso negado' }) }),
}));

import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { GET as GET_ELEMENTOS, POST as POST_ELEMENTOS } from '@/app/api/elementos/route';
import { PUT as PUT_ELEMENTO, DELETE as DELETE_ELEMENTO } from '@/app/api/elementos/[codigo]/route';
import { POST as POST_SUBELEMENTOS } from '@/app/api/subelementos/route';

describe('Integração API Elementos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/elementos', () => {
    test('sem autenticação retorna 401', async () => {
      (getAuthUser as any).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/elementos', { method: 'GET' });
      const res: any = await GET_ELEMENTOS(req);

      expect(res.status).toBe(401);
    });

    test('devolve elementos com subelementos e retenções aninhados', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'user-1', perfil: 'GESTOR' });
      (query as any)
        .mockResolvedValueOnce([{ codigo: '3.3.90.14', descricao: 'Diárias - Civil', legado: 0, ativo: 1, ordem: 10 }])
        .mockResolvedValueOnce([
          { codigo: '3.3.90.14.01', elemento_codigo: '3.3.90.14', descricao: 'Diárias Pessoal Civil', ativo: 1, ordem: 1 },
        ])
        .mockResolvedValueOnce([{ elemento_codigo: '3.3.90.14', campo: 'irrf' }]);

      const req = new NextRequest('http://localhost:3000/api/elementos', { method: 'GET' });
      const res: any = await GET_ELEMENTOS(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.elementos).toHaveLength(1);
      expect(data.elementos[0].valor).toBe('3.3.90.14 - Diárias - Civil');
      expect(data.elementos[0].subelementos).toHaveLength(1);
      expect(data.elementos[0].subelementos[0].valor).toBe('3.3.90.14.01 - Diárias Pessoal Civil');
      expect(data.elementos[0].retencoes).toEqual(['irrf']);
    });

    test('por padrão só busca ativos (sem ?incluirInativos)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'user-1', perfil: 'ADMIN' });
      (query as any).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const req = new NextRequest('http://localhost:3000/api/elementos', { method: 'GET' });
      const res: any = await GET_ELEMENTOS(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('ativo = 1'));
    });
  });

  describe('POST /api/elementos', () => {
    test('GESTOR não pode criar (403)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'user-1', perfil: 'GESTOR' });

      const req = new NextRequest('http://localhost:3000/api/elementos', {
        method: 'POST',
        body: JSON.stringify({ codigo: '3.3.90.99', descricao: 'Teste' }),
      });
      const res: any = await POST_ELEMENTOS(req);

      expect(res.status).toBe(403);
    });

    test('CONSULTA não pode criar (403)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'user-1', perfil: 'CONSULTA' });

      const req = new NextRequest('http://localhost:3000/api/elementos', {
        method: 'POST',
        body: JSON.stringify({ codigo: '3.3.90.99', descricao: 'Teste' }),
      });
      const res: any = await POST_ELEMENTOS(req);

      expect(res.status).toBe(403);
    });

    test('ADMIN cria com sucesso (201)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-1', perfil: 'ADMIN' });
      (query as any)
        .mockResolvedValueOnce({ affectedRows: 1 }) // INSERT elementos_despesa
        .mockResolvedValueOnce({ affectedRows: 1 }); // INSERT auditoria_financeira

      const req = new NextRequest('http://localhost:3000/api/elementos', {
        method: 'POST',
        body: JSON.stringify({ codigo: '3.3.90.99', descricao: 'Elemento de teste' }),
      });
      const res: any = await POST_ELEMENTOS(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.codigo).toBe('3.3.90.99');
    });

    test('código duplicado retorna 409', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-1', perfil: 'ADMIN' });
      (query as any).mockRejectedValueOnce(Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' }));

      const req = new NextRequest('http://localhost:3000/api/elementos', {
        method: 'POST',
        body: JSON.stringify({ codigo: '3.3.90.14', descricao: 'Repetido' }),
      });
      const res: any = await POST_ELEMENTOS(req);

      expect(res.status).toBe(409);
    });

    test('código em formato inválido retorna 400 (ZodError via withErrorHandler)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-1', perfil: 'ADMIN' });

      const req = new NextRequest('http://localhost:3000/api/elementos', {
        method: 'POST',
        body: JSON.stringify({ codigo: 'invalido', descricao: 'Teste' }),
      });
      const res: any = await POST_ELEMENTOS(req);

      expect(res.status).toBe(400);
    });
  });

  describe('PUT/DELETE /api/elementos/[codigo]', () => {
    test('DELETE marca ativo=0 (soft delete)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-1', perfil: 'ADMIN' });
      (query as any)
        .mockResolvedValueOnce([[{ codigo: '3.3.90.99', descricao: 'Teste', legado: 0, ativo: 1, ordem: 999 }]]) // SELECT FOR UPDATE
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE ativo = 0
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT auditoria

      const req = new NextRequest('http://localhost:3000/api/elementos/3.3.90.99', { method: 'DELETE' });
      const res: any = await DELETE_ELEMENTO(req, { params: Promise.resolve({ codigo: '3.3.90.99' }) });

      expect(res.status).toBe(200);
    });

    test('DELETE de um código inexistente retorna 404', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-1', perfil: 'ADMIN' });
      (query as any).mockResolvedValueOnce([[]]); // SELECT FOR UPDATE: nenhuma linha

      const req = new NextRequest('http://localhost:3000/api/elementos/9.9.99.99', { method: 'DELETE' });
      const res: any = await DELETE_ELEMENTO(req, { params: Promise.resolve({ codigo: '9.9.99.99' }) });

      expect(res.status).toBe(404);
    });

    test('DELETE de um código já inativo continua 200 (idempotente, não 404 por affectedRows=0)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-1', perfil: 'ADMIN' });
      (query as any)
        // já existe, mas já está ativo=0 (ex.: segunda chamada de DELETE)
        .mockResolvedValueOnce([[{ codigo: '3.3.90.99', descricao: 'Teste', legado: 0, ativo: 0, ordem: 999 }]])
        .mockResolvedValueOnce([{ affectedRows: 0 }]) // UPDATE não muda nada (valor já era 0)
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT auditoria

      const req = new NextRequest('http://localhost:3000/api/elementos/3.3.90.99', { method: 'DELETE' });
      const res: any = await DELETE_ELEMENTO(req, { params: Promise.resolve({ codigo: '3.3.90.99' }) });

      expect(res.status).toBe(200);
    });

    test('PUT com GESTOR não pode editar (403)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'user-1', perfil: 'GESTOR' });

      const req = new NextRequest('http://localhost:3000/api/elementos/3.3.90.99', {
        method: 'PUT',
        body: JSON.stringify({ descricao: 'Nova descrição' }),
      });
      const res: any = await PUT_ELEMENTO(req, { params: Promise.resolve({ codigo: '3.3.90.99' }) });

      expect(res.status).toBe(403);
    });

    test('PUT válido com ADMIN retorna 200', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-1', perfil: 'ADMIN' });
      (query as any)
        .mockResolvedValueOnce([[{ codigo: '3.3.90.99', descricao: 'Antiga', legado: 0, ativo: 1, ordem: 999 }]]) // SELECT FOR UPDATE
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT auditoria

      const req = new NextRequest('http://localhost:3000/api/elementos/3.3.90.99', {
        method: 'PUT',
        body: JSON.stringify({ descricao: 'Nova descrição' }),
      });
      const res: any = await PUT_ELEMENTO(req, { params: Promise.resolve({ codigo: '3.3.90.99' }) });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/subelementos', () => {
    test('elemento pai inexistente retorna 400', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-1', perfil: 'ADMIN' });
      (query as any).mockResolvedValueOnce([]); // SELECT codigo FROM elementos_despesa: não encontrado

      const req = new NextRequest('http://localhost:3000/api/subelementos', {
        method: 'POST',
        body: JSON.stringify({ codigo: '9.9.90.99.01', elementoCodigo: '9.9.90.99', descricao: 'Teste' }),
      });
      const res: any = await POST_SUBELEMENTOS(req);

      expect(res.status).toBe(400);
    });

    test('elemento pai existente cria subelemento (201)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-1', perfil: 'ADMIN' });
      (query as any)
        .mockResolvedValueOnce([{ codigo: '3.3.90.14' }]) // elemento encontrado
        .mockResolvedValueOnce({ affectedRows: 1 }) // INSERT subelementos_despesa
        .mockResolvedValueOnce({ affectedRows: 1 }); // INSERT auditoria

      const req = new NextRequest('http://localhost:3000/api/subelementos', {
        method: 'POST',
        body: JSON.stringify({ codigo: '3.3.90.14.02', elementoCodigo: '3.3.90.14', descricao: 'Novo subelemento' }),
      });
      const res: any = await POST_SUBELEMENTOS(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.codigo).toBe('3.3.90.14.02');
    });

    test('código que não começa com o código do elemento pai retorna 400 (ZodError)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-1', perfil: 'ADMIN' });

      const req = new NextRequest('http://localhost:3000/api/subelementos', {
        method: 'POST',
        body: JSON.stringify({ codigo: '9.9.99.99.01', elementoCodigo: '3.3.90.14', descricao: 'Teste' }),
      });
      const res: any = await POST_SUBELEMENTOS(req);

      expect(res.status).toBe(400);
    });
  });
});
