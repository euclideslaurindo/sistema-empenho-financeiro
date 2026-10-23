# Projeto Retenções v2 — requisitos e decisões

Projeto que levou o cálculo das retenções da Ordem de Pagamento para regras configuráveis por elemento de despesa, com tela do administrador, cálculo próprio do transporte autônomo (3.3.90.33), isenção de MEI, acompanhamento da DARF e emissão de OPs em lote. Foi entregue em duas rodadas (T01–T28 e T29–T37).

Os detalhes técnicos estão em [`ARQUITETURA.md`](./ARQUITETURA.md). As referências **Tnn** são as etapas do projeto (seção 9) e **Dnn**, as decisões (seções 4 e 5).

---

## 1. Objetivo

Hoje o formulário da Ordem de Pagamento (OP) marca **todos** os impostos para **qualquer** elemento de despesa, com alíquotas fixas no código (IRRF 1,5%, ISS 5%, INSS 11%, SEST/SENAT 2,5%, Patronal 20%), e o cálculo usa ponto flutuante, o que erra centavos em alguns casos. A NE aceita um único credor, não há controle da DARF e a tela não mostra qual será o número da OP.

O projeto muda isso para:

- as **regras de retenção dependerem do elemento** escolhido;
- as **taxas serem definidas pelo administrador** em uma tela e valerem para todos os usuários;
- o **arredondamento** seguir a regra oficial (3º decimal ≥ 5 arredonda para cima);
- a NE aceitar **vários credores**, com valor bruto por credor fechando com o valor da NE;
- existir uma **tela de status da DARF**.

## 2. Origem dos requisitos

Anotações da equipe financeira (tabela de elementos com marcações, ideias para o sistema e regras de arredondamento) e rodadas de esclarecimento com quem usa o sistema. O que importa foi transcrito aqui.

## 3. Requisitos (rastreabilidade)

| ID | Requisito | Tasks |
|----|-----------|-------|
| R1 | Arredondamento: se o 3º decimal for 5 ou mais, o valor sobe (ex.: 9,975 → 9,98) | T01, T10 |
| R2 | Campos **Taxa bancária (expediente)** e **Taxa PIX** em *Retenções e Descontos*, digitados na hora | T09, T10, T11, T12 |
| R3 | Retenções dependem do elemento (.14 é sem imposto; .30/.36/.39/.47 usam os percentuais padrão do sistema) | T02, T03, T04, T05, T10, T11 |
| R4 | Tela do **ADMIN** para editar **todos** os campos de retenções e descontos; vale para todos os usuários | T03, T06, T07 |
| R5 | Em caso específico, o admin pode **habilitar alteração manual** | T03, T06, T07, T10, T11 |
| R6 | Tela de status separada com **todos os credores que tiverem DARF** | T19, T20, T21 |
| R7 | Vários credores em uma NE; usuário informa o **bruto** de cada um; soma dos brutos = valor da NE | T14, T15, T16, T17 |
| R8 | Salvar o **município** no credor | T18 |
| R9 | Na OP, mostrar qual número será (NE …/01 ou /02 e nº da OP) | T13 |
| R10 | Novos elementos e subelementos, em cascata | T02, T04, T05, T08 |
| R11 | **Cálculo do transporte autônomo (3.3.90.33)** igual ao da planilha EJA Campo (base de 20%, INSS 11%, SEST/SENAT, IRRF por tabela) | T24, T25, T28 |
| R12 | **Tabela do IRRF e demais parâmetros editáveis só pelo ADMIN**, com data de vigência | T24, T27 |
| R13 | **ISS por município**, com a **taxa de expediente da prefeitura** | T18, T24, T25, T27 |
| R14 | **Credor MEI não sofre nenhuma retenção** (IRRF, ISS, INSS, SEST/SENAT e patronal) | T10, T26 |
| R15 | **Patronal é informativa**: aparece na OP e na impressão, mas não desconta do credor | T03, T09, T10, T12 |
| R16 | **NE:** título "Cadastro de Nota de Empenho"; sem Data de Emissão e Data de Pagamento; "Especificação" vira "Observações"; **Subelemento sempre visível** (texto livre quando não há lista) | T29 |
| R17 | **NE sem credor:** os credores deixam a NE e são escolhidos na Ordem de Pagamento | T30, T34, T35 |
| R18 | **NE parcial:** pode ser salva e usada sem consumir o valor todo; mostra **total, gasto e restante** | T30, T31 |
| R19 | **Município (Expediente)** no cadastro de credores, opcional; é ele que define a taxa de expediente (só no 3.3.90.33) | T32, T33 |
| R20 | **OP em lote:** vários credores na emissão, **uma OP por credor**, com nº da OP, valor a pagar, **nº do cheque e data do pagamento por credor** | T34, T35 |
| R21 | **Especificação de pagamento por credor** (itens), minimizada na tela | T34, T35 |
| R22 | Ajustes de consulta, impressão e DARF para as mudanças acima | T36 |

