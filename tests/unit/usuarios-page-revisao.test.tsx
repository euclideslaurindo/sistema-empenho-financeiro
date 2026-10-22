import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// Revisão da aba 8 (Usuários), tela: perfis e troca de perfil (U1), senha
// mínima (U2), formulário limpo (U4), acesso e botões (U5), nomes e
// paginação (U6). E o getAuthUser lendo o perfil do banco (troca imediata).

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import UsuariosPage from '@/app/usuarios/page';

const EU = { id: 'admin-2', nome: 'TESTE Eu', email: 'eu@x', perfil: 'ADMIN', ativo: 1 };
const RAIZ = { id: 'user-admin-1', nome: 'Administrador', email: 'admin@admin.com', perfil: 'ADMIN', ativo: 1 };
const ANA = { id: 'u3', nome: 'TESTE Ana', email: 'ana@x', perfil: 'GESTOR', ativo: 1 };
let lista: any[] = [EU, RAIZ, ANA];

const comoAdmin = () => useAppStore.setState({ userProfile: { id: 'admin-2', nome: 'TESTE Eu', email: 'eu@x', perfil: 'ADMIN' } });

describe('Usuários — revisão da aba 8', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lista = [EU, RAIZ, ANA];
    (apiClient.get as any).mockImplementation(async () => ({ usuarios: lista }));
    (apiClient.post as any).mockResolvedValue({ success: true });
    (apiClient.put as any).mockResolvedValue({ success: true });
    (apiClient.delete as any).mockResolvedValue({ success: true });
    comoAdmin();
  });
  afterEach(() => useAppStore.setState({ userProfile: null }));

  test('U5: quem não é admin vê o aviso e a lista nem é pedida', () => {
    useAppStore.setState({ userProfile: { id: 'g', nome: 'G', email: 'g', perfil: 'USER' as any } });
    render(<UsuariosPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Acesso restrito a administradores.');
    expect(screen.queryByRole('button', { name: /Novo Usuário/ })).toBeNull();
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  test('U5: sem bloquear/excluir/trocar perfil na linha do próprio usuário e do admin raiz', async () => {
    render(<UsuariosPage />);
    const minha = (await screen.findByText('TESTE Eu')).closest('tr')!;
    const raiz = screen.getByText('Administrador', { selector: 'td' }).closest('tr')!;
    for (const linha of [minha, raiz]) {
      expect(within(linha).queryByRole('button')).toBeNull();
      expect(within(linha).queryByRole('combobox')).toBeNull();
    }
    expect(within(minha).getByText('Você')).toBeInTheDocument();
    expect(within(raiz).getByText('Admin raiz')).toBeInTheDocument();
    const ana = screen.getByText('TESTE Ana').closest('tr')!;
    expect(within(ana).getByRole('button', { name: 'Bloquear TESTE Ana' })).toBeInTheDocument();
    expect(within(ana).getByRole('button', { name: 'Excluir TESTE Ana' })).toBeInTheDocument();
  });

  test('U6: perfis com os nomes do Meu Perfil', async () => {
    render(<UsuariosPage />);
    const minha = (await screen.findByText('TESTE Eu')).closest('tr')!;
    expect(within(minha).getByText('Administrador')).toBeInTheDocument();
    expect(screen.queryByText('GESTOR')).toBeNull();
    expect((screen.getByLabelText('Perfil de TESTE Ana') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Gestor');
  });

  test('U1: trocar o perfil pede confirmação e envia o novo perfil', async () => {
    render(<UsuariosPage />);
    fireEvent.change(await screen.findByLabelText('Perfil de TESTE Ana'), { target: { value: 'CONSULTA' } });
    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveTextContent('TESTE Ana passa de Gestor para Consulta (somente leitura)');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Trocar perfil' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/usuarios/u3', { perfil: 'CONSULTA' }));
  });

  test('U1/U2: criar oferece os três perfis; senha curta é recusada antes de enviar', async () => {
    render(<UsuariosPage />);
    await screen.findByText('TESTE Ana');
    fireEvent.click(screen.getByRole('button', { name: /Novo Usuário/ }));
    const opcoes = Array.from((screen.getByLabelText('Perfil') as HTMLSelectElement).options).map((o) => o.textContent);
    expect(opcoes).toEqual(['Administrador', 'Gestor', 'Consulta (somente leitura)']);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'TESTE Novo' } });
    fireEvent.change(screen.getByLabelText('E-mail (Login)'), { target: { value: 'novo@x.gov.br' } });
    fireEvent.change(screen.getByLabelText('Senha Provisória'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(toast.error).toHaveBeenCalledWith('A senha provisória deve ter no mínimo 8 caracteres.');
    expect(apiClient.post).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Senha Provisória'), { target: { value: '12345678' } });
    fireEvent.change(screen.getByLabelText('Perfil'), { target: { value: 'CONSULTA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect((apiClient.post as any).mock.calls[0][1]).toEqual({ nome: 'TESTE Novo', email: 'novo@x.gov.br', senha: '12345678', perfil: 'CONSULTA' });
  });

  test('U4: "Novo Usuário" abre sempre limpo (sem a senha do anterior)', async () => {
    render(<UsuariosPage />);
    await screen.findByText('TESTE Ana');
    fireEvent.click(screen.getByRole('button', { name: /Novo Usuário/ }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'TESTE Rascunho' } });
    fireEvent.change(screen.getByLabelText('Senha Provisória'), { target: { value: 'segredo123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByLabelText('Nome')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /Novo Usuário/ }));
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Senha Provisória') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Perfil') as HTMLSelectElement).value).toBe('GESTOR');
  });

  test('U6: excluir o único da última página volta para a página anterior', async () => {
    const muitos = Array.from({ length: 11 }, (_, i) => ({ id: `x${i}`, nome: `TESTE ${String(i).padStart(2, '0')}`, email: `${i}@x`, perfil: 'GESTOR', ativo: 1 }));
    lista = muitos;
    render(<UsuariosPage />);
    await screen.findByText('TESTE 00');
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir TESTE 10' }));
    lista = muitos.slice(0, 10);
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(screen.getByText('TESTE 00')).toBeInTheDocument());
    expect(screen.queryByText('TESTE 10')).toBeNull();
  });
});

describe('getAuthUser: perfil do banco', () => {
  test('vale o perfil gravado no banco, não o do token', async () => {
    vi.resetModules();
    vi.doMock('@/lib/db', () => ({ query: vi.fn(async () => [{ ativo: 1, perfil: 'CONSULTA' }]) }));
    vi.doMock('jose', () => ({ jwtVerify: vi.fn(async () => ({ payload: { id: 'u3', nome: 'Ana', email: 'a', perfil: 'GESTOR' } })) }));
    const { getAuthUser } = await import('@/lib/auth');
    const req: any = { cookies: { get: () => ({ value: 'tok' }) } };
    expect((await getAuthUser(req))?.perfil).toBe('CONSULTA');
    vi.doUnmock('@/lib/db');
    vi.doUnmock('jose');
  });
});
