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
          if (queryStr.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
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
      credorCpfCnpj: '12345678900',
      valorPagamento: 500 // Tenta pagar R$ 500 num saldo de R$ 200
    };

    const result = await OrdemPagamentoService.criar(rawData, 'user-id-123', 'ADMIN');
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(422);
      expect(result.error).toContain('Saldo insuficiente');
    }
  });

  test('Teste 3: RBAC — motor de retenções (T10) ignora valores fraudulentos enviados por GESTOR', async () => {
    const executeSpy = vi.fn();

    // Config/matriz iguais à seed real da T03 (migration_12.sql): elemento
    // 3.3.90.33 aplica os 5 campos tributários; nenhum deles é editável
    // pelo operador (editavel_operador=0), só por ADMIN.
    const configRows = [
      { campo: 'irrf', rotulo: 'IRRF', tipo: 'PERCENTUAL', aliquota: '1.5000', calculo_automatico: 1, editavel_operador: 0, entra_darf: 0, ativo: 1, ordem: 10, updated_at: new Date() },
      { campo: 'iss', rotulo: 'ISS', tipo: 'PERCENTUAL', aliquota: '5.0000', calculo_automatico: 1, editavel_operador: 0, entra_darf: 0, ativo: 1, ordem: 20, updated_at: new Date() },
      { campo: 'inss', rotulo: 'INSS', tipo: 'PERCENTUAL', aliquota: '11.0000', calculo_automatico: 1, editavel_operador: 0, entra_darf: 1, ativo: 1, ordem: 30, updated_at: new Date() },
      { campo: 'patronal', rotulo: 'Patronal', tipo: 'PERCENTUAL', aliquota: '20.0000', calculo_automatico: 1, editavel_operador: 0, entra_darf: 1, ativo: 1, ordem: 40, updated_at: new Date() },
      { campo: 'sest_senat', rotulo: 'SEST/SENAT', tipo: 'PERCENTUAL', aliquota: '2.5000', calculo_automatico: 1, editavel_operador: 0, entra_darf: 1, ativo: 1, ordem: 50, updated_at: new Date() },
      { campo: 'outros', rotulo: 'Outros', tipo: 'VALOR_DIGITADO', aliquota: null, calculo_automatico: 0, editavel_operador: 0, entra_darf: 0, ativo: 1, ordem: 60, updated_at: new Date() },
      { campo: 'taxa_bancaria', rotulo: 'Taxa bancária', tipo: 'VALOR_DIGITADO', aliquota: null, calculo_automatico: 0, editavel_operador: 1, entra_darf: 0, ativo: 1, ordem: 70, updated_at: new Date() },
      { campo: 'taxa_pix', rotulo: 'Taxa PIX', tipo: 'VALOR_DIGITADO', aliquota: null, calculo_automatico: 0, editavel_operador: 1, entra_darf: 0, ativo: 1, ordem: 80, updated_at: new Date() },
    ];
    const elementoRetencoesRows = ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'].map((campo) => ({
      elemento_codigo: '3.3.90.33',
      campo,
    }));

    (withTransaction as any).mockImplementation(async (callback: any) => {
      const conn = {
        execute: vi.fn().mockImplementation((queryStr: string, params: any[]) => {
          executeSpy(queryStr, params);
          if (queryStr.includes('SELECT id, valor, status, elemento, subelemento FROM notas_empenho')) {
            return [[{ id: 'ne-1', valor: 1000, status: 'EMITIDO', elemento: '3.3.90.33 - Material de consumo', subelemento: null }]];
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
          if (queryStr.includes('SELECT * FROM config_retencoes ORDER BY ordem')) {
            return [configRows];
          }
          if (queryStr.includes('SELECT codigo FROM elementos_despesa')) {
            return [[{ codigo: '3.3.90.33' }]];
          }
          if (queryStr.includes('SELECT elemento_codigo, campo FROM elemento_retencoes')) {
            return [elementoRetencoesRows];
          }
          if (queryStr.includes('SELECT MAX(updated_at) as versao FROM config_retencoes')) {
            return [[{ versao: new Date() }]];
          }
          return [[]];
        })
      };
      return await callback(conn);
    });

    // Usuário hacker tenta enviar uma OP de R$ 100 com impostos fraudulentos (R$ 0,01 cada)
    const rawData = {
      numeroEmpenho: '2026.NE.0001',
      credorCpfCnpj: '12345678900',
      valorPagamento: 100,
      irrf: 0.01,
      iss: 0.01,
      inss: 0.01,
      sestSenat: 0.01,
      patronal: 0.01,
      outrosDescontos: 0.01,
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
    expect(params[18]).toBe(1.5); // finalIrrf (motor: 1.5% do valor a pagar, não o 0.01 enviado)
    expect(params[19]).toBe(5); // finalIss (motor: 5% do valor a pagar, não o 0.01 enviado)
    expect(params[20]).toBe(11); // finalInss (motor: 11% do valor a pagar)
    expect(params[21]).toBe(2.5); // finalSestSenat (motor: 2.5% do valor a pagar)
    expect(params[22]).toBe(20); // finalPatronal (motor: 20% do valor a pagar)
    expect(params[23]).toBe(0); // finalOutros (não editável pelo GESTOR; valor enviado ignorado)
    expect(params[24]).toBe(0); // finalTaxaBancaria (não informado)
    expect(params[25]).toBe(0); // finalTaxaPix (não informado)
    expect(params[26]).toBe(40); // finalTotalDescontos (soma dos descontos calculados pelo motor)
    expect(params[27]).toBe(60); // finalLiquido (valor a pagar - total de descontos)
  });
});
