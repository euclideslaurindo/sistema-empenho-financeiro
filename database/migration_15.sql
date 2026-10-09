-- ============================================================
-- migration_15.sql
-- Projeto "Retenções v2" (T19): tabela darf_acompanhamento — uma
-- linha por OP com o valor da DARF, mês de competência e status —
-- e carga do histórico.
--
-- NOTA: seria "migration_14" no plano original; os nomes 13 e 14 já
-- foram usados pela T09 e pela T14 (deslocamento do migration_10.sql).
--
-- DARF = INSS + Patronal + SEST/SENAT (decisão D4; IRRF e ISS fora).
-- Competência = data_pagamento da OP, senão data_emissao, senão a
-- data de criação (D6). Status: PENDENTE | PAGA (D5).
--
-- Só CRIA uma tabela nova; ordens_pagamento é apenas LIDA.
-- Sem FK/CASCADE (conta `admin` do app não tem REFERENCES): quando
-- uma OP for excluída, quem apaga a linha da DARF é a aplicação (T20).
--
-- O backfill é uma foto do momento em que roda: OPs salvas depois
-- disto e antes da T20 ir para produção precisam ser sincronizadas
-- pela T20 (ou rode esta migration junto com o deploy da T20).
--
-- >>> CONFIRA @mes_corte ANTES DE RODAR (decidido: 2026-10). <<<
-- Rodar com conta privilegiada no Workbench. Pode rodar duas vezes.
-- ============================================================

USE empenho;
SET SQL_SAFE_UPDATES = 0;

-- Banco compartilhado: copia charset/collation de ordens_pagamento.numero_ne
-- para os cruzamentos com OP/NE/credores não falharem com
-- "Illegal mix of collations".
SET @cs = NULL, @col = NULL;
SELECT CHARACTER_SET_NAME, COLLATION_NAME
  INTO @cs, @col
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordens_pagamento' AND COLUMN_NAME = 'numero_ne';

SET @cs  = COALESCE(@cs, @@character_set_database);
SET @col = COALESCE(@col, @@collation_database);

-- numero_op guarda ordens_pagamento.numero_empenho (ex.: 2026.OP.0004).
-- detalhe_json: {"inss": 110.00, "patronal": 200.00, "sest_senat": 25.00}
SET @sql = CONCAT(
  'CREATE TABLE IF NOT EXISTS darf_acompanhamento (',
  '  id                  CHAR(36)      NOT NULL PRIMARY KEY,',
  '  ordem_pagamento_id  CHAR(36)      NOT NULL,',
  '  numero_ne           VARCHAR(60)   NOT NULL,',
  '  numero_op           VARCHAR(60)   NULL,',
  '  sub                 VARCHAR(5)    NULL,',
  '  credor_cpf_cnpj     VARCHAR(20)   NOT NULL,',
  '  credor_nome         VARCHAR(200)  NULL,',
  '  competencia         CHAR(7)       NOT NULL,',
  '  valor_darf          DECIMAL(15,2) NOT NULL,',
  '  detalhe_json        JSON          NULL,',
  '  status              VARCHAR(20)   NOT NULL DEFAULT ''PENDENTE'',',
  '  data_pagamento      DATE          NULL,',
  '  observacao          VARCHAR(300)  NULL,',
  '  atualizado_por      CHAR(36)      NULL,',
  '  created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,',
  '  updated_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,',
  '  UNIQUE KEY uq_darf_op (ordem_pagamento_id),',
  '  INDEX idx_darf_comp_status (competencia, status),',
  '  INDEX idx_darf_credor (credor_cpf_cnpj),',
  '  INDEX idx_darf_ne (numero_ne)',
  ') ENGINE=InnoDB DEFAULT CHARSET=', @cs, ' COLLATE=', @col
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ------------------------------------------------------------
-- BACKFILL: competência anterior ao corte -> PAGA; do corte em diante -> PENDENTE.
-- COALESCE nas retenções: as colunas aceitam NULL e NULL + x = NULL
-- (a OP sumiria do backfill). INSERT IGNORE + uq_darf_op: rodar de novo
-- não duplica nem altera status já registrado.
-- ------------------------------------------------------------
SET @mes_corte = '2026-10';

INSERT IGNORE INTO darf_acompanhamento
  (id, ordem_pagamento_id, numero_ne, numero_op, sub, credor_cpf_cnpj, credor_nome,
   competencia, valor_darf, detalhe_json, status)
SELECT UUID(),
       op.id,
       op.numero_ne,
       op.numero_empenho,
       op.sub,
       COALESCE(op.credor_cpf_cnpj, ''),
       op.credor_nome,
       DATE_FORMAT(COALESCE(op.data_pagamento, op.data_emissao, DATE(op.created_at)), '%Y-%m'),
       COALESCE(op.inss, 0) + COALESCE(op.patronal, 0) + COALESCE(op.sest_senat, 0),
       JSON_OBJECT('inss', COALESCE(op.inss, 0), 'patronal', COALESCE(op.patronal, 0), 'sest_senat', COALESCE(op.sest_senat, 0)),
       IF(DATE_FORMAT(COALESCE(op.data_pagamento, op.data_emissao, DATE(op.created_at)), '%Y-%m') < @mes_corte,
          'PAGA', 'PENDENTE')
  FROM ordens_pagamento op
 WHERE COALESCE(op.inss, 0) + COALESCE(op.patronal, 0) + COALESCE(op.sest_senat, 0) > 0;

INSERT IGNORE INTO schema_migrations (version) VALUES ('15');

-- ------------------------------------------------------------
-- CONFERÊNCIA (só leitura)
-- ------------------------------------------------------------
-- 1) ops_com_darf deve ser igual a linhas_darf; linhas_sem_op deve ser 0.
SELECT
  (SELECT COUNT(*) FROM ordens_pagamento
    WHERE COALESCE(inss, 0) + COALESCE(patronal, 0) + COALESCE(sest_senat, 0) > 0) AS ops_com_darf,
  (SELECT COUNT(*) FROM darf_acompanhamento) AS linhas_darf,
  (SELECT COUNT(*) FROM darf_acompanhamento d
    WHERE NOT EXISTS (SELECT 1 FROM ordens_pagamento op WHERE op.id = d.ordem_pagamento_id)) AS linhas_sem_op;

-- 2) Quantas pendências o corte gerou, por competência.
SELECT competencia, status, COUNT(*) AS qtd, SUM(valor_darf) AS total
  FROM darf_acompanhamento
 GROUP BY competencia, status
 ORDER BY competencia DESC, status;

-- 3) Collations dos campos cruzados (cada par deve ser igual).
SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND (   (TABLE_NAME = 'darf_acompanhamento' AND COLUMN_NAME IN ('ordem_pagamento_id', 'numero_ne', 'credor_cpf_cnpj'))
        OR (TABLE_NAME = 'ordens_pagamento'    AND COLUMN_NAME IN ('id', 'numero_ne', 'credor_cpf_cnpj')))
 ORDER BY COLUMN_NAME, TABLE_NAME;

-- ============================================================
-- ROLLBACK (somente com aprovação explícita; tabela nova, nenhuma
-- outra aplicação depende dela):
--   DROP TABLE darf_acompanhamento;
--   DELETE FROM schema_migrations WHERE version = '15';
-- ============================================================
