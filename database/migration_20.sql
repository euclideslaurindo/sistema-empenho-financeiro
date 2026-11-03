-- ============================================================
-- migration_20.sql
-- Estagiários sem retenção (B7a): tabela subelemento_retencoes — regra
-- própria de retenções por subelemento — e o subelemento 3.3.90.36.08
-- (Estagiários - Pagamento Direto) com a regra "nenhuma retenção".
--
-- Presença da linha = o subelemento tem regra própria, que substitui a
-- do elemento no cálculo da OP. campos = lista dos campos tributários
-- que se aplicam, separados por vírgula ('irrf,iss'); '' = nenhum.
-- Subelemento sem linha segue a regra do elemento, como antes.
--
-- Só CRIA uma tabela nova e faz 2 INSERT IGNORE (não sobrescrevem nada:
-- se o 3.3.90.36.08 já foi cadastrado pelo administrador, fica o dele).
-- Nenhuma tabela existente é alterada. O sistema funciona sem ela: sem a
-- tabela, todo subelemento segue a regra do elemento.
--
-- Sem FK (mesmo motivo das anteriores: a conta `admin` do app não tem
-- REFERENCES).
--
-- ANTES DE RODAR: confira a consulta 0 (a tabela não pode existir).
-- Rodar com conta privilegiada no Workbench. Pode rodar mais de uma vez.
-- ============================================================

USE empenho;
SET SQL_SAFE_UPDATES = 0;

-- 0) Antes da 1ª execução, esperado: 0. Se vier 1 numa base onde a
--    versão 20 ainda NÃO foi registrada, PARE: existe uma tabela com
--    esse nome que não é desta migration.
SELECT COUNT(*) AS subelemento_retencoes_ja_existe
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subelemento_retencoes';

-- Charset/collation copiados de subelementos_despesa.codigo (as duas
-- tabelas são lidas pelo mesmo código de subelemento).
SET @cs = NULL, @col = NULL;
SELECT CHARACTER_SET_NAME, COLLATION_NAME
  INTO @cs, @col
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subelementos_despesa' AND COLUMN_NAME = 'codigo';

SET @cs  = COALESCE(@cs, @@character_set_database);
SET @col = COALESCE(@col, @@collation_database);

SET @sql = CONCAT(
  'CREATE TABLE IF NOT EXISTS subelemento_retencoes (',
  '  subelemento_codigo VARCHAR(30)   NOT NULL PRIMARY KEY,',
  '  campos             VARCHAR(200)  NOT NULL DEFAULT '''',',
  '  atualizado_por     CHAR(36)      NULL,',
  '  updated_at         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  ') ENGINE=InnoDB DEFAULT CHARSET=', @cs, ' COLLATE=', @col
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Estagiários: o subelemento e a regra "nenhuma retenção".
INSERT IGNORE INTO subelementos_despesa (codigo, elemento_codigo, descricao, ordem)
  VALUES ('3.3.90.36.08', '3.3.90.36', 'Estagiários - Pagamento Direto', 8);
INSERT IGNORE INTO subelemento_retencoes (subelemento_codigo, campos)
  VALUES ('3.3.90.36.08', '');

INSERT IGNORE INTO schema_migrations (version) VALUES ('20');

-- ------------------------------------------------------------
-- CONFERÊNCIA (só leitura)
-- ------------------------------------------------------------
-- a) esperado: 4 linhas, nesta ordem:
--    subelemento_codigo varchar(30) NO · campos varchar(200) NO ·
--    atualizado_por char(36) YES · updated_at timestamp
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLLATION_NAME
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subelemento_retencoes'
 ORDER BY ORDINAL_POSITION;

-- b) esperado: 1 linha, 3.3.90.36.08 · 3.3.90.36 · ativo 1
SELECT codigo, elemento_codigo, descricao, ativo
  FROM subelementos_despesa WHERE codigo = '3.3.90.36.08';

-- c) esperado: 1 linha, 3.3.90.36.08 com campos vazio
SELECT subelemento_codigo, campos FROM subelemento_retencoes;

-- d) esperado: 1 linha com version = '20'
SELECT version, applied_at FROM schema_migrations WHERE version = '20';

-- ============================================================
-- ROLLBACK (somente com aprovação explícita; tabela nova, nenhuma
-- outra aplicação depende dela):
--   DROP TABLE subelemento_retencoes;
--   DELETE FROM subelementos_despesa WHERE codigo = '3.3.90.36.08';
--     (só se nenhuma NE usar o subelemento; senão, deixe-o, ou desative-o
--      em Configurações > Elementos)
--   DELETE FROM schema_migrations WHERE version = '20';
-- ============================================================
