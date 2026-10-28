-- ============================================================
-- migration_19.sql
-- Análises, etapa B5: tabela configuracoes_gerais — textos do sistema
-- editados pelo administrador. Primeiro uso: o cabeçalho do relatório A4
-- (chaves 'relatorio.orgao' e 'relatorio.setor').
--
-- Só CRIA uma tabela nova, vazia. Nenhuma tabela existente é alterada.
-- O sistema funciona sem ela: o relatório sai só com "Estado de
-- Pernambuco" até o administrador preencher em Configurações.
--
-- Sem FK (mesmo motivo das anteriores: a conta `admin` do app não tem
-- REFERENCES). A tabela não é cruzada com nenhuma outra (sem JOIN).
--
-- ANTES DE RODAR: confira a consulta 0 (a tabela não pode existir).
-- Rodar com conta privilegiada no Workbench. Pode rodar mais de uma vez.
-- ============================================================

USE empenho;
SET SQL_SAFE_UPDATES = 0;

-- 0) Antes da 1ª execução, esperado: 0. Se vier 1 numa base onde a
--    versão 19 ainda NÃO foi registrada, PARE: existe uma tabela com
--    esse nome que não é desta migration.
SELECT COUNT(*) AS configuracoes_gerais_ja_existe
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracoes_gerais';

-- Charset/collation do próprio banco (a tabela não cruza com outras).
SET @cs  = @@character_set_database;
SET @col = @@collation_database;

SET @sql = CONCAT(
  'CREATE TABLE IF NOT EXISTS configuracoes_gerais (',
  '  chave          VARCHAR(60)   NOT NULL PRIMARY KEY,',
  '  valor          VARCHAR(300)  NULL,',
  '  atualizado_por CHAR(36)      NULL,',
  '  updated_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  ') ENGINE=InnoDB DEFAULT CHARSET=', @cs, ' COLLATE=', @col
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO schema_migrations (version) VALUES ('19');

-- ------------------------------------------------------------
-- CONFERÊNCIA (só leitura)
-- ------------------------------------------------------------
-- a) esperado: 4 linhas, nesta ordem:
--    chave varchar(60) NO · valor varchar(300) YES ·
--    atualizado_por char(36) YES · updated_at timestamp
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracoes_gerais'
 ORDER BY ORDINAL_POSITION;

-- b) esperado: 1 linha com version = '19'
SELECT version, applied_at FROM schema_migrations WHERE version = '19';

-- c) esperado: 0 (a tabela nasce vazia)
SELECT COUNT(*) AS linhas_configuracoes_gerais FROM configuracoes_gerais;

-- ============================================================
-- ROLLBACK (somente com aprovação explícita; tabela nova, nenhuma
-- outra aplicação depende dela):
--   DROP TABLE configuracoes_gerais;
--   DELETE FROM schema_migrations WHERE version = '19';
-- ============================================================
