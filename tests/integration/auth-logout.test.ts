import { describe, test, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/logout/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Não autenticado' }) })
}));

import { getAuthUser } from '@/lib/auth';

describe('Integração API Auth Logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Logout com autenticação retorna 200 e deleta cookie', async () => {
    (getAuthUser as any).mockResolvedValue({ id: 'user-123', email: 'user@example.com' });

    const req = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: 'auth_token=some-jwt-token',
      },
    });

    const res: any = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verifica que o cookie foi deletado
    expect(res.cookies.delete).toHaveBeenCalledWith(
      expect.stringContaining('auth')
    );
  });

});
