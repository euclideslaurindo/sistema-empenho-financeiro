-- ============================================================
-- migration_11.sql
-- Projeto "Retenções v2" (T02): cria elementos_despesa e
-- subelementos_despesa, seed dos 10 elementos atuais + o novo
-- 3.3.90.47, e alarga subelemento para 250 chars se necessário.
--
-- NOTA: seria "migration_10" no plano original, mas esse nome de
-- arquivo já existe (fix não relacionado da coluna ultimo_acesso).
--
-- Conta `admin` do app não tem ALTER/REFERENCES — rodar com conta
-- privilegiada no Workbench. Sem FKs nas tabelas novas (mesmo
-- padrão da migration_06).
-- ============================================================

USE empenho;
SET SQL_SAFE_UPDATES = 0;

-- 0) CONFERIR ANTES (opcional, só para documentar no PR):
-- SHOW COLUMNS FROM ordens_pagamento LIKE 'subelemento';
-- SHOW COLUMNS FROM notas_empenho    LIKE 'subelemento';

CREATE TABLE IF NOT EXISTS elementos_despesa (
  codigo      VARCHAR(20)  NOT NULL PRIMARY KEY,
  descricao   VARCHAR(200) NOT NULL,
  legado      TINYINT(1)   NOT NULL DEFAULT 0,
  ativo       TINYINT(1)   NOT NULL DEFAULT 1,
  ordem       INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subelementos_despesa (
  codigo          VARCHAR(30)  NOT NULL PRIMARY KEY,
  elemento_codigo VARCHAR(20)  NOT NULL,
  descricao       VARCHAR(250) NOT NULL,
  ativo           TINYINT(1)   NOT NULL DEFAULT 1,
  ordem           INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sub_elemento (elemento_codigo)
);

-- Descrições idênticas (verbatim) às de lib/constants.ts::ELEMENTOS,
-- menos o prefixo "<codigo> - ", para o texto montado bater com o que
-- já está gravado em NEs/OPs antigas. 3.3.90.47 é NOVO (não existe
-- ainda em lib/constants.ts), conforme as anotações originais do
-- usuário e a matriz de retenções do README do projeto.
INSERT IGNORE INTO elementos_despesa (codigo, descricao, legado, ordem) VALUES
 ('3.3.90.14','Diárias - Civil',0,10),
 ('3.3.90.30','Material de Consumo',0,20),
 ('3.3.90.33','Passagens e Despesas com Locomoção',0,30),
 ('3.3.90.36','Outros Serviços de Terceiros - Pessoa Física',0,40),
 ('3.3.90.39','Outros Serviços de Terceiros - Pessoa Jurídica',0,50),
 ('3.3.90.47','Obrigações Tributárias e Contributivas',0,60),
 ('3.3.90.32','Material de Distribuição Gratuita',1,70),
 ('3.3.90.35','Serviços de Consultoria',1,80),
 ('3.3.90.40','Serviços de Tecnologia da Informação (TIC)',1,90),
 ('4.4.90.51','Obras e Instalações',1,100),
 ('4.4.90.52','Equipamentos e Material Permanente',1,110);

-- Os 27 subelementos soltos de lib/constants.ts::SUBELEMENTOS NÃO são
-- migrados aqui: não têm vínculo com elemento (decisão D9, já
-- documentada no projeto) e continuam só como texto livre em
-- registros antigos. Só os 2 subelementos novos do 3.3.90.14 entram:
INSERT IGNORE INTO subelementos_despesa (codigo, elemento_codigo, descricao, ordem) VALUES
 ('3.3.90.14.01','3.3.90.14','Diárias Pessoal Civil Dentro do Estado',1),
 ('3.3.90.14.03','3.3.90.14','Bolsas de Capacitação - Secretaria de Educação Lei nº 11.461/97',2);

-- Alarga subelemento para 250 chars SE estiver menor que isso hoje.
-- Auto-verificado via information_schema: correto e seguro
-- independentemente do tamanho real atual (não confirmado em código).
SET @db = DATABASE();

SELECT CHARACTER_MAXIMUM_LENGTH INTO @tam_ne
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='notas_empenho' AND COLUMN_NAME='subelemento';
SET @sql = IF(@tam_ne IS NOT NULL AND @tam_ne < 250,
  'ALTER TABLE notas_empenho MODIFY COLUMN subelemento VARCHAR(250)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT CHARACTER_MAXIMUM_LENGTH INTO @tam_op
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='ordens_pagamento' AND COLUMN_NAME='subelemento';
SET @sql = IF(@tam_op IS NOT NULL AND @tam_op < 250,
  'ALTER TABLE ordens_pagamento MODIFY COLUMN subelemento VARCHAR(250)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO schema_migrations (version) VALUES ('11');

-- ============================================================
-- ROLLBACK (somente com aprovação explícita):
--   DROP TABLE subelementos_despesa; DROP TABLE elementos_despesa;
--   -- as colunas subelemento alargadas podem permanecer (widening
--   -- nunca é destrutivo; reverter o tamanho exigiria confirmar que
--   -- nenhum registro novo passou de 250 chars, senão o MODIFY de
--   -- volta falha com ER_DATA_TOO_LONG).
--   DELETE FROM schema_migrations WHERE version = '11';
-- ============================================================
