// B5 (Relatório A4) — conferência estática da database/migration_19.sql.
// O script roda manualmente no Workbench; aqui só se garante que ele é seguro
// para o banco compartilhado: cria UMA tabela nova e não mexe em mais nada.
import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migration_19.sql'), 'utf8');
/** O script sem comentários de linha (`-- …`): só o que o MySQL executa. */
const executavel = sql
  .split(/\r?\n/)
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n');

describe('migration_19.sql', () => {
  test('começa com USE empenho e registra a versão 19', () => {
    expect(executavel.trim().startsWith('USE empenho;')).toBe(true);
    expect(executavel).toContain("INSERT IGNORE INTO schema_migrations (version) VALUES ('19');");
  });

  test('cria só a tabela configuracoes_gerais, e só se não existir', () => {
    expect(executavel).toContain('CREATE TABLE IF NOT EXISTS configuracoes_gerais (');
    expect(executavel.match(/CREATE TABLE/gi)).toHaveLength(1);
    expect(executavel).toMatch(/ENGINE=InnoDB/);
  });

  test('colunas e tipos combinados', () => {
    expect(executavel).toMatch(/chave\s+VARCHAR\(60\)\s+NOT NULL PRIMARY KEY/);
    expect(executavel).toMatch(/valor\s+VARCHAR\(300\)\s+NULL/);
    expect(executavel).toMatch(/atualizado_por\s+CHAR\(36\)\s+NULL/);
    expect(executavel).toMatch(/updated_at\s+TIMESTAMP/);
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
    expect(inserts).toEqual(["INSERT IGNORE INTO schema_migrations (version) VALUES ('19');"]);
  });

  test('o rollback existe, mas só em comentário', () => {
    expect(sql).toMatch(/--\s+DROP TABLE configuracoes_gerais;/);
    expect(executavel).not.toContain('DROP TABLE configuracoes_gerais');
  });
});
