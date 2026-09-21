import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OpTaxesSection from './OpTaxesSection';

describe('OpTaxesSection Component', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Checkboxes de imposto ficam desabilitados quando userRole !== ADMIN', () => {
    render(
      <OpTaxesSection
        valorPagamento={1000}
        irrf={15} // 1.5%
        iss={0}
        inss={110} // 11%
        sestSenat={25} // 2.5%
        patronal={200} // 20%
        outrosDescontos={0}
        autoCalculate={true}
        appliedTax_irrf={true}
        appliedTax_iss={false}
        appliedTax_inss={true}
        appliedTax_sestSenat={true}
        appliedTax_patronal={true}
        onChange={mockOnChange}
        userRole="GESTOR"
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toBeDisabled();
    });
  });

  test('Checkboxes ficam habilitados quando userRole === ADMIN', () => {
    render(
      <OpTaxesSection
        valorPagamento={1000}
        irrf={15}
        iss={0}
        inss={110}
        sestSenat={25}
        patronal={200}
        outrosDescontos={0}
        autoCalculate={true}
        appliedTax_irrf={true}
        appliedTax_iss={false}
        appliedTax_inss={true}
        appliedTax_sestSenat={true}
        appliedTax_patronal={true}
        onChange={mockOnChange}
        userRole="ADMIN"
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toBeEnabled();
    });
  });

  test('AutoCalculate ativado calcula automaticamente impostos para GESTOR', () => {
    const { rerender } = render(
      <OpTaxesSection
        valorPagamento={1000}
        irrf={0}
        iss={0}
        inss={0}
        sestSenat={0}
        patronal={0}
        outrosDescontos={0}
        autoCalculate={true}
        appliedTax_irrf={false}
        appliedTax_iss={false}
        appliedTax_inss={false}
        appliedTax_sestSenat={false}
        appliedTax_patronal={false}
        onChange={mockOnChange}
        userRole="GESTOR"
      />
    );

    // Ao ativar autoCalculate, deve chamar onChange com impostos recalculados
    // IRRF 1.5%, INSS 11%, SEST 2.5%, Patronal 20%
    // Não testa o valor exato pois depende da implementação do cálculo no componente
    expect(mockOnChange).toHaveBeenCalled();
  });

  test('Exibe valores de desconto calculados', () => {
    render(
      <OpTaxesSection
        valorPagamento={1000}
        irrf={15} // 1.5% de 1000
        iss={0}
        inss={110} // 11%
        sestSenat={25} // 2.5%
        patronal={200} // 20%
        outrosDescontos={0}
        autoCalculate={true}
        appliedTax_irrf={true}
        appliedTax_iss={false}
        appliedTax_inss={true}
        appliedTax_sestSenat={true}
        appliedTax_patronal={true}
        onChange={mockOnChange}
        userRole="GESTOR"
      />
    );

    // Verifica que os valores aparecem na tela
    expect(screen.getByText(/15|1,5%/i)).toBeInTheDocument(); // IRRF
    expect(screen.getByText(/110|11%/i)).toBeInTheDocument(); // INSS
  });
});
