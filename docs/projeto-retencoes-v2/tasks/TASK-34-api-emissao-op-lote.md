# TASK-34 — API de emissão de OPs em lote: um credor = uma OP, tudo na mesma transação
<!-- milestone: M11 - Ajustes do supervisor (rodada 2) | labels: backend,api,op,financeiro,P0 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 11 Rodada 2 | P0 | ~27 h (24–30 h) | T30, T31, T33 | R17, R20, R21 |

## Objetivo
Permitir emitir **várias Ordens de Pagamento de uma vez** para a mesma NE, uma por credor, cada uma com seu **valor a pagar, nº do cheque, data de pagamento, especificação (itens) e retenções**. É o que o supervisor pediu: a NE de R$ 100,00 recebe uma emissão com vários credores que gasta R$ 90,00.

## Contexto (estado atual)
- `OrdemPagamentoService.criar` (`lib/services/ordem-pagamento.service.ts`, ~245–478) faz **uma OP por chamada**, tudo dentro de `withTransaction`, com **retry (até 5×)** quando `numero_empenho` colide (`ER_DUP_ENTRY` em `uq_numero_empenho`, `migration_08`). Dentro da transação:
  1. checa **cheque duplicado** (`SELECT … WHERE numero_cheque = ?` → 409). O banco também tem `UNIQUE KEY uq_cheque (numero_cheque)`;
  2. trava a NE (`FOR UPDATE`), exige NE existente e **não cancelada**;
  3. elemento/subelemento **sempre da NE** (nunca do cliente);
  4. calcula `saldoDisponivel = valor da NE − SUM(valor_pagamento)` (hoje em ponto flutuante com `Math.round(x*100)/100`) e dá **422** se o valor passar;
  5. confere itens: `totalItensCalc` × `valorPagamento` (tolerância R$ 0,01 → 400);
  6. `calcularProximoNumeroOp(exec, numeroNe, { travar: true }, ano)` (`lib/services/numeracao-op.ts`) → `numeroOp` (`2026.OP.0004`, coluna `numero_empenho`) e `sub` (`01`, `02`…, por NE);
  7. `calcularRetencoesDaOp` (motor T10/T25, com MEI, vigência por `dataPagamento`/`dataEmissao`);
  8. `INSERT INTO ordens_pagamento …` (grava `credor_nome`, `credor_cpf_cnpj`, `credor_rg`, `credor_endereco`; **a OP não tem colunas de conta bancária**);
  9. auditoria do MEI sobrescrito; `sincronizarDarfDaOp` (DARF, mesma transação);
  10. atualiza o `status` da NE (a T31 troca por `recalcularStatusNe`).
- Rotas existentes: `POST /api/ordens-pagamento`, **`POST /api/ordens-pagamento/previa`** (prévia de **uma** OP; não existe `previa-retencoes`), `GET /api/ordens-pagamento/proximo-numero?numeroNe=` (previsão do próximo número).
- **Prévia hoje (D43):** a tela usa a prévia do servidor **só no 3.3.90.33** (`PreviaTransporteEffect`); nos demais elementos o cálculo é feito no navegador (`AutoCalcEffect`). Isso continua.
- `historico` da OP hoje: a tela une as especificações dos itens com " | " (`app/ordem-pagamento/page.tsx` ~297); quando a NE é escolhida, o primeiro item é pré-preenchido com `ne.historico || 'Pagamento referente ao empenho ' + ne.numero` (`OpPaymentData.tsx` ~182).
- **Testes atuais casam o texto do SQL** nos mocks (`tests/integration/ordens-pagamento.test.ts`, `ordem-pagamento.test.ts`, `darf.test.ts`): qualquer mudança de texto de SQL na extração quebra os mocks sem que o comportamento tenha mudado.
- **Confirmado:** cada credor tem **OP própria** ("mostrar o número da OP de cada um"). As planilhas do EJA Campo também funcionavam assim (sub-empenho /01 a /92, um cheque por motorista).