> **Substituições (rodada 2):** **R7** ("vários credores em uma NE; soma dos brutos = valor da NE") foi **substituído** por R17, R18 e R20. A tabela `ne_credores` fica no banco, sem uso.

### Fora do escopo (ADIADO por decisão do usuário)

- lembrete de DAE não gerado e controle das guias de ISS por prefeitura;
- salvar empenhos automaticamente;
- importar planilha de cálculo base para gerar empenhos (a planilha EJA Campo é o modelo; a T14 e o fixture da T28 já deixam a base pronta).

## 4. Decisões fechadas

1. `3.3.90.14` (subelementos `.01` e `.03`) é **sem nenhum imposto**.
2. **Só o 3.3.90.33** usa o cálculo da planilha EJA Campo (perfil `TRANSPORTE_AUTONOMO`). Os elementos `.36`, `.39`, `.30` e `.47` usam os **percentuais padrão** da tela do admin (D14, D20).
3. **MEI zera tudo**, em qualquer elemento (D16).
4. **A patronal não desconta do credor**, aparece na impressão e fica fora do líquido (D15).
5. Arredondamento: o combinado (3º decimal, 5 ou mais sobe), **sem** os dois passos da planilha (D17).
6. A **taxa de expediente da prefeitura** (dentro do ISS do .33) é diferente da **taxa bancária** (D18).
7. O **IRRF e seus parâmetros** (tabela, desconto simplificado, redutor) são editáveis **só pelo ADMIN**, com vigência por data (D19).
8. O **IRRF não entra na DARF** (na planilha o IR vai para a Secretaria da Fazenda) (D4).
9. Taxa bancária e taxa PIX são **valores digitados na hora**, sem valor fixo.
10. ~~A soma dos brutos tem que fechar exatamente com o valor da NE.~~ **Substituída em 13/10:** a soma das OPs deve ser **menor ou igual** ao valor da NE; o que sobra fica como saldo.
11. Ainda **não há credores cadastrados**: backfills (T14, T19) são dispensáveis.
12. **Subelemento** sempre visível na NE; sem lista cadastrada, é **texto livre** opcional (D26).
13. **Município (Expediente)** é opcional e vale **só no 3.3.90.33** por enquanto; é ele que determina sozinho a taxa de expediente (D27, D38).
14. **"Valor a pagar" é o bruto**; a **especificação de pagamento** é a tabela de itens por credor, e a soma dos itens é igual ao valor a pagar (D28).
15. **Cada credor tem OP própria**, com seu nº da OP, cheque e data de pagamento (D29).
16. A NE pode ser salva **sem credor** e **sem consumir o valor todo**; a tela mostra total, gasto e restante (D30).
17. O rótulo é **"Observações"** (plural) (D31).
18. A coluna do Município (Expediente) é **`credores.municipioExpediente`** (camelCase, já existente); **nunca** criar `municipio_expediente` (D41).
19. `exercicio` de NE nova = ano do **número da NE** (`2026NE…`); senão ano da Data de Provisão; senão ano corrente; nunca recalculado na edição (D42).
20. Prévia das retenções: **servidor só no 3.3.90.33**, navegador nos demais — também na emissão em lote (D43).
21. **T30, T31, T34 (lote) e T35 (lista) saem no mesmo release**; T32 e T33 podem sair antes (D44).
22. Credor do .33 **sem** Município (Expediente): taxa 0 e **sem aviso**; o alerta de "60 dias" da Data de Pagamento da NE sai (D45).
23. Reduzir o valor da NE abaixo do gasto continua **HTTP 409** (D46).
24. A `migration_17` **não faz `MODIFY`**; os outros sistemas **não leem** as colunas de data/credor da NE (D47).
25. A **edição de OP não está na tela** desde 09/2026 (commit `581c3ba`) e **não foi recriada** na T35-B; toda OP nova sai pela emissão em lote, inclusive com um credor só. A rota `PUT /api/ordens-pagamento/[id]` continua, com testes. Se a edição voltar a ser pedida, vira task própria (D48, 19/10/2026).
26. **Sem ambiente de homologação separado:** a homologação é um roteiro de teste com dados de teste identificáveis e limpeza pela aplicação, até existir um banco de teste (D49, 19/10/2026).

