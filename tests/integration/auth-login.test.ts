import { describe, test, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('bcryptjs', async (importOriginal: () => Promise<typeof import('bcryptjs')>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    compare: vi.fn(),
  };
});

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  resetRateLimit: vi.fn(),
}));

vi.mock('jose', () => ({
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('fake-jwt-token'),
  })),
}));

import { query } from '@/lib/db';
import { compare } from 'bcryptjs';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limiter';

describe('Integração API Auth Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Login bem-sucedido retorna 200 com cookie JWT', async () => {
    (checkRateLimit as any).mockReturnValue({ allowed: true });
    (query as any).mockResolvedValue([
      {
        id: 'user-123',
        nome: 'John Doe',
        email: 'john@example.com',
        senha_hash: 'hashed-password',
        perfil: 'ADMIN',
        ativo: 1,
      },
    ]);
    (compare as any).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'john@example.com',
        senha: 'correct-password',
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.id).toBe('user-123');
    expect(data.user.email).toBe('john@example.com');

    // Verifica que o cookie foi setado
    expect(res.cookies.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringContaining('auth'),
      })
    );

    // Verifica que rate limit foi resetado
    expect(resetRateLimit).toHaveBeenCalled();

    // Verifica que ultimo_acesso foi atualizado
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE usuarios SET ultimo_acesso'),
      expect.any(Array)
    );
  });

  test('Senha inválida retorna 401', async () => {
    (checkRateLimit as any).mockReturnValue({ allowed: true });
    (query as any).mockResolvedValue([
      {
        id: 'user-123',
        nome: 'John Doe',
        email: 'john@example.com',
        senha_hash: 'hashed-password',
        perfil: 'ADMIN',
        ativo: 1,
      },
    ]);
    (compare as any).mockResolvedValue(false); // senha não bate

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'john@example.com',
        senha: 'wrong-password',
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Credenciais inválidas');
  });

  test('Usuário não encontrado retorna 401', async () => {
    (checkRateLimit as any).mockReturnValue({ allowed: true });
    (query as any).mockResolvedValue([]); // não encontrado

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        senha: 'password',
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(401);
  });

  test('Conta desativada retorna 403', async () => {
    (checkRateLimit as any).mockReturnValue({ allowed: true });
    (query as any).mockResolvedValue([
      {
        id: 'user-123',
        nome: 'John Doe',
        email: 'john@example.com',
        senha_hash: 'hashed-password',
        perfil: 'ADMIN',
        ativo: 0, // desativado
      },
    ]);
    (compare as any).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'john@example.com',
        senha: 'correct-password',
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('desativada');
  });

  test('Rate limit excedido retorna 429 com Retry-After', async () => {
    (checkRateLimit as any).mockReturnValue({
      allowed: false,
      retryAfterMs: 300000, // 5 minutos
    });

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'john@example.com',
        senha: 'password',
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain('Muitas tentativas');
    expect(res.headers.get('Retry-After')).toBe('300'); // 5 minutos em segundos
  });

  test('Email vazio retorna 400', async () => {
    (checkRateLimit as any).mockReturnValue({ allowed: true });

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: '',
        senha: 'password',
      }),
    });

    const res: any = await POST(req);
    expect(res.status).toBe(400);
  });
});