## Escopo
### Entra
**1. Extrair o miolo da transação**
Mover os passos 3–9 para `criarOpNaTransacao(conn, dados, ctx)` (`lib/services/ordem-pagamento-core.ts`), **sem** abrir transação nem retry. O passo 10 (status da NE) fica **fora** do core: quem chama decide (`criar` individual chama `recalcularStatusNe` após a OP; o lote chama **uma vez** no fim). `criar` passa a ser `withTransaction(() => …criarOpNaTransacao…)` com o **mesmo retry**. Sem mudança de comportamento observável. Meta: a suíte atual passar sem alteração — **frágil**, porque os mocks casam texto de SQL; manter o texto dos SQL idêntico e, se algum mock precisar mudar, justificar no PR.

**2. `POST /api/ordens-pagamento/lote`** (ADMIN/GESTOR; CONSULTA → 403)
```json
{
  "numeroNe": "2026NE000123",
  "dataEmissao": "2026-10-13",
  "credores": [
    {
      "credorCpfCnpj": "123.456.789-09",
      "valorPagamento": 120.00,
      "numeroCheque": "852963",
      "dataPagamento": "2026-10-20",
      "itens": [
        { "especificacao": "Locomoção",   "unidade": "UN", "quantidade": 1, "valorUnitario": 50.00 },
        { "especificacao": "Alimentação", "unidade": "UN", "quantidade": 1, "valorUnitario": 70.00 }
      ],
      "irrf": null, "iss": null, "inss": null, "sestSenat": null, "patronal": null,
      "outrosDescontos": null, "taxaBancaria": 0, "taxaPix": 0,
      "sobrescreverMei": false
    }
  ]
}
```
- Dados do credor gravados na OP (`credor_nome`, `credor_rg`, `credor_endereco`) vêm do **cadastro** (`credores`), não do cliente.
- **`historico` de cada OP** (mesma regra da tela): especificações dos itens unidas por " | "; **sem itens**, as Observações da NE (`notas_empenho.historico`); **sem Observações**, "Pagamento referente ao empenho &lt;número da NE&gt;".
- **Resposta 201:**
```json
{
  "numeroNe": "2026NE000123",
  "ops": [{ "id": "…", "numeroOp": "2026.OP.0012", "sub": "01", "credorCpfCnpj": "…", "valorPagamento": 120, "totalDescontos": 0, "valorLiquido": 120 }],
  "resumo": { "quantidade": 3, "totalBruto": 90.00, "saldoAnterior": 100.00, "saldoRestante": 10.00, "statusNe": "PARCIALMENTE PAGO" }
}
```

**3. Regras do lote** (qualquer erro → **rollback total**, nenhuma OP é criada — D35)
- NE travada **uma vez** (`FOR UPDATE`), existente e não cancelada.
- **Soma dos `valorPagamento` ≤ saldo disponível** da NE (em centavos) → senão **422** "Soma das OPs (R$ X) maior que o saldo da NE (R$ Y)".
- Cada `valorPagamento > 0`.
- **Credor repetido** no mesmo lote → **400** `credores[i]: credor repetido` (D35).
- Máximo de **100** credores por emissão.
- **Cheque único**: contra o banco **e** dentro do lote → **409** `credores[i]: o cheque nº "…" já foi utilizado`. Se outra transação gravar o mesmo cheque entre a checagem e o `INSERT`, o `ER_DUP_ENTRY` de `uq_cheque` deve ser mapeado para a linha certa: extrair o valor duplicado de `sqlMessage` e achar o índice no lote. Não confundir com a colisão de `numero_empenho` (que dispara o retry).
- Itens: se houver, a **soma dos itens = valor a pagar** (tolerância R$ 0,01), por credor.
- Credor precisa existir **e estar ativo** em `credores` → **422** `credores[i]: …`. Checagem **explícita** (`ativo = 1`): a FK `fk_op_credor` (`credor_cpf_cnpj → credores.cpf_cnpj`) só exige que a linha exista, **não** olha `ativo`.
- Retenções **por credor** com o motor existente: MEI do credor, **`dataPagamento` do próprio credor** (define vigência das tabelas do .33 e a competência da DARF) e `credores.municipioExpediente` (T33, D41).
- `sincronizarDarfDaOp` por OP (mesma transação).
- Ao final, **uma** atualização de status da NE (`recalcularStatusNe`, T31).
- O **retry** de colisão do número refaz **o lote inteiro**.