Detalhes de D41 a D47 na seção 5.

## 5. Decisões tomadas por suposição (coluna "Suposição adotada")

| ID | Pergunta | Suposição adotada | Afeta |
|----|----------|-------------------|-------|
| D2 | O que é "habilitar alteração em caso específico"? | Flag **por campo** `editavel_operador` na tela do admin. O ADMIN continua podendo editar direto na OP. | T06, T07, T10, T11 |
| D3 | Elementos antigos (3.3.90.32, .35, .40, 4.4.90.51, .52): continuam? | Continuam ativos, "legado", com os percentuais padrão. | T02, T03 |
| D5 | Estados do status da DARF | `PENDENTE` e `PAGA` (coluna VARCHAR, extensível). | T19–T21 |
| D6 | Mês de competência da DARF | `data_pagamento` da OP, com fallback para `data_emissao`. | T19, T20 |
| ~~D7~~ | ~~NE com vários credores: o que vai nas colunas legadas?~~ | **OBSOLETA (rodada 2, D36):** a NE não tem mais credor; `ne_credores` fica sem uso e as colunas legadas ficam `NULL` nas NEs novas. | ~~T15~~ |
| D9 | Subelementos dos demais elementos | Sem lista oficial: campo opcional quando não houver subelementos cadastrados. | T05, T08 |
| D10 | Município do credor é obrigatório? | Não, mas sem município no 3.3.90.33 o ISS usa o padrão e **avisa**. | T18 |
| D11 | Taxas bancária e PIX saem do líquido do credor? | Sim, entram em "Total de Descontos". | T10, T12 |
| D12 | Ao **editar** uma OP antiga com a config nova | Recalcula só se valor, elemento ou credor mudarem. | T10 |
| D13 | OP com DARF já paga pode ser editada/excluída? | Não (HTTP 409). | T20 |
| D21 | **Patronal entra na DARF?** | Sim (anotação do usuário); detalhada à parte do "retido". Confirmar com quem monta a guia; o admin desliga sem mexer em código. | T03, T20, T21 |
| D22 | O **desc. adicional do IRRF usa o bruto** (e não os 60% tributáveis) e a tabela/redutor de 2026 estão corretos? | Replica a planilha exatamente. **Confirmar com a contabilidade.** | T24, T25 |
| D23 | A **taxa de expediente da prefeitura** vale também para o ISS de .36 e .39? | Não: só no 3.3.90.33 (como na planilha). Parâmetro por perfil. | T24, T25 |
| D24 | Credor **MEI** ainda paga taxa bancária/PIX digitada? | Sim, só as retenções zeram. | T10, T26 |
| D25 | Data que define a **vigência** das tabelas | `data_pagamento` > `data_emissao` > hoje. | T24, T25 |

Fechadas na rodada 1 (07/10): D1 (ISS), D4, D8 (.47 usa os padrões), D14 a D20.
Fechadas na rodada 2 (13/10): D26 a D31 e D38 (ver seção 4); D41 a D47 (tabela abaixo das em aberto). Obsoleta: D7.

**Rodada 2 (as etapas T29 a T37 seguem a suposição):**

| ID | Pergunta | Suposição adotada | Afeta |
|----|----------|-------------------|-------|
| D32 | A coluna "Data" da lista de NEs (hoje a data de pagamento) vira o quê? | **Data de cadastro** (`created_at`), com o rótulo "Cadastro". | T29 |
| D33 | Como avisar NE duplicada sem credor? | **Valor + elemento + subelemento**; continua só **aviso**. | T30 |
| D34 | "Data Emissão OP" continua na OP? | Sim, **no topo**, uma só por emissão (o supervisor não a citou). | T35 |
| D35 | A emissão em lote é "tudo ou nada"? E credor repetido? | **Tudo ou nada** (rollback total); **credor repetido** na mesma emissão é recusado. | T34, T35 |
| D36 | O que acontece com `ne_credores`? | Fica no banco, **sem uso**: não é lida nem validada. NEs antigas não restringem mais. | T30, T34 |
| D37 | Editar uma OP existente | Continua **individual** (um credor, travado). | T35 |
| D39 | A via impressa da NE muda o nome "ESPECIFICAÇÃO OU HISTÓRICO"? | **Não** (layout oficial). | T36 |
| D40 | Atalho "Aplicar data a todos" | Incluído como opcional; o supervisor confirma. | T35 |

