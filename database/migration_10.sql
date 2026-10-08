-- migration_10.sql
-- Adiciona coluna ultimo_acesso na tabela usuarios para rastrear último login
--
-- Idempotente: pode ser rodado quantas vezes for preciso, em qualquer
-- estado (coluna/índice já existentes ou não), sem erro.

USE empenho;
SET @db = DATABASE();

SELECT COUNT(*) INTO @tem_coluna FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='usuarios' AND COLUMN_NAME='ultimo_acesso';
SET @sql = IF(@tem_coluna=0,
  'ALTER TABLE usuarios ADD COLUMN ultimo_acesso TIMESTAMP NULL DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT COUNT(*) INTO @tem_indice FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='usuarios' AND INDEX_NAME='idx_usuarios_ultimo_acesso';
SET @sql = IF(@tem_indice=0,
  'CREATE INDEX idx_usuarios_ultimo_acesso ON usuarios(ultimo_acesso)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO schema_migrations (version) VALUES ('10');
