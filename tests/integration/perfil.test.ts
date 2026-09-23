import { describe, test, expect, vi, beforeEach } from 'vitest';
import { GET, PUT } from '@/app/api/perfil/route';
import { PUT as PUT_SENHA } from '@/app/api/perfil/senha/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Não autenticado' }) }),
}));

vi.mock('jose', () => ({
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('fake-jwt-token'),
  })),
}));

vi.mock('bcryptjs', async (importOriginal: () => Promise<typeof import('bcryptjs')>) => {
  const actual = await importOriginal();
  return { ...actual, compare: vi.fn() };
});

import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import * as bcrypt from 'bcryptjs';

describe('Integração API Perfil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (bcrypt.compare as any).mockResolvedValue(true);
  });

  describe('GET /api/perfil', () => {
    test('Retorna dados do usuário logado', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', email: 'joao@empenho.local', perfil: 'GESTOR' });
      (query as any).mockResolvedValue([{ id: '123', nome: 'João', email: 'joao@empenho.local', perfil: 'GESTOR' }]);

      const req = new NextRequest('http://localhost:3000/api/perfil', { method: 'GET' });
      const res: any = await GET(req);
      expect(res.status).toBe(200);
    });

    test('Usuário não encontrado retorna 404', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', email: 'joao@empenho.local', perfil: 'GESTOR' });
      (query as any).mockResolvedValue([]);

      const req = new NextRequest('http://localhost:3000/api/perfil', { method: 'GET' });
      const res: any = await GET(req);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/perfil — atualizar dados', () => {
    test('Atualização válida retorna 200 e seta cookie', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', email: 'joao@empenho.local', perfil: 'GESTOR' });
      (query as any)
        .mockResolvedValueOnce([]) // sem duplicidade de e-mail
        .mockResolvedValueOnce({ affectedRows: 1 }); // UPDATE

      const req = new NextRequest('http://localhost:3000/api/perfil', {
        method: 'PUT',
        body: JSON.stringify({ nome: 'João Silva', email: 'joao.silva@empenho.local' }),
      });
      const res: any = await PUT(req);
      expect(res.status).toBe(200);
      expect(res.cookies.set).toHaveBeenCalled();
    });

    test('E-mail duplicado retorna 409', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', email: 'joao@empenho.local', perfil: 'GESTOR' });
      (query as any).mockResolvedValueOnce([{ id: '456' }]); // já em uso por outro

      const req = new NextRequest('http://localhost:3000/api/perfil', {
        method: 'PUT',
        body: JSON.stringify({ nome: 'João Silva', email: 'outro@empenho.local' }),
      });
      const res: any = await PUT(req);
      expect(res.status).toBe(409);
    });

    test('Dados incompletos retorna 400', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', email: 'joao@empenho.local', perfil: 'GESTOR' });

      const req = new NextRequest('http://localhost:3000/api/perfil', {
        method: 'PUT',
        body: JSON.stringify({ nome: 'João Silva' }),
      });
      const res: any = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/perfil/senha — alterar senha', () => {
    test('Troca de senha válida retorna 200', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'GESTOR' });
      (query as any)
        .mockResolvedValueOnce([{ senha_hash: 'hash-antigo' }])
        .mockResolvedValueOnce({ affectedRows: 1 });

      const req = new NextRequest('http://localhost:3000/api/perfil/senha', {
        method: 'PUT',
        body: JSON.stringify({ senhaAtual: 'senhaAntiga123', novaSenha: 'senhaNova123' }),
      });
      const res: any = await PUT_SENHA(req);
      expect(res.status).toBe(200);
    });

    test('Senha atual incorreta retorna 401', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'GESTOR' });
      (query as any).mockResolvedValueOnce([{ senha_hash: 'hash-antigo' }]);
      (bcrypt.compare as any).mockResolvedValue(false);

      const req = new NextRequest('http://localhost:3000/api/perfil/senha', {
        method: 'PUT',
        body: JSON.stringify({ senhaAtual: 'errada', novaSenha: 'senhaNova123' }),
      });
      const res: any = await PUT_SENHA(req);
      expect(res.status).toBe(401);
    });

    test('Nova senha curta demais retorna 400', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'GESTOR' });

      const req = new NextRequest('http://localhost:3000/api/perfil/senha', {
        method: 'PUT',
        body: JSON.stringify({ senhaAtual: 'senhaAntiga123', novaSenha: '123' }),
      });
      const res: any = await PUT_SENHA(req);
      expect(res.status).toBe(400);
    });
  });
});
