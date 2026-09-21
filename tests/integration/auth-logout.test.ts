import { describe, test, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/logout/route';
import { AUTH_COOKIE_NAME } from '@/lib/constants';

describe('Integração API Auth Logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Logout retorna 200 e deleta cookie', async () => {
    const res: any = await POST();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verifica que o cookie foi deletado com o nome correto
    expect(res.cookies.delete).toHaveBeenCalledWith(AUTH_COOKIE_NAME);
  });
});
