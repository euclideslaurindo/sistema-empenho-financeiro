# TASK-24 — Migration 15: parâmetros do cálculo de transporte, tabela do IRRF e ISS por município
<!-- milestone: M10 - Cálculo do transporte (3.3.90.33) | labels: banco,migration,transporte,P0 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 10 Transporte (.33) | P0 | ~4 h | T02 | R11, R12, R13 |

## Objetivo
Criar as tabelas que guardam, **editáveis só pelo ADMIN**, tudo o que a planilha EJA Campo usa para o 3.3.90.33: os percentuais, a **tabela do IRRF** (com data de vigência) e o **ISS por município** com a **taxa de expediente da prefeitura**.

## Contexto (o que a planilha faz — 92 motoristas, NE 28925)
- Base INSS = 20% do bruto; INSS 11%, Patronal 20%, SEST 1,5% e SENAT 1% incidem sobre essa base.
- IRRF: base = 60% do bruto − desconto simplificado (o maior entre R$ 607,20 e o INSS de 11%); tabela progressiva; depois desconta o "desc. adicional" = máx(0; 978,62 − 0,133145 × bruto).
- ISS = 5% do bruto **+ taxa de expediente da prefeitura** (valor fixo em cinco municípios).
- Os números do IRRF **mudam por lei** (a tabela e o desc. adicional de 2026 são diferentes dos de 2025). Por isso ficam no banco, com **vigência**.

## Escopo
### Entra
- Três tabelas novas e os seeds de 2026 retirados da planilha.
- Registro em `schema_migrations` e rollback comentado.

### Não entra
Uso no cálculo (T25) e tela do admin (T27).