**4. Numeração**
- Em `numeracao-op.ts`, `calcularProximosNumerosOp(exec, numeroNe, quantidade, { travar }, ano)` → lista sequencial `[{ numeroOp, sub }, …]` com **um** `MAX` de OP e **um** de sub.
- Na gravação, cada OP chama `calcularProximoNumeroOp(..., { travar: true })` na **mesma conexão**: o `INSERT` anterior já é visível, então os números saem em sequência (`0012/01`, `0013/02`, …).
- `GET /api/ordens-pagamento/proximo-numero?numeroNe=…&quantidade=N` (1 a 100) devolve `{ numeroOp, sub, numeros: [{ numeroOp, sub, rotulo }] }`. Sem `quantidade`, continua igual (compatível com a T13).

**5. Prévia em lote (D43)** — `POST /api/ordens-pagamento/previa-lote` (mesma entrada, **sem gravar**), usada **só quando o elemento da NE é 3.3.90.33** (todas as linhas de uma emissão têm o elemento da NE). Aceita **qualquer subconjunto** das linhas (o cliente manda só as que mudaram) e devolve, por linha enviada (com o índice), as retenções, o líquido e os avisos (ex.: "Isento (MEI)", "Município de expediente sem cadastro de ISS"). Usa o **mesmo código** do cálculo da gravação. Nos demais elementos a tela calcula localmente por linha, como hoje.

**6. Desempenho**
- Carregar **uma vez** por requisição: `obterConfigRetencoes`, parâmetros/faixas por vigência (memoizar por `perfil+data`) e municípios de ISS. Hoje `calcularRetencoesDaOp` busca tudo a cada OP; com 90 credores isso vira centenas de consultas.
- Meta de referência: 90 credores em poucos segundos em homologação (não é critério rígido).

**7. Auditoria**: um registro `CREATE_LOTE` em `auditoria_financeira` (`acao` é `VARCHAR(20)`), com `entidade = 'notas_empenho'` e **`entidade_id` = id da NE** (a coluna é `CHAR(36)`: não cabe lista de ids); a lista de ids das OPs vai em `dados_novos`.

### Não entra
- Editar uma OP existente (continua individual: `PUT /api/ordens-pagamento/[id]`, D37).
- Impressão em lote (T36 opcional) e importação de planilha.
- Alterar a regra de retenções.

## Especificação técnica
```ts
// lib/services/ordem-pagamento-core.ts
export async function criarOpNaTransacao(
  conn: PoolConnection,
  dados: OpParsed,                      // já validado
  ctx: { usuarioId: string; perfil: Perfil; neRow: NeRow; cache: CalculoCache }
): Promise<{ id: string; numeroOp: string; sub: string; /* valores */ }>
// NÃO atualiza o status da NE (quem chama decide).

// OrdemPagamentoService.criarLote(raw, usuarioId, perfil)
//  1) valida o payload (Zod) e as regras que não precisam de banco (repetido, soma>0, máximo)
//  2) withTransaction + retry de colisão de número (5x)
//     a) SELECT … FROM notas_empenho WHERE numero = ? FOR UPDATE
//     b) saldo = valor − SUM(valor_pagamento) (centavos) → compara com a soma do lote
//     c) valida cheques (banco + lote) e credores ativos
//     d) for (const c of credores) await criarOpNaTransacao(conn, c, ctx)
//     e) recalcularStatusNe(conn, numeroNe); auditoria do lote
```
- **Erros com índice:** mensagens no formato `credores[2]: …`, para a tela (T35) destacar a linha.
- **Ordem dos credores** = ordem do payload = ordem dos números `sub`.
- `credor_rg` e `credor_endereco` continuam sendo gravados na OP, agora lidos do cadastro.