**Fechadas em 13/10/2026, após a revisão das tasks contra o código e o banco:**

| ID | Decisão | Afeta |
|----|---------|-------|
| D41 | A coluna do Município (Expediente) **já existe** no banco como **`credores.municipioExpediente`** (camelCase, `VARCHAR(100) NULL`), criada fora de migration, vazia e sem uso no código. **Manter esse nome** (exceção à convenção `snake_case`); **nunca** criar `municipio_expediente`. A `migration_17` só a cria onde faltar. | T23, T25, T32, T33, T34 |
| D42 | `exercicio` de NE nova = **4 primeiros caracteres do número da NE**, se forem um ano entre 2000 e 2099 (ex.: `2026NE000123` → 2026); senão, ano da Data de Provisão; senão, ano corrente. **Nunca** recalculado no `atualizar`. (O usuário confirmou que os números de NE começam pelo ano.) | T29 |
| D43 | Prévia das retenções como já está implementado: **servidor só no 3.3.90.33** (`/previa`), **navegador nos demais**. Na emissão em lote todas as linhas têm o elemento da NE: NE do .33 → `POST /api/ordens-pagamento/previa-lote` (aceita qualquer subconjunto de linhas; o cliente manda só as que mudaram); outros elementos → cálculo local por linha. | T10, T11, T34, T35 |
| D44 | **T30, T31, T34 (lote) e T35 (lista) saem no mesmo release.** T32 e T33 podem sair antes (a T33 só depois da `migration_17` no ambiente). | T30, T31, T34, T35, T37 |
| D45 | Credor do .33 **sem** Município (Expediente): taxa 0 e **sem aviso** (o campo é "se for o caso"); só avisa se estiver preenchido e não existir em `iss_municipios`. O alerta de "data passada de 60 dias" da NE (ligado à Data de Pagamento) **sai** junto com o campo. | T29, T33 |
| D46 | Reduzir o valor da NE abaixo do já gasto continua **HTTP 409** (contrato e teste atuais). | T31 |
| D47 | A `migration_17` **não faz `MODIFY`**: só **reporta** as colunas da NE (já são `NULL`, confirmado no Workbench) e cria `credores.municipioExpediente` se não existir. O usuário confirmou que os **outros sistemas não leem** `data_pagamento`, `data_emissao`, `credor_nome` e `cpf_cnpj` da NE. Nunca `DROP`. Todo script começa com `USE empenho;`. | T29, T30, T32 |

## 6. Matriz de retenções (seed inicial, editável pelo admin)

| Elemento | Perfil de cálculo | IRRF | ISS | INSS | Patronal* | SEST/SENAT | Observação |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3.3.90.14 (e .14.01, .14.03) | – | – | – | – | – | – | **Sem imposto** |
| 3.3.90.30 | SIMPLES | ✔ | – | ✔ | ✔ | ✔ | |
| **3.3.90.33** | **TRANSPORTE_AUTONOMO** | ✔ | ✔ | ✔ | ✔ | ✔ | planilha EJA Campo; ISS por município + taxa de expediente |
| 3.3.90.36 | SIMPLES | ✔ | ✔ | ✔ | ✔ | ✔ | |
| 3.3.90.39 | SIMPLES | ✔ | ✔ | ✔ | ✔ | ✔ | |
| 3.3.90.47 | SIMPLES | ✔ | – | ✔ | ✔ | ✔ | |
| Legados (32, 35, 40, 4.4.90.51/.52) | SIMPLES | ✔ | ✔ | ✔ | ✔ | ✔ | revisar (D3) |

\* A **patronal** é **informativa** (não desconta do credor). Credor **MEI** não sofre nenhuma retenção em nenhum elemento.
Taxa bancária, Taxa PIX e "Outros" **não** dependem do elemento.

