// B5 — cartão "Identificação nos relatórios" (Configurações, só Admin).
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IdentificacaoRelatorios } from './IdentificacaoRelatorios';

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { apiClient } from '@/lib/api-client';

beforeEach(() => {
  vi.clearAllMocks();
  (apiClient.get as any).mockResolvedValue({ orgao: 'Secretaria X', setor: '' });
  (apiClient.put as any).mockImplementation(async (_u: string, body: any) => ({ success: true, orgao: body.orgao.trim(), setor: body.setor.trim() }));
});

describe('IdentificacaoRelatorios', () => {
  test('carrega o gravado; a prévia muda ao digitar; Salvar só com mudança', async () => {
    render(<IdentificacaoRelatorios />);
    const orgao = (await screen.findByDisplayValue('Secretaria X')) as HTMLInputElement;
    const salvar = screen.getByRole('button', { name: 'Salvar' });
    expect(salvar).toBeDisabled();
    expect(screen.getByTestId('ident-previa')).toHaveTextContent('Estado de PernambucoSecretaria X');

    fireEvent.change(screen.getByLabelText('Setor'), { target: { value: 'Gerência Financeira' } });
    expect(screen.getByTestId('ident-previa')).toHaveTextContent('Gerência Financeira');
    expect(screen.getByText('19/120')).toBeInTheDocument();
    expect(salvar).not.toBeDisabled();

    fireEvent.click(salvar);
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/configuracoes/identificacao', { orgao: 'Secretaria X', setor: 'Gerência Financeira' }));
    await waitFor(() => expect(salvar).toBeDisabled());
    expect(orgao.maxLength).toBe(120);
  });

  test('erro do servidor (ex.: migration não rodada) aparece no cartão', async () => {
    (apiClient.put as any).mockRejectedValue(new Error('Rode a migration_19 no banco para poder salvar.'));
    render(<IdentificacaoRelatorios />);
    await screen.findByDisplayValue('Secretaria X');
    fireEvent.change(screen.getByLabelText('Órgão'), { target: { value: 'Outra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('migration_19');
  });
});
