-- ============================================================
-- migration_13.sql
-- Projeto "Retenções v2" (T09): taxa_bancaria, taxa_pix e
-- retencoes_snapshot em ordens_pagamento.
--
-- NOTA: seria "migration_12" no plano original, mas esse nome já
-- foi usado pela T03 (config_retencoes/elemento_retencoes), por
-- causa do deslocamento do migration_10.sql (fix não relacionado).
--
-- Conta `admin` do app não tem ALTER — rodar com conta privilegiada
-- no Workbench, fora do horário de uso (ADD COLUMN em tabela grande
-- pode demorar).
-- ============================================================

USE empenho;
SET SQL_SAFE_UPDATES = 0;
SET @db = DATABASE();

-- Sem cláusula AFTER de propósito: as 3 colunas entram no FINAL da tabela,
-- não no meio. Isso é mais seguro pras outras aplicações que compartilham
-- este banco (uma inserção posicional antiga, sem nomear colunas, continua
-- alinhada) e permite ao MySQL 8 usar ALGORITHM=INSTANT (quase sem lock),
-- o que "AFTER coluna_do_meio" impede.

SELECT COUNT(*) INTO @tem FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='ordens_pagamento' AND COLUMN_NAME='taxa_bancaria';
SET @sql = IF(@tem=0,
  'ALTER TABLE ordens_pagamento ADD COLUMN taxa_bancaria DECIMAL(10,2) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT COUNT(*) INTO @tem FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='ordens_pagamento' AND COLUMN_NAME='taxa_pix';
SET @sql = IF(@tem=0,
  'ALTER TABLE ordens_pagamento ADD COLUMN taxa_pix DECIMAL(10,2) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT COUNT(*) INTO @tem FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='ordens_pagamento' AND COLUMN_NAME='retencoes_snapshot';
SET @sql = IF(@tem=0,
  'ALTER TABLE ordens_pagamento ADD COLUMN retencoes_snapshot JSON NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO schema_migrations (version) VALUES ('13');

-- ============================================================
-- ROLLBACK (somente com aprovação explícita; evitar DROP COLUMN
-- no banco compartilhado — outras aplicações podem já estar lendo
-- a tabela inteira com SELECT *):
--   ALTER TABLE ordens_pagamento DROP COLUMN retencoes_snapshot;
--   ALTER TABLE ordens_pagamento DROP COLUMN taxa_pix;
--   ALTER TABLE ordens_pagamento DROP COLUMN taxa_bancaria;
--   DELETE FROM schema_migrations WHERE version = '13';
-- ============================================================
