// A3 (Pessoas físicas no IR) — a visão nova dentro da tela /darf, com a API simulada.
import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import DarfPage from '@/app/darf/page';

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

const ALVARO = {
  cpf: '11122233396', cpfFormatado: '111.222.333-96', nome: 'Álvaro Souza', qtdOps: 2,
  bruto: 1000.1, irrf: 0.1, inss: 110, iss: 50, liquido: 840,
  naturezas: [{ codigo: '3.3.90.33', descricao: 'Transporte' }, { codigo: '3.3.90.36', descricao: 'Outros serviços PF' }],
  informado: { em: '2026-10-26 09:15', porNome: 'Ana Gestora', observacao: 'Enviado' },
};
const BRUNO = {
  cpf: '22233344405', cpfFormatado: '222.333.444-05', nome: 'Bruno Lima', qtdOps: 1,
  bruto: 0.2, irrf: 0.2, inss: 0, iss: 0, liquido: 0,
  naturezas: [{ codigo: '3.3.90.36', descricao: 'Outros serviços PF' }],
  informado: null,
};
const TOTAIS = { pessoas: 2, informadas: 1, pendentes: 1, qtdOps: 3, bruto: 1000.3, irrf: 0.3, inss: 110, iss: 50, liquido: 840 };
const relatorio = (ano = 2026, pessoas: any[] = [ALVARO, BRUNO], totais: any = TOTAIS) => ({ ano, anos: [2026, 2025], pessoas, totais });

const DARF_VAZIA = {
  agrupar: 'op', itens: [],
  totais: { pendente: { qtd: 0, valor: 0, credores: 0 }, paga: { qtd: 0, valor: 0, credores: 0 } },
  pagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
};

type Respostas = { perfil?: string; ir?: (url: string) => any };
function mockApi({ perfil = 'GESTOR', ir = () => relatorio() }: Respostas = {}) {
  (apiClient.get as any).mockImplementation(async (url: string) => {
    if (url.startsWith('/api/perfil')) return { usuario: { perfil } };
    if (url.startsWith('/api/darf/pessoas-fisicas/1') || url.startsWith('/api/darf/pessoas-fisicas/2')) {
      return {
        ano: 2026, cpf: url.split('/')[4].split('?')[0],
        ops: [{ id: 'op1', numeroOp: '2026.OP.0001', sub: '01', numeroNe: '2026NE000001', elemento: '3.3.90.33 - Transporte', data: '2026-03-10', bruto: 500, irrf: 0, inss: 55, iss: 25, liquido: 420 }],
      };
    }
    if (url.startsWith('/api/darf/pessoas-fisicas')) return ir(url);
    if (url.startsWith('/api/darf')) return DARF_VAZIA;
    throw new Error(`URL inesperada: ${url}`);
  });
  (apiClient.post as any).mockResolvedValue({ success: true, informado: true });
}

const urlsIr = () => (apiClient.get as any).mock.calls.map((c: any[]) => c[0] as string).filter((u: string) => u.startsWith('/api/darf/pessoas-fisicas'));

async function abrirIr() {
  render(<DarfPage />);
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/perfil'));
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Pessoas físicas (IR)' }));
  return screen.findByText('Álvaro Souza');
}

const caixa = (nome: string) => screen.getByLabelText(`Marcar ${nome} como informado no IR de 2026`) as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi();
});

