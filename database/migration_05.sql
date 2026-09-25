-- ============================================================
-- migration_05.sql
-- Adição das colunas credor_nome e cpf_cnpj em notas_empenho
-- (usadas pelo código em lib/services/notas-empenho.service.ts
-- mas nunca criadas no schema — causava ER_BAD_FIELD_ERROR)
-- Execução Não Destrutiva (segura para re-executar)
-- ============================================================

DROP PROCEDURE IF EXISTS add_columns_notas_empenho_credor;
DELIMITER $$
CREATE PROCEDURE add_columns_notas_empenho_credor()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'notas_empenho'
      AND column_name = 'credor_nome'
  ) THEN
    ALTER TABLE notas_empenho ADD COLUMN credor_nome VARCHAR(200) NULL AFTER historico;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'notas_empenho'
      AND column_name = 'cpf_cnpj'
  ) THEN
    ALTER TABLE notas_empenho ADD COLUMN cpf_cnpj VARCHAR(20) NULL AFTER credor_nome;
  END IF;
END$$
DELIMITER ;
CALL add_columns_notas_empenho_credor();
DROP PROCEDURE IF EXISTS add_columns_notas_empenho_credor;
