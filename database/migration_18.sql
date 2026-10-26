-- ============================================================
-- migration_18.sql
-- Pessoas físicas (IR), etapa A1: tabela ir_informes_pf — marcação
-- "já informado na declaração anual" por CPF e por ano.
--
-- Só CRIA uma tabela nova, vazia. Nenhuma tabela existente é alterada.
-- Os valores (bruto, IRRF, INSS, ISS) NÃO ficam aqui: a aplicação os
-- calcula a partir das OPs.
--
-- cpf = só os 11 dígitos (sem máscara).
-- ano = ano da competência das OPs (data_pagamento, senão
--       data_emissao — mesma regra da DARF).
-- Desmarcar = a aplicação apaga a linha e registra na auditoria.
--
-- Sem FK (mesmo motivo da darf_acompanhamento: a conta `admin` do app
-- não tem REFERENCES); a aplicação garante a consistência.
--
-- ANTES DE RODAR: confira a consulta 0 (a tabela não pode existir).
-- Rodar com conta privilegiada no Workbench. Pode rodar mais de uma vez.
-- ============================================================

USE empenho;
SET SQL_SAFE_UPDATES = 0;

-- 0) Antes da 1ª execução, esperado: 0. Se vier 1 numa base onde a
--    versão 18 ainda NÃO foi registrada, PARE: existe uma tabela com
--    esse nome que não é desta migration.
SELECT COUNT(*) AS ir_informes_pf_ja_existe
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ir_informes_pf';

-- Banco compartilhado: copia charset/collation de
-- ordens_pagamento.credor_cpf_cnpj (cruzamentos por CPF não falham com
-- "Illegal mix of collations"). Zera as variáveis antes: sem linha, o
-- SELECT INTO manteria o valor anterior.
SET @cs = NULL, @col = NULL;
SELECT CHARACTER_SET_NAME, COLLATION_NAME
  INTO @cs, @col
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordens_pagamento' AND COLUMN_NAME = 'credor_cpf_cnpj';

SET @cs  = COALESCE(@cs, @@character_set_database);
SET @col = COALESCE(@col, @@collation_database);

SET @sql = CONCAT(
  'CREATE TABLE IF NOT EXISTS ir_informes_pf (',
  '  id             CHAR(36)          NOT NULL PRIMARY KEY,',
  '  ano            SMALLINT UNSIGNED NOT NULL,',
  '  cpf            CHAR(11)          NOT NULL,',
  '  informado_por  CHAR(36)          NULL,',
  '  observacao     VARCHAR(300)      NULL,',
  '  created_at     TIMESTAMP         DEFAULT CURRENT_TIMESTAMP,',
  '  updated_at     TIMESTAMP         DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,',
  '  UNIQUE KEY uq_ir_ano_cpf (ano, cpf),',
  '  INDEX idx_ir_cpf (cpf)',
  ') ENGINE=InnoDB DEFAULT CHARSET=', @cs, ' COLLATE=', @col
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO schema_migrations (version) VALUES ('18');

-- ------------------------------------------------------------
-- CONFERÊNCIA (só leitura)
-- ------------------------------------------------------------
-- a) esperado: 7 linhas, nesta ordem:
--    id char(36) NO · ano smallint unsigned NO · cpf char(11) NO ·
--    informado_por char(36) YES · observacao varchar(300) YES ·
--    created_at timestamp · updated_at timestamp
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLLATION_NAME
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ir_informes_pf'
 ORDER BY ORDINAL_POSITION;

-- b) esperado: idx_ir_cpf (cpf, NON_UNIQUE=1) · PRIMARY (id, 0) ·
--    uq_ir_ano_cpf (ano e cpf, NON_UNIQUE=0)
SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ir_informes_pf'
 ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- c) esperado: as duas linhas com a MESMA collation
SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND (   (TABLE_NAME = 'ir_informes_pf'   AND COLUMN_NAME = 'cpf')
        OR (TABLE_NAME = 'ordens_pagamento' AND COLUMN_NAME = 'credor_cpf_cnpj'));

-- d) esperado: 1 linha com version = '18'
SELECT version, applied_at FROM schema_migrations WHERE version = '18';

-- e) esperado: 0 (a tabela nasce vazia)
SELECT COUNT(*) AS linhas_ir_informes_pf FROM ir_informes_pf;

-- ============================================================
-- ROLLBACK (somente com aprovação explícita; tabela nova, nenhuma
-- outra aplicação depende dela):
--   DROP TABLE ir_informes_pf;
--   DELETE FROM schema_migrations WHERE version = '18';
-- ============================================================
