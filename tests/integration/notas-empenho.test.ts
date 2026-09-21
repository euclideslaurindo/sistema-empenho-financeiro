import { describe, test, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/notas-empenho/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Não autenticado' }) })
}));

import { getAuthUser } from '@/lib/auth';

describe('Integração API Notas de Empenho', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST — Criar Nota de Empenho', () => {
    test('Criação válida retorna 201', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });
      (global.crypto.randomUUID as any) = () => 'ne-uuid-123';

      const { withTransaction } = await import('@/lib/db');
      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn()
            .mockResolvedValueOnce([]) // verificação de duplicidade
            .mockResolvedValueOnce([{ affectedRows: 1 }]), // INSERT
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho', {
        method: 'POST',
        body: JSON.stringify({
          numero: 'NE-2026-001',
          valor: '15420.00',
          dataPagamento: '2026-12-31',
          unidadeOrcamentaria: 'Secretaria da Fazenda',
          elemento: '3.3.90.36',
        }),
      });

      const res: any = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.id).toBeDefined();
    });

    test('Valor <= 0 retorna 400 (Zod validation)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho', {
        method: 'POST',
        body: JSON.stringify({
          numero: 'NE-2026-001',
          valor: '0', // inválido
        }),
      });

      const res: any = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test('Número duplicado retorna 409', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      const { withTransaction } = await import('@/lib/db');
      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[{ id: 'ne-existing' }]]), // já existe
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho', {
        method: 'POST',
        body: JSON.stringify({
          numero: 'NE-2026-001',
          valor: '15420.00',
        }),
      });

      const res: any = await POST(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('já está cadastrada');
    });

    test('Sem autenticação retorna 401', async () => {
      (getAuthUser as any).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/notas-empenho', {
        method: 'POST',
        body: JSON.stringify({ numero: 'NE-001', valor: '100' }),
      });

      const res: any = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  describe('GET — Listar Notas de Empenho', () => {
    test('GET sem parâmetros retorna lista paginada', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      const { query } = await import('@/lib/db');
      (query as any)
        .mockResolvedValueOnce([{ total: 50 }]) // COUNT total
        .mockResolvedValueOnce([
          { id: 'ne-1', numero: 'NE-001', valor: 1000 },
          { id: 'ne-2', numero: 'NE-002', valor: 2000 },
        ]); // LIMIT/OFFSET resultados

      const req = new NextRequest('http://localhost:3000/api/notas-empenho');
      const res: any = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.totalPages).toBe(1); // 50 total, default 50/page
    });

    test('GET com ?numero= retorna NE específica com saldoDisponivel', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      const { query } = await import('@/lib/db');
      (query as any).mockResolvedValueOnce([
        {
          id: 'ne-1',
          numero: 'NE-2026-001',
          valor: 10000,
          saldoDisponivel: 5000,
        },
      ]);

      const req = new NextRequest('http://localhost:3000/api/notas-empenho?numero=NE-2026-001');
      const res: any = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ne.saldoDisponivel).toBe(5000);
    });

    test('GET com ?numero= NE não existente retorna 404', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      const { query } = await import('@/lib/db');
      (query as any).mockResolvedValueOnce([]); // não encontrada

      const req = new NextRequest('http://localhost:3000/api/notas-empenho?numero=NE-INEXISTENTE');
      const res: any = await GET(req);

      expect(res.status).toBe(404);
    });
  });
});
