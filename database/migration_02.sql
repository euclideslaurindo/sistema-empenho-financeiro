-- ============================================================
-- migration_02.sql
-- Performance e integridade: índice na coluna numero_ne
-- Execução Não Destrutiva (segura para re-executar)
-- ============================================================

-- Adiciona índice na coluna numero_ne de ordens_pagamento para
-- garantir performance nas queries de saldo (SUM/WHERE numero_ne = ?)
-- que são executadas a cada consulta de NE e salvamento de OP.

-- O IF EXISTS/DROP + CREATE garante idempotência
DROP PROCEDURE IF EXISTS add_index_if_not_exists;
DELIMITER $$
CREATE PROCEDURE add_index_if_not_exists()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'ordens_pagamento'
      AND index_name = 'idx_numero_ne'
  ) THEN
    ALTER TABLE ordens_pagamento ADD INDEX idx_numero_ne (numero_ne);
  END IF;
END$$
DELIMITER ;
CALL add_index_if_not_exists();
DROP PROCEDURE IF EXISTS add_index_if_not_exists;

-- Adiciona índice no numero_empenho (usado para gerar número sequencial da OP)
DROP PROCEDURE IF EXISTS add_index_ne_empenho;
DELIMITER $$
CREATE PROCEDURE add_index_ne_empenho()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'ordens_pagamento'
      AND index_name = 'idx_numero_empenho'
  ) THEN
    ALTER TABLE ordens_pagamento ADD INDEX idx_numero_empenho (numero_empenho);
  END IF;
END$$
DELIMITER ;
CALL add_index_ne_empenho();
DROP PROCEDURE IF EXISTS add_index_ne_empenho;
