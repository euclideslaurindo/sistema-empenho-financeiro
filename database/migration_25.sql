-- ============================================================
-- migration_25.sql
-- Taxas personalizadas (B12): o ADMIN cria taxas novas em Configurações
-- → Retenções ("Nova taxa"). Cada taxa criada vira uma linha em
-- config_retencoes (campo "x_<nome>") — tabela que já existe, sem
-- mudança de estrutura. O VALOR de cada taxa em cada OP fica nesta
-- tabela nova (as taxas fixas continuam nas colunas de ordens_pagamento).
--
-- Só CRIA uma tabela nova. Nada é alterado ou removido.
-- Sem FK (a conta `admin` do app não tem REFERENCES).
--
-- Rodar ANTES de criar a primeira taxa personalizada. Sem nenhuma taxa
-- criada, o sistema funciona igual mesmo sem esta tabela.
--
-- Rodar com conta privilegiada no Workbench. Pode rodar mais de uma vez.
-- ============================================================

USE empenho;

-- 0) Antes da 1ª execução, esperado: 0.
SELECT COUNT(*) AS op_retencoes_extras_ja_existe
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'op_retencoes_extras';

-- Charset/collation de ordens_pagamento.id (ligadas pelo id da OP).
SET @cs = NULL, @col = NULL;
SELECT CHARACTER_SET_NAME, COLLATION_NAME
  INTO @cs, @col
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordens_pagamento' AND COLUMN_NAME = 'id';

SET @cs  = COALESCE(@cs, @@character_set_database);
SET @col = COALESCE(@col, @@collation_database);

SET @sql = CONCAT(
  'CREATE TABLE IF NOT EXISTS op_retencoes_extras (',
  '  ordem_pagamento_id CHAR(36)      NOT NULL,',
  '  campo              VARCHAR(30)   NOT NULL,',
  '  valor              DECIMAL(10,2) NOT NULL,',
  '  created_at         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,',
  '  PRIMARY KEY (ordem_pagamento_id, campo),',
  '  INDEX idx_extras_campo (campo)',
  ') ENGINE=InnoDB DEFAULT CHARSET=', @cs, ' COLLATE=', @col
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO schema_migrations (version) VALUES ('25');

-- ------------------------------------------------------------
-- CONFERÊNCIA (só leitura)
-- ------------------------------------------------------------
-- a) esperado: 4 colunas (ordem_pagamento_id, campo, valor, created_at)
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'op_retencoes_extras'
 ORDER BY ORDINAL_POSITION;

-- b) esperado: 1 linha com version = '25'
SELECT version, applied_at FROM schema_migrations WHERE version = '25';

-- ============================================================
-- ROLLBACK (somente com aprovação explícita; tabela nova):
--   DROP TABLE op_retencoes_extras;
--   DELETE FROM schema_migrations WHERE version = '25';
-- (Antes, desative as taxas personalizadas em Configurações.)
-- ============================================================
