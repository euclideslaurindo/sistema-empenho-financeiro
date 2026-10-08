# TASK-09 — Migration 12: taxa bancária, taxa PIX e snapshot na OP
<!-- milestone: M4 - Ordem de Pagamento | labels: banco,migration,P0 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 4 OP | P0 | ~3 h | – | R2 |

## Objetivo
Adicionar à tabela `ordens_pagamento` as colunas para **taxa bancária (expediente)**, **taxa PIX** e o **snapshot** das regras aplicadas no cálculo.

## Contexto (estado atual)
- `ordens_pagamento` já tem `irrf`, `iss`, `inss`, `sest_senat`, `patronal`, `outros_descontos`, `total_descontos` e `valor_liquido` (`DECIMAL`).
- A tabela é usada por outros sistemas: só `ADD COLUMN ... DEFAULT` não quebra `INSERT`s antigos.
- O usuário de app não tem `ALTER`: executar no Workbench. O projeto já usa blocos idempotentes com `information_schema` (ver `migration_05.sql`).

## Escopo
### Entra
- `taxa_bancaria`, `taxa_pix` e `retencoes_snapshot`.
- Registro em `schema_migrations`.

### Não entra
Alterar `total_descontos`/`valor_liquido` de OPs antigas.

## Especificação técnica (rascunho do script `database/migration_12.sql`)
```sql
USE empenho;
SET SQL_SAFE_UPDATES = 0;

-- (padrão idempotente: só adiciona se a coluna não existir)
SET @db = DATABASE();

SELECT COUNT(*) INTO @tem FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='ordens_pagamento' AND COLUMN_NAME='taxa_bancaria';
SET @sql = IF(@tem=0,
  'ALTER TABLE ordens_pagamento ADD COLUMN taxa_bancaria DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER outros_descontos',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- repetir o bloco para: taxa_pix DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER taxa_bancaria
--                       retencoes_snapshot JSON NULL AFTER valor_liquido

INSERT IGNORE INTO schema_migrations (version) VALUES ('12');
-- ROLLBACK (somente com aprovação explícita; evitar DROP COLUMN no banco compartilhado)
```

Conteúdo do `retencoes_snapshot` (gravado pela T10):
```json
{ "elemento": "3.3.90.36",
  "campos": { "irrf": { "aliquota": 1.5, "automatico": true, "valor": 15.00 },
              "inss": { "aliquota": 11,  "automatico": true, "valor": 110.00 } },
  "calculadoEm": "2026-10-06T14:22:10Z", "regra": "v1" }
```

Observação de compatibilidade: `total_descontos` passa a **incluir** as taxas bancária/PIX nas OPs novas. Outros sistemas que leiam esse total verão o valor já com elas (comportamento desejado, D11).

## Arquivos
- **Novo:** `database/migration_12.sql`
- **Tipos:** `lib/types/db.ts` (interface de `ordens_pagamento`)

## Critérios de aceite
- [ ] Script idempotente.
- [ ] OPs antigas ficam com `taxa_bancaria = 0`, `taxa_pix = 0`, `retencoes_snapshot = NULL`.
- [ ] Aplicação atual (sem as mudanças de código) continua criando OPs normalmente após a migration (compatibilidade para deploy em duas etapas).
- [ ] Versão `12` registrada.

## Riscos e observações
`ADD COLUMN` em tabela grande pode demorar; rodar fora do horário de uso.

## Decisões em aberto relacionadas
D11.
