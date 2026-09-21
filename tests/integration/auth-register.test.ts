import { describe, test, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/register/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Não autenticado' }) }),
  forbiddenResponse: () => ({ status: 403, json: async () => ({ error: 'Acesso negado' }) })
}));

vi.mock('bcryptjs', async (importOriginal: () => Promise<typeof import('bcryptjs')>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    genSalt: vi.fn().mockResolvedValue('salt'),
    hash: vi.fn().mockResolvedValue('hashed-password'),
  };
});

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

import { getAuthUser } from '@/lib/auth';
import { query } from '@/lib/db';

describe('Integração API Auth Register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Criar usuário como ADMIN retorna 200', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'admin-123', perfil: 'ADMIN' });
    (query as any)
      .mockResolvedValueOnce([]) // SELECT duplicidade → não existe
      .mockResolvedValueOnce({ insertId: 'user-uuid-123' }); // INSERT → sucesso

    (global.crypto.randomUUID as any) = () => 'user-uuid-123';

    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'New User',
        senha: 'SecurePass123',
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBeDefined();
  });

  test('Não-ADMIN tentando criar retorna 403', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'user-123', perfil: 'GESTOR' });

    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'New User',
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
        senha: 'short',
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
        senha: 'SecurePass123',
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(400);
  });

  test('Duplicação de email retorna 409', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'admin-123', perfil: 'ADMIN' });
    (query as any)
      .mockResolvedValueOnce([]) // SELECT duplicidade → não existe
      .mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' }); // INSERT → erro

    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'New User',
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
        senha: 'SecurePass123',
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(401);
  });
});
