-- ============================================================
-- migration_14.sql
-- Projeto "Retenções v2" (T14): tabela ne_credores — uma NE com
-- vários credores, guardando o valor bruto de cada um.
--
-- NOTA: seria "migration_13" no plano original, mas esse nome já
-- foi usado pela T09 (taxa_bancaria/taxa_pix/retencoes_snapshot na
-- OP), por causa do deslocamento do migration_10.sql (fix não
-- relacionado).
--
-- Só CRIA uma tabela nova; não altera nenhuma tabela existente.
-- Sem FKs (conta `admin` do app não tem REFERENCES — mesmo padrão
-- das migrations 06/11/12): NE e credor existentes, valor_bruto > 0
-- e soma = notas_empenho.valor são validados na aplicação (T15).
--
-- Rodar com conta privilegiada no Workbench. Pode rodar duas vezes.
-- ============================================================

USE empenho;
SET SQL_SAFE_UPDATES = 0;

-- Banco compartilhado: o default de charset/collation do banco pode não
-- ser o mesmo das tabelas antigas. A tabela nova copia o charset/collation
-- de notas_empenho.numero, senão os JOINs por número da NE / CPF-CNPJ
-- falham com "Illegal mix of collations".
-- numero_ne = notas_empenho.numero; credor_cpf_cnpj = credores.cpf_cnpj;
-- credor_nome é cópia para exibição/impressão.
SET @cs = NULL, @col = NULL;
SELECT CHARACTER_SET_NAME, COLLATION_NAME
  INTO @cs, @col
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notas_empenho' AND COLUMN_NAME = 'numero';

SET @cs  = COALESCE(@cs, @@character_set_database);
SET @col = COALESCE(@col, @@collation_database);

-- A UNIQUE (numero_ne, credor_cpf_cnpj) já começa por numero_ne e atende
-- as buscas por NE; um índice só de numero_ne seria redundante.
SET @sql = CONCAT(
  'CREATE TABLE IF NOT EXISTS ne_credores (',
  '  id               CHAR(36)      NOT NULL PRIMARY KEY,',
  '  numero_ne        VARCHAR(60)   NOT NULL,',
  '  credor_cpf_cnpj  VARCHAR(20)   NOT NULL,',
  '  credor_nome      VARCHAR(200)  NOT NULL,',
  '  valor_bruto      DECIMAL(15,2) NOT NULL,',
  '  ordem            INT           NOT NULL DEFAULT 0,',
  '  created_by       CHAR(36)      NULL,',
  '  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,',
  '  updated_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,',
  '  UNIQUE KEY uq_ne_credor (numero_ne, credor_cpf_cnpj),',
  '  INDEX idx_nec_credor (credor_cpf_cnpj)',
  ') ENGINE=InnoDB DEFAULT CHARSET=', @cs, ' COLLATE=', @col
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO schema_migrations (version) VALUES ('14');

-- ------------------------------------------------------------
-- CONFERÊNCIA (só leitura): as collations de cada par devem ser iguais.
-- ------------------------------------------------------------
SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND (   (TABLE_NAME = 'ne_credores'   AND COLUMN_NAME IN ('numero_ne', 'credor_cpf_cnpj'))
        OR (TABLE_NAME = 'notas_empenho' AND COLUMN_NAME = 'numero')
        OR (TABLE_NAME = 'credores'      AND COLUMN_NAME = 'cpf_cnpj'))
 ORDER BY COLUMN_NAME, TABLE_NAME;

-- ============================================================
-- BACKFILL OPCIONAL (NEs antigas com 1 credor). O código da T15
-- funciona sem isto (fallback para as colunas legadas da NE).
-- Só LÊ notas_empenho; o NOT EXISTS impede duplicar se rodar de novo.
--
-- INSERT IGNORE INTO ne_credores (id, numero_ne, credor_cpf_cnpj, credor_nome, valor_bruto, ordem)
-- SELECT UUID(), ne.numero, ne.cpf_cnpj, COALESCE(ne.credor_nome, ''), ne.valor, 0
--   FROM notas_empenho ne
--  WHERE ne.cpf_cnpj IS NOT NULL AND ne.cpf_cnpj <> ''
--    AND NOT EXISTS (SELECT 1 FROM ne_credores x WHERE x.numero_ne = ne.numero);
-- ============================================================

-- ============================================================
-- ROLLBACK (somente com aprovação explícita; tabela nova, nenhuma
-- outra aplicação depende dela):
--   DROP TABLE ne_credores;
--   DELETE FROM schema_migrations WHERE version = '14';
-- ============================================================
