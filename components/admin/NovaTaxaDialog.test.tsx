// B12 — "Nova taxa" (ADMIN) e as colunas da Matriz com as taxas criadas.
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';

vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { apiClient } from '@/lib/api-client';
import NovaTaxaDialog from './NovaTaxaDialog';
import RetencoesMatriz from './RetencoesMatriz';

beforeEach(() => vi.clearAllMocks());

describe('NovaTaxaDialog', () => {
  test('percentual: envia rótulo, alíquota e opções; avisa a Matriz', async () => {
    (apiClient.post as any).mockResolvedValue({ success: true });
    const onCriada = vi.fn();
    render(<NovaTaxaDialog onCriada={onCriada} />);
    fireEvent.click(screen.getByRole('button', { name: /Nova taxa/ }));
    fireEvent.change(screen.getByLabelText('Rótulo'), { target: { value: 'Taxa Ambiental' } });
    expect(screen.getByText('Código: x_taxa_ambiental')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Alíquota (%)'), { target: { value: '2,5' } });
    fireEvent.click(screen.getByLabelText('Entra na DARF'));
    fireEvent.click(screen.getByRole('button', { name: 'Criar taxa' }));
    await waitFor(() => expect(onCriada).toHaveBeenCalled());
    expect(apiClient.post).toHaveBeenCalledWith('/api/configuracoes/retencoes/campos', {
      rotulo: 'Taxa Ambiental', tipo: 'PERCENTUAL', aliquota: 2.5, calculoAutomatico: true, editavelOperador: false, entraDarf: true,
    });
  });

  test('valor digitado: sem alíquota; sem rótulo não deixa criar', async () => {
    (apiClient.post as any).mockResolvedValue({ success: true });
    render(<NovaTaxaDialog onCriada={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Nova taxa/ }));
    expect(screen.getByRole('button', { name: 'Criar taxa' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Rótulo'), { target: { value: 'Contribuição' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'VALOR_DIGITADO' } });
    expect(screen.queryByLabelText('Alíquota (%)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Criar taxa' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect((apiClient.post as any).mock.calls[0][1]).toMatchObject({ tipo: 'VALOR_DIGITADO', aliquota: null, entraDarf: false, editavelOperador: true });
  });

  test('desabilitado com alterações não salvas', () => {
    render(<NovaTaxaDialog desabilitado onCriada={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Nova taxa/ })).toBeDisabled();
  });
});

describe('Matriz com taxa criada', () => {
  test('a "x_" percentual vira coluna; a digitada não', () => {
    function Tela() {
      const methods = useForm<any>({
        defaultValues: {
          campos: [
            { campo: 'irrf', rotulo: 'IRRF', tipo: 'PERCENTUAL' },
            { campo: 'x_taxa_ambiental', rotulo: 'Taxa Ambiental', tipo: 'PERCENTUAL' },
            { campo: 'x_contribuicao', rotulo: 'Contribuição', tipo: 'VALOR_DIGITADO' },
          ],
          elementos: [{ codigo: '3.3.90.39', descricao: 'PJ', legado: false, campos: { irrf: true, x_taxa_ambiental: true } }],
        },
      });
      return (
        <FormProvider {...methods}>
          <RetencoesMatriz />
        </FormProvider>
      );
    }
    render(<Tela />);
    expect(screen.getByLabelText('3.3.90.39 aplica Taxa Ambiental')).toBeChecked();
    expect(screen.queryByLabelText('3.3.90.39 aplica Contribuição')).toBeNull();
  });
});
