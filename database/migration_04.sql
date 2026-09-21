-- ============================================================
-- migration_04.sql
-- Adição da coluna ultimo_acesso em usuarios
-- Execução Não Destrutiva (segura para re-executar)
-- ============================================================

DROP PROCEDURE IF EXISTS add_column_usuarios_ultimo_acesso;
DELIMITER $$
CREATE PROCEDURE add_column_usuarios_ultimo_acesso()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'usuarios'
      AND column_name = 'ultimo_acesso'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN ultimo_acesso TIMESTAMP NULL DEFAULT NULL;
  END IF;
END$$
DELIMITER ;
CALL add_column_usuarios_ultimo_acesso();
DROP PROCEDURE IF EXISTS add_column_usuarios_ultimo_acesso;