**Percentuais padrão (perfil SIMPLES, sobre o bruto):** IRRF 1,5% · ISS 5% · INSS 11% · Patronal 20% · SEST/SENAT 2,5%.
**Perfil do 3.3.90.33:** base 20% do bruto; INSS 11%, Patronal 20%, SEST 1,5%, SENAT 1% sobre a base; IRRF por tabela (60% do bruto − desc. simplificado) menos o desc. adicional; ISS 5% + taxa de expediente do município.

## 7. Exemplos numéricos de referência (viram casos de teste)

**Perfil SIMPLES** (patronal informativa, fora do líquido):

| Caso | Bruto | Elemento | Resultado esperado |
|---|---:|---|---|
| A | 1.000,00 | .36 | IRRF 15,00 · ISS 50,00 · INSS 110,00 · SEST/SENAT 25,00 → desc. **200,00** → **líquido 800,00** (patronal 200,00 informativa) |
| B | 665,00 | .36 | IRRF **9,98** · ISS 33,25 · INSS 73,15 · SEST/SENAT **16,63** → desc. 133,01 → **líquido 531,99** (patronal 133,00 informativa) |
| C | 1.000,00 | .30 | IRRF 15,00 · INSS 110,00 · SEST/SENAT 25,00 (sem ISS) → desc. 150,00 → **líquido 850,00** |
| D | 1.000,00 | .14.01 | nenhuma retenção → **líquido 1.000,00** |
| E | 665,00 | .36 + taxa bancária 8,50 | desc. 141,51 → **líquido 523,49** |
| F | 11,00 | .36 | IRRF 0,165 → **0,17** (hoje o sistema grava 0,16: bug de ponto flutuante) |

**Perfil TRANSPORTE_AUTONOMO (3.3.90.33), da planilha EJA Campo:**

| Caso | Bruto / município | Resultado esperado |
|---|---|---|
| G | 11.970,00 · Águas Belas | IRRF 899,34 · ISS 598,50 · INSS 263,34 · SEST 35,91 · SENAT 23,94 · patronal 478,80 (informativa) → desc. 1.821,03 → **líquido 10.148,97** |
| H | 6.317,50 · Canhotinho | IRRF 0,00 · ISS **331,08** (315,875 + taxa de expediente 15,20) · INSS 138,99 · SEST 18,95 · SENAT 12,64 → **líquido 5.815,84** |
| I | 6.288,30 · Bom Conselho · **não MEI** | base INSS 1.257,66 · IRRF 80,71, mas desc. adicional 141,36 → **IRRF 0,00** · ISS 314,42 · INSS 138,34 · SEST 18,86 · SENAT 12,58 → **líquido 5.804,10** |
| J | 6.288,30 · **MEI** | todas as retenções 0 → **líquido 6.288,30** |

**Rodada 2 — NE parcial e emissão em lote:**

| Caso | Situação | Resultado esperado |
|---|---|---|
| K | NE de R$ 100,00 · emissão com 3 credores: 30,00 + 25,00 + 35,00 | **3 OPs** em sequência (ex.: `…0012/01`, `…0013/02`, `…0014/03`); gasto **90,00**; restante **10,00**; NE "PARCIALMENTE PAGO" |
| L | Mesma NE, nova emissão de R$ 12,00 | **422** "Soma das OPs maior que o saldo da NE" e **nenhuma** OP criada |
| M | Emissão com 3 credores onde o 3º repete o nº do cheque do 1º | **409** com o índice da linha e **nenhuma** OP criada |
| N | Dois credores com datas de pagamento em meses diferentes | duas OPs, **duas competências** de DARF |
| O | .33 · credor com Município (Expediente) = Canhotinho · bruto 6.317,50 | ISS **331,08** (315,875 + 15,20); o mesmo credor **sem** o campo → ISS **315,88** |

O conjunto completo (91 motoristas) está em [`tests/fixtures/eja-campo-5a-parcela.json`](../../tests/fixtures/eja-campo-5a-parcela.json) (anonimizado) e é usado no teste de conformidade (T28).

## 8. Regras do banco compartilhado

