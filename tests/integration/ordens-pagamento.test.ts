import { describe, test, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/ordens-pagamento/route';
import { NextRequest } from 'next/server';

// Mocks
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(async (callback) => {
    // Simula a injeção da conexão de transação (passando um mock)
    const connectionMock = {
      execute: vi.fn()
    };
    return await callback(connectionMock);
  }),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Nao autenticado' }) })
}));

import { withTransaction } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

describe('Integração API Ordens de Pagamento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('OP com valor maior que o saldo da NE retorna erro 422', async () => {
    (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });
    
    // Configura o mock do withTransaction para injetar o mock que valida saldo
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const connectionMock = {
        execute: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('SELECT id, valor, status FROM notas_empenho')) {
            return [[{ id: '1', valor: 10000, status: 'EMITIDO' }]]; // NE de R$ 10.000
          }
          if (sql.includes('COALESCE(SUM(valor_pagamento), 0)')) {
            return [[{ total_pago: 0 }]]; // Nenhum pagamento feito
          }
          return [[]]; // Default
        })
      };
      return await callback(connectionMock);
    });

    const opData = {
      numeroEmpenho: '2026NE0001',
      valorPagamento: 15000 // Tenta pagar R$ 15.000 numa NE de 10.000
    };
    
    const req = new NextRequest('http://localhost:3000/api/ordens-pagamento', {
      method: 'POST',
      body: JSON.stringify(opData)
    });
    
    const res: any = await POST(req);
    const data = await res.json();
    
    expect(res.status).toBe(422);
    expect(data.error).toContain('Saldo insuficiente');
  });

  test('OP cria corretamente e retorna 201', async () => {
    (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });
    
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const connectionMock = {
        execute: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('SELECT id, valor, status FROM notas_empenho')) {
            return [[{ id: '1', valor: 10000, status: 'EMITIDO' }]];
          }
          if (sql.includes('COALESCE(SUM(valor_pagamento), 0)')) {
            return [[{ total_pago: 0 }]]; 
          }
          if (sql.includes('SELECT COUNT(*) as count FROM ordens_pagamento WHERE numero_empenho')) {
            return [[{ count: 0 }]]; 
          }
          if (sql.includes('SELECT COUNT(*) as count FROM ordens_pagamento WHERE numero_ne')) {
            return [[{ count: 0 }]]; 
          }
          return [[]];
        })
      };
      return await callback(connectionMock);
    });
    
    const opData = {
      numeroEmpenho: '2026NE0001',
      valorPagamento: 5000 
    };
    
    const req = new NextRequest('http://localhost:3000/api/ordens-pagamento', {
      method: 'POST',
      body: JSON.stringify(opData)
    });
    
    const res: any = await POST(req);
    const data = await res.json();
    
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.id).toBeDefined();
    // Saldo inicial 10000, pagou 5000, deve restar 5000
    expect(data.saldoRestante).toBe(5000); 
  });
});
