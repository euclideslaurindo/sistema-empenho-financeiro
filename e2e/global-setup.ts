import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

/**
 * Roda uma vez antes de toda a suíte E2E: cria a tabela `usuarios` (se não
 * existir) e o admin inicial (admin@admin.com / ADMIN_INITIAL_PASSWORD ou
 * "Mudar@123") direto no MySQL de teste.
 *
 * Antes isso era a rota GET /api/setup, que era pública; ela foi removida
 * (revisão da aba 7, CF1). Por segurança, só roda com ENABLE_SETUP=true e com
 * o banco local (localhost/127.0.0.1, como o serviço MySQL do CI): nunca
 * contra o banco compartilhado. Fora disso, usa os usuários que já existem.
 */
const HOSTS_LOCAIS = ['localhost', '127.0.0.1', '::1'];

export default async function globalSetup() {
  if (process.env.ENABLE_SETUP !== 'true') return;

  const host = process.env.MYSQL_HOST || 'localhost';
  if (!HOSTS_LOCAIS.includes(host)) {
    throw new Error(`Setup do banco de teste recusado: MYSQL_HOST "${host}" não é local. Use um banco de teste local.`);
  }

  const conn = await mysql.createConnection({
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'empenho',
  });
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id VARCHAR(36) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        perfil ENUM('ADMIN', 'GESTOR', 'CONSULTA') DEFAULT 'CONSULTA',
        ativo BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ultimo_acesso TIMESTAMP NULL DEFAULT NULL
      )
    `);
    const hash = await bcrypt.hash(process.env.ADMIN_INITIAL_PASSWORD || 'Mudar@123', 12);
    await conn.execute(
      `INSERT IGNORE INTO usuarios (id, nome, email, senha_hash, perfil)
       VALUES ('user-admin-1', 'Administrador', 'admin@admin.com', ?, 'ADMIN')`,
      [hash]
    );
  } finally {
    await conn.end();
  }
}
