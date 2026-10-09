-- ============================================================
-- migration_16.sql
-- Projeto "Retenções v2" (T24): parâmetros do cálculo de transporte
-- (elemento 3.3.90.33), tabela progressiva do IRRF e ISS por município
-- com a taxa de expediente da prefeitura. Seeds de 2026 retirados da
-- planilha EJA Campo (5ª parcela, NE 28925).
--
-- NOTA: seria "migration_15" no plano original; os nomes 13, 14 e 15
-- já foram usados pela T09, T14 e T19.
--
-- Só CRIA tabelas novas; nenhuma tabela existente é tocada.
-- Rodar com conta privilegiada no Workbench. Pode rodar duas vezes:
-- os seeds usam INSERT IGNORE (não duplicam nem sobrescrevem valores
-- que o admin já tenha editado).
--
-- >>> OS SEEDS VIRAM DINHEIRO: revisar com a contabilidade antes de
--     produção (tabela do IRRF e redutor mudam por lei). <<<
--
-- Vigência: o cálculo (T25) usa, para cada chave, a linha com a maior
-- vigente_de <= data de referência da OP (data_pagamento, senão
-- data_emissao, senão hoje). Assim a tabela de 2027 pode ser cadastrada
-- antes de valer e OPs antigas continuam com a tabela da época.
--
-- Conferido contra docs/projeto-retencoes-v2/fixtures/eja-campo-5a-parcela.json:
-- com estes valores, as 68 linhas não isentas batem centavo a centavo.
-- D22: o redutor do IRRF é máx(0; redutor_constante − redutor_coeficiente
-- × BRUTO) — sobre a base tributável 38 linhas divergem da planilha.
-- ============================================================

USE empenho;
SET SQL_SAFE_UPDATES = 0;

-- Banco compartilhado: copia charset/collation de credores.cidade, porque
-- o município do credor vai ser comparado com iss_municipios.
SET @cs = NULL, @col = NULL;
SELECT CHARACTER_SET_NAME, COLLATION_NAME
  INTO @cs, @col
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credores' AND COLUMN_NAME = 'cidade';

SET @cs  = COALESCE(@cs, @@character_set_database);
SET @col = COALESCE(@col, @@collation_database);
SET @sufixo = CONCAT(') ENGINE=InnoDB DEFAULT CHARSET=', @cs, ' COLLATE=', @col);

