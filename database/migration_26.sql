-- ============================================================
-- migration_26.sql
-- Justificativa de sobra de recurso da NE (B13): o documento
-- "JUSTIFICATIVA DE NÃO UTILIZAÇÃO TOTAL DO RECURSO DA NE Nº", salvo
-- (uma por NE) para editar e reimprimir.
--
-- Só CRIA uma tabela nova. Nada é alterado ou removido.
-- Sem FK (a conta `admin` do app não tem REFERENCES).
-- Rodar com conta privilegiada no Workbench. Pode rodar mais de uma vez.
-- ============================================================

USE empenho;

-- 0) Antes da 1ª execução, esperado: 0.
SELECT COUNT(*) AS justificativas_saldo_ja_existe
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'justificativas_saldo';

-- Charset/collation de notas_empenho.numero (ligadas pelo número da NE).
SET @cs = NULL, @col = NULL;
SELECT CHARACTER_SET_NAME, COLLATION_NAME
  INTO @cs, @col
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notas_empenho' AND COLUMN_NAME = 'numero';

SET @cs  = COALESCE(@cs, @@character_set_database);
SET @col = COALESCE(@col, @@collation_database);

-- motivos: JSON com os motivos MARCADOS, [{"codigo":"parcial","texto":"…"}]
SET @sql = CONCAT(
  'CREATE TABLE IF NOT EXISTS justificativas_saldo (',
  '  id               CHAR(36)      NOT NULL PRIMARY KEY,',
  '  numero_ne        VARCHAR(50)   NOT NULL,',
  '  exercicio        VARCHAR(10)   NULL,',
  '  objeto           TEXT          NULL,',
  '  valor_saldo      DECIMAL(15,2) NOT NULL,',
  '  valor_atualizado DECIMAL(15,2) NOT NULL,',
  '  motivos          JSON          NOT NULL,',
  '  outros           TEXT          NULL,',
  '  texto_devolucao  TEXT          NULL,',
  '  usuario_id       CHAR(36)      NULL,',
  '  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,',
  '  updated_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,',
  '  UNIQUE KEY uq_justificativa_ne (numero_ne)',
  ') ENGINE=InnoDB DEFAULT CHARSET=', @cs, ' COLLATE=', @col
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO schema_migrations (version) VALUES ('26');

-- ------------------------------------------------------------
-- CONFERÊNCIA (só leitura)
-- ------------------------------------------------------------
-- a) esperado: 12 colunas, de id a updated_at
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'justificativas_saldo'
 ORDER BY ORDINAL_POSITION;

-- b) esperado: 1 linha com version = '26'
SELECT version, applied_at FROM schema_migrations WHERE version = '26';

-- ============================================================
-- ROLLBACK (somente com aprovação explícita; tabela nova):
--   DROP TABLE justificativas_saldo;
--   DELETE FROM schema_migrations WHERE version = '26';
-- ============================================================
