import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PUT, DELETE } from '@/app/api/credores/[id]/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Não autenticado' }) }),
}));

import { getAuthUser } from '@/lib/auth';
import { withTransaction } from '@/lib/db';

describe('Integração API Credores [id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PUT — Atualizar Credor', () => {
    test('Atualização válida retorna 200', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('FOR UPDATE')) return [[{ id: 'credor-1' }]];
            if (sql.includes('SELECT id, nome FROM credores')) return [[]]; // sem duplicidade
            if (sql.includes('SELECT id FROM usuarios')) return [[{ id: '123' }]];
            if (sql.includes('UPDATE credores')) return [{ affectedRows: 1 }];
            return [[]];
          }),
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/credores/credor-1', {
        method: 'PUT',
        body: JSON.stringify({ nome: 'Empresa X', cpfCnpj: '11.222.333/0001-81' }),
      });

      const res: any = await PUT(req, { params: Promise.resolve({ id: 'credor-1' }) });
      expect(res.status).toBe(200);
    });

    test('CPF/CNPJ duplicado retorna 409', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('FOR UPDATE')) return [[{ id: 'credor-1' }]];
            if (sql.includes('SELECT id, nome FROM credores')) return [[{ id: 'credor-2', nome: 'Outra Empresa' }]];
            return [[]];
          }),
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/credores/credor-1', {
        method: 'PUT',
        body: JSON.stringify({ nome: 'Empresa X', cpfCnpj: '11.222.333/0001-81' }),
      });

      const res: any = await PUT(req, { params: Promise.resolve({ id: 'credor-1' }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('Outra Empresa');
    });

    test('Credor inexistente retorna 404', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = { execute: vi.fn().mockResolvedValueOnce([[]]) };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/credores/inexistente', {
        method: 'PUT',
        body: JSON.stringify({ nome: 'Empresa X', cpfCnpj: '11.222.333/0001-81' }),
      });

      const res: any = await PUT(req, { params: Promise.resolve({ id: 'inexistente' }) });
      expect(res.status).toBe(404);
    });

    test('Sem nome ou CPF/CNPJ retorna 400', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      const req = new NextRequest('http://localhost:3000/api/credores/credor-1', {
        method: 'PUT',
        body: JSON.stringify({ nome: 'Empresa X' }),
      });

      const res: any = await PUT(req, { params: Promise.resolve({ id: 'credor-1' }) });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE — Excluir Credor', () => {
    test('Exclusão sem OPs vinculadas retorna 200', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('FOR UPDATE')) return [[{ cpf_cnpj: '11222333000181' }]];
            if (sql.includes('COUNT(*)')) return [[{ total: 0 }]];
            if (sql.includes('UPDATE credores')) return [{ affectedRows: 1 }];
            return [[]];
          }),
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/credores/credor-1', { method: 'DELETE' });
      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'credor-1' }) });
      expect(res.status).toBe(200);
    });

    test('Exclusão com OPs vinculadas retorna 409', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('FOR UPDATE')) return [[{ cpf_cnpj: '11222333000181' }]];
            if (sql.includes('COUNT(*)')) return [[{ total: 2 }]];
            return [[]];
          }),
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/credores/credor-1', { method: 'DELETE' });
      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'credor-1' }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('2');
    });

    test('Perfil CONSULTA não pode excluir (403)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'CONSULTA' });

      const req = new NextRequest('http://localhost:3000/api/credores/credor-1', { method: 'DELETE' });
      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'credor-1' }) });
      expect(res.status).toBe(403);
    });

    test('Credor inexistente retorna 404', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = { execute: vi.fn().mockResolvedValueOnce([[]]) };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/credores/inexistente', { method: 'DELETE' });
      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'inexistente' }) });
      expect(res.status).toBe(404);
    });
  });
});
