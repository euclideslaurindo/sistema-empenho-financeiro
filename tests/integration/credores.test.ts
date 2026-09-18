import { describe, test, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/credores/route';
import { NextRequest } from 'next/server';

// Mock do módulo de banco de dados
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

// Mock da autenticação
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => {
    return { status: 401, json: async () => ({ error: 'Nao autenticado' }) };
  }
}));

import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

describe('Integração API Credores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('GET /api/credores retorna 401 sem autenticação', async () => {
    (getAuthUser as any).mockResolvedValue(null);
    
    const req = new NextRequest('http://localhost:3000/api/credores', { method: 'GET' });
    const res: any = await GET(req);
    
    expect(res.status).toBe(401);
  });

  test('POST /api/credores cria credor com dados válidos', async () => {
    (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });
    (query as any).mockResolvedValue([{ id: '123' }]); // Mock retorno de checagem do usuario
    
    const credorData = {
      nome: 'Empresa Teste LTDA',
      cpfCnpj: '11.222.333/0001-81'
    };
    
    const req = new NextRequest('http://localhost:3000/api/credores', {
      method: 'POST',
      body: JSON.stringify(credorData)
    });
    
    const res: any = await POST(req);
    const data = await res.json();
    
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.id).toBeDefined();
    expect(query).toHaveBeenCalled();
  });

  test('POST /api/credores falha sem nome ou cpfCnpj', async () => {
    (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });
    
    const req = new NextRequest('http://localhost:3000/api/credores', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Teste Sem CPF' })
    });
    
    const res: any = await POST(req);
    const data = await res.json();
    
    expect(res.status).toBe(400);
    expect(data.error).toContain('CPF/CNPJ e Nome são obrigatórios');
  });
});
