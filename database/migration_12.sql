-- ============================================================
-- migration_12.sql
-- Projeto "Retenções v2" (T03): cria config_retencoes (campos de
-- Retenções e Descontos, editáveis pelo admin) e elemento_retencoes
-- (matriz elemento × imposto), com a configuração atual como seed.
--
-- NOTA: seria "migration_11" no plano original da T03, mas esse nome
-- já foi usado pela T02 (elementos/subelementos), por causa do
-- deslocamento do migration_10.sql (fix não relacionado).
--
-- Conta `admin` do app não tem ALTER/REFERENCES — rodar com conta
-- privilegiada no Workbench. Sem FKs (mesmo padrão da migration_06
-- e da migration_11): elemento_codigo não referencia elementos_despesa
-- fisicamente; a integridade é validada na API (T06).
-- ============================================================

USE empenho;
SET SQL_SAFE_UPDATES = 0;

CREATE TABLE IF NOT EXISTS config_retencoes (
  campo              VARCHAR(30)  NOT NULL PRIMARY KEY, -- irrf, iss, inss, patronal, sest_senat, outros, taxa_bancaria, taxa_pix
  rotulo             VARCHAR(60)  NOT NULL,              -- texto exibido na tela e na impressão
  tipo               VARCHAR(20)  NOT NULL,              -- 'PERCENTUAL' | 'VALOR_DIGITADO'
  aliquota           DECIMAL(7,4) NULL,                  -- 1.5000 = 1,5%; NULL para VALOR_DIGITADO
  calculo_automatico TINYINT(1)   NOT NULL DEFAULT 1,    -- 1 = sistema calcula; 0 = operador digita
  editavel_operador  TINYINT(1)   NOT NULL DEFAULT 0,    -- 1 = GESTOR pode alterar o valor na OP (caso específico)
  entra_darf         TINYINT(1)   NOT NULL DEFAULT 0,    -- 1 = soma na DARF
  ativo              TINYINT(1)   NOT NULL DEFAULT 1,
  ordem              INT          NOT NULL DEFAULT 0,
  updated_by         CHAR(36)     NULL,
  updated_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS elemento_retencoes (
  elemento_codigo VARCHAR(20) NOT NULL,
  campo           VARCHAR(30) NOT NULL,                  -- só os 5 campos tributários (validado na API, T06)
  PRIMARY KEY (elemento_codigo, campo)                   -- presença da linha = "se aplica"
);

-- Alíquotas idênticas às hoje fixas no código (OpTaxesSection.tsx /
-- ordem-pagamento.service.ts): 1,5% / 5% / 11% / 20% / 2,5%. Mover
-- para o banco não muda nenhum valor calculado ainda (isso só muda
-- de verdade na T10, quando o motor passar a ler daqui).
INSERT IGNORE INTO config_retencoes
 (campo, rotulo, tipo, aliquota, calculo_automatico, editavel_operador, entra_darf, ativo, ordem) VALUES
 ('irrf',          'IRRF',                       'PERCENTUAL',     1.5000, 1, 0, 0, 1, 10),
 ('iss',           'ISS',                        'PERCENTUAL',     5.0000, 1, 0, 0, 1, 20),
 ('inss',          'INSS',                       'PERCENTUAL',    11.0000, 1, 0, 1, 1, 30),
 ('patronal',      'Patronal',                   'PERCENTUAL',    20.0000, 1, 0, 1, 1, 40),
 ('sest_senat',    'SEST/SENAT',                 'PERCENTUAL',     2.5000, 1, 0, 1, 1, 50),
 ('outros',        'Outros / IBS-CBS',           'VALOR_DIGITADO', NULL,   0, 0, 0, 1, 60),
 ('taxa_bancaria', 'Taxa bancária (expediente)', 'VALOR_DIGITADO', NULL,   0, 1, 0, 1, 70),
 ('taxa_pix',      'Taxa PIX',                   'VALOR_DIGITADO', NULL,   0, 1, 0, 1, 80);

-- Matriz: presença da linha = "este elemento aplica este imposto".
-- 3.3.90.14 não recebe NENHUMA linha (sem imposto, confirmado D-fechada).
-- Segue exatamente a seção 6 do README do projeto.
INSERT IGNORE INTO elemento_retencoes (elemento_codigo, campo) VALUES
 -- .33 .36 .39 : todos os 5
 ('3.3.90.33','irrf'),('3.3.90.33','iss'),('3.3.90.33','inss'),('3.3.90.33','patronal'),('3.3.90.33','sest_senat'),
 ('3.3.90.36','irrf'),('3.3.90.36','iss'),('3.3.90.36','inss'),('3.3.90.36','patronal'),('3.3.90.36','sest_senat'),
 ('3.3.90.39','irrf'),('3.3.90.39','iss'),('3.3.90.39','inss'),('3.3.90.39','patronal'),('3.3.90.39','sest_senat'),
 -- .30 e .47 : sem ISS
 ('3.3.90.30','irrf'),('3.3.90.30','inss'),('3.3.90.30','patronal'),('3.3.90.30','sest_senat'),
 ('3.3.90.47','irrf'),('3.3.90.47','inss'),('3.3.90.47','patronal'),('3.3.90.47','sest_senat'),
 -- legados: comportamento atual (todos os 5)
 ('3.3.90.32','irrf'),('3.3.90.32','iss'),('3.3.90.32','inss'),('3.3.90.32','patronal'),('3.3.90.32','sest_senat'),
 ('3.3.90.35','irrf'),('3.3.90.35','iss'),('3.3.90.35','inss'),('3.3.90.35','patronal'),('3.3.90.35','sest_senat'),
 ('3.3.90.40','irrf'),('3.3.90.40','iss'),('3.3.90.40','inss'),('3.3.90.40','patronal'),('3.3.90.40','sest_senat'),
 ('4.4.90.51','irrf'),('4.4.90.51','iss'),('4.4.90.51','inss'),('4.4.90.51','patronal'),('4.4.90.51','sest_senat'),
 ('4.4.90.52','irrf'),('4.4.90.52','iss'),('4.4.90.52','inss'),('4.4.90.52','patronal'),('4.4.90.52','sest_senat');

INSERT IGNORE INTO schema_migrations (version) VALUES ('12');

-- ============================================================
-- ROLLBACK (somente com aprovação explícita):
--   DROP TABLE elemento_retencoes; DROP TABLE config_retencoes;
--   DELETE FROM schema_migrations WHERE version = '12';
-- ============================================================
