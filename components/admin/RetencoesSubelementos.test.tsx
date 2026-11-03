// B7a — "Exceções por subelemento" na tela de Retenções (só Admin).
import React, { useState } from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import RetencoesSubelementos, { descreverMudanca, subelementosComRegra } from './RetencoesSubelementos';
import type { ElementoOption } from '@/hooks/use-elementos';

vi.mock('@/lib/api-client', () => ({ apiClient: { put: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

const el = (codigo: string, subs: Array<[string, string]>): ElementoOption => ({
  codigo, descricao: `El ${codigo}`, valor: codigo, legado: false, ativo: true, retencoes: [],
  subelementos: subs.map(([c, d]) => ({ codigo: c, descricao: d, valor: `${c} - ${d}` })),
});
const ELEMENTOS = [
  el('3.3.90.14', [['3.3.90.14.03', 'Bolsas de Capacitação']]),
  el('3.3.90.33', [['3.3.90.33.01', 'Transporte escolar']]),
  el('3.3.90.36', [['3.3.90.36.08', 'Estagiários - Pagamento Direto']]),
];
const REGRAS = { '3.3.90.14': [], '3.3.90.33': ['irrf'], '3.3.90.36': ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'] };

function Tela({ inicial = { '3.3.90.36.08': [] } as Record<string, string[]> }) {
  const [regras, setRegras] = useState(inicial);
  return (
    <RetencoesSubelementos
      elementos={ELEMENTOS}
      regras={REGRAS}
      regrasSubelemento={regras}
      onSalvo={(codigo, regra) =>
        setRegras((a) => {
          const n = { ...a };
          if (regra === null) delete n[codigo];
          else n[codigo] = regra;
          return n;
        })
      }
    />
  );
}
const linha = (codigo: string) => screen.getByRole('rowheader', { name: new RegExp(codigo.replace(/\./g, '\\.')) }).closest('tr')!;

beforeEach(() => {
  vi.clearAllMocks();
  (apiClient.put as any).mockResolvedValue({ success: true });
});

describe('RetencoesSubelementos', () => {
  test('lista os subelementos menos os do transporte; estagiários com "Sem retenções"', () => {
    render(<Tela />);
    expect(screen.queryByText(/3\.3\.90\.33\.01/)).toBeNull();
    expect(within(linha('3.3.90.36.08')).getByText('Sem retenções')).toBeInTheDocument();
    expect(within(linha('3.3.90.36.08')).getByLabelText('3.3.90.36.08 tem regra própria')).toBeChecked();
    expect(within(linha('3.3.90.14.03')).getByText('Segue o elemento 3.3.90.14: nenhuma retenção')).toBeInTheDocument();
    for (const b of screen.getAllByRole('button', { name: 'Salvar' })) expect(b).toBeDisabled();
  });

  test('marcar IRRF, confirmar e salvar: PUT com os campos e a linha atualizada', async () => {
    render(<Tela />);
    const l = linha('3.3.90.36.08');
    fireEvent.click(within(l).getByLabelText('3.3.90.36.08 aplica IRRF'));
    fireEvent.click(within(l).getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('3.3.90.36.08: regra própria: nenhuma retenção → regra própria: IRRF')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e salvar' }));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith('/api/configuracoes/retencoes/subelementos', { subelementoCodigo: '3.3.90.36.08', campos: ['irrf'] })
    );
    await waitFor(() => expect(within(linha('3.3.90.36.08')).getByRole('button', { name: 'Salvar' })).toBeDisabled());
    expect(within(linha('3.3.90.36.08')).queryByText('Sem retenções')).toBeNull();
  });

  test('desligar a regra própria manda null (volta a seguir o elemento)', async () => {
    render(<Tela />);
    const l = linha('3.3.90.36.08');
    fireEvent.click(within(l).getByLabelText('3.3.90.36.08 tem regra própria'));
    expect(within(l).getByText(/Segue o elemento 3\.3\.90\.36: IRRF, ISS, INSS, Patronal, SEST\/SENAT/)).toBeInTheDocument();
    fireEvent.click(within(l).getByRole('button', { name: 'Salvar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar e salvar' }));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith('/api/configuracoes/retencoes/subelementos', { subelementoCodigo: '3.3.90.36.08', campos: null })
    );
  });

  test('erro do servidor (migration não rodada) vira aviso e a linha continua alterada', async () => {
    (apiClient.put as any).mockRejectedValue(new Error('Rode a migration_20 no banco para poder salvar.'));
    render(<Tela inicial={{}} />);
    const l = linha('3.3.90.14.03');
    fireEvent.click(within(l).getByLabelText('3.3.90.14.03 tem regra própria'));
    fireEvent.click(within(l).getByRole('button', { name: 'Salvar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar e salvar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Rode a migration_20 no banco para poder salvar.'));
    expect(within(linha('3.3.90.14.03')).getByRole('button', { name: 'Salvar' })).not.toBeDisabled();
  });

  test('helpers: lista sem transporte e texto da mudança', () => {
    expect(subelementosComRegra(ELEMENTOS).map((s) => s.codigo)).toEqual(['3.3.90.14.03', '3.3.90.36.08']);
    expect(descreverMudanca('X', null, [], ['irrf'])).toBe('X: segue o elemento (IRRF) → regra própria: nenhuma retenção');
  });
});
