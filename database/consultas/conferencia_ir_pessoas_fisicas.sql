-- ============================================================
-- conferencia_ir_pessoas_fisicas.sql — SÓ LEITURA
-- Pessoas físicas no IR (A2): o mesmo cálculo da tela "Pessoas físicas
-- (IR)", direto no banco, para comparar os totais.
--
-- Regras (as mesmas do sistema):
--   - entra quem tem CPF (11 dígitos, sem a máscara); CNPJ fica de fora;
--   - o ano da OP é o de data_pagamento, senão data_emissao, senão a data
--     em que a OP foi lançada (a mesma regra da DARF);
--   - NULL nas retenções conta como 0.
--
-- Troque o ano abaixo e rode tudo. Nenhum dado é alterado.
-- ============================================================

USE empenho;
SET @ano = 2026;

-- 1) Totais do ano: compare com o rodapé da tela.
SELECT COUNT(*)          AS pessoas,
       SUM(t.qtd_ops)    AS qtd_ops,
       SUM(t.bruto)      AS bruto,
       SUM(t.irrf)       AS irrf,
       SUM(t.inss)       AS inss,
       SUM(t.iss)        AS iss,
       SUM(t.liquido)    AS liquido
  FROM (
    SELECT REPLACE(REPLACE(REPLACE(REPLACE(op.credor_cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '') AS cpf,
           COUNT(*)                           AS qtd_ops,
           SUM(COALESCE(op.valor_pagamento, 0)) AS bruto,
           SUM(COALESCE(op.irrf, 0))          AS irrf,
           SUM(COALESCE(op.inss, 0))          AS inss,
           SUM(COALESCE(op.iss, 0))           AS iss,
           SUM(COALESCE(op.valor_liquido, 0)) AS liquido
      FROM ordens_pagamento op
     WHERE YEAR(COALESCE(op.data_pagamento, op.data_emissao, DATE(op.created_at))) = @ano
       AND CHAR_LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(op.credor_cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '')) = 11
     GROUP BY cpf
  ) t;

-- 2) Uma linha por pessoa: compare com a lista da tela.
SELECT REPLACE(REPLACE(REPLACE(REPLACE(op.credor_cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '') AS cpf,
       MAX(op.credor_nome)                AS nome_na_op,
       COUNT(*)                           AS qtd_ops,
       SUM(COALESCE(op.valor_pagamento, 0)) AS bruto,
       SUM(COALESCE(op.irrf, 0))          AS irrf,
       SUM(COALESCE(op.inss, 0))          AS inss,
       SUM(COALESCE(op.iss, 0))           AS iss,
       SUM(COALESCE(op.valor_liquido, 0)) AS liquido,
       GROUP_CONCAT(DISTINCT op.elemento ORDER BY op.elemento SEPARATOR ' / ') AS natureza
  FROM ordens_pagamento op
 WHERE YEAR(COALESCE(op.data_pagamento, op.data_emissao, DATE(op.created_at))) = @ano
   AND CHAR_LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(op.credor_cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '')) = 11
 GROUP BY cpf
 ORDER BY nome_na_op;

-- 3) Quem já foi marcado como informado no ano (a tela mostra o nome do
--    cadastro; aqui vai só o CPF, sem cruzar tabelas).
SELECT cpf, observacao, created_at AS informado_em
  FROM ir_informes_pf
 WHERE ano = @ano
 ORDER BY cpf;
