// B9 — coluna "IR natureza (%)" nas exceções por subelemento.
import React, { useState } from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import RetencoesSubelementos from './RetencoesSubelementos';
import type { ElementoOption } from '@/hooks/use-elementos';

vi.mock('@/lib/api-client', () => ({ apiClient: { put: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { apiClient } from '@/lib/api-client';

const ELEMENTOS: ElementoOption[] = [
  {
    codigo: '3.3.90.39', descricao: 'PJ', valor: '3.3.90.39', legado: false, ativo: true, retencoes: [],
    subelementos: [
      { codigo: '3.3.90.39.22', descricao: 'Limpeza', valor: '3.3.90.39.22 - Limpeza' },
      { codigo: '3.3.90.39.28', descricao: 'Demais serviços', valor: '3.3.90.39.28 - Demais serviços' },
    ],
  },
];

function Tela() {
  const [aliquotas, setAliquotas] = useState<Record<string, number>>({ '3.3.90.39.22': 4.8 });
  return (
    <>
      <RetencoesSubelementos
        elementos={ELEMENTOS}
        regras={{ '3.3.90.39': ['irrf', 'iss'] }}
        regrasSubelemento={{}}
        onSalvo={vi.fn()}
        irrfSubelemento={aliquotas}
        onSalvoAliquota={(codigo, aliquota) =>
          setAliquotas((a) => {
            const n = { ...a };
            if (aliquota === null) delete n[codigo];
            else n[codigo] = aliquota;
            return n;
          })
        }
      />
      <output data-testid="estado">{JSON.stringify(aliquotas)}</output>
    </>
  );
}
const campo = (codigo: string) => screen.getByLabelText(`${codigo} alíquota do IR pela natureza (%)`) as HTMLInputElement;
const salvarDa = (codigo: string) => within(campo(codigo).closest('tr')!).getByRole('button', { name: 'Salvar' });

beforeEach(() => {
  vi.clearAllMocks();
  (apiClient.put as any).mockResolvedValue({ success: true });
});

describe('RetencoesSubelementos — alíquota do IR pela natureza', () => {
  test('mostra a alíquota salva; vazio = padrão', () => {
    render(<Tela />);
    expect(campo('3.3.90.39.22').value).toBe('4,8');
    expect(campo('3.3.90.39.28').value).toBe('');
    expect(salvarDa('3.3.90.39.22')).toBeDisabled();
  });

  test('alterar, confirmar e salvar: PUT só da alíquota, com o antes e o depois', async () => {
    render(<Tela />);
    fireEvent.change(campo('3.3.90.39.28'), { target: { value: '4,80' } });
    fireEvent.click(salvarDa('3.3.90.39.28'));
    expect(await screen.findByText('3.3.90.39.28: alíquota padrão do IRRF → IRRF de 4,8%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e salvar' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    expect(apiClient.put).toHaveBeenCalledWith('/api/configuracoes/retencoes/subelementos/irrf', { subelementoCodigo: '3.3.90.39.28', aliquota: 4.8 });
    await waitFor(() => expect(screen.getByTestId('estado').textContent).toContain('"3.3.90.39.28":4.8'));
  });

  test('apagar volta ao padrão (null)', async () => {
    render(<Tela />);
    fireEvent.change(campo('3.3.90.39.22'), { target: { value: '' } });
    fireEvent.click(salvarDa('3.3.90.39.22'));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar e salvar' }));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith('/api/configuracoes/retencoes/subelementos/irrf', { subelementoCodigo: '3.3.90.39.22', aliquota: null })
    );
  });

  test('valor inválido: avisa e não deixa salvar', () => {
    render(<Tela />);
    fireEvent.change(campo('3.3.90.39.22'), { target: { value: '150' } });
    expect(campo('3.3.90.39.22')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('0 a 100')).toBeInTheDocument();
    expect(salvarDa('3.3.90.39.22')).toBeDisabled();
  });
});