## Especificação técnica (rascunho do script `database/migration_15.sql`)
```sql
USE empenho;
SET SQL_SAFE_UPDATES = 0;

CREATE TABLE IF NOT EXISTS calculo_parametros (
  perfil      VARCHAR(30)   NOT NULL,                  -- 'TRANSPORTE_AUTONOMO'
  chave       VARCHAR(40)   NOT NULL,
  valor       DECIMAL(18,6) NOT NULL,
  vigente_de  DATE          NOT NULL,                  -- vale a partir desta data (inclusive)
  updated_by  CHAR(36)      NULL,
  updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (perfil, chave, vigente_de)
);

CREATE TABLE IF NOT EXISTS irrf_faixas (
  vigente_de       DATE          NOT NULL,
  ordem            INT           NOT NULL,
  limite_ate       DECIMAL(15,2) NULL,                 -- NULL = sem limite (última faixa)
  aliquota         DECIMAL(7,4)  NOT NULL,             -- 7.5000 = 7,5%
  parcela_deduzir  DECIMAL(15,2) NOT NULL,
  updated_by       CHAR(36)      NULL,
  updated_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (vigente_de, ordem)
);

CREATE TABLE IF NOT EXISTS iss_municipios (
  chave            VARCHAR(80)   NOT NULL PRIMARY KEY, -- nome normalizado: minúsculas, sem acento, ex.: 'aguas belas'
  nome             VARCHAR(100)  NOT NULL,
  uf               CHAR(2)       NOT NULL DEFAULT 'PE',
  aliquota         DECIMAL(7,4)  NOT NULL DEFAULT 5.0000,
  taxa_expediente  DECIMAL(10,2) NOT NULL DEFAULT 0,   -- taxa de expediente DA PREFEITURA (não é a taxa bancária)
  apelidos         VARCHAR(200)  NULL,                 -- ex.: 'sbu;sao bento'
  ativo            TINYINT(1)    NOT NULL DEFAULT 1,
  updated_by       CHAR(36)      NULL,
  updated_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Parâmetros do perfil TRANSPORTE_AUTONOMO (vigência 2026), retirados da planilha EJA Campo
INSERT IGNORE INTO calculo_parametros (perfil, chave, valor, vigente_de) VALUES
 ('TRANSPORTE_AUTONOMO','base_percentual',          20,       '2026-01-01'),
 ('TRANSPORTE_AUTONOMO','inss_percentual',          11,       '2026-01-01'),
 ('TRANSPORTE_AUTONOMO','patronal_percentual',      20,       '2026-01-01'),
 ('TRANSPORTE_AUTONOMO','sest_percentual',          1.5,      '2026-01-01'),
 ('TRANSPORTE_AUTONOMO','senat_percentual',         1,        '2026-01-01'),
 ('TRANSPORTE_AUTONOMO','irrf_tributavel_percentual',60,      '2026-01-01'),
 ('TRANSPORTE_AUTONOMO','desconto_simplificado',    607.20,   '2026-01-01'),
 ('TRANSPORTE_AUTONOMO','redutor_constante',        978.62,   '2026-01-01'),
 ('TRANSPORTE_AUTONOMO','redutor_coeficiente',      0.133145, '2026-01-01');

INSERT IGNORE INTO irrf_faixas (vigente_de, ordem, limite_ate, aliquota, parcela_deduzir) VALUES
 ('2026-01-01',1, 2428.80,  0.0000,   0.00),
 ('2026-01-01',2, 2826.65,  7.5000, 182.16),
 ('2026-01-01',3, 3751.05, 15.0000, 394.16),
 ('2026-01-01',4, 4664.68, 22.5000, 675.49),
 ('2026-01-01',5, NULL,    27.5000, 908.73);

INSERT IGNORE INTO iss_municipios (chave, nome, uf, aliquota, taxa_expediente, apelidos) VALUES
 ('aguas belas',   'Águas Belas',      'PE', 5, 0.00,  NULL),
 ('bom conselho',  'Bom Conselho',     'PE', 5, 0.00,  NULL),
 ('caetes',        'Caetés',           'PE', 5, 0.00,  NULL),
 ('canhotinho',    'Canhotinho',       'PE', 5, 15.20, NULL),
 ('capoeiras',     'Capoeiras',        'PE', 5, 3.94,  NULL),
 ('garanhuns',     'Garanhuns',        'PE', 5, 0.00,  NULL),
 ('iati',          'Iati',             'PE', 5, 6.90,  NULL),
 ('lajedo',        'Lajedo',           'PE', 5, 0.00,  NULL),
 ('sao bento do una','São Bento do Una','PE',5, 0.00,  'sbu;sao bento'),
 ('correntes',     'Correntes',        'PE', 5, 0.00,  NULL),
 ('brejao',        'Brejão',           'PE', 5, 0.00,  NULL),
 ('jucati',        'Jucati',           'PE', 5, 3.00,  NULL),
 ('jupi',          'Jupi',             'PE', 5, 6.76,  NULL);

INSERT IGNORE INTO schema_migrations (version) VALUES ('15');
-- ROLLBACK (somente com aprovação explícita): DROP TABLE iss_municipios; DROP TABLE irrf_faixas; DROP TABLE calculo_parametros;
```

Regras de modelagem:
- **Vigência:** o cálculo usa, para cada `chave`, a linha com a **maior `vigente_de` ≤ data de referência** da OP (`data_pagamento` > `data_emissao` > hoje). Assim a tabela de 2027 pode ser cadastrada antes de valer, e OPs antigas continuam com a tabela da época.
- A **taxa de expediente da prefeitura é diferente da taxa bancária** (decisão do usuário): ela é parte do ISS do município; a taxa bancária é digitada na OP.
- Os valores acima vêm da planilha **como estão**; a validade legal da tabela do IRRF e do redutor deve ser confirmada com a contabilidade antes de produção (ver D22).

## Arquivos
- **Novo:** `database/migration_15.sql`
- **Tipos:** `lib/types/db.ts`

## Critérios de aceite
- [ ] Idempotente (duas execuções sem erro e sem duplicar).
- [ ] 9 linhas em `calculo_parametros`, 5 em `irrf_faixas`, 13 em `iss_municipios`.
- [ ] Taxas de expediente: Canhotinho 15,20 · Capoeiras 3,94 · Iati 6,90 · Jupi 6,76 · Jucati 3,00; demais 0,00.
- [ ] Versão `15` registrada.
- [ ] Nenhuma tabela existente alterada.

## Riscos e observações
Revisão obrigatória dos seeds pelo usuário/supervisor antes de produção: são valores que viram dinheiro.

## Decisões em aberto relacionadas
D22 (base do desc. adicional), D23 (taxa de expediente em outros elementos). **Fechadas:** D14, D18, D19.