-- perfil: 'TRANSPORTE_AUTONOMO'
SET @sql = CONCAT(
  'CREATE TABLE IF NOT EXISTS calculo_parametros (',
  '  perfil      VARCHAR(30)   NOT NULL,',
  '  chave       VARCHAR(40)   NOT NULL,',
  '  valor       DECIMAL(18,6) NOT NULL,',
  '  vigente_de  DATE          NOT NULL,',
  '  updated_by  CHAR(36)      NULL,',
  '  updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,',
  '  PRIMARY KEY (perfil, chave, vigente_de)',
  @sufixo
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- limite_ate NULL = última faixa (sem limite); aliquota 7.5000 = 7,5%
SET @sql = CONCAT(
  'CREATE TABLE IF NOT EXISTS irrf_faixas (',
  '  vigente_de       DATE          NOT NULL,',
  '  ordem            INT           NOT NULL,',
  '  limite_ate       DECIMAL(15,2) NULL,',
  '  aliquota         DECIMAL(7,4)  NOT NULL,',
  '  parcela_deduzir  DECIMAL(15,2) NOT NULL,',
  '  updated_by       CHAR(36)      NULL,',
  '  updated_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,',
  '  PRIMARY KEY (vigente_de, ordem)',
  @sufixo
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- chave: nome normalizado (minúsculas, sem acento), ex.: 'aguas belas'.
-- taxa_expediente é a taxa DA PREFEITURA (parte do ISS), não a taxa bancária.
-- apelidos: separados por ';', ex.: 'sbu;sao bento'.
SET @sql = CONCAT(
  'CREATE TABLE IF NOT EXISTS iss_municipios (',
  '  chave            VARCHAR(80)   NOT NULL PRIMARY KEY,',
  '  nome             VARCHAR(100)  NOT NULL,',
  '  uf               CHAR(2)       NOT NULL DEFAULT ''PE'',',
  '  aliquota         DECIMAL(7,4)  NOT NULL DEFAULT 5.0000,',
  '  taxa_expediente  DECIMAL(10,2) NOT NULL DEFAULT 0,',
  '  apelidos         VARCHAR(200)  NULL,',
  '  ativo            TINYINT(1)    NOT NULL DEFAULT 1,',
  '  updated_by       CHAR(36)      NULL,',
  '  updated_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  @sufixo
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ------------------------------------------------------------
-- SEEDS (vigência 2026)
-- ------------------------------------------------------------
INSERT IGNORE INTO calculo_parametros (perfil, chave, valor, vigente_de) VALUES
 ('TRANSPORTE_AUTONOMO', 'base_percentual',            20,       '2026-01-01'),
 ('TRANSPORTE_AUTONOMO', 'inss_percentual',            11,       '2026-01-01'),
 ('TRANSPORTE_AUTONOMO', 'patronal_percentual',        20,       '2026-01-01'),
 ('TRANSPORTE_AUTONOMO', 'sest_percentual',            1.5,      '2026-01-01'),
 ('TRANSPORTE_AUTONOMO', 'senat_percentual',           1,        '2026-01-01'),
 ('TRANSPORTE_AUTONOMO', 'irrf_tributavel_percentual', 60,       '2026-01-01'),
 ('TRANSPORTE_AUTONOMO', 'desconto_simplificado',      607.20,   '2026-01-01'),
 ('TRANSPORTE_AUTONOMO', 'redutor_constante',          978.62,   '2026-01-01'),
 ('TRANSPORTE_AUTONOMO', 'redutor_coeficiente',        0.133145, '2026-01-01');

INSERT IGNORE INTO irrf_faixas (vigente_de, ordem, limite_ate, aliquota, parcela_deduzir) VALUES
 ('2026-01-01', 1, 2428.80,  0.0000,   0.00),
 ('2026-01-01', 2, 2826.65,  7.5000, 182.16),
 ('2026-01-01', 3, 3751.05, 15.0000, 394.16),
 ('2026-01-01', 4, 4664.68, 22.5000, 675.49),
 ('2026-01-01', 5, NULL,    27.5000, 908.73);

INSERT IGNORE INTO iss_municipios (chave, nome, uf, aliquota, taxa_expediente, apelidos) VALUES
 ('aguas belas',      'Águas Belas',      'PE', 5, 0.00,  NULL),
 ('bom conselho',     'Bom Conselho',     'PE', 5, 0.00,  NULL),
 ('caetes',           'Caetés',           'PE', 5, 0.00,  NULL),
 ('canhotinho',       'Canhotinho',       'PE', 5, 15.20, NULL),
 ('capoeiras',        'Capoeiras',        'PE', 5, 3.94,  NULL),
 ('garanhuns',        'Garanhuns',        'PE', 5, 0.00,  NULL),
 ('iati',             'Iati',             'PE', 5, 6.90,  NULL),
 ('lajedo',           'Lajedo',           'PE', 5, 0.00,  NULL),
 ('sao bento do una', 'São Bento do Una', 'PE', 5, 0.00,  'sbu;sao bento'),
 ('correntes',        'Correntes',        'PE', 5, 0.00,  NULL),
 ('brejao',           'Brejão',           'PE', 5, 0.00,  NULL),
 ('jucati',           'Jucati',           'PE', 5, 3.00,  NULL),
 ('jupi',             'Jupi',             'PE', 5, 6.76,  NULL);

INSERT IGNORE INTO schema_migrations (version) VALUES ('16');

-- ------------------------------------------------------------
-- CONFERÊNCIA (só leitura): esperado 9 / 5 / 13.
-- ------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM calculo_parametros WHERE perfil = 'TRANSPORTE_AUTONOMO') AS parametros,
  (SELECT COUNT(*) FROM irrf_faixas WHERE vigente_de = '2026-01-01') AS faixas_irrf,
  (SELECT COUNT(*) FROM iss_municipios) AS municipios;

-- Esperado: Canhotinho 15,20 · Capoeiras 3,94 · Iati 6,90 · Jucati 3,00 · Jupi 6,76.
SELECT nome, taxa_expediente FROM iss_municipios WHERE taxa_expediente > 0 ORDER BY nome;

-- ============================================================
-- ROLLBACK (somente com aprovação explícita; tabelas novas, nenhuma
-- outra aplicação depende delas):
--   DROP TABLE iss_municipios;
--   DROP TABLE irrf_faixas;
--   DROP TABLE calculo_parametros;
--   DELETE FROM schema_migrations WHERE version = '16';
-- ============================================================
