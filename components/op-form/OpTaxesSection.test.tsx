import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import OpTaxesSection from './OpTaxesSection';

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    maskCurrency: (val: string | number) => String(val),
    parseFormNumber: (val: string | number) => parseFloat(String(val).replace(/[^\d,-]/g, '').replace(',', '.')),
    formatCurrency: (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
});

function renderWithForm(userRole: string, defaultValues: any = {}) {
  function Wrapper() {
    const methods = useForm({ defaultValues });
    return <FormProvider {...methods}><OpTaxesSection userRole={userRole} /></FormProvider>;
  }
  return render(<Wrapper />);
}

describe('OpTaxesSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Checkboxes de imposto ficam desabilitados quando userRole !== ADMIN', () => {
    renderWithForm('GESTOR', {
      valorPagamento: '1000',
      autoCalculate: false,
      appliedTax_irrf: false,
      appliedTax_iss: false,
      appliedTax_inss: false,
      appliedTax_sestSenat: false,
      appliedTax_patronal: false,
      irrf: '',
      iss: '',
      inss: '',
      sestSenat: '',
      patronal: '',
      outrosDescontos: '',
      itens: [],
    });

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((checkbox) => {
      expect((checkbox as HTMLInputElement).disabled).toBe(true);
    });
  });

  test('Checkboxes ficam habilitados quando userRole === ADMIN', () => {
    renderWithForm('ADMIN', {
      valorPagamento: '1000',
      autoCalculate: false,
      appliedTax_irrf: false,
      appliedTax_iss: false,
      appliedTax_inss: false,
      appliedTax_sestSenat: false,
      appliedTax_patronal: false,
      irrf: '',
      iss: '',
      inss: '',
      sestSenat: '',
      patronal: '',
      outrosDescontos: '',
      itens: [],
    });

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((checkbox) => {
      expect((checkbox as HTMLInputElement).disabled).toBe(false);
    });
  });

  test('AutoCalculate checkbox aparece e pode ser marcado por ADMIN', () => {
    renderWithForm('ADMIN', {
      valorPagamento: '1000',
      autoCalculate: false,
      appliedTax_irrf: false,
      appliedTax_iss: false,
      appliedTax_inss: false,
      appliedTax_sestSenat: false,
      appliedTax_patronal: false,
      irrf: '',
      iss: '',
      inss: '',
      sestSenat: '',
      patronal: '',
      outrosDescontos: '',
      itens: [],
    });

    const autoCalcCheckbox = screen.getByLabelText(/Cálculo Automático/i) as HTMLInputElement;
    expect(autoCalcCheckbox).toBeInTheDocument();
    expect(autoCalcCheckbox.disabled).toBe(false);
  });

  test('Exibe seção de retenções e descontos com labels', () => {
    renderWithForm('ADMIN', {
      valorPagamento: '1000',
      autoCalculate: false,
      appliedTax_irrf: false,
      appliedTax_iss: false,
      appliedTax_inss: false,
      appliedTax_sestSenat: false,
      appliedTax_patronal: false,
      irrf: '15',
      iss: '',
      inss: '110',
      sestSenat: '25',
      patronal: '200',
      outrosDescontos: '',
      itens: [],
    });

    expect(screen.getByText(/Retenções e Descontos/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/IRRF/)).toBeInTheDocument();
    expect(screen.getByLabelText(/ISS/)).toBeInTheDocument();
    expect(screen.getByLabelText(/INSS/)).toBeInTheDocument();
  });
});
