// B7a — o simulador escolhe o subelemento e usa a regra própria salva.
import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import RetencoesSimulador from './RetencoesSimulador';
import type { ElementoOption } from '@/hooks/use-elementos';

const campo = (c: string, aliquota: string) => ({ campo: c, tipo: 'PERCENTUAL', aliquota, calculoAutomatico: true, ativo: true });
const TODOS = { irrf: true, iss: true, inss: true, patronal: true, sest_senat: true };
const ELEMENTOS_API: ElementoOption[] = [
  {
    codigo: '3.3.90.36', descricao: 'PF', valor: '3.3.90.36 - PF', legado: false, ativo: true, retencoes: [],
    subelementos: [{ codigo: '3.3.90.36.08', descricao: 'Estagiários', valor: '3.3.90.36.08 - Estagiários' }],
  },
];

function Tela({ regrasSubelemento }: { regrasSubelemento?: Record<string, string[]> }) {
  const methods = useForm<any>({
    defaultValues: {
      campos: [campo('irrf', '1,5'), campo('iss', '5'), campo('inss', '11'), campo('patronal', '20'), campo('sest_senat', '2,5')],
      elementos: [{ codigo: '3.3.90.36', descricao: 'PF', legado: false, campos: TODOS }],
    },
  });
  return (
    <FormProvider {...methods}>
      <RetencoesSimulador elementosApi={ELEMENTOS_API} regrasSubelemento={regrasSubelemento} />
    </FormProvider>
  );
}
const liquido = () => screen.getByText('Valor Líquido').nextSibling!.textContent;

describe('RetencoesSimulador com subelemento', () => {
  test('estagiário com regra vazia: líquido = bruto; sem subelemento: regra do elemento', () => {
    render(<Tela regrasSubelemento={{ '3.3.90.36.08': [] }} />);
    fireEvent.change(screen.getByLabelText('Elemento'), { target: { value: '3.3.90.36' } });
    fireEvent.change(screen.getByLabelText('Valor Bruto'), { target: { value: '1.000,00' } });
    expect(liquido()).toBe('800,00');
    fireEvent.change(screen.getByLabelText('Subelemento'), { target: { value: '3.3.90.36.08' } });
    expect(liquido()).toBe('1.000,00');
    expect(screen.getByRole('status')).toHaveTextContent('Regra própria do subelemento 3.3.90.36.08');
  });

  test('trocar o elemento limpa o subelemento; sem regras próprias, segue o elemento', () => {
    render(<Tela />);
    fireEvent.change(screen.getByLabelText('Elemento'), { target: { value: '3.3.90.36' } });
    fireEvent.change(screen.getByLabelText('Subelemento'), { target: { value: '3.3.90.36.08' } });
    fireEvent.change(screen.getByLabelText('Valor Bruto'), { target: { value: '1.000,00' } });
    expect(liquido()).toBe('800,00');
    fireEvent.change(screen.getByLabelText('Elemento'), { target: { value: '' } });
    expect((screen.getByLabelText('Subelemento') as HTMLSelectElement).value).toBe('');
  });

  test('B8: no 3.3.90.36 avisa que o IRRF é pela tabela progressiva (simulador da aba Pessoa Física)', () => {
    render(<Tela />);
    fireEvent.change(screen.getByLabelText('Elemento'), { target: { value: '3.3.90.36' } });
    fireEvent.change(screen.getByLabelText('Valor Bruto'), { target: { value: '1.000,00' } });
    expect(screen.getByRole('note')).toHaveTextContent('Use o simulador da aba Pessoa Física (3.3.90.36)');
  });
});
