-- ============================================================
-- migration_22.sql
-- IR de Pessoa Jurídica por natureza (B9) e credor do Simples Nacional.
--
-- 1) Tabela nova subelemento_irrf: alíquota do IRRF por subelemento
--    (natureza da IN RFB 1.234/2012). Subelemento sem linha = alíquota
--    padrão do IRRF (Configurações → Retenções, hoje 1,5%).
-- 2) Os 28 subelementos de natureza do 3.3.90.39 (3.3.90.39.01 a .28)
--    com as alíquotas da tabela (0,24% / 1,20% / 2,40% / 4,80%).
-- 3) credores.is_simples: credor optante pelo Simples Nacional não
--    sofre retenção de IR (ISS e INSS seguem a regra do elemento).
--    Coluna nova com DEFAULT 0: nenhum credor existente muda.
--
-- Só CRIA uma tabela, INSERT IGNORE (não sobrescreve nada) e ADICIONA
-- uma coluna (só se ainda não existir). Nada é removido ou renomeado.
-- Sem FK (a conta `admin` do app não tem REFERENCES).
--
-- >>> RODAR ANTES DE INSTALAR A VERSÃO NOVA: o cadastro de credores e
--     o cálculo da OP passam a ler credores.is_simples. <<<
--
-- ANTES DE RODAR: confira a consulta 0.
-- Rodar com conta privilegiada no Workbench. Pode rodar mais de uma vez.
-- ============================================================

USE empenho;
SET SQL_SAFE_UPDATES = 0;

-- 0) Antes da 1ª execução, esperado: NENHUMA linha. Se vier algum
--    3.3.90.39.xx numa base onde a versão 22 ainda NÃO foi registrada,
--    PARE: os códigos .01 a .28 colidiriam com subelementos já usados.
SELECT codigo, descricao FROM subelementos_despesa WHERE codigo LIKE '3.3.90.39.%' ORDER BY codigo;
SELECT COUNT(*) AS versao_22_ja_rodou FROM schema_migrations WHERE version = '22';

-- ------------------------------------------------------------
-- 1) subelemento_irrf (charset/collation de subelementos_despesa.codigo)
-- ------------------------------------------------------------
SET @cs = NULL, @col = NULL;
SELECT CHARACTER_SET_NAME, COLLATION_NAME
  INTO @cs, @col
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subelementos_despesa' AND COLUMN_NAME = 'codigo';

SET @cs  = COALESCE(@cs, @@character_set_database);
SET @col = COALESCE(@col, @@collation_database);

-- aliquota 4.8000 = 4,80%
SET @sql = CONCAT(
  'CREATE TABLE IF NOT EXISTS subelemento_irrf (',
  '  subelemento_codigo VARCHAR(30)   NOT NULL PRIMARY KEY,',
  '  aliquota           DECIMAL(7,4)  NOT NULL,',
  '  atualizado_por     CHAR(36)      NULL,',
  '  updated_at         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  ') ENGINE=InnoDB DEFAULT CHARSET=', @cs, ' COLLATE=', @col
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ------------------------------------------------------------
-- 2) As 28 naturezas do 3.3.90.39
-- ------------------------------------------------------------
INSERT IGNORE INTO subelementos_despesa (codigo, elemento_codigo, descricao, ordem) VALUES
 ('3.3.90.39.01', '3.3.90.39', 'Gasolina, óleo diesel, GLP, gás natural, QAV e demais derivados de petróleo', 1),
 ('3.3.90.39.02', '3.3.90.39', 'Álcool etílico hidratado, inclusive para fins carburantes', 2),
 ('3.3.90.39.03', '3.3.90.39', 'Biodiesel', 3),
 ('3.3.90.39.04', '3.3.90.39', 'Alimentação', 4),
 ('3.3.90.39.05', '3.3.90.39', 'Energia elétrica', 5),
 ('3.3.90.39.06', '3.3.90.39', 'Serviços prestados com emprego de materiais', 6),
 ('3.3.90.39.07', '3.3.90.39', 'Construção civil por empreitada com emprego de materiais', 7),
 ('3.3.90.39.08', '3.3.90.39', 'Serviços hospitalares (art. 30 da IN RFB 1.234/2012)', 8),
 ('3.3.90.39.09', '3.3.90.39', 'Auxílio diagnóstico e terapia, patologia clínica, imagenologia e afins (art. 31 da IN RFB 1.234/2012)', 9),
 ('3.3.90.39.10', '3.3.90.39', 'Transporte de cargas', 10),
 ('3.3.90.39.11', '3.3.90.39', 'Produtos farmacêuticos, perfumaria, de toucador e de higiene pessoal', 11),
 ('3.3.90.39.12', '3.3.90.39', 'Mercadorias e bens em geral', 12),
 ('3.3.90.39.13', '3.3.90.39', 'Estaleiros navais brasileiros (construção, conservação, modernização, conversão e reparo de embarcações)', 13),
 ('3.3.90.39.14', '3.3.90.39', 'Produtos das alíneas "c" e "k" do inciso I do art. 5º', 14),
 ('3.3.90.39.15', '3.3.90.39', 'Passagens aéreas, rodoviárias e demais transportes de passageiros, inclusive tarifa de embarque', 15),
 ('3.3.90.39.16', '3.3.90.39', 'Serviços de bancos, financeiras, câmbio, arrendamento mercantil, cooperativas de crédito, seguros e previdência complementar', 16),
 ('3.3.90.39.17', '3.3.90.39', 'Seguro saúde', 17),
 ('3.3.90.39.18', '3.3.90.39', 'Abastecimento de água', 18),
 ('3.3.90.39.19', '3.3.90.39', 'Telefone', 19),
 ('3.3.90.39.20', '3.3.90.39', 'Correios e telégrafos', 20),
 ('3.3.90.39.21', '3.3.90.39', 'Vigilância', 21),
 ('3.3.90.39.22', '3.3.90.39', 'Limpeza', 22),
 ('3.3.90.39.23', '3.3.90.39', 'Locação de mão de obra', 23),
 ('3.3.90.39.24', '3.3.90.39', 'Intermediação de negócios', 24),
 ('3.3.90.39.25', '3.3.90.39', 'Administração, locação ou cessão de bens imóveis, móveis e direitos de qualquer natureza', 25),
 ('3.3.90.39.26', '3.3.90.39', 'Factoring', 26),
 ('3.3.90.39.27', '3.3.90.39', 'Plano de saúde humano, veterinário ou odontológico com valores fixos por servidor, empregado ou animal', 27),
 ('3.3.90.39.28', '3.3.90.39', 'Demais serviços', 28);

