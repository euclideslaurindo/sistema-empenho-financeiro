-- ============================================================
-- conferencia_status_ne.sql  —  SOMENTE LEITURA (nenhum UPDATE)
--
-- PR 0 da T31: até esta correção, editar e salvar uma Nota de Empenho
-- gravava sempre status = 'EMITIDO' (a tela mandava fixo), reabrindo NEs
-- PARCIALMENTE PAGO, LIQUIDADO e até CANCELADO.
--
-- Rodar no Workbench e conferir o resultado. A correção dos dados que
-- aparecerem é decisão à parte (não está neste arquivo).
-- Não é migration: não registra nada em schema_migrations.
-- ============================================================

USE empenho;

-- a) NEs não canceladas cujo status difere do que o saldo das OPs indica.
--    Regra (a mesma do sistema): gasto 0 -> EMITIDO; gasto >= valor -> LIQUIDADO;
--    senão PARCIALMENTE PAGO.
SELECT ne.numero,
       ne.status                               AS status_atual,
       ne.valor,
       COALESCE(SUM(op.valor_pagamento), 0)    AS gasto,
       CASE WHEN COALESCE(SUM(op.valor_pagamento), 0) = 0 THEN 'EMITIDO'
            WHEN COALESCE(SUM(op.valor_pagamento), 0) >= ne.valor THEN 'LIQUIDADO'
            ELSE 'PARCIALMENTE PAGO' END        AS status_esperado
  FROM notas_empenho ne
  LEFT JOIN ordens_pagamento op ON op.numero_ne = ne.numero
 WHERE ne.status <> 'CANCELADO'
 GROUP BY ne.id, ne.numero, ne.status, ne.valor
HAVING status_esperado <> ne.status
 ORDER BY ne.numero;

-- b) NEs que estavam CANCELADO antes de uma edição (registro de auditoria)
--    e hoje não estão mais canceladas: provavelmente reabertas pelo bug.
SELECT ne.numero,
       ne.status         AS status_atual,
       a.created_at      AS editada_em
  FROM auditoria_financeira a
  JOIN notas_empenho ne ON ne.id = a.entidade_id
 WHERE a.entidade = 'notas_empenho'
   AND a.acao = 'UPDATE'
   AND JSON_UNQUOTE(JSON_EXTRACT(a.dados_anteriores, '$.status')) = 'CANCELADO'
   AND ne.status <> 'CANCELADO'
 ORDER BY a.created_at;

-- c) Liquidações já registradas. A rota POST /api/liquidacoes também grava o
--    status da NE, por outra regra (soma das liquidações). Se este número for
--    maior que zero, as duas regras podem divergir: avisar antes de corrigir.
SELECT COUNT(*) AS liquidacoes_registradas FROM liquidacoes;

-- Se (a) ou (b) der "Illegal mix of collations" no JOIN, avisar: dá para
-- separar em duas consultas.
