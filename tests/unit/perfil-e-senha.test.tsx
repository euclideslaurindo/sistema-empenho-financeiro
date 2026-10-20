import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Revisão da aba 1 (Login e Perfil): perfil real no lugar de "Nível 1", sem
// campos falsos/fixos, e confirmação da nova senha.

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/perfil' }));

import { toast } from 'sonner';
import PerfilGestor from '@/app/perfil/page';
import { ChangePasswordModal } from '@/components/change-password-modal';

describe('tela de Perfil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        usuario: { id: 'u1', nome: 'TESTE Maria', email: 'maria@x.gov.br', perfil: 'GESTOR', ativo: 1, ultimo_acesso: '2026-10-20T10:00:00Z' },
      }),
    })) as any;
  });

  test('mostra o perfil real e não tem mais Nível, Matrícula, Departamento fixo nem Notificações', async () => {
    render(<PerfilGestor />);
    expect(await screen.findByText('Perfil: Gestor')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Meu Perfil' })).toBeInTheDocument();
    expect(screen.queryByText(/Nível/)).toBeNull();
    expect(screen.queryByText(/Matrícula/)).toBeNull();
    expect(screen.queryByText('Tesouraria')).toBeNull();
    expect(screen.queryByText(/Preferências de Notificação/)).toBeNull();
  });

  test.each([
    ['ADMIN', 'Perfil: Administrador'],
    ['CONSULTA', 'Perfil: Consulta (somente leitura)'],
  ])('perfil %s', async (perfil: string, texto: string) => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ usuario: { id: 'u1', nome: 'X', email: 'x@x', perfil, ativo: 1 } }) })) as any;
    render(<PerfilGestor />);
    expect(await screen.findByText(texto)).toBeInTheDocument();
  });
});

describe('troca de senha', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as any;
  });

  const preencher = (atual: string, nova: string, confirma: string) => {
    fireEvent.change(screen.getByLabelText('Senha Atual'), { target: { value: atual } });
    fireEvent.change(screen.getByLabelText('Nova Senha'), { target: { value: nova } });
    fireEvent.change(screen.getByLabelText('Confirmar Nova Senha'), { target: { value: confirma } });
  };

  test('confirmação diferente: avisa no campo, desabilita Confirmar e não envia', () => {
    render(<ChangePasswordModal onClose={vi.fn()} />);
    preencher('antiga123', 'novaSenha1', 'novaSenha2');
    expect(screen.getByRole('alert')).toHaveTextContent('A confirmação não é igual à nova senha.');
    expect(screen.getByLabelText('Confirmar Nova Senha')).toHaveAttribute('aria-invalid', 'true');
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmar).toBeDisabled();
    fireEvent.submit(confirmar.closest('form')!);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('nova senha curta: avisa e não envia', () => {
    render(<ChangePasswordModal onClose={vi.fn()} />);
    preencher('antiga123', 'curta', 'curta');
    fireEvent.submit(screen.getByRole('button', { name: 'Confirmar' }).closest('form')!);
    expect(toast.error).toHaveBeenCalledWith('A nova senha deve ter no mínimo 8 caracteres.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('senhas iguais: envia a senha atual e a nova e fecha', async () => {
    const onClose = vi.fn();
    render(<ChangePasswordModal onClose={onClose} />);
    preencher('antiga123', 'novaSenha1', 'novaSenha1');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [url, opcoes] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('/api/perfil/senha');
    expect(JSON.parse(opcoes.body)).toEqual({ senhaAtual: 'antiga123', novaSenha: 'novaSenha1' });
  });
});
