import { describe, test, expect, vi, beforeEach } from 'vitest';
import { LiquidacaoService } from '@/lib/services/liquidacao.service';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(async (callback: any) => {
    const conn = { execute: vi.fn() };
    return await callback(conn);
  }),
}));

import { withTransaction } from '@/lib/db';

describe('LiquidacaoService.criar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const payloadBase = {
    notas_empenho_id: 'ne-1',
    numero_liquidacao: 'LIQ-001',
    valor_liquidado: 500,
    data_liquidacao: '2026-09-28',
  };

  test('usuário CONSULTA não pode criar liquidação (403)', async () => {
    const resultado = await LiquidacaoService.criar(payloadBase, 'user-1', 'CONSULTA');
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(resultado.status).toBe(403);
  });

  test('empenho inexistente retorna 422', async () => {
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const conn = { execute: vi.fn().mockResolvedValue([[]]) };
      return await callback(conn);
    });

    const resultado = await LiquidacaoService.criar(payloadBase, 'user-1', 'GESTOR');
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.status).toBe(422);
      expect(resultado.error).toContain('não encontrado');
    }
  });

  test('valor acima do saldo a liquidar retorna 422 com a mensagem correta', async () => {
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('FROM notas_empenho')) return [[{ id: 'ne-1', valor: 1000 }]];
          if (sql.includes('SUM(valor_liquidado)')) return [[{ total_liquidado: 800 }]]; // saldo = 200
          return [[]];
        }),
      };
      return await callback(conn);
    });

    const resultado = await LiquidacaoService.criar({ ...payloadBase, valor_liquidado: 500 }, 'user-1', 'GESTOR');
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.status).toBe(422);
      expect(resultado.error).toContain('excede o saldo');
      expect(resultado.error).toContain('200,00');
    }
  });

  test('liquidação parcial atualiza status da NE para "PARCIALMENTE PAGO" (vocabulário da UI)', async () => {
    const executeSpy = vi.fn();
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
          executeSpy(sql, params);
          if (sql.includes('FROM notas_empenho') && sql.includes('FOR UPDATE')) return [[{ id: 'ne-1', valor: 1000 }]];
          if (sql.includes('SUM(valor_liquidado)')) return [[{ total_liquidado: 0 }]];
          return [[]];
        }),
      };
      return await callback(conn);
    });

    const resultado = await LiquidacaoService.criar({ ...payloadBase, valor_liquidado: 500 }, 'user-1', 'GESTOR');
    expect(resultado.success).toBe(true);

    const updateCall = executeSpy.mock.calls.find((call: any[]) => call[0].includes('UPDATE notas_empenho SET status'));
    expect(updateCall).toBeDefined();
    expect(updateCall[1][0]).toBe('PARCIALMENTE PAGO');
  });

  test('liquidação total atualiza status da NE para "LIQUIDADO" (vocabulário da UI)', async () => {
    const executeSpy = vi.fn();
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
          executeSpy(sql, params);
          if (sql.includes('FROM notas_empenho') && sql.includes('FOR UPDATE')) return [[{ id: 'ne-1', valor: 1000 }]];
          if (sql.includes('SUM(valor_liquidado)')) return [[{ total_liquidado: 0 }]];
          return [[]];
        }),
      };
      return await callback(conn);
    });

    const resultado = await LiquidacaoService.criar({ ...payloadBase, valor_liquidado: 1000 }, 'user-1', 'GESTOR');
    expect(resultado.success).toBe(true);

    const updateCall = executeSpy.mock.calls.find((call: any[]) => call[0].includes('UPDATE notas_empenho SET status'));
    expect(updateCall[1][0]).toBe('LIQUIDADO');
  });

  test('número de liquidação duplicado retorna 409', async () => {
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('FROM notas_empenho') && sql.includes('FOR UPDATE')) return [[{ id: 'ne-1', valor: 1000 }]];
          if (sql.includes('SUM(valor_liquidado)')) return [[{ total_liquidado: 0 }]];
          if (sql.includes('INSERT INTO liquidacoes')) {
            const err: any = new Error("Duplicate entry 'LIQ-001'");
            err.code = 'ER_DUP_ENTRY';
            throw err;
          }
          return [[]];
        }),
      };
      return await callback(conn);
    });

    const resultado = await LiquidacaoService.criar(payloadBase, 'user-1', 'GESTOR');
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(resultado.status).toBe(409);
  });

  test('payload inválido (Zod) retorna 400', async () => {
    const resultado = await LiquidacaoService.criar({ ...payloadBase, valor_liquidado: -10 }, 'user-1', 'GESTOR');
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(resultado.status).toBe(400);
  });
});
