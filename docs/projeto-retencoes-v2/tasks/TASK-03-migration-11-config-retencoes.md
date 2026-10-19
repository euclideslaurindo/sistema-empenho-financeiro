# TASK-03 — Migration 11: configuração de retenções e matriz por elemento
<!-- milestone: M1 - Fundação | labels: banco,migration,P0 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 1 Banco | P0 | ~4 h | T02 | R3, R4, R5 |

## Objetivo
Criar as tabelas que guardam **todas as taxas e regras editáveis pelo admin**: `config_retencoes` (um registro por campo de *Retenções e Descontos*) e `elemento_retencoes` (quais impostos se aplicam a cada elemento), já com a configuração inicial.

## Contexto (estado atual)
- Alíquotas fixas no código (IRRF 1,5%, ISS 5%, INSS 11%, SEST/SENAT 2,5%, Patronal 20%).
- "Outros" hoje é zerado pelo servidor para quem não é ADMIN; os campos de imposto estão desabilitados para não-ADMIN na tela.
- `configuracoes_sistema` (linha única `id = 1`) guarda configurações gerais; **não** é o lugar das retenções (mistura assuntos e exigiria `ALTER` em tabela existente).

## Escopo
### Entra
- DDL das duas tabelas + seed (alíquotas atuais e matriz da seção 6 do README).
- Registro em `schema_migrations` e rollback comentado.

### Não entra
Leitura/escrita pela aplicação (T06) nem uso no cálculo (T10).

## Especificação técnica (rascunho do script `database/migration_11.sql`)
```sql
USE empenho;
SET SQL_SAFE_UPDATES = 0;

CREATE TABLE IF NOT EXISTS config_retencoes (
  campo              VARCHAR(30)  NOT NULL PRIMARY KEY, -- irrf, iss, inss, patronal, sest_senat, outros, taxa_bancaria, taxa_pix
  rotulo             VARCHAR(60)  NOT NULL,             -- texto exibido na tela e na impressão
  tipo               VARCHAR(20)  NOT NULL,             -- 'PERCENTUAL' | 'VALOR_DIGITADO'
  aliquota           DECIMAL(7,4) NULL,                 -- 1.5000 = 1,5%; NULL para VALOR_DIGITADO
  calculo_automatico TINYINT(1)   NOT NULL DEFAULT 1,   -- 1 = sistema calcula; 0 = operador digita
  editavel_operador  TINYINT(1)   NOT NULL DEFAULT 0,   -- 1 = GESTOR pode alterar o valor na OP (caso específico)
  entra_darf         TINYINT(1)   NOT NULL DEFAULT 0,   -- 1 = soma na DARF
  desconta_credor    TINYINT(1)   NOT NULL DEFAULT 1,   -- 0 = informativo: aparece na OP, mas NÃO reduz o líquido do credor (ex.: patronal)
  ativo              TINYINT(1)   NOT NULL DEFAULT 1,
  ordem              INT          NOT NULL DEFAULT 0,
  updated_by         CHAR(36)     NULL,
  updated_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS elemento_retencoes (
  elemento_codigo VARCHAR(20) NOT NULL,
  campo           VARCHAR(30) NOT NULL,                 -- só campos tributários
  PRIMARY KEY (elemento_codigo, campo)                  -- presença da linha = "se aplica"
);

INSERT IGNORE INTO config_retencoes
 (campo, rotulo, tipo, aliquota, calculo_automatico, editavel_operador, entra_darf, desconta_credor, ativo, ordem) VALUES
 ('irrf',          'IRRF',                       'PERCENTUAL',     1.5000, 1, 0, 0, 1, 1, 10),   -- IR vai para a Secretaria da Fazenda, não para a DARF
 ('iss',           'ISS',                        'PERCENTUAL',     5.0000, 1, 0, 0, 1, 1, 20),
 ('inss',          'INSS',                       'PERCENTUAL',    11.0000, 1, 0, 1, 1, 1, 30),
 ('patronal',      'Patronal',                   'PERCENTUAL',    20.0000, 1, 0, 1, 0, 1, 40),   -- encargo do órgão: não desconta do credor
 ('sest_senat',    'SEST/SENAT',                 'PERCENTUAL',     2.5000, 1, 0, 1, 1, 1, 50),
 ('outros',        'Outros / IBS-CBS',           'VALOR_DIGITADO', NULL,   0, 0, 0, 1, 1, 60),
 ('taxa_bancaria', 'Taxa bancária (expediente)', 'VALOR_DIGITADO', NULL,   0, 1, 0, 1, 1, 70),
 ('taxa_pix',      'Taxa PIX',                   'VALOR_DIGITADO', NULL,   0, 1, 0, 1, 1, 80);

-- Matriz: presença = se aplica.  3.3.90.14 NÃO recebe linhas (sem imposto).
INSERT IGNORE INTO elemento_retencoes (elemento_codigo, campo) VALUES
 -- .33 .36 .39 : todos os 5
 ('3.3.90.33','irrf'),('3.3.90.33','iss'),('3.3.90.33','inss'),('3.3.90.33','patronal'),('3.3.90.33','sest_senat'),
 ('3.3.90.36','irrf'),('3.3.90.36','iss'),('3.3.90.36','inss'),('3.3.90.36','patronal'),('3.3.90.36','sest_senat'),
 ('3.3.90.39','irrf'),('3.3.90.39','iss'),('3.3.90.39','inss'),('3.3.90.39','patronal'),('3.3.90.39','sest_senat'),
 -- .30 e .47 : sem ISS
 ('3.3.90.30','irrf'),('3.3.90.30','inss'),('3.3.90.30','patronal'),('3.3.90.30','sest_senat'),
 ('3.3.90.47','irrf'),('3.3.90.47','inss'),('3.3.90.47','patronal'),('3.3.90.47','sest_senat'),
 -- legados: comportamento atual (todos os 5)
 ('3.3.90.32','irrf'),('3.3.90.32','iss'),('3.3.90.32','inss'),('3.3.90.32','patronal'),('3.3.90.32','sest_senat'),
 ('3.3.90.35','irrf'),('3.3.90.35','iss'),('3.3.90.35','inss'),('3.3.90.35','patronal'),('3.3.90.35','sest_senat'),
 ('3.3.90.40','irrf'),('3.3.90.40','iss'),('3.3.90.40','inss'),('3.3.90.40','patronal'),('3.3.90.40','sest_senat'),
 ('4.4.90.51','irrf'),('4.4.90.51','iss'),('4.4.90.51','inss'),('4.4.90.51','patronal'),('4.4.90.51','sest_senat'),
 ('4.4.90.52','irrf'),('4.4.90.52','iss'),('4.4.90.52','inss'),('4.4.90.52','patronal'),('4.4.90.52','sest_senat');

INSERT IGNORE INTO schema_migrations (version) VALUES ('11');
-- ROLLBACK (somente com aprovação explícita): DROP TABLE elemento_retencoes; DROP TABLE config_retencoes;
```

