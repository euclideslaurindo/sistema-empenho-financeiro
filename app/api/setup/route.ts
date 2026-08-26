import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

// PROTECAO: Esta rota so pode ser executada em ambiente de desenvolvimento.
// Em producao, retorna 403 imediatamente.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Esta rota nao esta disponivel em producao.' },
      { status: 403 }
    );
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS configuracoes_sistema (
        id INT PRIMARY KEY,
        nome_completo VARCHAR(255),
        email_corporativo VARCHAR(255),
        unidade_padrao VARCHAR(255),
        gestao_padrao VARCHAR(50),
        auto_preencher_credor BOOLEAN DEFAULT 1,
        notifica_email_empenho BOOLEAN DEFAULT 1,
        exigir_2fa_op BOOLEAN DEFAULT 0,
        alerta_integracao BOOLEAN DEFAULT 1,
        aviso_manutencao BOOLEAN DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await query(`
      INSERT IGNORE INTO configuracoes_sistema (id, nome_completo, email_corporativo, unidade_padrao, gestao_padrao)
      VALUES (1, 'Gestor Financeiro', 'gestor@prefeitura.gov.br', 'Secretaria da Fazenda', '140101')
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id VARCHAR(36) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        perfil ENUM('ADMIN', 'GESTOR', 'CONSULTA') DEFAULT 'CONSULTA',
        ativo BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const hash = await bcrypt.hash('admin123', 12);

    await query(`
      INSERT IGNORE INTO usuarios (id, nome, email, senha_hash, perfil)
      VALUES ('user-admin-1', 'Administrador', 'admin@admin.com', ?, 'ADMIN')
    `, [hash]);

    return NextResponse.json({ success: true, message: 'Tabelas criadas com sucesso.' });
  } catch (error: any) {
    console.error('Setup erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
