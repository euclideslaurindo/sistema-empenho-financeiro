# TASK-19 — Migration 14: acompanhamento da DARF
<!-- milestone: M8 - DARF | labels: banco,migration,P0 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 8 DARF | P0 | ~4 h | T03, T09 | R6 |

## Objetivo
Criar a tabela que acompanha, **por OP**, o valor da DARF, o mês de competência e o status, e carregar o histórico das OPs que já têm INSS/Patronal/SEST-SENAT.

## Contexto (estado atual)
- Não existe nenhum controle de DARF. As retenções que a compõem estão nas colunas `inss`, `patronal` e `sest_senat` de `ordens_pagamento` (D4: IRRF e ISS ficam fora).
- A OP é **excluída fisicamente** (`DELETE FROM ordens_pagamento`) e a exclusão grava auditoria; portanto a linha da DARF precisa acompanhar essa exclusão.
- `ordens_pagamento` tem `data_emissao` e `data_pagamento` (D6: competência = `data_pagamento`, fallback `data_emissao`).

## Escopo
### Entra
- Tabela `darf_acompanhamento` e índices.
- Backfill das OPs existentes com DARF > 0, com um **mês de corte** configurável: OPs anteriores ao corte entram como `PAGA` (para o usuário não ter que baixar o histórico antigo).

### Não entra
Lógica de sincronização (T20) e tela (T21).

## Especificação técnica (rascunho do script `database/migration_14.sql`)
```sql
USE empenho;
SET SQL_SAFE_UPDATES = 0;

CREATE TABLE IF NOT EXISTS darf_acompanhamento (
  id                  CHAR(36)      NOT NULL PRIMARY KEY,
  ordem_pagamento_id  CHAR(36)      NOT NULL,                -- ordens_pagamento.id
  numero_ne           VARCHAR(60)   NOT NULL,
  numero_op           VARCHAR(60)   NULL,                    -- valor de ordens_pagamento.numero_empenho (ex.: 2026.OP.0004)
  sub                 VARCHAR(5)    NULL,
  credor_cpf_cnpj     VARCHAR(20)   NOT NULL,
  credor_nome         VARCHAR(200)  NULL,
  competencia         CHAR(7)       NOT NULL,                -- 'YYYY-MM'
  valor_darf          DECIMAL(15,2) NOT NULL,
  detalhe_json        JSON          NULL,                    -- {"inss":110.00,"patronal":200.00,"sest_senat":25.00}
  status              VARCHAR(20)   NOT NULL DEFAULT 'PENDENTE',   -- PENDENTE | PAGA (extensível)
  data_pagamento      DATE          NULL,
  observacao          VARCHAR(300)  NULL,
  atualizado_por      CHAR(36)      NULL,
  created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_darf_op (ordem_pagamento_id),
  INDEX idx_darf_comp_status (competencia, status),
  INDEX idx_darf_credor (credor_cpf_cnpj),
  INDEX idx_darf_ne (numero_ne)
);

-- BACKFILL (ajuste @mes_corte antes de rodar; OPs de meses anteriores entram como PAGA)
SET @mes_corte = '2026-10';
INSERT IGNORE INTO darf_acompanhamento
  (id, ordem_pagamento_id, numero_ne, numero_op, sub, credor_cpf_cnpj, credor_nome,
   competencia, valor_darf, detalhe_json, status)
SELECT UUID(), op.id, op.numero_ne, op.numero_empenho, op.sub, op.credor_cpf_cnpj, op.credor_nome,
       DATE_FORMAT(COALESCE(op.data_pagamento, op.data_emissao, DATE(op.created_at)), '%Y-%m'),
       (op.inss + op.patronal + op.sest_senat),
       JSON_OBJECT('inss', op.inss, 'patronal', op.patronal, 'sest_senat', op.sest_senat),
       IF(DATE_FORMAT(COALESCE(op.data_pagamento, op.data_emissao, DATE(op.created_at)), '%Y-%m') < @mes_corte,
          'PAGA', 'PENDENTE')
  FROM ordens_pagamento op
 WHERE (op.inss + op.patronal + op.sest_senat) > 0;

INSERT IGNORE INTO schema_migrations (version) VALUES ('14');
-- ROLLBACK (somente com aprovação explícita): DROP TABLE darf_acompanhamento;
```

Observação: as colunas somadas no backfill refletem a decisão D4 (INSS + Patronal + SEST/SENAT). Se o admin mudar `entra_darf` depois, a T20 passa a somar conforme a configuração vigente **nas OPs novas/editadas**.

## Arquivos
- **Novo:** `database/migration_14.sql`
- **Tipos:** `lib/types/db.ts`

## Critérios de aceite
- [ ] Idempotente (a unique `uq_darf_op` impede duplicidade no backfill).
- [ ] Conferência: `SELECT COUNT(*)` do backfill = nº de OPs com `inss+patronal+sest_senat > 0`.
- [ ] OPs de meses anteriores ao corte ficam `PAGA`; as do mês de corte em diante, `PENDENTE`.
- [ ] Versão `14` registrada.

## Riscos e observações
- **Definir o `@mes_corte` com o usuário antes de rodar**, para não gerar centenas de pendências falsas.
- `UUID()` em `INSERT … SELECT` gera um valor por linha no MySQL 8; conferir em homologação.

## Decisões em aberto relacionadas
D4, D5, D6.
