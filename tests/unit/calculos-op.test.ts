import { describe, test, expect } from 'vitest';

describe('Regras de Negócio Financeiras - Cálculos', () => {
  test('calcula retenções tributárias e valor líquido (IRRF 1.5%, INSS 11%, ISS 5%)', () => {
    const valorBruto = 10000;
    const irrf = valorBruto * 0.015;
    const inss = valorBruto * 0.11;
    const iss = valorBruto * 0.05;
    const totalDescontos = irrf + inss + iss;
    const valorLiquido = valorBruto - totalDescontos;

    expect(irrf).toBe(150);
    expect(inss).toBe(1100);
    expect(iss).toBe(500);
    expect(totalDescontos).toBe(1750);
    expect(valorLiquido).toBe(8250);
  });

  test('calcula saldo disponível após pagamento parcial', () => {
    const valorNe = 50000;
    const totalPago = 15000;
    const novoPagamento = 10000;
    
    const saldoDisponivel = valorNe - totalPago;
    expect(saldoDisponivel).toBe(35000);
    
    // Verifica se permite pagamento
    expect(novoPagamento).toBeLessThanOrEqual(saldoDisponivel);
    
    // Saldo restante após esse pagamento
    const saldoRestante = saldoDisponivel - novoPagamento;
    expect(saldoRestante).toBe(25000);
  });
});
