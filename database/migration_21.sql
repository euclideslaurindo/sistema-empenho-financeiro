-- ============================================================
-- migration_21.sql
-- IRRF progressivo 2026 para Pessoa Física (B8): parâmetros do
-- perfil PESSOA_FISICA (elemento 3.3.90.36) em calculo_parametros.
--
-- Regra (documento "IR 2026"):
--   INSS da OP      = 11% do bruto (alíquota da config), até inss_teto
--   dedução do IR   = máx(INSS da OP; desconto_simplificado)
--   base do IR      = bruto − dedução; tabela progressiva = irrf_faixas
--   bruto <= isencao_ate                 -> IRRF = 0 (isento)
--   isencao_ate < bruto <= redutor_ate   -> IRRF = tabela − redutor
--       redutor = máx(0; redutor_constante − redutor_coeficiente × bruto)
--   bruto > redutor_ate                  -> IRRF = tabela
--
-- Só faz INSERT IGNORE em calculo_parametros (tabela deste sistema,
-- criada pela migration_16). Nenhuma tabela nova, nenhuma coluna
-- alterada; a tabela do IRRF (irrf_faixas) é a mesma do transporte.
-- Não sobrescreve valores que o admin já tenha editado.
--
-- >>> SEM ESTA MIGRATION, A OP DE 3.3.90.36 RESPONDE 422 ("parâmetros
--     não cadastrados"). Rodar ANTES de instalar a versão nova. <<<
--
-- Rodar com conta privilegiada no Workbench. Pode rodar mais de uma vez.
-- ============================================================

USE empenho;
SET SQL_SAFE_UPDATES = 0;

INSERT IGNORE INTO calculo_parametros (perfil, chave, valor, vigente_de) VALUES
 ('PESSOA_FISICA', 'inss_teto',             932.31,   '2026-01-01'),
 ('PESSOA_FISICA', 'desconto_simplificado', 607.20,   '2026-01-01'),
 ('PESSOA_FISICA', 'isencao_ate',           5000.00,  '2026-01-01'),
 ('PESSOA_FISICA', 'redutor_ate',           7350.00,  '2026-01-01'),
 ('PESSOA_FISICA', 'redutor_constante',     978.61,   '2026-01-01'),
 ('PESSOA_FISICA', 'redutor_coeficiente',   0.133145, '2026-01-01');

INSERT IGNORE INTO schema_migrations (version) VALUES ('21');

-- ------------------------------------------------------------
-- CONFERÊNCIA (só leitura)
-- ------------------------------------------------------------
-- a) esperado: 6 linhas, vigência 2026-01-01:
--    desconto_simplificado 607.20 · inss_teto 932.31 · isencao_ate 5000.00 ·
--    redutor_ate 7350.00 · redutor_coeficiente 0.133145 · redutor_constante 978.61
SELECT chave, valor, vigente_de FROM calculo_parametros
 WHERE perfil = 'PESSOA_FISICA' ORDER BY chave;

-- b) esperado: 5 faixas do IRRF com vigência 2026-01-01 (da migration_16)
SELECT COUNT(*) AS faixas_irrf_2026 FROM irrf_faixas WHERE vigente_de = '2026-01-01';

-- c) esperado: 1 linha com version = '21'
SELECT version, applied_at FROM schema_migrations WHERE version = '21';

-- ============================================================
-- ROLLBACK (somente com aprovação explícita; só linhas deste perfil):
--   DELETE FROM calculo_parametros WHERE perfil = 'PESSOA_FISICA';
--   DELETE FROM schema_migrations WHERE version = '21';
-- (Depois do rollback, OP de 3.3.90.36 volta a dar 422 até a versão
--  anterior do sistema ser reinstalada.)
-- ============================================================
