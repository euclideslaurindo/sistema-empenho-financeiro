import { describe, test, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/register/route';
import { NextRequest } from 'next/server';
import { createDbMock } from '@/tests/helpers/db-mock';

vi.mock('@/lib/db', () => createDbMock());

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Não autenticado' }) }),
  forbiddenResponse: () => ({ status: 403, json: async () => ({ error: 'Acesso negado' }) })
}));

vi.mock('bcryptjs', () => ({
  genSalt: vi.fn().mockResolvedValue('salt'),
  hash: vi.fn().mockResolvedValue('hashed-password'),
}));

import { getAuthUser } from '@/lib/auth';
import { query } from '@/lib/db';

describe('Integração API Auth Register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Criar usuário como ADMIN retorna 201', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'admin-123', perfil: 'ADMIN' });
    (query as any).mockResolvedValue([]); // não existe

    (global.crypto.randomUUID as any) = () => 'user-uuid-123';

    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'New User',
        email: 'newuser@example.com',
        senha: 'SecurePass123',
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.usuario.perfil).toBe('GESTOR'); // novo usuário é sempre GESTOR
  });

  test('Não-ADMIN tentando criar retorna 403', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'user-123', perfil: 'USER' }); // não é ADMIN

    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'New User',
        email: 'newuser@example.com',
        senha: 'SecurePass123',
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(403);
  });

  test('Senha muito curta retorna 400', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'admin-123', perfil: 'ADMIN' });

    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'New User',
        email: 'newuser@example.com',
        senha: 'short', // menos de 8 chars
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(400);
  });

  test('Nome vazio retorna 400', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'admin-123', perfil: 'ADMIN' });

    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nome: '',
        email: 'newuser@example.com',
        senha: 'SecurePass123',
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(400);
  });

  test('Duplicação de email retorna 409', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'admin-123', perfil: 'ADMIN' });

    const { withTransaction } = await import('@/lib/db');
    (withTransaction as any).mockImplementationOnce(async (cb: any) => {
      const conn = {
        execute: vi.fn().mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' }),
      };
      return await cb(conn);
    });

    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'New User',
        email: 'existing@example.com',
        senha: 'SecurePass123',
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(409);
  });

  test('Sem autenticação retorna 401', async () => {
    (getAuthUser as any).mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'New User',
        email: 'newuser@example.com',
        senha: 'SecurePass123',
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(401);
  });
});
