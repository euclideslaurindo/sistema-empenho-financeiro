import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PUT, DELETE } from '@/app/api/usuarios/[id]/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Não autenticado' }) }),
}));

import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

describe('Integração API Usuários [id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DELETE — Excluir usuário', () => {
    test('Não pode excluir a si mesmo (400)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-1', perfil: 'ADMIN' });

      const req = new NextRequest('http://localhost:3000/api/usuarios/admin-1', { method: 'DELETE' });
      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'admin-1' }) });
      expect(res.status).toBe(400);
    });

    test('Não pode excluir o admin raiz (403)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-2', perfil: 'ADMIN' });

      const req = new NextRequest('http://localhost:3000/api/usuarios/user-admin-1', { method: 'DELETE' });
      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'user-admin-1' }) });
      expect(res.status).toBe(403);
    });

    test('Usuário inexistente retorna 404', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-2', perfil: 'ADMIN' });
      (query as any).mockResolvedValueOnce([]); // SELECT existência

      const req = new NextRequest('http://localhost:3000/api/usuarios/inexistente', { method: 'DELETE' });
      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'inexistente' }) });
      expect(res.status).toBe(404);
    });

    test('Usuário com OPs vinculadas não pode ser excluído (409)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-2', perfil: 'ADMIN' });
      (query as any)
        .mockResolvedValueOnce([{ id: 'user-3' }]) // SELECT existência
        .mockResolvedValueOnce([{ id: 'op-1' }]); // SELECT ordens_pagamento vinculadas

      const req = new NextRequest('http://localhost:3000/api/usuarios/user-3', { method: 'DELETE' });
      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'user-3' }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('Bloquear');
    });

    test('Exclusão válida retorna 200', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-2', perfil: 'ADMIN' });
      (query as any)
        .mockResolvedValueOnce([{ id: 'user-3' }]) // SELECT existência
        .mockResolvedValueOnce([]) // sem OPs vinculadas
        .mockResolvedValueOnce({ affectedRows: 1 }); // DELETE

      const req = new NextRequest('http://localhost:3000/api/usuarios/user-3', { method: 'DELETE' });
      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'user-3' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('PUT — Bloquear/Desbloquear usuário', () => {
    test('Não pode alterar o próprio status (400)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-1', perfil: 'ADMIN' });

      const req = new NextRequest('http://localhost:3000/api/usuarios/admin-1', {
        method: 'PUT',
        body: JSON.stringify({ ativo: false }),
      });
      const res: any = await PUT(req, { params: Promise.resolve({ id: 'admin-1' }) });
      expect(res.status).toBe(400);
    });

    test('Não pode alterar o admin raiz (403)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-2', perfil: 'ADMIN' });

      const req = new NextRequest('http://localhost:3000/api/usuarios/user-admin-1', {
        method: 'PUT',
        body: JSON.stringify({ ativo: false }),
      });
      const res: any = await PUT(req, { params: Promise.resolve({ id: 'user-admin-1' }) });
      expect(res.status).toBe(403);
    });

    test('Alteração válida retorna 200', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-2', perfil: 'ADMIN' });
      (query as any).mockResolvedValueOnce({ affectedRows: 1 });

      const req = new NextRequest('http://localhost:3000/api/usuarios/user-3', {
        method: 'PUT',
        body: JSON.stringify({ ativo: false }),
      });
      const res: any = await PUT(req, { params: Promise.resolve({ id: 'user-3' }) });
      expect(res.status).toBe(200);
    });
  });
});
