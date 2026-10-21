import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Revisão da aba 2 (Credores): CEP não apaga a rua, busca sem resultado velho,
// máscaras no preenchimento pelo CNPJ, botões sem função removidos,
// perfil Consulta e reativação de credor excluído.

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import Credores from '@/app/credores/page';

const lista = {
  credores: [
    { id: 'c1', nome: 'TESTE Empresa', cpfCnpj: '11.222.333/0001-81', isMei: 0, logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Recife', uf: 'PE', cep: '50000-000' },
  ],
  pagination: { totalPages: 1, total: 1 },
};
const valor = (rotulo: string) => (screen.getByLabelText(rotulo) as HTMLInputElement).value;

describe('Credores — revisão da aba 2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn() as any;
    useAppStore.setState({ userProfile: null });
    (apiClient.get as any).mockImplementation(async (url: string) => (url.includes('iss') ? { municipios: [] } : lista));
  });
  afterEach(() => useAppStore.setState({ userProfile: null }));

  test('C2: CEP geral (sem rua) não apaga logradouro e bairro já preenchidos', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ logradouro: '', bairro: '', localidade: 'Caruaru', uf: 'PE' }) })) as any;
    render(<Credores />);
    fireEvent.click(await screen.findByText('TESTE Empresa'));
    fireEvent.blur(screen.getByLabelText('CEP'), { target: { value: '55000-000' } });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Endereço preenchido!'));
    expect(valor('Logradouro')).toBe('Rua A');
    expect(valor('Bairro')).toBe('Centro');
    expect(valor('CEP')).toBe('55000-000');
  });

  test('C2: CEP com rua continua preenchendo a rua', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ logradouro: 'Av. Nova', bairro: 'Boa Vista', localidade: 'Recife', uf: 'PE' }) })) as any;
    render(<Credores />);
    fireEvent.click(await screen.findByText('TESTE Empresa'));
    fireEvent.blur(screen.getByLabelText('CEP'), { target: { value: '50050-000' } });
    await waitFor(() => expect(valor('Logradouro')).toBe('Av. Nova'));
    expect(valor('Bairro')).toBe('Boa Vista');
  });

  test('C4: a resposta de uma busca antiga não sobrescreve a da busca nova', async () => {
    let soltarAntiga: (v: any) => void = () => {};
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url.includes('iss')) return Promise.resolve({ municipios: [] });
      if (url.includes('busca=J&')) return new Promise((r) => { soltarAntiga = r; });
      if (url.includes('busca=Jo&')) return Promise.resolve({ credores: [{ id: 'j2', nome: 'TESTE Jose', cpfCnpj: '1' }], pagination: { totalPages: 1, total: 1 } });
      return Promise.resolve(lista);
    });
    render(<Credores />);
    await screen.findByText('TESTE Empresa');
    const busca = screen.getByPlaceholderText('Buscar credor...');
    fireEvent.change(busca, { target: { value: 'J' } });
    await waitFor(() => expect((apiClient.get as any).mock.calls.some(([u]: any[]) => u.includes('busca=J&'))).toBe(true));
    fireEvent.change(busca, { target: { value: 'Jo' } });
    await screen.findByText('TESTE Jose');
    await act(async () => soltarAntiga({ credores: [{ id: 'x', nome: 'Resultado Velho', cpfCnpj: '2' }], pagination: { totalPages: 1, total: 1 } }));
    expect(screen.getByText('TESTE Jose')).toBeInTheDocument();
    expect(screen.queryByText('Resultado Velho')).toBeNull();
  });

  test('C4: digitando rápido, consulta uma vez só (com o texto final)', async () => {
    render(<Credores />);
    await screen.findByText('TESTE Empresa');
    const busca = screen.getByPlaceholderText('Buscar credor...');
    for (const v of ['T', 'TE', 'TES', 'TEST']) fireEvent.change(busca, { target: { value: v } });
    await waitFor(() => expect((apiClient.get as any).mock.calls.some(([u]: any[]) => u.includes('busca=TEST&'))).toBe(true));
    const buscas = (apiClient.get as any).mock.calls.map(([u]: any[]) => u).filter((u: string) => /busca=T/.test(u));
    expect(buscas).toHaveLength(1);
  });

  test('C6: preenchimento pelo CNPJ põe CEP e telefone com máscara', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ razao_social: 'TESTE RECEITA', cep: '51000000', ddd_telefone_1: '8133334444', municipio: 'Olinda', uf: 'PE' }) })) as any;
    render(<Credores />);
    await screen.findByText('TESTE Empresa');
    fireEvent.change(screen.getByLabelText('CNPJ/CPF'), { target: { value: '11222333000181' } });
    fireEvent.blur(screen.getByLabelText('CNPJ/CPF'));
    await waitFor(() => expect(valor('CEP')).toBe('51000-000'));
    expect(valor('Telefone')).toBe('(81) 3333-4444');
  });

  describe('C1: consulta do CNPJ na Receita', () => {
    const receita = () => {
      global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ razao_social: 'RAZAO DA RECEITA', logradouro: 'Rua Receita', numero: '99', bairro: 'Bairro Receita', cep: '51000000', municipio: 'Olinda', uf: 'PE' }) })) as any;
    };

    test('editando um credor, passar pelo campo CNPJ não reconsulta nem troca o nome digitado', async () => {
      receita();
      render(<Credores />);
      fireEvent.click(await screen.findByText('TESTE Empresa'));
      fireEvent.change(screen.getByLabelText('Nome/Razão Social'), { target: { value: 'TESTE Nome Corrigido' } });
      fireEvent.blur(screen.getByLabelText('CNPJ/CPF'));
      await act(async () => {});
      expect(global.fetch).not.toHaveBeenCalled();
      expect(valor('Nome/Razão Social')).toBe('TESTE Nome Corrigido');
      expect(valor('Logradouro')).toBe('Rua A');
    });

    test('CNPJ trocado: consulta e preenche só os campos vazios', async () => {
      receita();
      render(<Credores />);
      fireEvent.click(await screen.findByText('TESTE Empresa'));
      fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '' } });
      fireEvent.change(screen.getByLabelText('CNPJ/CPF'), { target: { value: '12345678000195' } });
      fireEvent.blur(screen.getByLabelText('CNPJ/CPF'));
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Dados da Receita preenchidos nos campos vazios.'));
      expect(valor('Nome/Razão Social')).toBe('TESTE Empresa');
      expect(valor('Logradouro')).toBe('Rua A');
      expect(valor('CEP')).toBe('50000-000');
      expect(valor('Município')).toBe('Recife');
    });

    test('formulário vazio: preenche tudo, e sair do campo de novo não reconsulta', async () => {
      receita();
      render(<Credores />);
      await screen.findByText('TESTE Empresa');
      fireEvent.change(screen.getByLabelText('CNPJ/CPF'), { target: { value: '11222333000181' } });
      fireEvent.blur(screen.getByLabelText('CNPJ/CPF'));
      await waitFor(() => expect(valor('Nome/Razão Social')).toBe('RAZAO DA RECEITA'));
      expect(valor('Logradouro')).toBe('Rua Receita');
      expect(valor('Município')).toBe('Olinda');
      fireEvent.blur(screen.getByLabelText('CNPJ/CPF'));
      await act(async () => {});
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('falha de conexão: sair do campo de novo tenta outra vez', async () => {
      global.fetch = vi.fn(async () => { throw new Error('rede'); }) as any;
      render(<Credores />);
      await screen.findByText('TESTE Empresa');
      fireEvent.change(screen.getByLabelText('CNPJ/CPF'), { target: { value: '11222333000181' } });
      fireEvent.blur(screen.getByLabelText('CNPJ/CPF'));
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      fireEvent.blur(screen.getByLabelText('CNPJ/CPF'));
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    });
  });

  test('C7 e C8: sem o botão de "olho" e sem os links falsos do rodapé', async () => {
    render(<Credores />);
    await screen.findByText('TESTE Empresa');
    expect(screen.queryByTitle('Visualizar Detalhes')).toBeNull();
    expect(screen.queryByText('Termos de Uso')).toBeNull();
    expect(screen.queryByText('Política de Privacidade')).toBeNull();
    expect(screen.queryByText('Suporte')).toBeNull();
  });

  test('C9: perfil Consulta vê o aviso e os botões de alterar desabilitados', async () => {
    useAppStore.setState({ userProfile: { id: 'u', nome: 'X', email: 'x', perfil: 'CONSULTA' } });
    render(<Credores />);
    await screen.findByText('TESTE Empresa');
    expect(screen.getByRole('status')).toHaveTextContent('Seu perfil é Consulta');
    expect(screen.getByRole('button', { name: /Salvar/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Excluir$/ })).toBeDisabled();
    expect(screen.getByLabelText('Excluir credor')).toBeDisabled();
  });

  test('C9: outros perfis continuam com os botões habilitados', async () => {
    useAppStore.setState({ userProfile: { id: 'u', nome: 'X', email: 'x', perfil: 'ADMIN' } });
    render(<Credores />);
    await screen.findByText('TESTE Empresa');
    expect(screen.queryByText(/Seu perfil é Consulta/)).toBeNull();
    expect(screen.getByRole('button', { name: /Salvar/ })).toBeEnabled();
  });

  test('C3: ao reativar um credor excluído, a mensagem diz isso', async () => {
    (apiClient.post as any).mockResolvedValue({ success: true, id: 'antigo-1', reativado: true });
    render(<Credores />);
    await screen.findByText('TESTE Empresa');
    fireEvent.change(screen.getByLabelText('CNPJ/CPF'), { target: { value: '12345678909' } });
    fireEvent.change(screen.getByLabelText('Nome/Razão Social'), { target: { value: 'TESTE Volta' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('o cadastro foi reativado')));
  });
});
