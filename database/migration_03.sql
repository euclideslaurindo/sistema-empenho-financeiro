-- ============================================================
-- migration_03.sql
-- Adição de Índices de Performance e Soft Delete
-- Execução Não Destrutiva (segura para re-executar)
-- ============================================================

-- Adiciona índice na coluna created_at de notas_empenho
DROP PROCEDURE IF EXISTS add_index_ne_created_at;
DELIMITER $$
CREATE PROCEDURE add_index_ne_created_at()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'notas_empenho'
      AND index_name = 'idx_ne_created_at'
  ) THEN
    ALTER TABLE notas_empenho ADD INDEX idx_ne_created_at (created_at);
  END IF;
END$$
DELIMITER ;
CALL add_index_ne_created_at();
DROP PROCEDURE IF EXISTS add_index_ne_created_at;

-- Adiciona índice na coluna created_at de ordens_pagamento
DROP PROCEDURE IF EXISTS add_index_op_created_at;
DELIMITER $$
CREATE PROCEDURE add_index_op_created_at()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'ordens_pagamento'
      AND index_name = 'idx_op_created_at'
  ) THEN
    ALTER TABLE ordens_pagamento ADD INDEX idx_op_created_at (created_at);
  END IF;
END$$
DELIMITER ;
CALL add_index_op_created_at();
DROP PROCEDURE IF EXISTS add_index_op_created_at;

-- Adiciona índice na coluna created_at de credores
DROP PROCEDURE IF EXISTS add_index_credor_created_at;
DELIMITER $$
CREATE PROCEDURE add_index_credor_created_at()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'credores'
      AND index_name = 'idx_credor_created_at'
  ) THEN
    ALTER TABLE credores ADD INDEX idx_credor_created_at (created_at);
  END IF;
END$$
DELIMITER ;
CALL add_index_credor_created_at();
DROP PROCEDURE IF EXISTS add_index_credor_created_at;

-- Adiciona índice na coluna deleted_at de notas_empenho
DROP PROCEDURE IF EXISTS add_index_ne_deleted_at;
DELIMITER $$
CREATE PROCEDURE add_index_ne_deleted_at()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'notas_empenho'
      AND index_name = 'idx_ne_deleted_at'
  ) THEN
    ALTER TABLE notas_empenho ADD INDEX idx_ne_deleted_at (deleted_at);
  END IF;
END$$
DELIMITER ;
CALL add_index_ne_deleted_at();
DROP PROCEDURE IF EXISTS add_index_ne_deleted_at;

-- Adiciona índice na coluna deleted_at de ordens_pagamento
DROP PROCEDURE IF EXISTS add_index_op_deleted_at;
DELIMITER $$
CREATE PROCEDURE add_index_op_deleted_at()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'ordens_pagamento'
      AND index_name = 'idx_op_deleted_at'
  ) THEN
    ALTER TABLE ordens_pagamento ADD INDEX idx_op_deleted_at (deleted_at);
  END IF;
END$$
DELIMITER ;
CALL add_index_op_deleted_at();
DROP PROCEDURE IF EXISTS add_index_op_deleted_at;

-- Adiciona índice na coluna codigo de notas_empenho (para buscas)
DROP PROCEDURE IF EXISTS add_index_ne_codigo;
DELIMITER $$
CREATE PROCEDURE add_index_ne_codigo()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'notas_empenho'
      AND index_name = 'idx_ne_codigo'
  ) THEN
    ALTER TABLE notas_empenho ADD INDEX idx_ne_codigo (codigo);
  END IF;
END$$
DELIMITER ;
CALL add_index_ne_codigo();
DROP PROCEDURE IF EXISTS add_index_ne_codigo;
