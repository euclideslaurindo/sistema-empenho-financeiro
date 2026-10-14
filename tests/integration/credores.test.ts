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

  test('POST normaliza município e monta o endereço com ele', async () => {
    (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });
    (query as any).mockResolvedValue([{ id: '123' }]);

    const req = new NextRequest('http://localhost:3000/api/credores', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Empresa Teste LTDA',
        cpfCnpj: '11.222.333/0001-81',
        logradouro: 'Rua A',
        numero: '10',
        cidade: '  Garanhuns  ',
        uf: 'pe',
      }),
    });
    const res: any = await POST(req);
    expect(res.status).toBe(201);

    const insert = (query as any).mock.calls.find((c: any[]) => String(c[0]).includes('INSERT INTO credores'));
    const p = insert[1];
    expect(p[7]).toBe('Rua A, Nº 10, Garanhuns, PE'); // endereco
    expect(p[12]).toBe('Garanhuns'); // cidade
    expect(p[13]).toBe('PE'); // uf
  });

  describe('Município (Expediente) — T33', () => {
    const postar = async (extra: Record<string, unknown>) => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });
      (query as any).mockResolvedValue([{ id: '123' }]);
      const res: any = await POST(
        new NextRequest('http://localhost:3000/api/credores', {
          method: 'POST',
          body: JSON.stringify({ nome: 'Empresa Teste LTDA', cpfCnpj: '11.222.333/0001-81', cidade: 'Garanhuns', uf: 'PE', ...extra }),
        })
      );
      const insert = (query as any).mock.calls.find((c: any[]) => String(c[0]).includes('INSERT INTO credores'));
      return { status: res.status, sql: insert?.[0] as string, expediente: insert?.[1].at(-1) };
    };

    test('grava o município de expediente (trim e espaços colapsados), independente da cidade', async () => {
      const r = await postar({ municipioExpediente: '  Canhotinho   ' });
      expect(r.status).toBe(201);
      expect(r.sql).toContain('municipioExpediente');
      expect(r.expediente).toBe('Canhotinho');
    });

    test('vazio ou ausente vira NULL', async () => {
      expect((await postar({ municipioExpediente: '   ' })).expediente).toBeNull();
      vi.clearAllMocks();
      expect((await postar({})).expediente).toBeNull();
    });

    test('mais de 100 caracteres -> 400 e nada é gravado', async () => {
      const r = await postar({ municipioExpediente: 'x'.repeat(101) });
      expect(r.status).toBe(400);
      expect(r.sql).toBeUndefined();
    });

    test('a listagem (usada também pelas sugestões da OP) devolve municipioExpediente', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'GESTOR' });
      (query as any).mockImplementation(async (sql: string) =>
        sql.includes('COUNT(*)') ? [{ total: 1 }] : [{ id: 'c1', nome: 'Credor', municipioExpediente: 'Canhotinho' }]
      );
      const res: any = await GET(new NextRequest('http://localhost:3000/api/credores?busca=Credor', { method: 'GET' }));
      const data = await res.json();
      expect(data.credores[0].municipioExpediente).toBe('Canhotinho');
      const sql = (query as any).mock.calls.find((c: any[]) => String(c[0]).includes('FROM credores') && !String(c[0]).includes('COUNT'))[0];
      expect(sql).toContain('municipioExpediente');
    });
  });

  test('POST com UF inválida retorna 400', async () => {
    (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });
    const req = new NextRequest('http://localhost:3000/api/credores', {
      method: 'POST',
      body: JSON.stringify({ nome: 'X', cpfCnpj: '11.222.333/0001-81', uf: 'Pernambuco' }),
    });
    const res: any = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('UF inválida');
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
