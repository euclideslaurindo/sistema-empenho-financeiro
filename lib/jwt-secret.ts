/**
 * Fonte única da verdade para o JWT_SECRET.
 * Lança erro fatal se a variável de ambiente não estiver definida,
 * eliminando qualquer fallback hardcoded e protegendo contra uso acidental
 * de chave pública em produção.
 */
const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error(
    '❌ FATAL: JWT_SECRET não está definido nas variáveis de ambiente. ' +
    'Adicione JWT_SECRET no seu arquivo .env.local antes de iniciar o servidor.'
  );
}

export const JWT_SECRET = new TextEncoder().encode(secret);
