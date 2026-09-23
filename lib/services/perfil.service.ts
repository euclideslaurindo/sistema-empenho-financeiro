import { query } from '@/lib/db';
import * as bcrypt from 'bcryptjs';
import { UsuarioDB } from '@/lib/types/db';

export type ServiceResult<T = any> =
  | { success: true; data: T }
  | { success: false; error: string; status: number };

export class PerfilService {
  static async buscarPorEmail(email: string): Promise<ServiceResult<UsuarioDB>> {
    const rows = await query<UsuarioDB[]>(
      'SELECT id, nome, email, perfil, ativo, created_at, ultimo_acesso FROM usuarios WHERE email = ? LIMIT 1',
      [email]
    );
    if (!rows || rows.length === 0) {
      return { success: false, error: 'Usuário não encontrado.', status: 404 };
    }
    return { success: true, data: rows[0] };
  }

  /**
   * Atualiza nome/e-mail do próprio usuário. Não gera JWT nem mexe em
   * cookie — isso é responsabilidade de sessão HTTP e fica na rota, que
   * usa o retorno daqui (nome/email/perfil atualizados) para montar o
   * novo token.
   */
  static async atualizarDados(usuarioId: string, nome: string, email: string, perfilAtual: string): Promise<ServiceResult<{ id: string; nome: string; email: string; perfil: string }>> {
    if (!nome || !email) {
      return { success: false, error: 'Dados incompletos', status: 400 };
    }

    const [existing] = await query<{ id: string }[]>(
      'SELECT id FROM usuarios WHERE email = ? AND id != ? LIMIT 1',
      [email.trim(), usuarioId]
    );
    if (existing) {
      return { success: false, error: 'Este e-mail já está em uso por outro usuário.', status: 409 };
    }

    await query('UPDATE usuarios SET nome = ?, email = ? WHERE id = ?', [nome.trim(), email.trim(), usuarioId]);

    return { success: true, data: { id: usuarioId, nome: nome.trim(), email: email.trim(), perfil: perfilAtual } };
  }

  static async alterarSenha(usuarioId: string, senhaAtual: string, novaSenha: string): Promise<ServiceResult<null>> {
    if (!senhaAtual || !novaSenha) {
      return { success: false, error: 'Senha atual e nova senha são obrigatórias.', status: 400 };
    }
    if (novaSenha.length < 8) {
      return { success: false, error: 'A nova senha deve ter no mínimo 8 caracteres.', status: 400 };
    }

    const rows = await query<{ senha_hash: string }[]>('SELECT senha_hash FROM usuarios WHERE id = ?', [usuarioId]);
    if (!rows || rows.length === 0) {
      return { success: false, error: 'Usuário não encontrado', status: 404 };
    }

    const isValid = await bcrypt.compare(senhaAtual, rows[0].senha_hash);
    if (!isValid) {
      return { success: false, error: 'Senha atual incorreta', status: 401 };
    }

    const newHash = await bcrypt.hash(novaSenha, 10);
    await query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [newHash, usuarioId]);

    return { success: true, data: null };
  }
}
