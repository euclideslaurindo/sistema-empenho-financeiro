-- ============================================================
-- migration_24.sql
-- B11: constante do redutor do IRRF da pessoa física (3.3.90.36) é
-- 978,62 (e não 978,61, como entrou na migration_21).
--
-- Altera UMA linha de calculo_parametros (tabela deste sistema), e só se
-- ela ainda estiver em 978,61 — se o admin já mudou, não mexe. As OPs já
-- emitidas não mudam: guardam o cálculo no retencoes_snapshot.
--
-- Efeito: OP de R$ 5.200,00 passa de IRRF 71,63 para 71,62.
--
-- Rodar com conta privilegiada no Workbench. Pode rodar mais de uma vez.
-- ============================================================

USE empenho;

-- 0) Antes, esperado: 1 linha com 978.610000
SELECT perfil, chave, valor, vigente_de FROM calculo_parametros
 WHERE perfil = 'PESSOA_FISICA' AND chave = 'redutor_constante';

UPDATE calculo_parametros
   SET valor = 978.62
 WHERE perfil = 'PESSOA_FISICA'
   AND chave = 'redutor_constante'
   AND vigente_de = '2026-01-01'
   AND valor = 978.61;

INSERT IGNORE INTO schema_migrations (version) VALUES ('24');

-- ------------------------------------------------------------
-- CONFERÊNCIA (só leitura)
-- ------------------------------------------------------------
-- a) esperado: 978.620000 na vigência 2026-01-01
SELECT perfil, chave, valor, vigente_de FROM calculo_parametros
 WHERE perfil = 'PESSOA_FISICA' AND chave = 'redutor_constante';

-- b) esperado: 1 linha com version = '24'
SELECT version, applied_at FROM schema_migrations WHERE version = '24';

-- ============================================================
-- ROLLBACK (somente com aprovação explícita):
--   UPDATE calculo_parametros SET valor = 978.61
--    WHERE perfil = 'PESSOA_FISICA' AND chave = 'redutor_constante'
--      AND vigente_de = '2026-01-01' AND valor = 978.62;
--   DELETE FROM schema_migrations WHERE version = '24';
-- ============================================================
