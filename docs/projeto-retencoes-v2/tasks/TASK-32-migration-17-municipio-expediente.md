# TASK-32 — Migration 17: garantir `credores.municipioExpediente` e conferir as colunas nulas da NE
<!-- milestone: M11 - Ajustes do supervisor (rodada 2) | labels: banco,migration,P0 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 11 Rodada 2 | P0 | ~1 h | – | R16, R17, R19 |

## Objetivo
Criar o script de banco da rodada 2 (`database/migration_17.sql`) para que **todos os ambientes** (produção, homologação, desenvolvimento, instalação nova) tenham a coluna do **Município (Expediente)** no cadastro de credores, e **conferir** (sem alterar) que as colunas da NE que deixam de ser preenchidas aceitam `NULL`.

> **Numeração real do repositório:** `migration_11` (T02) · `12` (T03) · `13` (T09) · `14` (T14) · `15` (T19) · `16` (T24). Esta é a **17**. (O plano original previa 10 a 15; a sequência real andou um número à frente porque o `migration_10.sql` foi usado pelo `ultimo_acesso` de `usuarios`.)

## Contexto (confirmado no Workbench em 13/10/2026)
- **`credores.municipioExpediente` já existe** (camelCase, `VARCHAR(100) NULL`), criada **fora de migration**, **vazia** (4 credores, 0 preenchidos) e **sem uso no código**. **Decisão D41:** manter esse nome (exceção à convenção `snake_case` do banco). **Nunca** criar uma coluna `municipio_expediente`.
- `notas_empenho`: `data_pagamento`, `data_emissao`, `data_provisao_concedida`, `credor_nome` e `cpf_cnpj` **já aceitam `NULL`**; `elemento` é `VARCHAR(100)` e `subelemento` é `VARCHAR(250)`. Por isso **não há `MODIFY`** nesta migration (D47).
- Os outros sistemas **não leem** as colunas da NE que deixam de ser preenchidas (confirmação do usuário em 13/10/2026). A regra de nunca `DROP` continua valendo.
- Regras do banco: script manual no Workbench com conta privilegiada (o usuário `admin` do app **não** tem `ALTER`); começa com `USE empenho; SET SQL_SAFE_UPDATES = 0;`; registra a versão em `schema_migrations`.
- Padrão de ADD COLUMN condicional: o mesmo da `migration_13.sql` (sem `AFTER`, coluna no final, compatível com `ALGORITHM=INSTANT`).

## Escopo
### Entra
1. `credores.municipioExpediente VARCHAR(100) NULL`, **só se não existir** (em produção ela já existe: o bloco não faz nada).
2. **Nenhum `MODIFY`.** Apenas uma consulta que **reporta** `IS_NULLABLE` das cinco colunas da NE. Se alguma aparecer `NO` num ambiente, parar e tratar à parte (com `SHOW CREATE TABLE`, preservando charset/collation/comentário), fora desta migration.
3. Registro `INSERT IGNORE INTO schema_migrations (version) VALUES ('17');`.
4. Rollback documentado **sem `DROP COLUMN`**.

### Não entra
- Criar tabela de municípios (já existe `iss_municipios`, `migration_16`).
- Criar `municipio_expediente` (nome errado; ver D41).
- Apagar `ne_credores`, remover colunas ou mexer em dados.

