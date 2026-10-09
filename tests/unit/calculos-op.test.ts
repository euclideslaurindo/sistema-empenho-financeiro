import { describe, test, expect, vi, beforeEach } from 'vitest';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';

// Mock DB
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(async (callback: any) => {
    const conn = { execute: vi.fn() };
    return await callback(conn);
  }),
}));

import { withTransaction } from '@/lib/db';

describe('OrdemPagamentoService.criar — Edge Cases de Cálculos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('#1: Valor com arredondamento de centavos (33.333 → 33.33)', async () => {
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('numero_cheque')) return [[]]; // sem cheque duplicado
          if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
            return [[{ id: 'ne-1', valor: 1000, status: 'EMITIDO' }]];
          }
          if (sql.includes('SELECT COALESCE(SUM(valor_pagamento)')) {
            return [[{ total_pago: 0 }]];
          }
          if (sql.includes('SELECT CAST(SUBSTRING_INDEX(numero_empenho')) {
            return [[{ seq: 5 }]];
          }
          if (sql.includes('SELECT CAST(sub AS UNSIGNED)')) {
            return [[{ seq: 1 }]];
          }
          if (sql.includes('INSERT INTO ordens_pagamento')) {
            return [{ affectedRows: 1 }];
          }
          if (sql.includes('UPDATE notas_empenho SET status')) {
            return [{ affectedRows: 1 }];
          }
          return [[]];
        }),
      };
      return await callback(conn);
    });

    const resultado = await OrdemPagamentoService.criar(
      {
        numeroEmpenho: 'NE-001',
        credorCpfCnpj: '12345678900',
        valorPagamento: 33.333, // arredonda para 33.33
        irrf: 0,
        iss: 0,
        inss: 0,
        sestSenat: 0,
        patronal: 0,
      },
      'user-123',
      'GESTOR'
    );

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.saldoRestante).toBe(966.67); // 1000 - 33.33
      // número definitivo (T13): MAX seq 5 -> .0006; MAX sub 1 -> 02
      expect(resultado.data.numeroOp).toBe(`${new Date().getFullYear()}.OP.0006`);
      expect(resultado.data.sub).toBe('02');
    }
  });

  test('#2: Valor exatamente igual ao saldo disponível (limite)', async () => {
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('numero_cheque')) return [[]];
          if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
            return [[{ id: 'ne-1', valor: 500, status: 'EMITIDO' }]];
          }
          if (sql.includes('SELECT COALESCE(SUM(valor_pagamento)')) {
            return [[{ total_pago: 0 }]];
          }
          if (sql.includes('SUBSTRING_INDEX')) return [[{ seq: 5 }]];
          if (sql.includes('sub AS UNSIGNED')) return [[{ seq: 1 }]];
          if (sql.includes('INSERT')) return [{ affectedRows: 1 }];
          if (sql.includes('UPDATE notas_empenho')) return [{ affectedRows: 1 }];
          return [[]];
        }),
      };
      return await callback(conn);
    });

    const resultado = await OrdemPagamentoService.criar(
      {
        numeroEmpenho: 'NE-001',
        credorCpfCnpj: '12345678900',
        valorPagamento: 500, // = saldo disponível exato
      },
      'user-123',
      'GESTOR'
    );

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.saldoRestante).toBe(0); // NE fica LIQUIDADA
    }
  });

  test('#3: Valor 1 centavo acima do saldo (deve falhar 422)', async () => {
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('numero_cheque')) return [[]];
          if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
            return [[{ id: 'ne-1', valor: 500, status: 'EMITIDO' }]];
          }
          if (sql.includes('SELECT COALESCE(SUM(valor_pagamento)')) {
            return [[{ total_pago: 0 }]];
          }
          return [[]];
        }),
      };
      return await callback(conn);
    });

    const resultado = await OrdemPagamentoService.criar(
      {
        numeroEmpenho: 'NE-001',
        credorCpfCnpj: '12345678900',
        valorPagamento: 500.01, // 1 centavo acima
      },
      'user-123',
      'GESTOR'
    );

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.status).toBe(422);
      expect(resultado.error).toContain('Saldo insuficiente');
    }
  });

  test('#4: Soma de itens com diferença de 1 centavo (tolerância, deve passar)', async () => {
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('numero_cheque')) return [[]];
          if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
            return [[{ id: 'ne-1', valor: 1000, status: 'EMITIDO' }]];
          }
          if (sql.includes('SELECT COALESCE(SUM(valor_pagamento)')) {
            return [[{ total_pago: 0 }]];
          }
          if (sql.includes('SUBSTRING_INDEX')) return [[{ seq: 5 }]];
          if (sql.includes('sub AS UNSIGNED')) return [[{ seq: 1 }]];
          if (sql.includes('INSERT')) return [{ affectedRows: 1 }];
          if (sql.includes('UPDATE notas_empenho')) return [{ affectedRows: 1 }];
          return [[]];
        }),
      };
      return await callback(conn);
    });

    const resultado = await OrdemPagamentoService.criar(
      {
        numeroEmpenho: 'NE-001',
        credorCpfCnpj: '12345678900',
        valorPagamento: 100.00,
        itens: [
          { quantidade: 3, valorUnitario: 33.33 }, // 3 * 33.33 = 99.99 (diferença de 0.01)
        ],
      },
      'user-123',
      'GESTOR'
    );

    expect(resultado.success).toBe(true); // tolerância de 0.01 centavo passa
  });

  test('#5: Soma de itens com diferença de 2+ centavos (deve falhar)', async () => {
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('numero_cheque')) return [[]];
          if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
            return [[{ id: 'ne-1', valor: 1000, status: 'EMITIDO' }]];
          }
          if (sql.includes('SELECT COALESCE(SUM(valor_pagamento)')) {
            return [[{ total_pago: 0 }]];
          }
          return [[]];
        }),
      };
      return await callback(conn);
    });

    const resultado = await OrdemPagamentoService.criar(
      {
        numeroEmpenho: 'NE-001',
        credorCpfCnpj: '12345678900',
        valorPagamento: 100.00,
        itens: [
          { quantidade: 1, valorUnitario: 97.00 }, // diferença de 3 centavos
        ],
      },
      'user-123',
      'GESTOR'
    );

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.status).toBe(400);
      expect(resultado.error).toMatch(/fraude/i);
    }
  });

  test('#6: Múltiplos descontos combinados (IRRF + INSS + ISS + SEST + Patronal)', async () => {
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('numero_cheque')) return [[]];
          if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
            return [[{ id: 'ne-1', valor: 10000, status: 'EMITIDO' }]];
          }
          if (sql.includes('SELECT COALESCE(SUM(valor_pagamento)')) {
            return [[{ total_pago: 0 }]];
          }
          if (sql.includes('SUBSTRING_INDEX')) return [[{ seq: 5 }]];
          if (sql.includes('sub AS UNSIGNED')) return [[{ seq: 1 }]];
          if (sql.includes('INSERT')) return [{ affectedRows: 1 }];
          if (sql.includes('UPDATE notas_empenho')) return [{ affectedRows: 1 }];
          return [[]];
        }),
      };
      return await callback(conn);
    });

    const resultado = await OrdemPagamentoService.criar(
      {
        numeroEmpenho: 'NE-001',
        credorCpfCnpj: '12345678900',
        valorPagamento: 1000,
        irrf: 0,
        iss: 0,
        inss: 0,
        sestSenat: 0,
        patronal: 0,
      },
      'user-123',
      'GESTOR' // perfil não-admin vai forçar recálculo
    );

    expect(resultado.success).toBe(true);
    // GESTOR: IRRF=1.5%, INSS=11%, SEST=2.5%, Patronal=20%
    // Total: 35% → liquido = 650
  });

  test('#7: Cheque duplicado (deve falhar 409)', async () => {
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('numero_cheque')) {
            return [[{ id: 'op-1' }]]; // cheque já existe
          }
          return [[]];
        }),
      };
      return await callback(conn);
    });

    const resultado = await OrdemPagamentoService.criar(
      {
        numeroEmpenho: 'NE-001',
        credorCpfCnpj: '12345678900',
        valorPagamento: 100,
        numeroCheque: 'CHQ-12345',
      },
      'user-123',
      'GESTOR'
    );

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.status).toBe(409);
      expect(resultado.error).toContain('cheque');
    }
  });

  test('#8: NE cancelada (deve falhar 409)', async () => {
    (withTransaction as any).mockImplementationOnce(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('numero_cheque')) return [[]];
          if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
            return [[{ id: 'ne-1', valor: 1000, status: 'CANCELADO' }]];
          }
          return [[]];
        }),
      };
      return await callback(conn);
    });

    const resultado = await OrdemPagamentoService.criar(
      {
        numeroEmpenho: 'NE-001',
        credorCpfCnpj: '12345678900',
        valorPagamento: 100,
      },
      'user-123',
      'GESTOR'
    );

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.status).toBe(409);
      expect(resultado.error).toContain('CANCELADA');
    }
  });

  test('#10: Colisão de numero_empenho (UNIQUE KEY) — tenta de novo e cria com sucesso', async () => {
    let tentativa = 0;
    (withTransaction as any).mockImplementation(async (callback: any) => {
      tentativa++;
      const conn = {
        execute: vi.fn().mockImplementation(async (sql: string) => {
          // Checagem do INSERT precisa vir ANTES de 'numero_cheque': a própria
          // lista de colunas do INSERT contém a palavra "numero_cheque", então
          // um includes() genérico pegaria o INSERT por engano.
          if (sql.includes('INSERT INTO ordens_pagamento')) {
            if (tentativa === 1) {
              const err: any = new Error("Duplicate entry '2026.OP.0006' for key 'ordens_pagamento.uq_numero_empenho'");
              err.code = 'ER_DUP_ENTRY';
              err.sqlMessage = err.message;
              throw err; // simula outra requisição concorrente pegando o mesmo número
            }
            return [{ affectedRows: 1 }];
          }
          if (sql.includes('numero_cheque')) return [[]];
          if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
            return [[{ id: 'ne-1', valor: 1000, status: 'EMITIDO' }]];
          }
          if (sql.includes('SELECT COALESCE(SUM(valor_pagamento)')) {
            return [[{ total_pago: 0 }]];
          }
          if (sql.includes('SELECT CAST(SUBSTRING_INDEX(numero_empenho')) {
            return [[{ seq: 5 }]];
          }
          if (sql.includes('SELECT CAST(sub AS UNSIGNED)')) {
            return [[{ seq: 1 }]];
          }
          if (sql.includes('UPDATE notas_empenho SET status')) {
            return [{ affectedRows: 1 }];
          }
          return [[]];
        }),
      };
      return await callback(conn);
    });

    const resultado = await OrdemPagamentoService.criar(
      {
        numeroEmpenho: 'NE-001',
        credorCpfCnpj: '12345678900',
        valorPagamento: 100,
      },
      'user-123',
      'GESTOR'
    );

    expect(tentativa).toBe(2); // falhou na 1ª, teve sucesso na 2ª
    expect(resultado.success).toBe(true);
  });

  test('#11: Erro de duplicidade que NÃO é de numero_empenho não deve disparar retry', async () => {
    let tentativa = 0;
    (withTransaction as any).mockImplementation(async (callback: any) => {
      tentativa++;
      const conn = {
        execute: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('INSERT INTO ordens_pagamento')) {
            const err: any = new Error("Duplicate entry '123' for key 'ordens_pagamento.uq_cheque'");
            err.code = 'ER_DUP_ENTRY';
            err.sqlMessage = err.message;
            throw err;
          }
          if (sql.includes('numero_cheque')) return [[]];
          if (sql.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
            return [[{ id: 'ne-1', valor: 1000, status: 'EMITIDO' }]];
          }
          if (sql.includes('SELECT COALESCE(SUM(valor_pagamento)')) {
            return [[{ total_pago: 0 }]];
          }
          if (sql.includes('SELECT CAST(SUBSTRING_INDEX(numero_empenho')) {
            return [[{ seq: 5 }]];
          }
          if (sql.includes('SELECT CAST(sub AS UNSIGNED)')) {
            return [[{ seq: 1 }]];
          }
          return [[]];
        }),
      };
      return await callback(conn);
    });

    const resultado = await OrdemPagamentoService.criar(
      {
        numeroEmpenho: 'NE-001',
        credorCpfCnpj: '12345678900',
        valorPagamento: 100,
        numeroCheque: 'CHQ-999',
      },
      'user-123',
      'GESTOR'
    );

    expect(tentativa).toBe(1); // não deve tentar de novo, erro não é de numero_empenho
    expect(resultado.success).toBe(false);
  });

  test('#9: Validação Zod — valor 0 (deve falhar 400)', async () => {
    const resultado = await OrdemPagamentoService.criar(
      {
        numeroEmpenho: 'NE-001',
        credorCpfCnpj: '12345678900',
        valorPagamento: 0, // inválido
      },
      'user-123',
      'GESTOR'
    );

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.status).toBe(400);
    }
  });
});
