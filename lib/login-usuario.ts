// Login por e-mail OU por nome de usuário. Usuários criados pelo cadastro
// têm um e-mail interno "nome.normalizado.<8 hex>@empenho.local" (ver
// app/api/auth/register/route.ts); os antigos, "nome.normalizado@empenho.local".

/** Mesmo formato do cadastro: minúsculas e espaços viram ponto. */
export const normalizarNomeUsuario = (entrada: string) => entrada.trim().toLowerCase().replace(/\s+/g, ".");

const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * O e-mail do banco corresponde EXATAMENTE ao que foi digitado?
 * - o próprio e-mail; ou
 * - o e-mail interno do nome de usuário (com ou sem o sufixo de 8 hex).
 * "joao" NÃO corresponde a "joao.silva.abc12345@empenho.local" (antes o
 * LIKE 'joao.%' aceitava e o login podia pegar o usuário errado).
 */
export function correspondeAoLogin(emailBanco: string, entrada: string): boolean {
  const email = String(emailBanco ?? "").trim().toLowerCase();
  const digitado = String(entrada ?? "").trim().toLowerCase();
  if (!email || !digitado) return false;
  if (email === digitado) return true;
  const nome = escaparRegex(normalizarNomeUsuario(digitado));
  return new RegExp(`^${nome}(\\.[0-9a-f]{8})?@empenho\\.local$`).test(email);
}

/** Candidatos em ordem: quem tem o e-mail exato primeiro (vale sobre homônimo de nome). */
export function candidatosDoLogin<T extends { email: string }>(usuarios: T[], entrada: string): T[] {
  const digitado = String(entrada ?? "").trim().toLowerCase();
  return usuarios
    .filter((u) => correspondeAoLogin(u.email, entrada))
    .sort((a, b) => Number(b.email.toLowerCase() === digitado) - Number(a.email.toLowerCase() === digitado));
}
