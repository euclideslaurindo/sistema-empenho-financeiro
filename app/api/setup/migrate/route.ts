import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Operação proibida: Migrações via API estão desabilitadas em ambiente de produção.' }, { status: 403 });
  }

  const user = await getAuthUser(request);
  if (!user || user.perfil !== 'ADMIN') return unauthorizedResponse();

  const results: string[] = [];
  try {
    
    // Tabela ordens_pagamento
    try {
      await query("ALTER TABLE ordens_pagamento ADD COLUMN numero_op VARCHAR(100);");
      results.push('Coluna numero_op adicionada em ordens_pagamento');
    } catch (e: any) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        results.push('Coluna numero_op já existe em ordens_pagamento');
      } else {
        results.push("Erro numero_op: " + e.message);
      }
    }

    // Tabela credores
    try {
      await query("ALTER TABLE credores ADD COLUMN pix VARCHAR(100);");
      results.push("Coluna pix adicionada em credores.");
    } catch (e: any) {
      if (e.code === 'ER_DUP_FIELDNAME') results.push("Coluna pix já existe em credores.");
      else results.push("Erro pix: " + e.message);
    }

    // Tabela notas_empenho
    try {
      await query("ALTER TABLE notas_empenho ADD COLUMN elemento VARCHAR(50);");
      results.push("Coluna elemento adicionada em notas_empenho.");
    } catch (e: any) {
      if (e.code === 'ER_DUP_FIELDNAME') results.push("Coluna elemento já existe.");
      else results.push("Erro elemento: " + e.message);
    }
    
    try {
      await query("ALTER TABLE notas_empenho ADD COLUMN subelemento VARCHAR(200);");
      results.push("Coluna subelemento adicionada em notas_empenho.");
    } catch (e: any) {
      if (e.code === 'ER_DUP_FIELDNAME') results.push("Coluna subelemento já existe.");
      else results.push("Erro subelemento: " + e.message);
    }

    try {
      await query(`
        UPDATE notas_empenho 
        SET 
          elemento = SUBSTRING_INDEX(elemento_subelemento, '/', 1),
          subelemento = IF(LOCATE('/', elemento_subelemento) > 0, SUBSTRING(elemento_subelemento, LOCATE('/', elemento_subelemento) + 1), '')
        WHERE elemento_subelemento IS NOT NULL;
      `);
      results.push("Dados migrados para as novas colunas elemento/subelemento.");
    } catch (e: any) {
      results.push("Aviso: erro ao migrar: " + e.message);
    }
      
    try {
      await query("ALTER TABLE notas_empenho DROP COLUMN elemento_subelemento;");
      results.push("Coluna elemento_subelemento removida.");
    } catch (e: any) {
      if (e.code === 'ER_CANT_DROP_FIELD_OR_KEY' || e.code === 'ER_BAD_FIELD_ERROR') {
        results.push("Coluna elemento_subelemento já foi removida ou não existe.");
      } else {
        results.push("Aviso: erro ao dropar elemento_subelemento: " + e.message);
      }
    }

    try {
      await query("ALTER TABLE notas_empenho ADD COLUMN credor_nome VARCHAR(200);");
      results.push("Coluna credor_nome adicionada em notas_empenho.");
    } catch (e: any) {
      if (e.code === 'ER_DUP_FIELDNAME') results.push("Coluna credor_nome já existe em notas_empenho.");
      else results.push("Erro credor_nome: " + e.message);
    }

    try {
      await query("ALTER TABLE notas_empenho ADD COLUMN cpf_cnpj VARCHAR(20);");
      results.push("Coluna cpf_cnpj adicionada em notas_empenho.");
    } catch (e: any) {
      if (e.code === 'ER_DUP_FIELDNAME') results.push("Coluna cpf_cnpj já existe em notas_empenho.");
      else results.push("Erro cpf_cnpj: " + e.message);
    }

    // Tabelas que o código usa (auditoria de OP, liquidações) mas nunca existiram no banco
    try {
      await query("CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(20) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);");
      results.push("Tabela schema_migrations OK.");
    } catch (e: any) {
      results.push("Erro schema_migrations: " + e.message);
    }

    try {
      await query(`CREATE TABLE IF NOT EXISTS auditoria_financeira (
        id CHAR(36) PRIMARY KEY,
        entidade VARCHAR(60) NOT NULL,
        entidade_id CHAR(36) NOT NULL,
        acao VARCHAR(20) NOT NULL COMMENT 'CREATE, UPDATE, DELETE',
        dados_anteriores JSON NULL,
        dados_novos JSON NULL,
        usuario_id CHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_auditoria_entidade (entidade, entidade_id),
        INDEX idx_auditoria_usuario (usuario_id)
      );`);
      results.push("Tabela auditoria_financeira OK.");
    } catch (e: any) {
      results.push("Erro auditoria_financeira: " + e.message);
    }

    try {
      await query(`CREATE TABLE IF NOT EXISTS liquidacoes (
        id VARCHAR(36) PRIMARY KEY,
        numero_liquidacao VARCHAR(60) NOT NULL UNIQUE,
        notas_empenho_id VARCHAR(36) NOT NULL,
        valor_liquidado DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        data_liquidacao DATE NOT NULL,
        responsavel_atesto VARCHAR(200),
        documento_fiscal VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_liq_notas_empenho (notas_empenho_id),
        INDEX idx_liq_created_by (created_by)
      );`);
      results.push("Tabela liquidacoes OK.");
    } catch (e: any) {
      results.push("Erro liquidacoes: " + e.message);
    }

    try {
      await query("INSERT IGNORE INTO schema_migrations (version) VALUES ('06');");
    } catch (e: any) {
      results.push("Aviso: erro ao registrar migration 06: " + e.message);
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, results }, { status: 500 });
  }
}
