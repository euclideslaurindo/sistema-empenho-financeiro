-- ============================================================
-- conferencia_analises.sql — SÓ LEITURA
-- Aba Análises (B2): os mesmos números da tela, direto no banco, para
-- comparar. Base ano civil, todos os elementos.
--
-- Regras (as mesmas do sistema):
--   - data da OP: data_pagamento, senão data_emissao, senão a data em que
--     a OP foi lançada;
--   - data da NE: data_emissao, senão a data do cadastro;
--   - ponte: NEs com data no período, pagamentos a elas até @fim;
--   - NE cancelada conta pela situação atual.
--
-- Troque as datas abaixo (use como @fim a data de hoje se o período ainda
-- não terminou) e rode tudo. Nenhum dado é alterado.
-- ============================================================

USE empenho;
SET @inicio = '2026-01-01';
SET @fim = '2026-10-31';

-- 1) Cartões: pago, retido, restos a pagar e quantidade de OPs e credores.
SELECT COUNT(*)                                                     AS qtd_ops,
       COUNT(DISTINCT REPLACE(REPLACE(REPLACE(REPLACE(op.credor_cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '')) AS qtd_credores,
       SUM(COALESCE(op.valor_pagamento, 0))                         AS pago,
       SUM(COALESCE(op.irrf, 0) + COALESCE(op.iss, 0) + COALESCE(op.inss, 0) + COALESCE(op.sest_senat, 0)) AS retido,
       SUM(CASE WHEN COALESCE(CAST(NULLIF(ne.exercicio, '') AS UNSIGNED), YEAR(COALESCE(ne.data_emissao, DATE(ne.created_at)))) < YEAR(@inicio)
                THEN COALESCE(op.valor_pagamento, 0) ELSE 0 END)     AS restos_a_pagar
  FROM ordens_pagamento op
  LEFT JOIN notas_empenho ne ON ne.numero = op.numero_ne
 WHERE COALESCE(op.data_pagamento, op.data_emissao, DATE(op.created_at)) BETWEEN @inicio AND @fim;

-- 2) Ponte do orçamento: empenhado − cancelado − líquido − retenções e descontos = saldo.
SELECT SUM(ne.valor)                                                         AS empenhado,
       SUM(CASE WHEN ne.status = 'CANCELADO' THEN ne.valor ELSE 0 END)       AS cancelado,
       SUM(COALESCE(pg.liquido, 0))                                          AS liquido_pago,
       SUM(COALESCE(pg.pago, 0) - COALESCE(pg.liquido, 0))                   AS retencoes_e_descontos,
       SUM(ne.valor) - SUM(CASE WHEN ne.status = 'CANCELADO' THEN ne.valor ELSE 0 END) - SUM(COALESCE(pg.pago, 0)) AS saldo_a_pagar
  FROM notas_empenho ne
  LEFT JOIN (
    SELECT o2.numero_ne, SUM(COALESCE(o2.valor_pagamento, 0)) AS pago, SUM(COALESCE(o2.valor_liquido, 0)) AS liquido
      FROM ordens_pagamento o2
     WHERE COALESCE(o2.data_pagamento, o2.data_emissao, DATE(o2.created_at)) <= @fim
     GROUP BY o2.numero_ne
  ) pg ON pg.numero_ne = ne.numero
 WHERE COALESCE(ne.data_emissao, DATE(ne.created_at)) BETWEEN @inicio AND @fim;

-- 3) Situação das NEs do período, na posição de @fim.
SELECT CASE
         WHEN ne.status = 'CANCELADO'            THEN 'Cancelada'
         WHEN COALESCE(pg.pago, 0) <= 0          THEN 'A pagar'
         WHEN COALESCE(pg.pago, 0) >= ne.valor   THEN 'Paga'
         ELSE 'Parcial'
       END                AS situacao,
       COUNT(*)           AS qtd,
       SUM(ne.valor)      AS valor
  FROM notas_empenho ne
  LEFT JOIN (
    SELECT o2.numero_ne, SUM(COALESCE(o2.valor_pagamento, 0)) AS pago
      FROM ordens_pagamento o2
     WHERE COALESCE(o2.data_pagamento, o2.data_emissao, DATE(o2.created_at)) <= @fim
     GROUP BY o2.numero_ne
  ) pg ON pg.numero_ne = ne.numero
 WHERE COALESCE(ne.data_emissao, DATE(ne.created_at)) BETWEEN @inicio AND @fim
 GROUP BY situacao
 ORDER BY situacao;
