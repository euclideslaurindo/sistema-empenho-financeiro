// B5 — página do relatório A4 (/analises/relatorio) com a API simulada.
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import RelatorioPage from '@/app/analises/relatorio/page';
import { respostaExemplo } from '@/tests/fixtures/analises-resposta';

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }));
const endereco = vi.hoisted(() => ({ busca: 'periodo=ano&ano=2026&base=civil' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(endereco.busca) }));
import { apiClient } from '@/lib/api-client';

type R = (url: string) => any;
function mockApi({ analises = () => respostaExemplo(), ident = () => ({ orgao: 'Secretaria de Educação', setor: 'Gerência Financeira' }) }: { analises?: R; ident?: R } = {}) {
  (apiClient.get as any).mockImplementation(async (url: string) => (url.startsWith('/api/configuracoes/identificacao') ? ident(url) : analises(url)));
}
const urls = () => (apiClient.get as any).mock.calls.map((c: any[]) => c[0]);

beforeEach(() => {
  vi.clearAllMocks();
  endereco.busca = 'periodo=ano&ano=2026&base=civil';
  mockApi();
});

describe('Relatório A4', () => {
  test('busca as análises com os filtros do endereço e a identificação; 2 folhas com cabeçalho e assinaturas', async () => {
    render(<RelatorioPage />);
    await screen.findByTestId('folha-2');
    expect(urls()).toEqual(['/api/analises?periodo=ano&ano=2026&base=civil', '/api/configuracoes/identificacao']);

    const cab = screen.getAllByTestId('relatorio-cabecalho');
    expect(cab).toHaveLength(2);
    expect(cab[0]).toHaveTextContent('Estado de Pernambuco');
    expect(cab[0]).toHaveTextContent('Secretaria de Educação');
    expect(cab[0]).toHaveTextContent('Gerência Financeira');

    expect(screen.getByRole('heading', { level: 1, name: 'Relatório de Execução Financeira' })).toBeInTheDocument();
    expect(screen.getByText(/Página 1 de 2/, { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText(/Página 2 de 2/, { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByTestId('relatorio-resumo')).toHaveTextContent('foram pagos R$ 307 mil a 2 credores');
    expect(screen.getByTestId('relatorio-assinaturas')).toHaveTextContent('Responsável pelo setor financeiro');
    expect(screen.getByTestId('relatorio-assinaturas')).toHaveTextContent('Ordenador de despesa');
    expect(screen.getByText('Das NEs do período, 53% já foi pago e R$ 799,90 falta pagar')).toBeInTheDocument();
    expect(within(screen.getByTestId('relatorio-credores')).getAllByRole('row')).toHaveLength(3);
  });

  test('sem identificação (ou sem a migration_19): só "Estado de Pernambuco"', async () => {
    mockApi({ ident: () => Promise.reject(new Error('ER_NO_SUCH_TABLE')) });
    render(<RelatorioPage />);
    const [cab] = await screen.findAllByTestId('relatorio-cabecalho');
    expect(cab.textContent).toBe('Estado de Pernambuco');
  });

  test('"Imprimir / Salvar PDF" chama a impressão; "Voltar" leva os mesmos filtros', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<RelatorioPage />);
    await screen.findByTestId('folha-1');
    fireEvent.click(screen.getByRole('button', { name: /Imprimir \/ Salvar PDF/ }));
    expect(imprimir).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: /Voltar para Análises/ })).toHaveAttribute('href', '/analises?periodo=ano&ano=2026&base=civil');
    imprimir.mockRestore();
  });

  test('cabe na folha: 9 elementos viram 6 linhas (com "Outros"), avisos impressos', async () => {
    const r = respostaExemplo();
    r.elementos = Array.from({ length: 9 }, (_, i) => ({ codigo: `3.3.90.${10 + i}`, desc: `Elemento ${i}`, pago: 1000 - i, pct: 11.1 }));
    r.avisos = ['1 NE(s) com pagamento acima do valor empenhado.'];
    mockApi({ analises: () => r });
    render(<RelatorioPage />);
    const tabela = await screen.findByTestId('relatorio-elementos');
    expect(within(tabela).getAllByRole('row')).toHaveLength(6);
    expect(within(tabela).getByText('Outros (4 elementos)')).toBeInTheDocument();
    expect(screen.getByTestId('relatorio-avisos')).toHaveTextContent('pagamento acima do valor');
  });

  test('erro: mensagem e "Tentar de novo"', async () => {
    let falhar = true;
    mockApi({ analises: () => (falhar ? Promise.reject(new Error('Erro interno')) : respostaExemplo()) });
    render(<RelatorioPage />);
    expect(await screen.findByText('Não foi possível montar o relatório.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imprimir/ })).toBeDisabled();
    falhar = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByTestId('folha-1')).toBeInTheDocument();
  });

  test('intervalo inválido no endereço: avisa e não pede nada', async () => {
    endereco.busca = 'periodo=intervalo&inicio=2026-05-01&fim=2026-04-01&base=civil';
    render(<RelatorioPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('não é válido');
    await waitFor(() => expect(apiClient.get).not.toHaveBeenCalled());
  });
});
