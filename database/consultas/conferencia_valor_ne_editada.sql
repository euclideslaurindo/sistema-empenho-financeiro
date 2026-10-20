-- ============================================================
-- conferencia_valor_ne_editada.sql  —  SOMENTE LEITURA (nenhum UPDATE)
--
-- Bug corrigido em fix/valor-ne-e-busca-credor: editar uma Nota de Empenho
-- (ou "Carregar dados da NE") e salvar sem mexer no valor gravava o valor
-- ×100 (R$ 100,00 virava R$ 10.000,00). Existia desde o início do sistema.
--
-- Estas consultas só APONTAM NEs suspeitas. A correção dos valores é decisão
-- à parte (script separado, com rollback, depois de conferir cada caso).
-- Não é migration: não registra nada em schema_migrations.
-- ============================================================

USE empenho;

-- 1) Edições AUDITADAS em que o valor foi multiplicado por ~100.
--    A auditoria de edição de NE (auditoria_financeira, acao UPDATE) existe
--    desde 09/10/2026; edições anteriores não aparecem aqui (ver consulta 2).
--    esperado: vazio. Cada linha é uma NE a conferir.
SELECT ne.numero,
       a.created_at                                                        AS editada_em,
       a.usuario_id,
       CAST(JSON_UNQUOTE(JSON_EXTRACT(a.dados_anteriores, '$.valor')) AS DECIMAL(15,2)) AS valor_antes,
       CAST(JSON_UNQUOTE(JSON_EXTRACT(a.dados_novos, '$.valor')) AS DECIMAL(15,2))      AS valor_depois,
       ne.valor                                                            AS valor_atual,
       ne.status
  FROM auditoria_financeira a
  JOIN notas_empenho ne ON ne.id = a.entidade_id
 WHERE a.entidade = 'notas_empenho'
   AND a.acao = 'UPDATE'
   AND CAST(JSON_UNQUOTE(JSON_EXTRACT(a.dados_anteriores, '$.valor')) AS DECIMAL(15,2)) > 0
   AND CAST(JSON_UNQUOTE(JSON_EXTRACT(a.dados_novos, '$.valor')) AS DECIMAL(15,2))
       / CAST(JSON_UNQUOTE(JSON_EXTRACT(a.dados_anteriores, '$.valor')) AS DECIMAL(15,2))
       BETWEEN 99 AND 101
 ORDER BY a.created_at;

-- 2) Apoio para o período SEM auditoria: NEs já editadas alguma vez
--    (updated_at bem depois de created_at) com valor muito acima do que já
--    foi pago, ou valor redondo ×100 suspeito. É heurística: cada linha é
--    para revisão manual (comparar com o documento original da NE).
SELECT ne.numero, ne.valor, ne.status,
       COALESCE(SUM(op.valor_pagamento), 0)   AS gasto,
       COUNT(op.id)                           AS qtd_ops,
       ne.created_at, ne.updated_at,
       CASE WHEN COALESCE(SUM(op.valor_pagamento), 0) > 0
            THEN ROUND(ne.valor / SUM(op.valor_pagamento), 1) END AS valor_sobre_gasto
  FROM notas_empenho ne
  LEFT JOIN ordens_pagamento op ON op.numero_ne = ne.numero
 WHERE ne.updated_at > ne.created_at + INTERVAL 1 MINUTE
 GROUP BY ne.id, ne.numero, ne.valor, ne.status, ne.created_at, ne.updated_at
HAVING (gasto > 0 AND ne.valor >= 50 * gasto)
    OR (ne.valor >= 100000 AND MOD(ne.valor, 100) = 0)
 ORDER BY ne.valor DESC
 LIMIT 200;

-- Se a consulta 2 der "Illegal mix of collations" no JOIN, avisar: dá para
-- separar em duas consultas.
