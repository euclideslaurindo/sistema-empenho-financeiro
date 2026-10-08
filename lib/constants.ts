/**
 * Nome do cookie de autenticação JWT.
 * Centralizado aqui para evitar erros de digitação em múltiplos arquivos.
 */
export const AUTH_COOKIE_NAME = 'auth_token';

/**
 * Se o cookie de autenticação deve ter a flag "Secure". Baseado no
 * protocolo de APP_URL (não em NODE_ENV): um cookie Secure só é
 * reenviado pelo navegador em HTTPS. Em produção sem certificado (ex:
 * servidor interno acessado via http://hostname:porta), NODE_ENV já é
 * "production" mas a conexão continua sendo HTTP — usar NODE_ENV aqui
 * faz o navegador aceitar o cookie no login mas nunca reenviá-lo depois,
 * causando loop infinito de redirecionamento para /login.
 */
export const AUTH_COOKIE_SECURE = (process.env.APP_URL || '').startsWith('https://');
