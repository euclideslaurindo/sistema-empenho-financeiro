// B4 — a tela /analises com a API simulada.
import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AnalisesPage from '@/app/analises/page';
import { respostaExemplo } from '@/tests/fixtures/analises-resposta';

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// O endereço da tela (filtros vindos da URL): por padrão, sem nada.
const enderecoTela = vi.hoisted(() => ({ busca: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/analises',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(enderecoTela.busca),
}));
import { apiClient } from '@/lib/api-client';

const ELEMENTOS = [
  { codigo: '3.3.90.33', descricao: 'Transporte', valor: '3.3.90.33 - Transporte', legado: false, ativo: true, retencoes: [], subelementos: [] },
  { codigo: '3.3.90.36', descricao: 'Serviços PF', valor: '3.3.90.36 - Serviços PF', legado: false, ativo: true, retencoes: [], subelementos: [] },
  { codigo: '3.3.90.99', descricao: 'Inativo', valor: 'x', legado: true, ativo: false, retencoes: [], subelementos: [] },
];

const OPS = {
  ops: [
    { id: 'op1', data: '2026-04-10', numeroOp: '2026.OP.0001', numeroNe: '2026NE000001', sub: '01', credor: 'Álvaro Souza', elemento: '3.3.90.33 - Transporte', bruto: 1000, retido: 50, liquido: 950, restos: false },
    { id: 'op2', data: '2026-04-12', numeroOp: '2025.OP.0090', numeroNe: '2025NE000009', sub: '01', credor: 'Bruno Lima', elemento: '3.3.90.36 - PF', bruto: 100, retido: 0, liquido: 100, restos: true },
  ],
  qtd: 2, total: 1100, limite: 500, truncado: false,
};

type Resposta = (url: string) => any;
function mockApi({ analises = () => respostaExemplo(), ops = () => OPS }: { analises?: Resposta; ops?: Resposta } = {}) {
  (apiClient.get as any).mockImplementation(async (url: string) => {
    if (url.startsWith('/api/elementos')) return { elementos: ELEMENTOS };
    if (url.startsWith('/api/analises/ops')) return ops(url);
    if (url.startsWith('/api/analises')) return analises(url);
    throw new Error(`URL inesperada: ${url}`);
  });
}

const urlsAnalises = () => (apiClient.get as any).mock.calls.map((c: any[]) => c[0] as string).filter((u: string) => u.startsWith('/api/analises?'));
const urlsOps = () => (apiClient.get as any).mock.calls.map((c: any[]) => c[0] as string).filter((u: string) => u.startsWith('/api/analises/ops'));
const abrir = async () => {
  render(<AnalisesPage />);
  return screen.findByTestId('resumo-analises');
};

beforeEach(() => {
  vi.clearAllMocks();
  mockApi();
});