describe('Visão "Pessoas físicas (IR)" na aba DARF', () => {
  test('a página abre na DARF; a visão do IR pede o relatório sem ano e mostra pessoas, cartões e o ano', async () => {
    render(<DarfPage />);
    expect(screen.getByRole('tab', { name: 'Recolhimento (DARF)' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Nenhuma DARF neste mês.')).toBeInTheDocument();
    expect(urlsIr()).toEqual([]);

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Pessoas físicas (IR)' }));
    expect(await screen.findByText('Álvaro Souza')).toBeInTheDocument();
    expect(urlsIr()).toEqual(['/api/darf/pessoas-fisicas']);

    const linhas: Array<string | null> = screen.getAllByRole('row').map((r: HTMLElement) => r.textContent);
    expect(linhas.findIndex((t) => t?.includes('Álvaro'))).toBeLessThan(linhas.findIndex((t) => t?.includes('Bruno')));
    expect(screen.getByTestId('ir-resumo-bruto')).toHaveTextContent('R$ 1.000,30');
    expect(screen.getByTestId('ir-resumo-irrf')).toHaveTextContent('R$ 0,30');
    expect(screen.getByTestId('ir-resumo-pessoas')).toHaveTextContent('1 informada');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect((screen.getByLabelText('Ano') as HTMLSelectElement).value).toBe('2026');
    expect(within(screen.getByLabelText('Ano')).getAllByRole('option').map((o: HTMLElement) => o.textContent)).toEqual(['2026', '2025']);
    expect(screen.getByTitle('Transporte')).toHaveTextContent('3.3.90.33');
    expect(urlsIr()).toHaveLength(1); // nenhum pedido extra só para "confirmar" o ano
  });

  test('trocar de ano pede ?ano=2025; a resposta atrasada de 2026 não substitui a de 2025', async () => {
    let liberar2026: (v: any) => void = () => {};
    let pedidos2026 = 0;
    mockApi({
      ir: (url) => {
        if (url.endsWith('?ano=2025')) return relatorio(2025, [{ ...BRUNO, nome: 'Carla de 2025' }], { ...TOTAIS, pessoas: 1 });
        pedidos2026 += 1;
        return pedidos2026 === 1 ? relatorio() : new Promise((r) => (liberar2026 = r));
      },
    });
    await abrirIr();

    fireEvent.change(screen.getByLabelText('Ano'), { target: { value: '2025' } });
    expect(await screen.findByText('Carla de 2025')).toBeInTheDocument();
    expect(urlsIr()).toContain('/api/darf/pessoas-fisicas?ano=2025');

    fireEvent.change(screen.getByLabelText('Ano'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('Ano'), { target: { value: '2025' } });
    liberar2026(relatorio(2026, [{ ...ALVARO, nome: 'Atrasado de 2026' }]));
    expect(await screen.findByText('Carla de 2025')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('Atrasado de 2026')).toBeNull();
  });

  test('voltar para "Recolhimento (DARF)" mostra a DARF de novo', async () => {
    await abrirIr();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Recolhimento (DARF)' }));
    expect(await screen.findByLabelText('Competência')).toBeInTheDocument();
    expect(screen.queryByText('Álvaro Souza')).toBeNull();
  });

  test('busca sem acento, situação "Pendentes" e o rodapé soma só as visíveis', async () => {
    await abrirIr();
    expect(screen.getByTestId('ir-rodape')).toHaveTextContent('Mostrando 2 de 2 pessoa(s)');

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'alvaro' } });
    await waitFor(() => expect(screen.queryByText('Bruno Lima')).toBeNull());
    expect(screen.getByText('Álvaro Souza')).toBeInTheDocument();
    expect(screen.getByTestId('ir-rodape')).toHaveTextContent('Mostrando 1 de 2 pessoa(s)');
    expect(screen.getByTestId('ir-rodape')).toHaveTextContent('1.000,10');
    // os cartões continuam com o ano inteiro
    expect(screen.getByTestId('ir-resumo-bruto')).toHaveTextContent('R$ 1.000,30');

    fireEvent.click(screen.getByRole('radio', { name: 'Pendentes' }));
    expect(await screen.findByText('Nenhuma pessoa encontrada com estes filtros.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: '' } });
    expect(await screen.findByText('Bruno Lima')).toBeInTheDocument();
    expect(screen.queryByText('Álvaro Souza')).toBeNull();
    expect(urlsIr()).toHaveLength(1); // filtrar não vai ao servidor
  });

  test('marcar: um clique envia {ano, cpf, informado: true}, trava a caixinha até a resposta e recarrega', async () => {
    let responder: (v: any) => void = () => {};
    (apiClient.post as any).mockImplementation(() => new Promise((r) => (responder = r)));
    await abrirIr();

    fireEvent.click(caixa('Bruno Lima'));
    expect(apiClient.post).toHaveBeenCalledWith('/api/darf/pessoas-fisicas/informado', { ano: 2026, cpf: '22233344405', informado: true });
    await waitFor(() => expect(caixa('Bruno Lima')).toBeDisabled());
    expect(caixa('Bruno Lima').checked).toBe(false); // sem marcar antes do servidor confirmar
    fireEvent.click(caixa('Bruno Lima'));
    expect(apiClient.post).toHaveBeenCalledTimes(1);

    responder({ success: true, informado: true });
    await waitFor(() => expect(urlsIr()).toHaveLength(2));
    await waitFor(() => expect(caixa('Bruno Lima')).not.toBeDisabled());
    expect(toast.success).toHaveBeenCalled();
    expect(screen.getByText('Bruno Lima')).toBeInTheDocument(); // recarregou sem esvaziar a lista
  });

  test('erro ao marcar: mostra a mensagem do servidor e a caixinha continua desmarcada', async () => {
    (apiClient.post as any).mockRejectedValue(new Error('Esta pessoa não tem pagamentos em 2026.'));
    await abrirIr();
    fireEvent.click(caixa('Bruno Lima'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Esta pessoa não tem pagamentos em 2026.'));
    expect(caixa('Bruno Lima').checked).toBe(false);
    expect(caixa('Bruno Lima')).not.toBeDisabled();
    expect(urlsIr()).toHaveLength(1);
  });

  test('desmarcar pede confirmação: cancelar não envia, confirmar envia informado: false', async () => {
    await abrirIr();
    fireEvent.click(caixa('Álvaro Souza'));
    let alerta = await screen.findByRole('alertdialog');
    expect(alerta).toHaveTextContent('Desmarcar Álvaro Souza?');
    fireEvent.click(within(alerta).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(apiClient.post).not.toHaveBeenCalled();

    fireEvent.click(caixa('Álvaro Souza'));
    alerta = await screen.findByRole('alertdialog');
    fireEvent.click(within(alerta).getByRole('button', { name: 'Desmarcar' }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/api/darf/pessoas-fisicas/informado', { ano: 2026, cpf: '11122233396', informado: false })
    );
  });

  test('perfil Consulta: sem caixinhas, com selos, e a observação só para leitura', async () => {
    mockApi({ perfil: 'CONSULTA' });
    await abrirIr();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText('Informado')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalhes de Álvaro Souza' }));
    expect(await screen.findByText('Enviado')).toBeInTheDocument();
    expect(screen.queryByLabelText('Observação')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salvar observação' })).toBeNull();
  });

  test('detalhes: pede as OPs uma vez só, mostra o link da impressão e salva a observação', async () => {
    await abrirIr();
    const botao = () => screen.getByRole('button', { name: /detalhes de Álvaro Souza/ });
    fireEvent.click(botao());
    expect(await screen.findByRole('link', { name: '2026.OP.0001' })).toHaveAttribute('href', '/consulta-impressao?ne=2026NE000001&ops=op1');
    expect(screen.getByText('Informado em', { exact: false })).toHaveTextContent('26/10/2026 09:15 por Ana Gestora');
    expect(urlsIr()).toContain('/api/darf/pessoas-fisicas/11122233396?ano=2026');

    fireEvent.click(botao()); // fecha
    fireEvent.click(botao()); // abre de novo
    await screen.findByRole('link', { name: '2026.OP.0001' });
    expect(urlsIr().filter((u: string) => u.includes('/11122233396'))).toHaveLength(1);

    const obs = screen.getByLabelText('Observação') as HTMLInputElement;
    expect(obs.value).toBe('Enviado');
    expect(screen.getByRole('button', { name: 'Salvar observação' })).toBeDisabled(); // nada mudou
    fireEvent.change(obs, { target: { value: 'Enviado por e-mail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar observação' }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/api/darf/pessoas-fisicas/informado', {
        ano: 2026, cpf: '11122233396', informado: true, observacao: 'Enviado por e-mail',
      })
    );
  });

  test('pessoa pendente: o painel diz que ainda não foi informada e não oferece observação', async () => {
    await abrirIr();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalhes de Bruno Lima' }));
    expect(await screen.findByText('Ainda não informado no IR de 2026.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Observação')).toBeNull();
  });

  test('ano sem pessoas e erro ao carregar têm mensagens diferentes', async () => {
    mockApi({ ir: () => relatorio(2026, [], { ...TOTAIS, pessoas: 0, informadas: 0, pendentes: 0 }) });
    render(<DarfPage />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Pessoas físicas (IR)' }));
    expect(await screen.findByText('Nenhuma pessoa física recebeu pagamento em 2026.')).toBeInTheDocument();
  });

  test('erro ao carregar: avisa, não diz "ninguém recebeu" e deixa tentar de novo', async () => {
    let falhar = true;
    mockApi({ ir: () => (falhar ? Promise.reject(new Error('Erro do servidor')) : relatorio()) });
    render(<DarfPage />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Pessoas físicas (IR)' }));
    expect(await screen.findByText('Não foi possível carregar o relatório.')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Erro do servidor');
    expect(screen.queryByText(/Nenhuma pessoa física/)).toBeNull();

    falhar = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Álvaro Souza')).toBeInTheDocument();
  });
});

describe('Exportar CSV do ano', () => {
  const criarUrl = vi.fn(() => 'blob:planilha');
  let cliques: HTMLAnchorElement[] = [];

  beforeEach(() => {
    cliques = [];
    Object.assign(URL, { createObjectURL: criarUrl, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      cliques.push(this);
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('baixa pessoas-fisicas-ir-2026.csv pelo fetch, com o botão travado durante o download', async () => {
    let responder: (v: any) => void = () => {};
    const fetchMock = vi.fn(() => new Promise((r) => (responder = r)));
    vi.stubGlobal('fetch', fetchMock);
    await abrirIr();

    const botao = screen.getByRole('button', { name: 'Exportar CSV do ano' });
    fireEvent.click(botao);
    expect(fetchMock).toHaveBeenCalledWith('/api/darf/pessoas-fisicas/csv?ano=2026');
    expect(await screen.findByRole('button', { name: 'Exportando...' })).toBeDisabled();

    responder({ ok: true, blob: async () => new Blob(['\uFEFFAno;CPF'], { type: 'text/csv' }) });
    await waitFor(() => expect(cliques).toHaveLength(1));
    expect(cliques[0].download).toBe('pessoas-fisicas-ir-2026.csv');
    expect(cliques[0].getAttribute('href')).toBe('blob:planilha');
    expect(await screen.findByRole('button', { name: 'Exportar CSV do ano' })).not.toBeDisabled();
  });

  test('erro do servidor: mostra a mensagem e não baixa nada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'Ano inválido (use AAAA, entre 2000 e 2100).' }) })));
    await abrirIr();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV do ano' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Ano inválido (use AAAA, entre 2000 e 2100).'));
    expect(criarUrl).not.toHaveBeenCalled();
    expect(cliques).toHaveLength(0);
  });
});
