import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextRequest } from 'next/server';

// Revisão da aba 7 (Configurações): rotas de setup removidas e fora da lista
// pública (CF1), setup da E2E só em banco local (CF1), página de
// Configurações sem as abas falsas (CF2) e valores em reais (CF3).

const mysqlMock = vi.hoisted(() => ({ createConnection: vi.fn() }));
vi.mock('mysql2/promise', () => ({ default: mysqlMock, ...mysqlMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/configuracoes' }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { proxy } from '@/proxy';
import globalSetup from '../../e2e/global-setup';
import { useAppStore } from '@/lib/store';
import Configuracoes from '@/app/configuracoes/page';
import {
  diffFaixas,
  diffMunicipio,
  diffParametros,
  reais,
  validarFaixasIrrf,
  validarMunicipio,
  validarParametrosTransporte,
  valorDoParametro,
} from '@/lib/transporte-admin';

const raiz = path.resolve(__dirname, '../..');

describe('CF1: rotas de setup', () => {
  test('as três rotas não existem mais', () => {
    for (const rota of ['app/api/setup/route.ts', 'app/api/setup/optimize/route.ts', 'app/api/setup/migrate/route.ts']) {
      expect(fs.existsSync(path.join(raiz, rota))).toBe(false);
    }
  });

  test.each(['/api/setup', '/api/setup/optimize', '/api/setup/migrate'])('%s sem login: 401 (não é mais pública)', async (rota: string) => {
    const res = await proxy(new NextRequest(`http://localhost:3000${rota}`));
    expect(res.status).toBe(401);
  });

  test('a lista pública do proxy não cita mais /api/setup (login e /api/auth continuam)', () => {
    const codigo = fs.readFileSync(path.join(raiz, 'proxy.ts'), 'utf8');
    expect(codigo).not.toContain('/api/setup');
    expect(codigo).toContain("pathname === '/login'");
    expect(codigo).toContain("pathname.startsWith('/api/auth')");
  });
});

describe('CF1: setup da E2E', () => {
  const ambiente = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    mysqlMock.createConnection.mockResolvedValue({ query: vi.fn(), execute: vi.fn(), end: vi.fn() });
  });
  afterEach(() => {
    process.env = { ...ambiente };
  });

  test('sem ENABLE_SETUP=true não conecta em banco nenhum', async () => {
    delete process.env.ENABLE_SETUP;
    await globalSetup();
    expect(mysqlMock.createConnection).not.toHaveBeenCalled();
  });

  test('banco que não é local: recusa, sem conectar', async () => {
    process.env.ENABLE_SETUP = 'true';
    process.env.MYSQL_HOST = '10.0.0.5';
    await expect(globalSetup()).rejects.toThrow('não é local');
    expect(mysqlMock.createConnection).not.toHaveBeenCalled();
  });

  test('banco local (CI): cria a tabela e o admin', async () => {
    process.env.ENABLE_SETUP = 'true';
    process.env.MYSQL_HOST = '127.0.0.1';
    const conn = { query: vi.fn(), execute: vi.fn(), end: vi.fn() };
    mysqlMock.createConnection.mockResolvedValue(conn);
    await globalSetup();
    expect(conn.query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS usuarios');
    expect(conn.execute.mock.calls[0][0]).toContain('INSERT IGNORE INTO usuarios');
    expect(conn.end).toHaveBeenCalled();
  });
});

describe('CF2: página de Configurações', () => {
  afterEach(() => useAppStore.setState({ userProfile: null }));

  test('ADMIN: cartões de Retenções e Elementos, e a conta', () => {
    useAppStore.setState({ userProfile: { id: 'u', nome: 'X', email: 'x', perfil: 'ADMIN' } });
    render(<Configuracoes />);
    expect(screen.getByRole('link', { name: /Retenções e Descontos/ })).toHaveAttribute('href', '/configuracoes/retencoes');
    expect(screen.getByRole('link', { name: /Elementos e Subelementos/ })).toHaveAttribute('href', '/configuracoes/elementos');
    expect(screen.getByRole('link', { name: /Meu Perfil/ })).toHaveAttribute('href', '/perfil');
  });

  test('Gestor: só a conta, sem os atalhos de administrador', () => {
    useAppStore.setState({ userProfile: { id: 'u', nome: 'X', email: 'x', perfil: 'USER' as any } });
    render(<Configuracoes />);
    expect(screen.queryByRole('link', { name: /Retenções e Descontos/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Alterar senha/ })).toBeInTheDocument();
  });

  test('sem as abas e opções de enfeite', () => {
    useAppStore.setState({ userProfile: { id: 'u', nome: 'X', email: 'x', perfil: 'ADMIN' } });
    render(<Configuracoes />);
    for (const t of [/Sessões Ativas/, /Windows \/ Chrome/, /duas etapas/, /Notificações/, /Nível: Administrador/, /Autopreencher/, /Salvar Alterações/]) {
      expect(screen.queryByText(t)).toBeNull();
    }
  });

  test('"Alterar senha" abre a troca de senha', () => {
    render(<Configuracoes />);
    fireEvent.click(screen.getByRole('button', { name: /Alterar senha/ }));
    expect(screen.getByLabelText('Confirmar Nova Senha')).toBeInTheDocument();
  });
});

describe('CF3: valores em reais', () => {
  test.each([
    ['2.428', 2428],
    ['2.428,80', 2428.8],
    ['2428.80', 2428.8],
    ['2428,8', 2428.8],
    ['607,20', 607.2],
    [607.2, 607.2],
  ])('reais(%j) = %d', (v: any, esperado: number) => {
    expect(reais(v)).toBe(esperado);
  });

  test('vazio e inválido viram NaN', () => {
    expect(reais('')).toBeNaN();
    expect(reais('abc')).toBeNaN();
  });

  test('parâmetros do transporte: só os em R$ mudam de leitura; coeficiente e % ficam como antes', () => {
    expect(valorDoParametro('redutor_constante', '2.428')).toBe(2428);
    expect(valorDoParametro('desconto_simplificado', '607,20')).toBe(607.2);
    expect(valorDoParametro('redutor_coeficiente', '0.133145')).toBe(0.133145);
    expect(valorDoParametro('inss_percentual', '11')).toBe(11);
  });

  test('faixas do IRRF: limite "2.428" é 2428 (antes 2,428 passava como faixa válida)', () => {
    const faixas = [
      { limiteAte: '2.428', aliquota: '0', parcelaDeduzir: '0' },
      { limiteAte: '2.826,65', aliquota: '7,5', parcelaDeduzir: '182,16' },
      { limiteAte: '', aliquota: '27,5', parcelaDeduzir: '896' },
    ];
    expect(validarFaixasIrrf(faixas as any)).toEqual([]);
    const linhas = diffFaixas([{ ...faixas[0], limiteAte: '2.259,20' }, faixas[1], faixas[2]] as any, faixas as any);
    expect(linhas).toEqual(['Faixa 1: limite 2259,2 → 2428']);
  });

  test('transporte e ISS: conferência e validação com os valores em reais', () => {
    expect(validarParametrosTransporte({
      base_percentual: '20', inss_percentual: '11', patronal_percentual: '20', sest_percentual: '1,5', senat_percentual: '1',
      irrf_tributavel_percentual: '60', desconto_simplificado: '607,20', redutor_constante: '978,62', redutor_coeficiente: '0,133145',
    })).toEqual([]);
    expect(diffParametros({ redutor_constante: '978,62' }, { redutor_constante: '1.978,62' })).toContain('Redutor — constante (R$): 978,62 → 1978,62');
    expect(validarMunicipio({ nome: 'TESTE', uf: 'PE', aliquota: '5', taxaExpediente: '1.500' } as any)).toEqual([]);
    expect(diffMunicipio({ nome: 'TESTE', uf: 'PE', aliquota: '5', taxaExpediente: '15', apelidos: '', ativo: true } as any,
      { nome: 'TESTE', uf: 'PE', aliquota: '5', taxaExpediente: '1.500', apelidos: '', ativo: true } as any))
      .toEqual(['TESTE: taxa de expediente 15 → 1500']);
  });
});
