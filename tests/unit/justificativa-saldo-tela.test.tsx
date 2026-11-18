// B13 — tela da justificativa de sobra e o botão na lista de NEs.
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let busca = new URLSearchParams('ne=2026NE000007');
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => busca }));
vi.mock('next/image', () => ({ default: (p: any) => <img alt={p.alt} /> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('@/hooks/use-elementos', () => ({ useElementos: () => ({ elementos: [], loading: false, erro: null, recarregar: vi.fn() }) }));
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import JustificativaSaldoPage from '@/app/notas-empenho/justificativa/page';
import NotasEmpenho from '@/app/notas-empenho/page';
import { TEXTO_DEVOLUCAO_PADRAO } from '@/lib/justificativa-saldo';

const RESPOSTA = {
  ne: { numero: '2026NE000007', status: 'PARCIALMENTE PAGO' },
  saldo: { valor: 2000, gasto: 1500, restante: 500 },
  dados: {
    numeroNe: '2026NE000007', exercicio: '2026', objeto: 'Transporte escolar', valorSaldo: 500, valorAtualizado: 500,
    motivos: [], outros: '', textoDevolucao: TEXTO_DEVOLUCAO_PADRAO,
  },
  salva: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  busca = new URLSearchParams('ne=2026NE000007');
  useAppStore.setState({ userProfile: { perfil: 'GESTOR' } as any });
  (apiClient.get as any).mockResolvedValue(RESPOSTA);
  (apiClient.put as any).mockResolvedValue({ success: true });
});

describe('página da justificativa', () => {
  test('preenche, marca motivo, salva e imprime', async () => {
    render(<JustificativaSaldoPage />);
    const folha = await screen.findByTestId('folha-justificativa');
    expect(folha).toHaveTextContent('JUSTIFICATIVA DE NÃO UTILIZAÇÃO TOTAL DO RECURSO DA NE Nº 2026NE000007');
    expect(folha).toHaveTextContent('no valor de R$ 500,00 (quinhentos reais)');
    expect(folha).toHaveTextContent('Objeto do Recurso: Transporte escolar');
    // sem motivo: não deixa salvar nem imprimir
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Marque ao menos um motivo');

    fireEvent.click(screen.getByLabelText('Prazo acima de 60 dias'));
    fireEvent.change(screen.getByLabelText('Texto do motivo prazo'), { target: { value: 'Prazo estourado.' } });
    fireEvent.change(screen.getByLabelText('Outros fatores'), { target: { value: 'Chuvas' } });
    expect(screen.getByTestId('folha-motivos')).toHaveTextContent('Prazo estourado.');
    expect(screen.getByTestId('folha-motivos')).toHaveTextContent('Outros fatores: Chuvas');
    expect(screen.getByTestId('folha-motivos')).not.toHaveTextContent('Execução parcial');

    fireEvent.change(screen.getByLabelText('Saldo remanescente atualizado (R$)'), { target: { value: '51230' } });
    expect(folha).toHaveTextContent('NO VALOR DE R$ 512,30');

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalled());
    const [url, corpo] = (apiClient.put as any).mock.calls[0];
    expect(url).toBe('/api/notas-empenho/justificativa?ne=2026NE000007');
    expect(corpo).toMatchObject({ valorAtualizado: 512.3, outros: 'Chuvas', motivos: [{ codigo: 'prazo', texto: 'Prazo estourado.' }] });

    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    expect(imprimir).toHaveBeenCalled();
  });

  test('salva antes: avisa se o saldo da NE mudou; CONSULTA não vê "Salvar"', async () => {
    useAppStore.setState({ userProfile: { perfil: 'CONSULTA' } as any });
    (apiClient.get as any).mockResolvedValue({
      ...RESPOSTA,
      dados: { ...RESPOSTA.dados, motivos: [{ codigo: 'parcial', texto: 'Execução parcial do recurso.' }] },
      salva: { em: '2026-11-10T12:00:00Z', por: 'Amanda', valorSaldoSalvo: 600 },
    });
    render(<JustificativaSaldoPage />);
    expect(await screen.findByText(/O saldo da NE mudou desde que a justificativa foi salva/)).toBeInTheDocument();
    expect(screen.getByText(/por Amanda/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    expect(screen.getByRole('button', { name: /Imprimir/ })).not.toBeDisabled();
  });
});

describe('botão na lista de NEs', () => {
  test('só aparece com saldo > 0 e NE não cancelada', async () => {
    busca = new URLSearchParams();
    window.scrollTo = vi.fn() as any;
    global.fetch = vi.fn(async () => ({ json: async () => ({ duplicado: false }) })) as any;
    const ne = (numero: string, restante: number, status = 'PARCIALMENTE PAGO') => ({
      id: numero, numero, valor: 2000, status, historico: 'x', elemento: '3.3.90.30 - Material',
      saldo: { valor: 2000, gasto: 2000 - restante, restante, percentualGasto: 0, qtdOps: 1 },
    });
    (apiClient.get as any).mockResolvedValue({
      notas: [ne('NE-COM-SALDO', 500), ne('NE-ZERADA', 0, 'LIQUIDADO'), ne('NE-CANCELADA', 2000, 'CANCELADO')],
      pagination: { totalPages: 1 },
    });
    render(<NotasEmpenho />);
    const link = await screen.findByRole('link', { name: 'Justificativa de sobra de recurso da NE NE-COM-SALDO' });
    expect(link).toHaveAttribute('href', '/notas-empenho/justificativa?ne=NE-COM-SALDO');
    expect(screen.queryByRole('link', { name: /NE NE-ZERADA/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /NE NE-CANCELADA/ })).toBeNull();
  });
});
