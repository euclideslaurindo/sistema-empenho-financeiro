// B7a (estagiários sem retenção) — conferência estática da database/migration_20.sql.
// O script roda manualmente no Workbench; aqui só se garante que ele é seguro
// para o banco compartilhado: cria UMA tabela nova, faz só INSERT IGNORE e não
// mexe em mais nada.
import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migration_20.sql'), 'utf8');
/** O script sem comentários de linha (`-- …`): só o que o MySQL executa. */
const executavel = sql
  .split(/\r?\n/)
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n');

describe('migration_20.sql', () => {
  test('começa com USE empenho e registra a versão 20', () => {
    expect(executavel.trim().startsWith('USE empenho;')).toBe(true);
    expect(executavel).toContain("INSERT IGNORE INTO schema_migrations (version) VALUES ('20');");
  });

  test('cria só a tabela subelemento_retencoes, e só se não existir', () => {
    expect(executavel).toContain('CREATE TABLE IF NOT EXISTS subelemento_retencoes (');
    expect(executavel.match(/CREATE TABLE/gi)).toHaveLength(1);
    expect(executavel).toMatch(/ENGINE=InnoDB/);
  });

  test('colunas e tipos combinados; collation copiada de subelementos_despesa.codigo', () => {
    expect(executavel).toMatch(/subelemento_codigo\s+VARCHAR\(30\)\s+NOT NULL PRIMARY KEY/);
    expect(executavel).toMatch(/campos\s+VARCHAR\(200\)\s+NOT NULL DEFAULT ''''/);
    expect(executavel).toMatch(/atualizado_por\s+CHAR\(36\)\s+NULL/);
    expect(executavel).toMatch(/updated_at\s+TIMESTAMP/);
    expect(executavel).toMatch(/TABLE_NAME = 'subelementos_despesa' AND COLUMN_NAME = 'codigo'/);
  });

  test('nada destrutivo fora dos comentários: sem DROP, ALTER, MODIFY, DELETE, TRUNCATE, RENAME nem UPDATE', () => {
    const semOnUpdate = executavel.replace(/ON UPDATE CURRENT_TIMESTAMP/g, '').replace(/SQL_SAFE_UPDATES/g, '');
    for (const palavra of ['DROP', 'ALTER', 'MODIFY', 'DELETE', 'TRUNCATE', 'RENAME', 'UPDATE', 'REPLACE']) {
      expect(semOnUpdate).not.toMatch(new RegExp(`\\b${palavra}\\b`, 'i'));
    }
  });

  test('sem chave estrangeira; os únicos INSERT são IGNORE: estagiários, a regra vazia e a versão', () => {
    expect(executavel).not.toMatch(/\bFOREIGN KEY\b|\bREFERENCES\b/i);
    const inserts = (executavel.match(/INSERT[^;]*;/gi) || []).map((s) => s.replace(/\s+/g, ' '));
    expect(inserts).toEqual([
      "INSERT IGNORE INTO subelementos_despesa (codigo, elemento_codigo, descricao, ordem) VALUES ('3.3.90.36.08', '3.3.90.36', 'Estagiários - Pagamento Direto', 8);",
      "INSERT IGNORE INTO subelemento_retencoes (subelemento_codigo, campos) VALUES ('3.3.90.36.08', '');",
      "INSERT IGNORE INTO schema_migrations (version) VALUES ('20');",
    ]);
  });

  test('o rollback existe, mas só em comentário', () => {
    expect(sql).toMatch(/--\s+DROP TABLE subelemento_retencoes;/);
    expect(executavel).not.toContain('DROP TABLE subelemento_retencoes');
  });
});
