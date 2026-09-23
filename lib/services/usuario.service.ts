import { query } from '@/lib/db';
import { hash } from 'bcryptjs';
import { UsuarioDB } from '@/lib/types/db';

export type PerfilUsuario = 'ADMIN' | 'GESTOR' | 'CONSULTA';

export type CriarUsuarioResult =
  | { success: true; id: string }
  | { success: false; error: string; status: number };

export type ServiceResult<T = any> =
  | { success: true; data: T }
  | { success: false; error: string; status: number };

const ROOT_ADMIN_ID = 'user-admin-1';

/**
 * Lógica compartilhada de criação de usuário: hash da senha, checagem de
 * e-mail duplicado e insert no banco. Usada tanto por app/api/usuarios
 * (ADMIN cria usuário com perfil escolhido) quanto por app/api/auth/register
 * (ADMIN cria usuário GESTOR com e-mail fake) — cada rota resolve suas
 * próprias regras de validação e geração de e-mail antes de chamar isto.
 */
export async function criarUsuario(params: {
  nome: string;
  email: string;
  senha: string;
  perfil?: PerfilUsuario;
}): Promise<CriarUsuarioResult> {
  const { nome, email, senha, perfil = 'GESTOR' } = params;

  const [existing] = await query<{ id: string }[]>(
    'SELECT id FROM usuarios WHERE email = ?',
    [email]
  );

  if (existing) {
    return { success: false, error: 'Esse e-mail já está em uso.', status: 409 };
  }

  const senhaHash = await hash(senha, 10);
  const id = crypto.randomUUID();

  try {
    await query(
      `INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, ?, 1)`,
      [id, nome, email, senhaHash, perfil]
    );
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return { success: false, error: 'Esse e-mail já está em uso.', status: 409 };
    }
    throw error;
  }

  return { success: true, id };
}

/** Lista todos os usuários (sem dados sensíveis). */
export async function listarUsuarios(): Promise<UsuarioDB[]> {
  return query<UsuarioDB[]>(
    `SELECT id, nome, email, perfil, ativo, created_at FROM usuarios ORDER BY nome ASC`
  );
}

/**
 * Exclui um usuário, com as travas de segurança já existentes:
 * ninguém pode excluir a si mesmo, o admin raiz nunca pode ser excluído,
 * e usuários com Ordens de Pagamento vinculadas devem ser bloqueados
 * (não excluídos), para preservar o histórico.
 */
export async function excluirUsuario(idAlvo: string, solicitanteId: string): Promise<ServiceResult<null>> {
  if (solicitanteId === idAlvo) {
    return { success: false, error: 'Você não pode excluir seu próprio usuário', status: 400 };
  }
  if (idAlvo === ROOT_ADMIN_ID) {
    return { success: false, error: 'Acesso Negado: O usuário administrador raiz não pode ser excluído do sistema.', status: 403 };
  }

  const [existing] = await query<UsuarioDB[]>('SELECT id FROM usuarios WHERE id = ?', [idAlvo]);
  if (!existing) {
    return { success: false, error: 'Usuário não encontrado', status: 404 };
  }

  const transacoes = await query<{ id: string }[]>('SELECT id FROM ordens_pagamento WHERE usuario_id = ? LIMIT 1', [idAlvo]);
  if (transacoes && transacoes.length > 0) {
    return {
      success: false,
      error: 'Não é possível excluir: Este usuário possui Ordens de Pagamento vinculadas. Utilize a função "Bloquear" para preservar o histórico.',
      status: 409,
    };
  }

  await query('DELETE FROM usuarios WHERE id = ?', [idAlvo]);
  return { success: true, data: null };
}

/** Bloqueia/desbloqueia um usuário (toggle do campo `ativo`). */
export async function alterarStatusUsuario(idAlvo: string, solicitanteId: string, ativo: boolean): Promise<ServiceResult<null>> {
  if (solicitanteId === idAlvo) {
    return { success: false, error: 'Você não pode alterar seu próprio status', status: 400 };
  }
  if (idAlvo === ROOT_ADMIN_ID) {
    return { success: false, error: 'Acesso Negado: O usuário administrador raiz não pode ser alterado ou bloqueado.', status: 403 };
  }

  await query('UPDATE usuarios SET ativo = ? WHERE id = ?', [ativo ? 1 : 0, idAlvo]);
  return { success: true, data: null };
}
