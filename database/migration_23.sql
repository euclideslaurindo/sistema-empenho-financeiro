-- ============================================================
-- migration_23.sql
-- ISS-BS (B10): 2º ISS, valor livre digitado em cada OP.
--
-- 1) ordens_pagamento.iss_bs DECIMAL(10,2) NOT NULL DEFAULT 0 — só se a
--    coluna ainda não existir. OPs já gravadas ficam com 0.
-- 2) config_retencoes: o campo 'iss_bs' (VALOR_DIGITADO, editável pelo
--    operador, entra no total de descontos, NÃO entra na DARF). O ADMIN
--    pode mudar o rótulo ou desativar em Configurações → Retenções.
--
-- Só ADICIONA uma coluna e faz um INSERT IGNORE (não sobrescreve nada).
-- Nada é removido ou renomeado.
--
-- >>> RODAR ANTES DE INSTALAR A VERSÃO NOVA (a OP passa a gravar e ler
--     iss_bs). Ordem: migration_21 → 22 → 23. <<<
--
-- Rodar com conta privilegiada no Workbench. Pode rodar mais de uma vez.
-- ============================================================

USE empenho;
SET SQL_SAFE_UPDATES = 0;

SET @tem = (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordens_pagamento' AND COLUMN_NAME = 'iss_bs');
SET @sql = IF(@tem = 0,
  'ALTER TABLE ordens_pagamento ADD COLUMN iss_bs DECIMAL(10,2) NOT NULL DEFAULT 0',
  'SELECT ''iss_bs já existe'' AS aviso');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO config_retencoes
 (campo, rotulo, tipo, aliquota, calculo_automatico, editavel_operador, entra_darf, ativo, ordem) VALUES
 ('iss_bs', 'ISS-BS', 'VALOR_DIGITADO', NULL, 0, 1, 0, 1, 25);

INSERT IGNORE INTO schema_migrations (version) VALUES ('23');

-- ------------------------------------------------------------
-- CONFERÊNCIA (só leitura)
-- ------------------------------------------------------------
-- a) esperado: 1 linha, iss_bs decimal(10,2) NO default 0.00
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordens_pagamento' AND COLUMN_NAME = 'iss_bs';

-- b) esperado: iss_bs · ISS-BS · VALOR_DIGITADO · aliquota NULL · automatico 0 · editavel 1 · darf 0 · ativo 1
SELECT campo, rotulo, tipo, aliquota, calculo_automatico, editavel_operador, entra_darf, ativo, ordem
  FROM config_retencoes WHERE campo = 'iss_bs';

-- c) esperado: 1 linha com version = '23'
SELECT version, applied_at FROM schema_migrations WHERE version = '23';

-- ============================================================
-- DEPOIS (na tela, sem SQL): para o GESTOR poder mudar o ISS (5%) na OP,
-- Configurações → Retenções → Campos → ISS → marcar "Editável pelo
-- operador" e salvar.
--
-- ROLLBACK (somente com aprovação explícita; evitar DROP COLUMN no
-- banco compartilhado):
--   DELETE FROM config_retencoes WHERE campo = 'iss_bs';
--   ALTER TABLE ordens_pagamento DROP COLUMN iss_bs;
--     (a versão anterior do sistema não lê essa coluna)
--   DELETE FROM schema_migrations WHERE version = '23';
-- ============================================================
