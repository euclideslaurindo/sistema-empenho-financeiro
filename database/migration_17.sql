-- ============================================================
-- migration_17.sql
-- Projeto "Retenções v2", rodada 2 (T32): Município (Expediente) do
-- credor e conferência das colunas da NE que deixam de ser preenchidas.
--
-- D41: a coluna se chama credores.municipioExpediente (camelCase,
-- VARCHAR(100) NULL). Ela JÁ EXISTE em produção, criada fora de
-- migration (vazia em 13/10/2026). Este script só a cria nos ambientes
-- onde ela falta (homologação, desenvolvimento, instalação nova).
-- NÃO criar `municipio_expediente`.
--
-- D47: nenhum MODIFY. As colunas data_pagamento, data_emissao,
-- data_provisao_concedida, credor_nome e cpf_cnpj de notas_empenho já
-- aceitam NULL; o script só CONFERE (consulta b). Se alguma vier
-- IS_NULLABLE = NO em algum ambiente, parar e tratar à parte.
--
-- Conta `admin` do app não tem ALTER — rodar com conta privilegiada no
-- Workbench, fora do horário de uso. Pode rodar mais de uma vez.
-- ============================================================

USE empenho;
SET SQL_SAFE_UPDATES = 0;
SET @db = DATABASE();

-- 1) Município (Expediente). No FINAL da tabela (sem AFTER), como a
--    migration_13: inserções posicionais de outros sistemas continuam
--    alinhadas e o MySQL 8 pode usar ALGORITHM=INSTANT.
--    (SET @tem = NULL antes do SELECT INTO: sem linha, a variável
--    manteria o valor anterior.)
SET @tem = NULL;
SELECT COUNT(*) INTO @tem FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='credores' AND COLUMN_NAME='municipioExpediente';
SET @sql = IF(@tem=0,
  'ALTER TABLE credores ADD COLUMN municipioExpediente VARCHAR(100) NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO schema_migrations (version) VALUES ('17');

-- ------------------------------------------------------------
-- CONFERÊNCIA (só leitura)
-- ------------------------------------------------------------
-- a) esperado: 1 linha, varchar(100), IS_NULLABLE = YES
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, CHARACTER_SET_NAME, COLLATION_NAME
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='credores' AND COLUMN_NAME='municipioExpediente';

-- b) esperado: 5 linhas, todas IS_NULLABLE = YES
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='notas_empenho'
   AND COLUMN_NAME IN ('data_pagamento','data_emissao','data_provisao_concedida','credor_nome','cpf_cnpj')
 ORDER BY COLUMN_NAME;

-- c) esperado: 0 (o nome errado não pode existir)
SELECT COUNT(*) AS municipio_expediente_nao_deve_existir
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='credores' AND COLUMN_NAME='municipio_expediente';

-- ============================================================
-- ROLLBACK (somente com aprovação explícita):
--   DELETE FROM schema_migrations WHERE version = '17';
-- NÃO remover a coluna municipioExpediente: ela não foi criada por esta
-- migration em produção (já existia) e pode ter outro dono.
-- ============================================================