1. O schema `empenho` é **compartilhado com outras aplicações em produção**. **Nunca** `DROP COLUMN` / `DROP TABLE`. Só `CREATE TABLE IF NOT EXISTS` e `ADD COLUMN`/`MODIFY` não destrutivos.
2. Scripts SQL são **executados manualmente no MySQL Workbench** por conta privilegiada (o usuário `admin` do app não tem `ALTER` nem `REFERENCES`). Todo script começa com `USE empenho; SET SQL_SAFE_UPDATES = 0;` e registra a versão em `schema_migrations`.
3. Colunas legadas (`elemento_subelemento`, `credor_nome`, `cpf_cnpj`, `total_descontos`…) **continuam sendo gravadas** para não quebrar os outros sistemas. **Atenção:** `total_descontos` passa a **não incluir a patronal** nas OPs novas.
4. Antes de abrir PR: `npm run lint:types`, `npm run lint`, `npm test` e `npm run build` (é o que o CI roda).

## 9. Etapas do projeto

| Etapa | Entrega |
|---|---|
| T01 | Função única de arredondamento monetário |
| T02 | Migration 10 — elementos, subelementos e perfil de cálculo |
| T03 | Migration 11 — config de retenções e regras por elemento |
| T04 | Serviço e API de elementos/subelementos |
| T05 | Cascata elemento→subelemento nas telas |
| T06 | Serviço e API de configuração de retenções |
| T07 | Tela do admin — Retenções e Descontos |
| T08 | (Opcional) Tela do admin — elementos/subelementos |
| T09 | Migration 12 — taxa bancária, taxa PIX e snapshot na OP |
| T10 | Motor de cálculo de retenções (estratégias, MEI, patronal informativa) |
| T11 | Formulário da OP: campos novos e prévia do servidor |
| T12 | Impressão da OP dinâmica |
| T13 | Número previsto da OP e do sub-empenho |
| T14 | Migration 13 — tabela `ne_credores` |
| T15 | Serviço e API da NE com vários credores |
| T16 | Tela da NE: seleção de credores e valor bruto |
| T17 | OP integrada à NE com vários credores |
| T18 | Município do credor (normalização e uso no ISS) |
| T19 | Migration 14 — acompanhamento da DARF |
| T20 | Serviço e API da DARF |
| T21 | Tela de status da DARF |
| T22 | Testes de regressão e fechamento de qualidade |
| T23 | Deploy, checklist de produção e documentação |
| T24 | Migration 15 — parâmetros do transporte, tabela do IRRF e ISS por município |
| T25 | Perfil de cálculo "Transporte autônomo" (3.3.90.33) |
| T26 | Isenção de credor MEI na OP e no cadastro |
| T27 | Tela do admin — parâmetros do transporte, IRRF e ISS por município |
| T28 | Teste de conformidade com a planilha EJA Campo |
| T29 | NE: título, sem datas, "Observações" e Subelemento sempre visível |
| T30 | NE sem credor (retira "vários credores" da NE) |
| T31 | NE com saldo parcial: total, gasto e restante (+ PR 0: status da NE) |
| T32 | Migration 17 — garantir `credores.municipioExpediente` e conferir colunas nulas da NE |
| T33 | Credores: "Município (Expediente)" e uso na taxa de expediente |
| T34 | API de emissão de OPs em lote (um credor = uma OP) |
| T35 | Tela da OP: lista de credores |
| T36 | Consulta, impressão e telas auxiliares |
| T37 | Rodada 2: testes, homologação e deploy |

## 10. Numeração real das migrations

O plano original previa as migrations 10 a 15 (por isso os títulos das etapas T02, T03, T09, T14, T19 e T24 citam "Migration 10" a "Migration 15" — são **históricos**). No repositório a sequência andou um número (o `migration_10.sql` é o `ultimo_acesso` de `usuarios`, fora do projeto), então vale esta tabela:

| Migration | Etapa | Conteúdo |
|---|---|---|
| `migration_11` | T02 | elementos e subelementos |
| `migration_12` | T03 | configuração de retenções |
| `migration_13` | T09 | taxa bancária, taxa PIX e snapshot na OP |
| `migration_14` | T14 | `ne_credores` (sem uso a partir da rodada 2) |
| `migration_15` | T19 | acompanhamento da DARF |
| `migration_16` | T24 | parâmetros do transporte, IRRF e ISS por município |
| **`migration_17`** | **T32** | garante `credores.municipioExpediente` (camelCase; já existe em produção — D41) e só **confere** as colunas nulas da NE, sem `MODIFY` (D47). Escrita e **executada em 14/10/2026** (a coluna já existia; só registrou a versão) |

