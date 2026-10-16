// T32 — conferência estática da database/migration_17.sql (o script roda
// manualmente no Workbench; aqui só se garante que ele é seguro para o
// banco compartilhado e segue as decisões D41 e D47).
import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migration_17.sql'), 'utf8');
/** O script sem comentários de linha (`-- …`): só o que o MySQL executa. */
const executavel = sql
  .split(/\r?\n/)
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n');

describe('migration_17.sql', () => {
  test('começa com USE empenho e registra a versão 17', () => {
    expect(executavel.trim().startsWith('USE empenho;')).toBe(true);
    expect(executavel).toContain("INSERT IGNORE INTO schema_migrations (version) VALUES ('17');");
  });

  test('cria credores.municipioExpediente só se não existir (D41)', () => {
    expect(executavel).toMatch(/COLUMN_NAME='municipioExpediente'/);
    expect(executavel).toMatch(
      /IF\(@tem=0,\s*'ALTER TABLE credores ADD COLUMN municipioExpediente VARCHAR\(100\) NULL',\s*'SELECT 1'\)/
    );
    expect(executavel).toContain('SET @tem = NULL;');
  });

  test('nunca cria a coluna com o nome errado', () => {
    expect(executavel).not.toMatch(/ADD COLUMN\s+municipio_expediente/i);
  });

  test('nada destrutivo fora dos comentários (D47): sem MODIFY, DROP, UPDATE ou DELETE', () => {
    expect(executavel).not.toMatch(/\bMODIFY\b/i);
    expect(executavel).not.toMatch(/\bDROP\b/i);
    expect(executavel).not.toMatch(/\bUPDATE\b/i);
    expect(executavel).not.toMatch(/\bDELETE\b/i);
  });

  test('confere as 5 colunas da NE que deixam de ser preenchidas', () => {
    for (const coluna of ['data_pagamento', 'data_emissao', 'data_provisao_concedida', 'credor_nome', 'cpf_cnpj']) {
      expect(executavel).toContain(`'${coluna}'`);
    }
  });
});