describe('Tela Análises', () => {
  test('ao abrir: pede ano civil sem ano e mostra título, resumo, cartões, ponte e os 8 gráficos', async () => {
    await abrir();
    expect(urlsAnalises()).toEqual(['/api/analises?periodo=ano&base=civil']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Execução financeira de 2026 (até 27/10)');
    expect(screen.getByText('Período em andamento')).toBeInTheDocument();

    const resumo = screen.getByTestId('resumo-analises');
    expect([...resumo.querySelectorAll('strong')].map((e) => e.textContent)).toEqual(['R$ 307 mil', '2 credores', 'R$ 799,90']);

    expect(screen.getByTestId('cartao-Empenhado')).toHaveTextContent('R$ 2.000,20');
    expect(screen.getByTestId('cartao-Empenhado')).toHaveTextContent('+100% sobre jan–out/2025');
    expect(screen.getByTestId('cartao-Saldo a pagar')).toHaveTextContent('sem base de comparação');
    expect(screen.getByTestId('cartao-Retido dos credores')).toHaveTextContent('−3,2% sobre jan–out/2025');
    expect(screen.getByTestId('cartao-Pago no período')).toHaveTextContent('de NEs anteriores');

    for (const t of [
      'Das NEs do período, 53% já foi pago e R$ 799,90 falta pagar',
      'Abril teve o maior pagamento: R$ 306 mil',
      'Transporte ficou com 60% do que foi pago',
      '12 OPs no período, com média de R$ 26 mil por OP',
      'Os 2 maiores receberam 100% do total pago',
      'R$ 142,60 retidos dos credores no período',
      'R$ 50,00 de DARF ainda a recolher',
      '2 de 4 NEs ainda têm saldo a pagar',
      'Garanhuns recebeu 81% do transporte',
    ]) expect(screen.getByRole('heading', { level: 3, name: t })).toBeInTheDocument();
    expect(screen.getAllByText(/^Ano civil: OPs pela data/)).toHaveLength(1);
    expect((screen.getByLabelText('Ano') as HTMLSelectElement).value).toBe('2026');
    expect(urlsAnalises()).toHaveLength(1);
  });

  test('trocar período, base e ano refaz o pedido com os parâmetros', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: '1º semestre' }));
    await waitFor(() => expect(urlsAnalises().at(-1)).toBe('/api/analises?periodo=s1&ano=2026&base=civil'));
    fireEvent.click(screen.getByRole('button', { name: 'Exercício da NE' }));
    await waitFor(() => expect(urlsAnalises().at(-1)).toBe('/api/analises?periodo=s1&ano=2026&base=exercicio'));
    fireEvent.change(screen.getByLabelText('Ano'), { target: { value: '2025' } });
    await waitFor(() => expect(urlsAnalises().at(-1)).toBe('/api/analises?periodo=s1&ano=2025&base=exercicio'));
    expect(screen.getByRole('button', { name: 'Exercício da NE' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('uma resposta atrasada não substitui a do filtro atual', async () => {
    let liberarAno: (v: any) => void = () => {};
    let primeira = true;
    mockApi({
      analises: (url) => {
        if (url.includes('periodo=s1')) return { ...respostaExemplo(), periodo: { ...respostaExemplo().periodo, rotulo: '1º semestre de 2026' } };
        if (primeira) {
          primeira = false;
          return respostaExemplo();
        }
        return new Promise((r) => (liberarAno = r));
      },
    });
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    fireEvent.click(screen.getByRole('button', { name: '1º semestre' }));
    expect(await screen.findByRole('heading', { level: 1, name: /1º semestre de 2026/ })).toBeInTheDocument();
    liberarAno({ ...respostaExemplo(), periodo: { ...respostaExemplo().periodo, rotulo: 'ATRASADA' } });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/ATRASADA/)).toBeNull();
    // e o resultado atual continua na tela (a atrasada não apaga o que já chegou)
    expect(screen.getByRole('heading', { level: 1, name: /1º semestre de 2026/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Carregando as análises')).toBeNull();
  });

  test('intervalo: abre preenchido; data invertida mostra a mensagem e não pede; corrigida, pede', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Intervalo' }));
    expect((screen.getByLabelText('De') as HTMLInputElement).value).toBe('2026-01-01');
    expect((screen.getByLabelText('Até') as HTMLInputElement).value).toBe('2026-10-27');
    await waitFor(() => expect(urlsAnalises().at(-1)).toBe('/api/analises?periodo=intervalo&inicio=2026-01-01&fim=2026-10-27&base=civil'));

    const antes = urlsAnalises().length;
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-11-01' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('A data de início é depois da data de fim.');
    await new Promise((r) => setTimeout(r, 20));
    expect(urlsAnalises()).toHaveLength(antes);

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-03-01' } });
    await waitFor(() => expect(urlsAnalises().at(-1)).toBe('/api/analises?periodo=intervalo&inicio=2026-03-01&fim=2026-10-27&base=civil'));
  });

  test('elemento: pela lista (só os ativos), pelo clique na barra e o chip ✕ tira', async () => {
    await abrir();
    const lista = screen.getByLabelText('Elemento') as HTMLSelectElement;
    await waitFor(() => expect(within(lista).getAllByRole('option')).toHaveLength(3));
    expect(within(lista).queryByText(/Inativo/)).toBeNull();

    fireEvent.change(lista, { target: { value: '3.3.90.36' } });
    await waitFor(() => expect(urlsAnalises().at(-1)).toBe('/api/analises?periodo=ano&base=civil&elemento=3.3.90.36'));

    fireEvent.click(await screen.findByRole('button', { name: /^3\.3\.90\.33 Transporte: R\$ 184\.308,80/ }));
    await waitFor(() => expect(urlsAnalises().at(-1)).toContain('elemento=3.3.90.33'));

    fireEvent.click(screen.getByRole('button', { name: 'Tirar o filtro do elemento 3.3.90.33' }));
    await waitFor(() => expect(urlsAnalises().at(-1)).not.toContain('elemento'));
  });

  test('clicar num mês abre o painel com as OPs do recorte; não pede duas vezes', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: /^Abril: empenhado/ }));
    const painel = await screen.findByRole('dialog');
    expect(within(painel).getByText('Abril/2026')).toBeInTheDocument();
    await within(painel).findByText('Álvaro Souza');
    expect(urlsOps()).toEqual(['/api/analises/ops?inicio=2026-04-01&fim=2026-04-30&base=civil&ano=2026']);
    expect(within(painel).getByRole('link', { name: '2026.OP.0001' })).toHaveAttribute('href', '/consulta-impressao?ne=2026NE000001&ops=op1');
    expect(within(painel).getByText('restos a pagar')).toBeInTheDocument();
    expect(within(painel).getByText('Total R$ 1.100,00')).toBeInTheDocument();
    expect(within(painel).getByText('2 OPs')).toBeInTheDocument();

    fireEvent.keyDown(painel, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /^Abril: empenhado/ }));
    await screen.findByRole('dialog');
    expect(urlsOps()).toHaveLength(1);
  });

  test('mês atual: o recorte para no fim efetivo; truncado mostra "Mostrando 500 de N"', async () => {
    mockApi({ ops: () => ({ ...OPS, qtd: 812, truncado: true }) });
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: /^Outubro: empenhado/ }));
    const painel = await screen.findByRole('dialog');
    await within(painel).findByText('Álvaro Souza');
    expect(urlsOps().at(-1)).toBe('/api/analises/ops?inicio=2026-10-01&fim=2026-10-27&base=civil&ano=2026');
    expect(within(painel).getByText('Mostrando 500 de 812 OPs')).toBeInTheDocument();
  });

  test('erro no detalhe: mensagem e "Tentar de novo"', async () => {
    let falhar = true;
    mockApi({ ops: () => (falhar ? Promise.reject(new Error('Falha no servidor')) : OPS) });
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: /^Abril: empenhado/ }));
    const painel = await screen.findByRole('dialog');
    expect(await within(painel).findByText('Falha no servidor')).toBeInTheDocument();
    falhar = false;
    fireEvent.click(within(painel).getByRole('button', { name: 'Tentar de novo' }));
    expect(await within(painel).findByText('Álvaro Souza')).toBeInTheDocument();
  });

  test('avisos da API aparecem na faixa', async () => {
    mockApi({ analises: () => ({ ...respostaExemplo(), avisos: ['1 NE(s) com pagamento acima do valor empenhado.'] }) });
    await abrir();
    expect(screen.getByRole('status')).toHaveTextContent('1 NE(s) com pagamento acima do valor empenhado.');
  });

  test('vazio: a frase da API e "Sem movimento no período" nos gráficos', async () => {
    const r = respostaExemplo();
    mockApi({
      analises: () => ({
        ...r, vazio: true, qtdOps: 0, qtdNes: 0, elementos: [], credores: [], municipios: [],
        meses: r.meses.map((m) => ({ ...m, empenhado: 0, pago: 0, ops: 0, irrf: 0, iss: 0, inss: 0, sest: 0, patronal: 0 })),
        darf: r.darf.map((d) => ({ ...d, paga: 0, pendente: 0 })),
        ponte: { empenhado: 0, cancelado: 0, liquido: 0, retencoes: 0, saldo: 0 },
        resumo: [{ t: 'Nenhuma NE ou OP em 2026 (até 27/10).', forte: false }],
      }),
    });
    await abrir();
    expect(screen.getByTestId('resumo-analises')).toHaveTextContent('Nenhuma NE ou OP em 2026 (até 27/10).');
    expect(screen.getAllByText('Sem movimento no período.')).toHaveLength(9);
  });

  test('erro ao carregar: aviso, sem zeros, e "Tentar de novo" refaz o pedido', async () => {
    let falhar = true;
    mockApi({ analises: () => (falhar ? Promise.reject(new Error('Erro interno')) : respostaExemplo()) });
    render(<AnalisesPage />);
    expect(await screen.findByText('Não foi possível carregar as análises.')).toBeInTheDocument();
    expect(screen.queryByText(/R\$ 0,00/)).toBeNull();
    expect(screen.queryByTestId('resumo-analises')).toBeNull();
    falhar = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByTestId('resumo-analises')).toBeInTheDocument();
  });

  test('"Atualizar" refaz o pedido e mantém a tela na tela (sem esqueleto)', async () => {
    let responder: (v: any) => void = () => {};
    let primeira = true;
    mockApi({
      analises: () => {
        if (primeira) {
          primeira = false;
          return respostaExemplo();
        }
        return new Promise((r) => (responder = r));
      },
    });
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(urlsAnalises()).toHaveLength(2);
    expect(screen.getByTestId('resumo-analises')).toBeInTheDocument();
    expect(screen.queryByLabelText('Carregando as análises')).toBeNull();
    responder(respostaExemplo());
  });
});

