import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PUT, DELETE } from '@/app/api/notas-empenho/[id]/route';
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

describe('Integração API Notas de Empenho [id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PUT — Atualizar Nota de Empenho', () => {
    test('Atualização válida retorna 200', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      const { withTransaction } = await import('@/lib/db');
      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[{ numero: 'NE-001', valor: 10000, status: 'EMITIDO' }]]) // SELECT for UPDATE
            .mockResolvedValueOnce([]) // verificação número duplicado
            .mockResolvedValueOnce([[{ total_pago: 3000 }]]) // OPs já pagas
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
            .mockResolvedValueOnce([{ affectedRows: 1 }]), // INSERT auditoria
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'PUT',
        body: JSON.stringify({
          numero: 'NE-001',
          valor: 8000, // reduz, mas acima do total já pago
        }),
      });

      const res: any = await PUT(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(200);
    });

    test('Reduzir valor abaixo do total já pago retorna 409', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      const { withTransaction } = await import('@/lib/db');
      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[{ numero: 'NE-001', valor: 10000, status: 'EMITIDO' }]]) // SELECT for UPDATE
            .mockResolvedValueOnce([]) // número check
            .mockResolvedValueOnce([[{ total_pago: 5000 }]]), // OPs já pagas (5k)
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'PUT',
        body: JSON.stringify({
          numero: 'NE-001',
          valor: 4000, // menor que 5k já pago → falha
        }),
      });

      const res: any = await PUT(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('saldo');
    });

    test('Número duplicado com outro registro retorna 409', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      const { withTransaction } = await import('@/lib/db');
      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[{ numero: 'NE-001', valor: 10000 }]]) // SELECT for UPDATE
            .mockResolvedValueOnce([[{ id: 'ne-999' }]]), // outro registro com este número
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'PUT',
        body: JSON.stringify({
          numero: 'NE-EXISTENTE', // já usado por outro
          valor: 10000,
        }),
      });

      const res: any = await PUT(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(409);
    });
  });

  describe('DELETE — Cancelar Nota de Empenho', () => {
    test('Cancelar NE sem OPs vinculadas retorna 200', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      const { withTransaction } = await import('@/lib/db');
      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[{ numero: 'NE-001' }]]) // SELECT for UPDATE
            .mockResolvedValueOnce([[{ total_pago: 0 }]]) // nenhuma OP
            .mockResolvedValueOnce([{ affectedRows: 1 }]), // UPDATE status = CANCELADO
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'DELETE',
      });

      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(200);
    });

    test('Cancelar NE com OPs vinculadas retorna 409', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      const { withTransaction } = await import('@/lib/db');
      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[{ numero: 'NE-001' }]]) // SELECT for UPDATE
            .mockResolvedValueOnce([[{ total_pago: 3 }]]), // 3 OPs vinculadas
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'DELETE',
      });

      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('3'); // menciona a contagem de OPs
    });

    test('Cancelar NE inexistente retorna 404', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      const { withTransaction } = await import('@/lib/db');
      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn().mockResolvedValueOnce([[]]), // não encontrada
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-inexistente', {
        method: 'DELETE',
      });

      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'ne-inexistente' }) });
      expect(res.status).toBe(404);
    });
  });
});
