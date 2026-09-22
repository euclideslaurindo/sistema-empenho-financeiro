import { query } from '@/lib/db';
import { hash } from 'bcryptjs';

export type PerfilUsuario = 'ADMIN' | 'GESTOR' | 'CONSULTA';

export type CriarUsuarioResult =
  | { success: true; id: string }
  | { success: false; error: string; status: number };

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