describe('Relatório A4, CSV e filtros no endereço (B5)', () => {
  afterEach(() => {
    enderecoTela.busca = '';
    vi.unstubAllGlobals();
  });

  test('o link do relatório leva os filtros da tela, com o ano já resolvido', async () => {
    await abrir();
    expect(screen.getByRole('link', { name: /Relatório A4/ })).toHaveAttribute('href', '/analises/relatorio?periodo=ano&ano=2026&base=civil');
    fireEvent.click(screen.getByRole('button', { name: 'Exercício da NE' }));
    await screen.findByTestId('resumo-analises');
    await waitFor(() => expect(screen.getByRole('link', { name: /Relatório A4/ })).toHaveAttribute('href', '/analises/relatorio?periodo=ano&ano=2026&base=exercicio'));
  });

  test('a tela abre com os filtros que vêm no endereço (volta do relatório)', async () => {
    enderecoTela.busca = 'periodo=s1&ano=2025&base=exercicio&elemento=3.3.90.33';
    await abrir();
    expect(urlsAnalises()[0]).toBe('/api/analises?periodo=s1&ano=2025&base=exercicio&elemento=3.3.90.33');
  });

  test('filtro inválido no endereço cai no padrão', async () => {
    enderecoTela.busca = "periodo=trimestre&ano=1800&base=caixa&elemento=1'%20OR";
    await abrir();
    expect(urlsAnalises()[0]).toBe('/api/analises?periodo=ano&base=civil');
  });

  test('Exportar CSV baixa a planilha com os filtros da tela; com erro, avisa e não baixa', async () => {
    const criar = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() });
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['a']) }));
    vi.stubGlobal('fetch', fetchMock);
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(clique).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/analises/csv?periodo=ano&ano=2026&base=civil');

    const { toast } = await import('sonner');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'Período inválido.' }) })));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Período inválido.'));
    expect(clique).toHaveBeenCalledTimes(1);
    clique.mockRestore();
  });
});

describe('Menu lateral', () => {
  test('tem o item Análises apontando para /analises', async () => {
    const { Sidebar } = await import('@/components/sidebar');
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /Análises/ })).toHaveAttribute('href', '/analises');
  });
});
