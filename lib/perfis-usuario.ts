// Perfis de acesso: os três que o sistema conhece, com o nome mostrado na
// tela (Meu Perfil e Usuários usam os mesmos nomes).

export const PERFIS_USUARIO = ["ADMIN", "GESTOR", "CONSULTA"] as const;
export type PerfilUsuario = (typeof PERFIS_USUARIO)[number];

export const ROTULO_PERFIL: Record<string, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  CONSULTA: "Consulta (somente leitura)",
};

export const ehPerfilValido = (v: unknown): v is PerfilUsuario => (PERFIS_USUARIO as readonly string[]).includes(String(v));

/** Usuário raiz (criado com o sistema): não pode ser bloqueado, excluído nem mudar de perfil. */
export const ID_ADMIN_RAIZ = "user-admin-1";

export const SENHA_MINIMA = 8;
export const SENHA_MAXIMA = 128;
