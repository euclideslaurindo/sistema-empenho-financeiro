# TASK-14 — Migration 13: tabela `ne_credores`
<!-- milestone: M6 - NE com vários credores | labels: banco,migration,P0 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 6 Multi-credor | P0 | ~3 h | – | R7 |

## Objetivo
Criar a tabela que liga **uma NE a vários credores**, guardando o **valor bruto** de cada um.

## Contexto (estado atual)
- `notas_empenho` guarda um credor (`credor_nome`, `cpf_cnpj`, adicionados na `migration_05`).
- `ordens_pagamento` referencia a NE por `numero_ne` (`fk_op_ne`) e o credor por `credor_cpf_cnpj` (`fk_op_credor`, `migration_08`). Ou seja, **a OP já suporta credores diferentes na mesma NE**; falta registrar o que cada credor pode receber.
- O usuário de app não tem `REFERENCES`: sem FKs nas tabelas novas (padrão da `migration_06`).

## Escopo
### Entra
- Tabela `ne_credores` e índices.
- Script **opcional** de backfill para NEs antigas.

### Não entra
Alterar `notas_empenho` (as colunas legadas continuam).

## Especificação técnica (rascunho do script `database/migration_13.sql`)
```sql
USE empenho;
SET SQL_SAFE_UPDATES = 0;

CREATE TABLE IF NOT EXISTS ne_credores (
  id               CHAR(36)      NOT NULL PRIMARY KEY,
  numero_ne        VARCHAR(60)   NOT NULL,                -- referência a notas_empenho.numero
  credor_cpf_cnpj  VARCHAR(20)   NOT NULL,                -- referência a credores.cpf_cnpj
  credor_nome      VARCHAR(200)  NOT NULL,                -- cópia para exibição/impressão
  valor_bruto      DECIMAL(15,2) NOT NULL,
  ordem            INT           NOT NULL DEFAULT 0,
  created_by       CHAR(36)      NULL,
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ne_credor (numero_ne, credor_cpf_cnpj),
  INDEX idx_nec_ne (numero_ne),
  INDEX idx_nec_credor (credor_cpf_cnpj)
);

-- BACKFILL OPCIONAL (NEs antigas com 1 credor): o código também funciona sem isto (fallback na T15)
-- INSERT IGNORE INTO ne_credores (id, numero_ne, credor_cpf_cnpj, credor_nome, valor_bruto, ordem)
-- SELECT UUID(), ne.numero, ne.cpf_cnpj, COALESCE(ne.credor_nome,''), ne.valor, 0
--   FROM notas_empenho ne
--  WHERE ne.cpf_cnpj IS NOT NULL AND ne.cpf_cnpj <> ''
--    AND NOT EXISTS (SELECT 1 FROM ne_credores x WHERE x.numero_ne = ne.numero);

INSERT IGNORE INTO schema_migrations (version) VALUES ('13');
-- ROLLBACK (somente com aprovação explícita): DROP TABLE ne_credores;
```

Regras:
- `valor_bruto` > 0 e a soma por NE deve ser igual a `notas_empenho.valor` (**validada pela aplicação**, em centavos).
- Sem `deleted_at`: ao editar a NE a lista é **substituída** numa transação (com auditoria).
- Chave de ligação pelo **número** da NE, como já faz `ordens_pagamento`.

## Arquivos
- **Novo:** `database/migration_13.sql`
- **Tipos:** `lib/types/db.ts`

## Critérios de aceite
- [ ] Idempotente.
- [ ] Não permite o mesmo credor duas vezes na mesma NE (unique).
- [ ] Backfill (se rodado) não duplica e não altera `notas_empenho`.
- [ ] Versão `13` registrada.

## Riscos e observações
Sem FK: integridade (credor existente, NE existente) fica na camada de serviço (T15) — teste obrigatório.

## Decisões em aberto relacionadas
D7.
