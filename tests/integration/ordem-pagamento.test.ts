import { describe, test, expect, vi, beforeEach } from 'vitest';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';

// Mock DB
vi.mock('@/lib/db', () => {
  return {
    query: vi.fn(),
    withTransaction: vi.fn(async (callback) => {
      // Mock the connection object
      const conn = {
        execute: vi.fn()
      };
      return await callback(conn);
    }),
  };
});

import { withTransaction } from '@/lib/db';

describe('Integração OrdemPagamentoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Teste 1: Impede criação de OP com valor <= 0', async () => {
    const rawData = {
      numeroEmpenho: '2026.NE.0001',
      valorPagamento: 0
    };

    const result = await OrdemPagamentoService.criar(rawData, 'user-id-123', 'ADMIN');
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(400); // Validation error
      expect(result.error).toContain('Dados inválidos');
    }
  });

  test('Teste 2: Impede criação de OP se o valor exceder o saldo da NE', async () => {
    (withTransaction as any).mockImplementation(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation((queryStr: string, params: any[]) => {
          if (queryStr.includes('SELECT id, valor FROM notas_empenho')) {
            return [[{ id: 'ne-1', valor: 1000 }]]; // NE de R$ 1000
          }
          if (queryStr.includes('SELECT COALESCE(SUM(valor_pagamento), 0)')) {
            return [[{ total_pago: 800 }]]; // Já pago R$ 800 (Saldo R$ 200)
          }
          return [[]];
        })
      };
      
      try {
        return await callback(conn);
      } catch(e) {
        throw e;
      }
    });

    const rawData = {
      numeroEmpenho: '2026.NE.0001',
      valorPagamento: 500 // Tenta pagar R$ 500 num saldo de R$ 200
    };

    const result = await OrdemPagamentoService.criar(rawData, 'user-id-123', 'ADMIN');
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(422);
      expect(result.error).toContain('Saldo insuficiente');
    }
  });

  test('Teste 3: RBAC recálculo de impostos para perfil GESTOR', async () => {
    const executeSpy = vi.fn();

    (withTransaction as any).mockImplementation(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation((queryStr: string, params: any[]) => {
          executeSpy(queryStr, params);
          if (queryStr.includes('SELECT id, valor FROM notas_empenho')) {
            return [[{ id: 'ne-1', valor: 1000 }]]; 
          }
          if (queryStr.includes('SELECT COALESCE(SUM(valor_pagamento), 0)')) {
            return [[{ total_pago: 0 }]]; 
          }
          if (queryStr.includes('SELECT CAST(SUBSTRING_INDEX(numero_empenho')) {
            return [[{ seq: 1 }]]; 
          }
          if (queryStr.includes('SELECT CAST(sub AS UNSIGNED)')) {
            return [[{ seq: 1 }]]; 
          }
          return [[]];
        })
      };
      return await callback(conn);
    });

    // Usuário hacker tenta enviar uma OP de R$ 100 com impostos fraudulentos (R$ 0,01 cada)
    const rawData = {
      numeroEmpenho: '2026.NE.0001',
      valorPagamento: 100,
      irrf: 0.01,
      iss: 0.01,
      inss: 0.01,
      sestSenat: 0.01,
      patronal: 0.01,
      totalDescontos: 0.05,
      valorLiquido: 99.95
    };

    const result = await OrdemPagamentoService.criar(rawData, 'user-id-123', 'GESTOR');
    
    expect(result.success).toBe(true);

    // Encontra a chamada de INSERT para conferir os parâmetros
    const insertCall = executeSpy.mock.calls.find((call: any[]) => call[0].includes('INSERT INTO ordens_pagamento'));
    expect(insertCall).toBeDefined();

    const params = insertCall[1];
    
    expect(params[23]).toBe(100); // vPagamento
    expect(params[24]).toBe(1.5); // finalIrrf
    expect(params[25]).toBe(5.0); // finalIss
    expect(params[26]).toBe(11.0); // finalInss
    expect(params[27]).toBe(2.5); // finalSestSenat
    expect(params[28]).toBe(20.0); // finalPatronal
    expect(params[30]).toBe(40.0); // finalTotalDescontos
    expect(params[31]).toBe(60.0); // finalLiquido
  });
});
