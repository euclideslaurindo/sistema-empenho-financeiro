# TASK-02 — Migration 10: elementos e subelementos
<!-- milestone: M1 - Fundação | labels: banco,migration,P0 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 1 Banco | P0 | ~3 h | – | R3, R10 |

## Objetivo
Criar as tabelas `elementos_despesa` e `subelementos_despesa` com os dados da lista nova, e garantir que as colunas `elemento`/`subelemento` das tabelas existentes comportem o texto novo.

## Contexto (estado atual)
- Lista de elementos e subelementos em `lib/constants.ts` (10 elementos, 27 subelementos soltos).
- Valor gravado nas NEs/OPs: `"3.3.90.39 - Outros Serviços de Terceiros - Pessoa Jurídica"` (texto completo) em `elemento`; texto livre em `subelemento`.
- `migration_09.sql` já alargou `elemento` para `VARCHAR(100)` em `notas_empenho` e `ordens_pagamento`.
- `contexto_sessao_atual.md` cita `subelemento VARCHAR(10)` em `ordens_pagamento`; o script de setup cria `subelemento VARCHAR(200)` em `notas_empenho`. **O tamanho real em produção precisa ser conferido.**

## Escopo
### Entra
1. DDL das duas tabelas novas.
2. Seed dos elementos e subelementos.
3. Conferência (`SHOW COLUMNS`) e `MODIFY COLUMN` não destrutivo de `subelemento`.
4. Registro em `schema_migrations` e rollback comentado.

### Não entra
Alterar/remover dados já gravados em NEs e OPs; remover `lib/constants.ts` (T05).

## Especificação técnica (rascunho do script `database/migration_10.sql`)
```sql
USE empenho;
SET SQL_SAFE_UPDATES = 0;

-- 0) CONFERIR ANTES: rode e anote o resultado
-- SHOW COLUMNS FROM ordens_pagamento LIKE 'subelemento';
-- SHOW COLUMNS FROM notas_empenho    LIKE 'subelemento';

CREATE TABLE IF NOT EXISTS elementos_despesa (
  codigo      VARCHAR(20)  NOT NULL PRIMARY KEY,          -- '3.3.90.36'
  descricao   VARCHAR(200) NOT NULL,                      -- 'Outros Serviços de Terceiros - Pessoa Física'
  legado      TINYINT(1)   NOT NULL DEFAULT 0,            -- 1 = veio da lista antiga
  ativo       TINYINT(1)   NOT NULL DEFAULT 1,
  ordem       INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subelementos_despesa (
  codigo          VARCHAR(30)  NOT NULL PRIMARY KEY,      -- '3.3.90.14.01'
  elemento_codigo VARCHAR(20)  NOT NULL,                  -- '3.3.90.14'
  descricao       VARCHAR(250) NOT NULL,
  ativo           TINYINT(1)   NOT NULL DEFAULT 1,
  ordem           INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sub_elemento (elemento_codigo)
);

INSERT IGNORE INTO elementos_despesa (codigo, descricao, legado, ordem) VALUES
 ('3.3.90.14','Diárias - Civil',0,10),
 ('3.3.90.30','Material de Consumo',0,20),
 ('3.3.90.33','Passagens e Despesas com Locomoção',0,30),
 ('3.3.90.36','Outros Serviços de Terceiros - Pessoa Física',0,40),
 ('3.3.90.39','Outros Serviços de Terceiros - Pessoa Jurídica',0,50),
 ('3.3.90.47','Obrigações Tributárias e Contributivas',0,60),
 ('3.3.90.32','Material de Distribuição Gratuita',1,70),
 ('3.3.90.35','Serviços de Consultoria',1,80),
 ('3.3.90.40','Serviços de Tecnologia da Informação (TIC)',1,90),
 ('4.4.90.51','Obras e Instalações',1,100),
 ('4.4.90.52','Equipamentos e Material Permanente',1,110);

INSERT IGNORE INTO subelementos_despesa (codigo, elemento_codigo, descricao, ordem) VALUES
 ('3.3.90.14.01','3.3.90.14','Diárias Pessoal Civil Dentro do Estado',1),
 ('3.3.90.14.03','3.3.90.14','Bolsas de Capacitação - Secretaria de Educação Lei nº 11.461/97',2);

-- 3) Só alargar se a conferência mostrar tamanho menor que 250
ALTER TABLE ordens_pagamento MODIFY COLUMN subelemento VARCHAR(250);
ALTER TABLE notas_empenho    MODIFY COLUMN subelemento VARCHAR(250);

INSERT IGNORE INTO schema_migrations (version) VALUES ('10');

-- ROLLBACK (somente com aprovação explícita):
--   DROP TABLE subelementos_despesa; DROP TABLE elementos_despesa;
--   (as colunas alargadas podem permanecer)
```

Notas:
- A **descrição** dos elementos antigos usa a mesma grafia de `lib/constants.ts`, para que o texto `"codigo - descricao"` bata com o que já está gravado nas NEs.
- Descrições dos novos itens vêm do documento oficial das anotações (o usuário abreviou 14.03 como "Bolsas de Capacitação"; mantive o texto oficial completo).
- Os 27 subelementos soltos antigos **não são migrados** como tabela (não têm elemento). Ficam só nos registros já gravados (D9).

## Arquivos
- **Novo:** `database/migration_10.sql`
- **Atualizar:** `database/database.sql` (comentário apontando a migration) e `docs` da T23

## Critérios de aceite
- [ ] Script roda **duas vezes** sem erro (idempotente).
- [ ] `SELECT COUNT(*) FROM elementos_despesa` = 11 e `subelementos_despesa` = 2.
- [ ] `SHOW COLUMNS … subelemento` mostra tamanho ≥ 250 nas duas tabelas.
- [ ] `schema_migrations` tem a versão `10`.
- [ ] Nenhuma coluna ou tabela existente foi removida.
- [ ] Testado primeiro em homologação; resultado da conferência anexado ao PR.

## Riscos e observações
- Se o `subelemento` de `ordens_pagamento` for mesmo `VARCHAR(10)`, o sistema atual já daria "Data too long" ao gravar descrições longas; confirmar se há OPs afetadas antes do `MODIFY`.
- Usuário `admin` do app não tem `ALTER`/`REFERENCES`: executar com conta privilegiada. **Sem FKs** nas tabelas novas, como na `migration_06`.

## Decisões em aberto relacionadas
D3 (elementos legados), D9 (subelementos dos demais elementos).
