// B6 — modo apresentação (/analises/apresentacao) com a API simulada.
import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ApresentacaoPage from '@/app/analises/apresentacao/page';
import { respostaExemplo } from '@/tests/fixtures/analises-resposta';

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }));
const nav = vi.hoisted(() => ({ busca: 'periodo=ano&ano=2026&base=civil', push: (() => {}) as (u: string) => void }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.busca),
  useRouter: () => ({ push: (u: string) => nav.push(u) }),
}));
import { apiClient } from '@/lib/api-client';

type R = () => any;
function mockApi({ analises = () => respostaExemplo(), ident = () => ({ orgao: 'Secretaria de Educação', setor: 'Gerência Financeira' }) }: { analises?: R; ident?: R } = {}) {
  (apiClient.get as any).mockImplementation(async (url: string) => (url.startsWith('/api/configuracoes') ? ident() : analises()));
}

const abrir = async () => {
  const r = render(<ApresentacaoPage />);
  await screen.findByTestId('palco');
  return r;
};
const tecla = (key: string, alvo: EventTarget = window) => fireEvent.keyDown(alvo, { key });
const contador = () => screen.getByTestId('contador').textContent;

beforeEach(() => {
  vi.clearAllMocks();
  nav.busca = 'periodo=ano&ano=2026&base=civil';
  nav.push = vi.fn();
  window.history.replaceState(null, '', '/analises/apresentacao');
  document.body.style.overflow = 'auto';
  mockApi();
});
afterEach(() => {
  // @ts-expect-error limpar o simulado
  delete document.fullscreenElement;
});

