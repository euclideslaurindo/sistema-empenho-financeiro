-- ============================================================
-- conferencia_rodada2.sql  —  SOMENTE LEITURA (nenhum INSERT/UPDATE/DELETE)
--
-- T37: conferência da rodada 2 (NE sem credor, emissão de OPs em lote,
-- Município (Expediente)). Rodar no Workbench antes da entrega (seção 1)
-- e depois do roteiro de teste (seções 2 a 5) com a NE de teste.
-- Não é migration: não registra nada em schema_migrations.
-- Os SET abaixo só criam variáveis desta sessão do Workbench.
-- ============================================================

USE empenho;
SET @db = DATABASE();
SET @ne = '2026NE999901';   -- NE do roteiro de teste (trocar para conferir outra)

-- ------------------------------------------------------------
-- 1. Banco pronto para a rodada 2 (as mesmas conferências da migration_17)
-- ------------------------------------------------------------
-- 1a) esperado: 1 linha, varchar(100), IS_NULLABLE = YES
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, CHARACTER_SET_NAME, COLLATION_NAME
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='credores' AND COLUMN_NAME='municipioExpediente';

-- 1b) esperado: 5 linhas, todas IS_NULLABLE = YES (NE sem datas e sem credor)
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='notas_empenho'
   AND COLUMN_NAME IN ('data_pagamento','data_emissao','data_provisao_concedida','credor_nome','cpf_cnpj')
 ORDER BY COLUMN_NAME;

-- 1c) esperado: 0 (o nome errado não pode existir — D41)
SELECT COUNT(*) AS municipio_expediente_nao_deve_existir
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='credores' AND COLUMN_NAME='municipio_expediente';

-- 1d) esperado: a versão 17 registrada
SELECT * FROM schema_migrations WHERE version = '17';

-- ------------------------------------------------------------
-- 2. OPs da NE: em sequência, cada uma com seu credor, cheque e data
-- ------------------------------------------------------------
SELECT numero_empenho AS numero_op, sub, credor_nome, credor_cpf_cnpj,
       valor_pagamento, valor_liquido, numero_cheque,
       DATE_FORMAT(data_pagamento, '%Y-%m-%d') AS data_pagamento, created_at
  FROM ordens_pagamento
 WHERE numero_ne = @ne
 ORDER BY sub;

-- 2a) esperado: vazio (sub repetido na mesma NE)
SELECT sub, COUNT(*) AS vezes
  FROM ordens_pagamento
 WHERE numero_ne = @ne
 GROUP BY sub
HAVING COUNT(*) > 1;

-- ------------------------------------------------------------
-- 3. Saldo e status da NE (mesma regra do sistema)
--    esperado: status_atual = status_esperado (CANCELADO nunca muda) e
--    gasto <= valor
-- ------------------------------------------------------------
SELECT ne.numero, ne.valor, ne.status AS status_atual,
       COALESCE(SUM(op.valor_pagamento), 0)              AS gasto,
       ne.valor - COALESCE(SUM(op.valor_pagamento), 0)   AS restante,
       CASE WHEN ne.status = 'CANCELADO' THEN 'CANCELADO'
            WHEN COALESCE(SUM(op.valor_pagamento), 0) = 0 THEN 'EMITIDO'
            WHEN COALESCE(SUM(op.valor_pagamento), 0) >= ne.valor THEN 'LIQUIDADO'
            ELSE 'PARCIALMENTE PAGO' END                 AS status_esperado
  FROM notas_empenho ne
  LEFT JOIN ordens_pagamento op ON op.numero_ne = ne.numero
 WHERE ne.numero = @ne
 GROUP BY ne.id, ne.numero, ne.valor, ne.status;

-- ------------------------------------------------------------
-- 4. DARF de cada OP na competência do mês do pagamento da própria OP
--    esperado: competencia = competencia_esperada (OP sem INSS/patronal/
--    SEST-SENAT, ex.: MEI, pode não ter DARF — linha com competencia NULL)
-- ------------------------------------------------------------
SELECT op.numero_empenho AS numero_op, op.sub,
       DATE_FORMAT(op.data_pagamento, '%Y-%m-%d')                           AS data_pagamento,
       d.competencia,
       DATE_FORMAT(COALESCE(op.data_pagamento, op.data_emissao), '%Y-%m')  AS competencia_esperada,
       d.valor_darf, d.status
  FROM ordens_pagamento op
  LEFT JOIN darf_acompanhamento d ON d.ordem_pagamento_id = op.id
 WHERE op.numero_ne = @ne
 ORDER BY op.sub;

-- ------------------------------------------------------------
-- 5. Gerais
-- ------------------------------------------------------------
-- 5a) esperado: vazio (cheque usado em mais de uma OP, em todo o banco)
SELECT numero_cheque, COUNT(*) AS vezes
  FROM ordens_pagamento
 WHERE numero_cheque IS NOT NULL AND numero_cheque <> ''
 GROUP BY numero_cheque
HAVING COUNT(*) > 1;

-- 5b) emissões em lote registradas na auditoria (uma linha por emissão)
SELECT a.created_at, a.usuario_id,
       JSON_UNQUOTE(JSON_EXTRACT(a.dados_novos, '$.numeroNe'))   AS numero_ne,
       JSON_EXTRACT(a.dados_novos, '$.quantidade')               AS quantidade,
       JSON_EXTRACT(a.dados_novos, '$.totalBruto')               AS total_bruto
  FROM auditoria_financeira a
 WHERE a.acao = 'CREATE_LOTE'
 ORDER BY a.created_at DESC
 LIMIT 20;

-- Se a consulta 3 ou 4 der "Illegal mix of collations" no JOIN, avisar:
-- dá para separar em duas consultas.
