import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import DarfPage from '@/app/darf/page';
import { DarfResumo } from './DarfResumo';
import { DarfTabela, colunasDaDarf, textoSemDarf } from './DarfTabela';

// Revisão da aba 6 (DARF), tela: seleção misturada (D1), colunas conforme o
// que entra na DARF (D2), link da OP (D4) e textos conforme o filtro (D5).

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { apiClient } from '@/lib/api-client';

const op = (i: number, status = 'PENDENTE', detalhe: Record<string, number> = { inss: 110, patronal: 200, sest_senat: 25 }) => ({
  id: `d${i}`, ordemPagamentoId: `op${i}`, numeroNe: `2026NE00000${i}`, numeroOp: `2026.OP.000${i}`, sub: '01',
  credorCpfCnpj: `${i}${i}${i}.000.000-00`, credorNome: `TESTE Credor ${i}`, municipio: '',
  competencia: '2026-10', valorDarf: Object.values(detalhe).reduce((t, v) => t + v, 0), detalhe,
  status, dataPagamento: status === 'PAGA' ? '2026-10-05' : null, observacao: null,
});
const TOTAIS = { pendente: { qtd: 1, valor: 335, credores: 1 }, paga: { qtd: 1, valor: 335, credores: 1 } };

describe('D1: seleção misturada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockImplementation(async (url: string) =>
      url.startsWith('/api/perfil')
        ? { usuario: { perfil: 'GESTOR' } }
        : { agrupar: 'op', itens: [op(1), op(2, 'PAGA')], totais: TOTAIS, pagination: { page: 1, limit: 50, total: 2, totalPages: 1 } }
    );
    (apiClient.post as any).mockResolvedValue({ atualizadas: 1 });
  });

  const selecionarAsDuas = async () => {
    render(<DarfPage />);
    await screen.findByText('TESTE Credor 1');
    fireEvent.click(await screen.findByLabelText('Selecionar DARF da OP 2026.OP.0001'));
    fireEvent.click(screen.getByLabelText('Selecionar DARF da OP 2026.OP.0002'));
  };

  test('cada botão mostra quantas vai mudar', async () => {
    await selecionarAsDuas();
    expect(screen.getByRole('button', { name: 'Marcar como paga (1)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reabrir (1)' })).toBeEnabled();
  });

  test('"Marcar como paga" envia só a pendente (a já paga não é regravada)', async () => {
    await selecionarAsDuas();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como paga (1)' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('1 DARF(s) · R$ 335,00')).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar pagamento' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect((apiClient.post as any).mock.calls[0][1].ids).toEqual(['d1']);
  });

  test('"Reabrir" envia só a paga e avisa que a pendente fica como está', async () => {
    await selecionarAsDuas();
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir (1)' }));
    const alerta = await screen.findByRole('alertdialog');
    expect(alerta).toHaveTextContent('1 DARF(s) paga(s) voltarão para PENDENTE');
    expect(alerta).toHaveTextContent('As 1 pendente(s) da seleção ficam como estão.');
    fireEvent.click(within(alerta).getByRole('button', { name: 'Reabrir' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/darf/status', { ids: ['d2'], status: 'PENDENTE' }));
  });

  test('só pagas selecionadas: "Marcar como paga" desabilitado', async () => {
    render(<DarfPage />);
    fireEvent.click(await screen.findByLabelText('Selecionar DARF da OP 2026.OP.0002'));
    expect(screen.getByRole('button', { name: /Marcar como paga/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reabrir (1)' })).toBeEnabled();
  });
});

const tabela = (itens: any[], extra: Partial<React.ComponentProps<typeof DarfTabela>> = {}) =>
  render(
    <DarfTabela agrupar="op" itens={itens} carregando={false} competencia="2026-10" podeSelecionar={false}
      selecionados={new Set()} onAlternar={() => {}} onAlternarPagina={() => {}} {...extra} />
  );

describe('D2: colunas da DARF', () => {
  test('IRRF na DARF ganha coluna, e o total bate com as colunas', () => {
    tabela([op(1, 'PENDENTE', { irrf: 15, inss: 110, patronal: 200, sest_senat: 25 })]);
    const cab = screen.getAllByRole('columnheader').map((th: HTMLElement) => th.textContent);
    expect(cab).toEqual(expect.arrayContaining(['IRRF', 'INSS', 'Patronal', 'SEST/SENAT']));
    expect(cab).not.toContain('ISS');
    const linha = screen.getByText('TESTE Credor 1').closest('tr')!;
    expect(within(linha).getByText('15,00')).toBeInTheDocument();
    expect(within(linha).getByText('R$ 350,00')).toBeInTheDocument();
  });

  test('sem detalhe: as três colunas do padrão', () => {
    expect(colunasDaDarf([{ ...op(1), detalhe: null } as any]).map(([c]) => c)).toEqual(['inss', 'patronal', 'sest_senat']);
  });
});

test('D4: o número da OP abre a impressão só com aquela OP marcada', () => {
  tabela([op(3)]);
  expect(screen.getByRole('link', { name: '2026.OP.0003' })).toHaveAttribute('href', '/consulta-impressao?ne=2026NE000003&ops=op3');
});

describe('D5: textos conforme o filtro', () => {
  test.each([
    ['2026-10', false, 'Nenhuma DARF neste mês.'],
    ['2026-10', true, 'Nenhuma DARF encontrada com estes filtros.'],
    ['', false, 'Nenhuma DARF encontrada.'],
  ])('competência "%s", filtrado %s → "%s"', (competencia: string, filtrado: boolean, texto: string) => {
    expect(textoSemDarf(competencia, filtrado)).toBe(texto);
    tabela([], { competencia, filtrado });
    expect(screen.getByText(texto)).toBeInTheDocument();
  });

  test('card "Total do mês" só com competência', () => {
    const { rerender } = render(<DarfResumo totais={TOTAIS} competencia="2026-10" />);
    expect(screen.getByTestId('resumo-total')).toHaveTextContent('Total do mês');
    rerender(<DarfResumo totais={TOTAIS} competencia="" />);
    expect(screen.getByTestId('resumo-total')).not.toHaveTextContent('Total do mês');
    expect(screen.getByTestId('resumo-total')).toHaveTextContent('Total');
  });
});