## Arquivos afetados
- **Novos:** `lib/services/ordem-pagamento-core.ts`, `app/api/ordens-pagamento/lote/route.ts`, `app/api/ordens-pagamento/previa-lote/route.ts`
- **Alterados:** `lib/services/ordem-pagamento.service.ts` (usa o core), `lib/services/numeracao-op.ts`, `app/api/ordens-pagamento/proximo-numero/route.ts`, `lib/services/calculo-op.service.ts` (cache por requisição), `lib/schemas.ts`
- **Testes:** `tests/integration/ordens-pagamento.test.ts` (lote), `tests/integration/proximo-numero.test.ts`, `tests/unit/numeracao-op.test.ts` (novo), `tests/integration/darf.test.ts`

## Critérios de aceite
- [ ] NE de R$ 100,00 + lote de 3 credores somando R$ 90,00 → **3 OPs**, NE "PARCIALMENTE PAGO", restante R$ 10,00.
- [ ] Os 3 números de OP saem em sequência e os `sub` saem `01`, `02`, `03` (ou na sequência da NE).
- [ ] Soma do lote > saldo → **422** e **nenhuma** OP criada.
- [ ] Falha na 3ª OP (ex.: cheque repetido) → **rollback**: nenhuma das anteriores permanece.
- [ ] Cheque repetido **dentro** do lote → **409** com o índice da linha; cheque gravado por outra transação no meio do lote → **409** com o índice certo.
- [ ] Credor repetido no lote → **400**; credor inativo → **422** com o índice.
- [ ] Cada OP calcula as retenções do **seu** credor: MEI zera; .33 usa a vigência da **data de pagamento do credor** e o `municipioExpediente`.
- [ ] Cada OP gera/atualiza a sua DARF com a competência da **sua** data de pagamento.
- [ ] OP sem itens grava `historico` pela regra acima.
- [ ] A suíte antiga de `POST /api/ordens-pagamento` passa após a extração do core (mudanças em mocks só com justificativa).
- [ ] `proximo-numero?quantidade=3` devolve 3 números sequenciais; sem `quantidade` mantém o formato antigo.
- [ ] Duas emissões simultâneas na mesma NE não duplicam número de OP nem estouram o saldo.
- [ ] `previa-lote` não grava nada, aceita um subconjunto de linhas e bate com o que a gravação calcula.
- [ ] Perfil CONSULTA recebe 403.
- [ ] `npm run lint:types`, `npm run lint`, `npm test` e `npm run build` verdes.

## Testes
- **Unitário:** `calcularProximosNumerosOp`; validações do payload; cache do cálculo; mapeamento de `ER_DUP_ENTRY` de cheque para o índice.
- **Integração:** todos os cenários acima (sucesso, saldo, rollback, cheque, repetido, inativo, MEI, vigência, DARF, concorrência com duas transações).
- **Regressão:** `criar` individual idêntico ao anterior.

## Riscos e observações
- É a task de **maior risco**: mexe no coração do sistema financeiro. Fazer em **três PRs**: (A) só a extração do core, sem mudar comportamento; (B) numeração múltipla e `proximo-numero?quantidade`; (C) lote, `previa-lote`, cache e teste de concorrência.
- Transação longa (até 100 inserts + DARF): atenção ao tempo de lock da NE; manter o lote enxuto e evitar consultas repetidas.
- O número da OP mostrado na tela é **previsão**; o definitivo sai no `INSERT`. A tela deve avisar se mudou (já existe esse aviso para a OP individual).
- **Release:** a parte (C) sai **junto** com T30, T31 e a lista da T35 (D44).

## Decisões relacionadas
D35 (lote atômico; credor repetido recusado), D36 (`ne_credores` não é mais lida), D37 (edição segue individual). **Fechadas:** D28, D29, D30, D41 (`municipioExpediente`), D43 (prévia: servidor só no .33), D44 (mesmo release de T30/T31/T35).