## Especificação técnica
```sql
USE empenho;
SET SQL_SAFE_UPDATES = 0;
SET @db = DATABASE();

-- 1) Município (Expediente) do credor. Nome em camelCase de propósito (D41):
--    a coluna já existe em produção, criada fora de migration. NÃO criar
--    `municipio_expediente`. No FINAL da tabela (sem AFTER), como a migration_13.
SET @tem = NULL;
SELECT COUNT(*) INTO @tem FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='credores' AND COLUMN_NAME='municipioExpediente';
SET @sql = IF(@tem=0,
  'ALTER TABLE credores ADD COLUMN municipioExpediente VARCHAR(100) NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO schema_migrations (version) VALUES ('17');

-- Verificação (só leitura)
-- a) esperado: 1 linha, VARCHAR(100), IS_NULLABLE = YES
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, CHARACTER_SET_NAME, COLLATION_NAME
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='credores' AND COLUMN_NAME='municipioExpediente';
-- b) esperado: 5 linhas, todas IS_NULLABLE = YES (se alguma vier NO, parar e avisar)
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='notas_empenho'
   AND COLUMN_NAME IN ('data_pagamento','data_emissao','data_provisao_concedida','credor_nome','cpf_cnpj');
-- c) não pode existir a coluna com o nome errado
SELECT COUNT(*) AS municipio_expediente_nao_deve_existir FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='credores' AND COLUMN_NAME='municipio_expediente';

-- ROLLBACK (somente com aprovação explícita):
--   DELETE FROM schema_migrations WHERE version = '17';
-- NÃO fazer DROP COLUMN municipioExpediente: a coluna não foi criada por esta
-- migration (já existia em produção) e pode ter outro dono.
```
- `SET @tem = NULL` antes do `SELECT … INTO`: quando o `SELECT INTO` não devolve linha, a variável **mantém o valor anterior**. Com `COUNT(*)` sempre há linha, mas o padrão fica para blocos futuros.

**Antes de rodar:** `SHOW CREATE TABLE credores;` para conferir tipo e collation reais.

## Arquivos afetados
- **Novo:** `database/migration_17.sql`
- **Alterados:** `lib/types/db.ts` (`CredorDB.municipioExpediente: string | null`), `database/database.sql` (comentário de referência, se o projeto mantém o schema base atualizado)

## Critérios de aceite
- [ ] Rodar duas vezes não dá erro e não duplica nada (idempotente).
- [ ] `credores.municipioExpediente` existe, `VARCHAR(100) NULL`, em todos os ambientes.
- [ ] **Não** existe `credores.municipio_expediente` (consulta c = 0).
- [ ] As cinco colunas da NE aparecem com `IS_NULLABLE = YES` (só conferido, nada alterado).
- [ ] Versão `17` registrada em `schema_migrations`.
- [ ] Nenhuma tabela/coluna removida; nenhum dado alterado.
- [ ] Executada primeiro em **homologação**, com o resultado das consultas de verificação anexado ao PR.

## Riscos e observações
- Em produção o script praticamente só registra a versão (a coluna já existe). Em homologação/desenvolvimento ele cria a coluna; rodar **fora do horário de uso**.
- O deploy do código (T33 em diante) **só depois** da migration no ambiente; senão o `SELECT … municipioExpediente` quebra a tela de credores e o cálculo do .33.
- Ainda não se sabe **quem** criou a coluna em produção. Está vazia e nenhum código a usa; se aparecer outro sistema gravando nela, rever a D41.

## Decisões relacionadas
**Fechadas:** D27 (município de expediente, só no .33), D41 (nome `municipioExpediente`), D47 (sem `MODIFY`; só verificação).

## Implementação (14/10/2026)
- `database/migration_17.sql` escrito e **executado no Workbench em 14/10/2026**: a coluna já existia (o bloco só fez `SELECT 1`), versão `17` registrada; conferência (a) `municipioExpediente varchar(100) YES` (`utf8mb4` / `utf8mb4_0900_ai_ci`), (b) as 5 colunas da NE `YES`, (c) `municipio_expediente` = 0.
- Atenção (T33): a collation da coluna é `utf8mb4_0900_ai_ci`; comparar o município no código (`normalizarMunicipio`), nunca num `JOIN` com `iss_municipios` no SQL.
- `lib/types/db.ts`: `CredorDB.municipioExpediente: string | null`.
- `tests/unit/migration-17.test.ts`: confere estaticamente o script (começa com `USE empenho;`, `ADD COLUMN` só condicional e só de `municipioExpediente`, nada de `MODIFY`/`DROP`/`UPDATE`/`DELETE` fora de comentário, registra a versão `17`).
