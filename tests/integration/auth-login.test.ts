import { describe, test, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

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
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limiter';

describe('Integração API Auth Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as any);
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
    (bcrypt.compare as any).mockResolvedValue(true);

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

    // Verifica que o cookie foi setado (rota chama cookies.set(name, value, options))
    expect(res.cookies.set).toHaveBeenCalledWith(
      expect.stringContaining('auth'),
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
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
    (bcrypt.compare as any).mockResolvedValue(false); // senha não bate

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
    expect(data.error).toBe('Usuário ou senha inválidos'); // mesma mensagem do usuário inexistente (não revela quem existe)
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
    (bcrypt.compare as any).mockResolvedValue(true);

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

describe('login por nome de usuário e mensagens (revisão da aba 1)', () => {
  const usuario = (id: string, email: string, ativo = 1) => ({ id, nome: id, email, senha_hash: `hash-${id}`, perfil: 'GESTOR', ativo });
  const logar = async (email: string, senha: string) => {
    const res: any = await POST(new NextRequest('http://localhost:3000/api/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }));
    return { status: res.status, body: await res.json() };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (checkRateLimit as any).mockReturnValue({ allowed: true });
    // a senha certa de cada usuário é "senha-<id>"
    (bcrypt.compare as any).mockImplementation(async (senha: string, hash: string) => hash === `hash-${senha.replace('senha-', '')}`);
  });

  test('"joao" entra como joao, mesmo existindo "joao.silva" (antes o LIKE + LIMIT 1 podia pegar o errado)', async () => {
    (query as any).mockResolvedValueOnce([
      usuario('silva', 'joao.silva.def67890@empenho.local'), // vem primeiro, como o LIKE poderia trazer
      usuario('joao', 'joao.abc12345@empenho.local'),
    ]);
    const r = await logar('joao', 'senha-joao');
    expect(r.status).toBe(200);
    expect(r.body.user.id).toBe('joao');
    // nunca testou a senha contra o "joao.silva"
    expect((bcrypt.compare as any).mock.calls.some((c: any[]) => c[1] === 'hash-silva')).toBe(false);
  });

  test('homônimos (mesmo nome, sufixos diferentes): entra quem tem a senha', async () => {
    (query as any).mockResolvedValueOnce([
      usuario('joao1', 'joao.aaaa1111@empenho.local'),
      usuario('joao2', 'joao.bbbb2222@empenho.local'),
    ]);
    const r = await logar('joao', 'senha-joao2');
    expect(r.status).toBe(200);
    expect(r.body.user.id).toBe('joao2');
  });

  test('usuário inexistente e senha errada: a MESMA mensagem', async () => {
    (query as any).mockResolvedValueOnce([]);
    const inexistente = await logar('ninguem', 'x');
    (query as any).mockResolvedValueOnce([usuario('joao', 'joao.abc12345@empenho.local')]);
    const senhaErrada = await logar('joao', 'senha-outra');
    expect(inexistente).toEqual({ status: 401, body: { error: 'Usuário ou senha inválidos' } });
    expect(senhaErrada).toEqual(inexistente);
  });

  test('conta desativada só é revelada para quem acertou a senha', async () => {
    (query as any).mockResolvedValueOnce([usuario('joao', 'joao.abc12345@empenho.local', 0)]);
    expect((await logar('joao', 'senha-errada')).body.error).toBe('Usuário ou senha inválidos');
    (query as any).mockResolvedValueOnce([usuario('joao', 'joao.abc12345@empenho.local', 0)]);
    const r = await logar('joao', 'senha-joao');
    expect(r.status).toBe(403);
    expect(r.body.error).toContain('desativada');
  });
});
