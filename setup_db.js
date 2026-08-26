const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function run() {
  const connection = await mysql.createConnection({
    host: 'DAGMCGPA100',
    port: 3306,
    user: 'admin',
    password: 'qwe124578',
    database: 'empenho'
  });

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS configuracoes_sistema (
        id INT PRIMARY KEY,
        nome_completo VARCHAR(255),
        email_corporativo VARCHAR(255),
        unidade_padrao VARCHAR(100),
        gestao_padrao VARCHAR(100),
        auto_preencher_credor BOOLEAN DEFAULT 1,
        notifica_email_empenho BOOLEAN DEFAULT 0,
        exigir_2fa_op BOOLEAN DEFAULT 0,
        alerta_integracao BOOLEAN DEFAULT 1,
        aviso_manutencao BOOLEAN DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      INSERT IGNORE INTO configuracoes_sistema (id, nome_completo, email_corporativo, unidade_padrao, gestao_padrao)
      VALUES (1, 'Gestor Financeiro', 'gestor@prefeitura.gov.br', 'Secretaria da Fazenda', '140101')
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id VARCHAR(36) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        perfil VARCHAR(50) DEFAULT 'ADMIN',
        ativo BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const hash = await bcrypt.hash('admin123', 10);
    
    await connection.execute(`
      INSERT IGNORE INTO usuarios (id, nome, email, senha_hash)
      VALUES ('user-admin-1', 'Administrador', 'admin@admin.com', ?)
    `, [hash]);
    
    console.log('Tabelas configuradas com sucesso.');
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await connection.end();
  }
}

run();