describe('Modo apresentação', () => {
  test('abre no slide 1 com as frases, o órgão no rodapé e os dados dos filtros do endereço', async () => {
    await abrir();
    expect((apiClient.get as any).mock.calls.map((c: any[]) => c[0])).toEqual(['/api/analises?periodo=ano&ano=2026&base=civil', '/api/configuracoes/identificacao']);
    expect(screen.getByTestId('abertura-principal')).toHaveTextContent('R$ 307 mil pagos a 2 credores, 25% a mais que em jan–out/2025');
    expect(screen.getByTestId('abertura-apoio')).toHaveTextContent('53% das NEs do período já foi pago. Restam R$ 799,90 a pagar.');
    expect(screen.getByTestId('abertura-rodape')).toHaveTextContent('Secretaria de Educação · Gerência Financeira');
    expect(contador()).toBe('1 / 3');
    expect(screen.getByTestId('palco')).toHaveAttribute('aria-label', 'Slide 1 de 3: Abertura');
    expect(screen.getByText('Período em andamento')).toBeInTheDocument();
  });

  test('teclado: → avança até o 3 sem dar a volta; ← volta; Home e End; PageDown e espaço', async () => {
    await abrir();
    tecla('ArrowRight');
    expect(contador()).toBe('2 / 3');
    expect(screen.getByRole('heading', { level: 2, name: 'Das NEs do período, 53% já foi pago e R$ 799,90 falta pagar' })).toBeInTheDocument();
    expect(screen.getByTestId('cascata-saldo')).toBeInTheDocument();
    tecla(' ');
    expect(contador()).toBe('3 / 3');
    expect(screen.getByRole('heading', { level: 2, name: 'Transporte ficou com 60% do que foi pago' })).toBeInTheDocument();
    tecla('ArrowRight');
    tecla('PageDown');
    expect(contador()).toBe('3 / 3');
    tecla('ArrowLeft');
    expect(contador()).toBe('2 / 3');
    tecla('Home');
    expect(contador()).toBe('1 / 3');
    tecla('ArrowLeft');
    expect(contador()).toBe('1 / 3');
    tecla('End');
    expect(contador()).toBe('3 / 3');
    tecla('PageUp');
    expect(contador()).toBe('2 / 3');
  });

  test('botões ‹ ›, com ‹ desabilitado no primeiro e › no último', async () => {
    await abrir();
    expect(screen.getByRole('button', { name: 'Slide anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo slide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próximo slide' }));
    expect(contador()).toBe('3 / 3');
    expect(screen.getByRole('button', { name: 'Próximo slide' })).toBeDisabled();
  });

  test('Esc e o botão Sair voltam para Análises com os mesmos filtros', async () => {
    await abrir();
    tecla('Escape');
    expect(nav.push).toHaveBeenCalledWith('/analises?periodo=ano&ano=2026&base=civil');
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(nav.push).toHaveBeenCalledTimes(2);
  });

  test('o ouvinte de teclado sai junto com a apresentação; tecla em campo de texto não troca o slide', async () => {
    const { unmount } = await abrir();
    const campo = document.createElement('input');
    document.body.appendChild(campo);
    tecla('ArrowRight', campo);
    expect(contador()).toBe('1 / 3');
    unmount();
    tecla('Escape');
    expect(nav.push).not.toHaveBeenCalled();
    campo.remove();
  });

  test('tela cheia: F e o botão pedem; recusada, avisa "F11" e continua; ativa, F sai', async () => {
    const pedir = vi.fn().mockRejectedValueOnce(new Error('negado')).mockResolvedValue(undefined);
    const sairTC = vi.fn().mockResolvedValue(undefined);
    Element.prototype.requestFullscreen = pedir;
    document.exitFullscreen = sairTC;
    await abrir();

    tecla('f');
    await waitFor(() => expect(pedir).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Use F11 para tela cheia.')).toBeInTheDocument();
    tecla('ArrowRight');
    expect(contador()).toBe('2 / 3');

    fireEvent.click(screen.getByRole('button', { name: 'Tela cheia' }));
    await waitFor(() => expect(pedir).toHaveBeenCalledTimes(2));

    Object.defineProperty(document, 'fullscreenElement', { value: document.body, configurable: true });
    fireEvent(document, new Event('fullscreenchange'));
    expect(await screen.findByRole('button', { name: 'Sair da tela cheia' })).toBeInTheDocument();
    tecla('F');
    await waitFor(() => expect(sairTC).toHaveBeenCalledTimes(1));
  });

  test('#2 no endereço abre no slide 2; trocar de slide atualiza o # sem histórico novo', async () => {
    window.history.replaceState(null, '', '/analises/apresentacao?periodo=ano#2');
    const troca = vi.spyOn(window.history, 'replaceState');
    await abrir();
    expect(contador()).toBe('2 / 3');
    tecla('ArrowRight');
    await waitFor(() => expect(troca).toHaveBeenLastCalledWith(null, '', '/analises/apresentacao?periodo=ano#3'));
    troca.mockRestore();
  });

  test('toque: deslizar 80 px para a esquerda avança; 30 px não troca', async () => {
    await abrir();
    const raiz = screen.getByTestId('palco').parentElement!;
    fireEvent.touchStart(raiz, { touches: [{ clientX: 300 }] });
    fireEvent.touchEnd(raiz, { changedTouches: [{ clientX: 270 }] });
    expect(contador()).toBe('1 / 3');
    fireEvent.touchStart(raiz, { touches: [{ clientX: 300 }] });
    fireEvent.touchEnd(raiz, { changedTouches: [{ clientX: 220 }] });
    expect(contador()).toBe('2 / 3');
  });

  test('a rolagem do sistema trava enquanto aberta e volta ao sair', async () => {
    const { unmount } = await abrir();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
  });

  test('sem identificação, o rodapé diz "Estado de Pernambuco"', async () => {
    mockApi({ ident: () => Promise.reject(new Error('ER_NO_SUCH_TABLE')) });
    await abrir();
    expect(screen.getByTestId('abertura-rodape')).toHaveTextContent('Estado de Pernambuco');
  });

  test('vazio: a frase da API no 1 e "Sem movimento no período" no 2 e no 3', async () => {
    const r = respostaExemplo();
    mockApi({
      analises: () => ({
        ...r, vazio: true, qtdOps: 0, elementos: [],
        ponte: { empenhado: 0, cancelado: 0, liquido: 0, retencoes: 0, saldo: 0 },
        resumo: [{ t: 'Nenhuma NE ou OP em 2026 (até 27/10).', forte: false }],
      }),
    });
    await abrir();
    expect(screen.getByTestId('abertura-principal')).toHaveTextContent('Nenhuma NE ou OP em 2026 (até 27/10).');
    expect(screen.queryByTestId('abertura-apoio')).toBeNull();
    tecla('ArrowRight');
    expect(screen.getByText('Sem movimento no período.')).toBeInTheDocument();
    tecla('ArrowRight');
    expect(screen.getByText('Sem movimento no período.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  test('erro: mensagem, "Tentar de novo" e "Sair"', async () => {
    let falhar = true;
    mockApi({ analises: () => (falhar ? Promise.reject(new Error('Erro interno')) : respostaExemplo()) });
    render(<ApresentacaoPage />);
    expect(await screen.findByText('Não foi possível preparar a apresentação.')).toBeInTheDocument();
    falhar = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByTestId('palco')).toBeInTheDocument();
  });
});