INSERT IGNORE INTO subelemento_irrf (subelemento_codigo, aliquota) VALUES
 ('3.3.90.39.01', 0.24), ('3.3.90.39.02', 0.24), ('3.3.90.39.03', 0.24),
 ('3.3.90.39.04', 1.20), ('3.3.90.39.05', 1.20), ('3.3.90.39.06', 1.20), ('3.3.90.39.07', 1.20),
 ('3.3.90.39.08', 1.20), ('3.3.90.39.09', 1.20), ('3.3.90.39.10', 1.20), ('3.3.90.39.11', 1.20),
 ('3.3.90.39.12', 1.20), ('3.3.90.39.13', 1.20), ('3.3.90.39.14', 1.20),
 ('3.3.90.39.15', 2.40), ('3.3.90.39.16', 2.40), ('3.3.90.39.17', 2.40),
 ('3.3.90.39.18', 4.80), ('3.3.90.39.19', 4.80), ('3.3.90.39.20', 4.80), ('3.3.90.39.21', 4.80),
 ('3.3.90.39.22', 4.80), ('3.3.90.39.23', 4.80), ('3.3.90.39.24', 4.80), ('3.3.90.39.25', 4.80),
 ('3.3.90.39.26', 4.80), ('3.3.90.39.27', 4.80), ('3.3.90.39.28', 4.80);

-- ------------------------------------------------------------
-- 3) credores.is_simples — só se ainda não existir
-- ------------------------------------------------------------
SET @existe = (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credores' AND COLUMN_NAME = 'is_simples');
SET @sql = IF(@existe = 0,
  'ALTER TABLE credores ADD COLUMN is_simples TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT ''is_simples já existe'' AS aviso');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO schema_migrations (version) VALUES ('22');

-- ------------------------------------------------------------
-- CONFERÊNCIA (só leitura)
-- ------------------------------------------------------------
-- a) esperado: 28 linhas, 3.3.90.39.01 a .28, todas do 3.3.90.39
SELECT s.codigo, s.descricao, i.aliquota
  FROM subelementos_despesa s LEFT JOIN subelemento_irrf i ON i.subelemento_codigo = s.codigo
 WHERE s.codigo LIKE '3.3.90.39.%' ORDER BY s.codigo;

-- b) esperado: 0.2400 → 3 · 1.2000 → 11 · 2.4000 → 3 · 4.8000 → 11
SELECT aliquota, COUNT(*) AS qtd FROM subelemento_irrf GROUP BY aliquota ORDER BY aliquota;

-- c) esperado: 1 linha, is_simples tinyint(1) NO default 0
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credores' AND COLUMN_NAME = 'is_simples';

-- d) esperado: 0 (ninguém marcado como Simples ainda)
SELECT COUNT(*) AS credores_simples FROM credores WHERE is_simples = 1;

-- e) esperado: 1 linha com version = '22'
SELECT version, applied_at FROM schema_migrations WHERE version = '22';

-- ============================================================
-- DEPOIS (na tela, sem SQL): Configurações → Retenções → Matriz →
-- no 3.3.90.39 desmarcar INSS, SEST/SENAT e Patronal (ficam IRRF e ISS).
--
-- ROLLBACK (somente com aprovação explícita):
--   DROP TABLE subelemento_irrf;
--   DELETE FROM subelementos_despesa WHERE codigo LIKE '3.3.90.39.%' AND codigo BETWEEN '3.3.90.39.01' AND '3.3.90.39.28';
--     (só se nenhuma NE usar esses subelementos; senão, desative-os em
--      Configurações > Elementos)
--   ALTER TABLE credores DROP COLUMN is_simples;
--     (a versão anterior do sistema não lê essa coluna)
--   DELETE FROM schema_migrations WHERE version = '22';
-- ============================================================
