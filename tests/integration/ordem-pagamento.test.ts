import { describe, test, expect, vi, beforeEach } from 'vitest';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';

// Mock DB
vi.mock('@/lib/db', () => {
  return {
    query: vi.fn(),
    withTransaction: vi.fn(async (callback: any) => {
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
          if (queryStr.includes('SELECT id, valor, status FROM notas_empenho')) {
            return [[{ id: 'ne-1', valor: 1000, status: 'EMITIDO' }]]; // NE de R$ 1000
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
          if (queryStr.includes('SELECT id, valor, status FROM notas_empenho')) {
            return [[{ id: 'ne-1', valor: 1000, status: 'EMITIDO' }]];
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

    expect(params[17]).toBe(100); // vPagamento
    expect(params[18]).toBe(1.5); // finalIrrf (recalculado: 1.5% do valor a pagar)
    expect(params[19]).toBe(0.01); // finalIss (não é mais recalculado por perfil, mantém o valor enviado)
    expect(params[20]).toBe(11.0); // finalInss (recalculado: 11% do valor a pagar)
    expect(params[21]).toBe(2.5); // finalSestSenat (recalculado: 2.5% do valor a pagar)
    expect(params[22]).toBe(20.0); // finalPatronal (recalculado: 20% do valor a pagar)
    expect(params[23]).toBe(0); // finalOutros (zerado à força para perfis não-ADMIN)
    expect(params[24]).toBe(35.01); // finalTotalDescontos (soma dos descontos recalculados)
    expect(params[25]).toBe(64.99); // finalLiquido (valor a pagar - total de descontos)
  });
});
