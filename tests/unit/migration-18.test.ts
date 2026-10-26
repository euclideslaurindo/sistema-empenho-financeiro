// A1 (Pessoas físicas no IR) — conferência estática da database/migration_18.sql.
// O script roda manualmente no Workbench; aqui só se garante que ele é seguro
// para o banco compartilhado: cria UMA tabela nova e não mexe em mais nada.
import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migration_18.sql'), 'utf8');
/** O script sem comentários de linha (`-- …`): só o que o MySQL executa. */
const executavel = sql
  .split(/\r?\n/)
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n');

describe('migration_18.sql', () => {
  test('começa com USE empenho e registra a versão 18', () => {
    expect(executavel.trim().startsWith('USE empenho;')).toBe(true);
    expect(executavel).toContain("INSERT IGNORE INTO schema_migrations (version) VALUES ('18');");
  });

  test('cria só a tabela ir_informes_pf, e só se não existir', () => {
    expect(executavel).toContain('CREATE TABLE IF NOT EXISTS ir_informes_pf (');
    expect(executavel.match(/CREATE TABLE/gi)).toHaveLength(1);
    expect(executavel).toMatch(/ENGINE=InnoDB/);
  });

  test('colunas e tipos combinados (CPF só com dígitos, ano numérico)', () => {
    expect(executavel).toMatch(/id\s+CHAR\(36\)\s+NOT NULL PRIMARY KEY/);
    expect(executavel).toMatch(/ano\s+SMALLINT UNSIGNED NOT NULL/);
    expect(executavel).toMatch(/cpf\s+CHAR\(11\)\s+NOT NULL/);
    expect(executavel).toMatch(/informado_por\s+CHAR\(36\)\s+NULL/);
    expect(executavel).toMatch(/observacao\s+VARCHAR\(300\)\s+NULL/);
  });

  test('uma marcação por pessoa por ano: UNIQUE (ano, cpf), e índice por CPF', () => {
    expect(executavel).toContain('UNIQUE KEY uq_ir_ano_cpf (ano, cpf)');
    expect(executavel).toContain('INDEX idx_ir_cpf (cpf)');
  });

  test('copia a collation de ordens_pagamento.credor_cpf_cnpj (banco compartilhado)', () => {
    expect(executavel).toContain("TABLE_NAME = 'ordens_pagamento' AND COLUMN_NAME = 'credor_cpf_cnpj'");
    expect(executavel).toContain('SET @cs = NULL, @col = NULL;');
    expect(executavel).toMatch(/DEFAULT CHARSET=', @cs, ' COLLATE=', @col/);
  });

  test('nada destrutivo fora dos comentários: sem DROP, ALTER, MODIFY, DELETE, TRUNCATE, RENAME nem UPDATE', () => {
    const semOnUpdate = executavel.replace(/ON UPDATE CURRENT_TIMESTAMP/g, '');
    for (const palavra of ['DROP', 'ALTER', 'MODIFY', 'DELETE', 'TRUNCATE', 'RENAME', 'UPDATE']) {
      expect(semOnUpdate).not.toMatch(new RegExp(`\\b${palavra}\\b`, 'i'));
    }
  });

  test('sem chave estrangeira e sem carga inicial', () => {
    expect(executavel).not.toMatch(/\bFOREIGN KEY\b|\bREFERENCES\b/i);
    const inserts = executavel.match(/INSERT[^;]*;/gi) || [];
    expect(inserts).toEqual(["INSERT IGNORE INTO schema_migrations (version) VALUES ('18');"]);
  });

  test('o rollback existe, mas só em comentário', () => {
    expect(sql).toMatch(/--\s+DROP TABLE ir_informes_pf;/);
    expect(executavel).not.toContain('DROP TABLE ir_informes_pf');
  });
});
