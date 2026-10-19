import { describe, test, expect, vi } from 'vitest';
import { montarSaldo, obterSaldoNe, recalcularStatusNe, saldoParaResposta } from '@/lib/services/saldo-ne';

describe('montarSaldo (T31)', () => {
  test('NE sem OP: gasto 0, restante = valor, 0%', () => {
    expect(montarSaldo('100.00', 0, 0)).toEqual({ valorCents: 10000, gastoCents: 0, restanteCents: 10000, percentualGasto: 0, qtdOps: 0 });
  });
  test('NE de 100 com 90 gastos: restante 10, 90%', () => {
    expect(montarSaldo('100.00', '90.00', 3)).toEqual({ valorCents: 10000, gastoCents: 9000, restanteCents: 1000, percentualGasto: 90, qtdOps: 3 });
  });
  test('totalmente gasta: restante 0, 100%', () => {
    expect(montarSaldo(100, 100, 1).restanteCents).toBe(0);
    expect(montarSaldo(100, 100, 1).percentualGasto).toBe(100);
  });
  test('dados antigos com gasto acima do valor: restante negativo', () => {
    expect(montarSaldo('100.00', '120.50', 2).restanteCents).toBe(-2050);
  });
  test('centavos sem erro de ponto flutuante e percentual com 2 casas', () => {
    const s = montarSaldo('0.30', '0.10', 1);
    expect(s.restanteCents).toBe(20); // 0,30 - 0,10 em float daria 0,19999…
    expect(montarSaldo('3.00', '1.00').percentualGasto).toBe(33.33);
  });
  test('saldoParaResposta devolve reais', () => {
    expect(saldoParaResposta(montarSaldo('100.00', '90.00', 3))).toEqual({ valor: 100, gasto: 90, restante: 10, percentualGasto: 90, qtdOps: 3 });
  });
});

describe('obterSaldoNe', () => {
  test('lê a NE e a soma das OPs; NE inexistente -> null', async () => {
    const exec = vi.fn(async (sql: string) =>
      sql.includes('FROM notas_empenho') ? [{ valor: '100.00' }] : [{ gasto: '90.00', qtd: 3 }]
    );
    expect(await obterSaldoNe(exec, 'NE-1')).toMatchObject({ gastoCents: 9000, restanteCents: 1000, qtdOps: 3 });
    expect(exec.mock.calls.every((c: unknown[]) => !String(c[0]).includes('JOIN'))).toBe(true);

    const vazio = vi.fn(async () => []);
    expect(await obterSaldoNe(vazio, 'NE-X')).toBeNull();
  });
});

describe('recalcularStatusNe', () => {
  function conexao(ne: { valor: string; status: string } | null, gasto: string) {
    const chamadas: Array<[string, any[]]> = [];
    const conn: any = {
      execute: vi.fn(async (sql: string, params: any[] = []) => {
        chamadas.push([sql, params]);
        if (sql.includes('FROM notas_empenho')) return [ne ? [ne] : []];
        if (sql.includes('FROM ordens_pagamento')) return [[{ gasto, qtd: 1 }]];
        return [{ affectedRows: 1 }];
      }),
    };
    const gravado = () => chamadas.find(([sql]) => sql.startsWith('UPDATE notas_empenho SET status'))?.[1][0];
    return { conn, chamadas, gravado };
  }

  test.each([
    ['0.00', 'EMITIDO', 'EMITIDO'],
    ['40.00', 'EMITIDO', 'PARCIALMENTE PAGO'],
    ['100.00', 'PARCIALMENTE PAGO', 'LIQUIDADO'],
    ['0.00', 'LIQUIDADO', 'EMITIDO'],
  ])('gasto %s de 100, status atual %s -> %s', async (gasto: string, atual: string, esperado: string) => {
    const { conn, gravado } = conexao({ valor: '100.00', status: atual }, gasto);
    expect(await recalcularStatusNe(conn, 'NE-1')).toBe(esperado);
    expect(gravado()).toBe(atual === esperado ? undefined : esperado); // só grava se mudou
  });

  test('CANCELADO nunca é desfeito', async () => {
    const { conn, gravado } = conexao({ valor: '100.00', status: 'CANCELADO' }, '0.00');
    expect(await recalcularStatusNe(conn, 'NE-1')).toBe('CANCELADO');
    expect(gravado()).toBeUndefined();
  });

  test('trava a NE (FOR UPDATE) e não faz nada se ela não existe', async () => {
    const { conn, chamadas, gravado } = conexao(null, '0.00');
    expect(await recalcularStatusNe(conn, 'NE-X')).toBeNull();
    expect(chamadas[0][0]).toContain('FOR UPDATE');
    expect(gravado()).toBeUndefined();
  });
});