Regras de modelagem:
- `desconta_credor = 0` marca um campo **informativo**: é calculado, aparece na OP e na impressão, pode entrar na DARF (`entra_darf`), mas **não entra** em `total_descontos` nem reduz o `valor_liquido`. Hoje só a **patronal** é assim (decisão do usuário, vale para todos os elementos).
- `tipo` + `calculo_automatico` cobrem o caso do ISS digitado (D1): basta o admin desmarcar "cálculo automático".
- Subelementos **herdam** a regra do elemento-pai (o código do elemento é o prefixo).
- `taxa_bancaria` e `taxa_pix` já nascem `editavel_operador = 1`, pois são digitadas na hora.
- Os campos de imposto aceitos em `elemento_retencoes.campo` são **somente** `irrf, iss, inss, patronal, sest_senat` (validado na API, T06).

## Arquivos
- **Novo:** `database/migration_11.sql`

## Critérios de aceite
- [ ] Script idempotente (duas execuções sem erro e sem duplicar).
- [ ] 8 linhas em `config_retencoes`; matriz com 5 impostos nos elementos `.33/.36/.39` e 4 em `.30/.47`; `3.3.90.14` sem linhas.
- [ ] Alíquotas iguais às hoje em produção (conferir antes de rodar).
- [ ] Patronal com `desconta_credor = 0` e `entra_darf = 1`; demais campos com `desconta_credor = 1`.
- [ ] Versão `11` em `schema_migrations`.
- [ ] Nenhuma tabela existente alterada.

## Riscos e observações
- **O seed define comportamento financeiro.** O usuário deve revisar a matriz e as alíquotas antes de produção (D1, D3, D8).
- **IRRF fora da DARF:** confirmado pela planilha EJA Campo (o IR vai para a Secretaria da Fazenda). **Patronal na DARF:** `entra_darf = 1` conforme a anotação do usuário; falta confirmar com quem monta a guia (o admin pode desligar sem mexer em código).
- Os percentuais desta tabela são os **padrões do sistema**, usados pelos elementos `.36`, `.39`, `.30` e `.47` (e legados). O 3.3.90.33 usa os parâmetros próprios da T24/T25.
- Hoje o sistema **desconta** a patronal do líquido; com `desconta_credor = 0` o líquido das OPs novas **sobe**. Avisar o supervisor antes de ir para produção.

## Decisões em aberto relacionadas
D1, D2, D3, D8. **Fechadas:** D4 (IRRF fora da DARF), D15 (patronal informativa).
