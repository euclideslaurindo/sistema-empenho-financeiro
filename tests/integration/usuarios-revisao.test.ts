import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Revisão da aba 8 (Usuários), servidor: perfis Administrador/Gestor/Consulta
// e troca de perfil (U1), senha mínima na criação (U2) e exclusão que
// preserva o "quem fez" (U3).

vi.mock('@/lib/db', () => ({ query: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Não autenticado' }) }),
}));
vi.mock('bcryptjs', () => ({ hash: vi.fn(async () => 'hash') }));

import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { POST } from '@/app/api/usuarios/route';
import { PUT, DELETE } from '@/app/api/usuarios/[id]/route';

const criar = async (body: any) => {
  const res: any = await POST(new NextRequest('http://localhost:3000/api/usuarios', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};
const put = async (id: string, body: any) => {
  const res: any = await PUT(new NextRequest(`http://localhost:3000/api/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });
  return { status: res.status, body: await res.json() };
};
const insertDoUsuario = () => (query as any).mock.calls.find((c: any[]) => String(c[0]).startsWith('INSERT INTO usuarios'));

beforeEach(() => {
  vi.clearAllMocks();
  (getAuthUser as any).mockResolvedValue({ id: 'admin-2', perfil: 'ADMIN' });
  (query as any).mockImplementation(async (sql: string) => (sql.startsWith('SELECT id FROM usuarios') ? [] : { affectedRows: 1 }));
});

describe('U1/U2: criar usuário', () => {
  test.each(['ADMIN', 'GESTOR', 'CONSULTA'])('perfil %s é gravado como escolhido', async (perfil: string) => {
    const r = await criar({ nome: 'TESTE', email: 't@x.gov.br', senha: '12345678', perfil });
    expect(r.status).toBe(201);
    expect(insertDoUsuario()[1][4]).toBe(perfil);
  });

  test('sem perfil (ou "USER", da tela antiga): Gestor', async () => {
    await criar({ nome: 'TESTE', email: 't@x.gov.br', senha: '12345678' });
    expect(insertDoUsuario()[1][4]).toBe('GESTOR');
    vi.clearAllMocks();
    await criar({ nome: 'TESTE', email: 't@x.gov.br', senha: '12345678', perfil: 'USER' });
    expect(insertDoUsuario()[1][4]).toBe('GESTOR');
  });

  test('perfil inválido: 400 e nada gravado', async () => {
    const r = await criar({ nome: 'TESTE', email: 't@x.gov.br', senha: '12345678', perfil: 'SUPER' });
    expect(r.status).toBe(400);
    expect(insertDoUsuario()).toBeUndefined();
  });

  test.each(['1', '1234567'])('senha "%s" (menos de 8): 400 e nada gravado', async (senha: string) => {
    const r = await criar({ nome: 'TESTE', email: 't@x.gov.br', senha, perfil: 'GESTOR' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('A senha deve ter no mínimo 8 caracteres.');
    expect(insertDoUsuario()).toBeUndefined();
  });
});

describe('U1: trocar o perfil', () => {
  test('troca para Consulta', async () => {
    (query as any).mockImplementation(async (sql: string) => (sql.startsWith('SELECT id FROM usuarios') ? [{ id: 'user-3' }] : { affectedRows: 1 }));
    const r = await put('user-3', { perfil: 'CONSULTA' });
    expect(r.status).toBe(200);
    const upd = (query as any).mock.calls.find((c: any[]) => String(c[0]).startsWith('UPDATE usuarios SET perfil'));
    expect(upd[1]).toEqual(['CONSULTA', 'user-3']);
  });

  test.each([
    ['admin-2', 'CONSULTA', 400],
    ['user-admin-1', 'CONSULTA', 403],
    ['user-3', 'SUPER', 400],
  ])('%s → %s: %d, sem UPDATE', async (id: string, perfil: string, status: number) => {
    const r = await put(id, { perfil });
    expect(r.status).toBe(status);
    expect((query as any).mock.calls.some((c: any[]) => String(c[0]).startsWith('UPDATE'))).toBe(false);
  });

  test('bloquear continua funcionando (sem "perfil" no corpo)', async () => {
    const r = await put('user-3', { ativo: 0 });
    expect(r.status).toBe(200);
    expect((query as any).mock.calls.find((c: any[]) => String(c[0]).startsWith('UPDATE usuarios SET ativo'))[1]).toEqual([0, 'user-3']);
  });
});

describe('U3: excluir só quem nunca registrou nada', () => {
  const excluir = async (uso: Record<string, number>) => {
    (query as any).mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT id FROM usuarios')) return [{ id: 'user-3' }];
      if (sql.includes('AS auditoria')) return [{ ops: 0, nes: 0, credores: 0, darfs: 0, auditoria: 0, ...uso }];
      return { affectedRows: 1 };
    });
    const res: any = await DELETE(new NextRequest('http://localhost:3000/api/usuarios/user-3', { method: 'DELETE' }), { params: Promise.resolve({ id: 'user-3' }) });
    return { status: res.status, body: await res.json() };
  };
  const apagou = () => (query as any).mock.calls.some((c: any[]) => String(c[0]).startsWith('DELETE FROM usuarios'));

  test('quem cadastrou NE (sem OP) não é excluído', async () => {
    const r = await excluir({ nes: 2 });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('Não é possível excluir: este usuário tem 2 nota(s) de empenho. Use "Bloquear" para tirar o acesso e preservar o histórico.');
    expect(apagou()).toBe(false);
  });

  test('a mensagem lista tudo o que ele registrou', async () => {
    const r = await excluir({ credores: 1, auditoria: 5, darfs: 3 });
    expect(r.body.error).toContain('1 credor(es), 3 DARF(s), 5 registro(s) na auditoria');
  });

  test('sem nenhum registro: exclui', async () => {
    const r = await excluir({});
    expect(r.status).toBe(200);
    expect(apagou()).toBe(true);
  });

  test('a consulta olha as cinco tabelas', async () => {
    await excluir({});
    const [sql, params] = (query as any).mock.calls.find((c: any[]) => String(c[0]).includes('AS auditoria'));
    for (const t of ['ordens_pagamento', 'notas_empenho', 'credores', 'darf_acompanhamento', 'auditoria_financeira']) expect(sql).toContain(t);
    expect(params).toEqual(['user-3', 'user-3', 'user-3', 'user-3', 'user-3']);
  });
});
