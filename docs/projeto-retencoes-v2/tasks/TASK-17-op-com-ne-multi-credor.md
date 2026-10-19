# TASK-17 — OP integrada à NE com vários credores
<!-- milestone: M6 - NE com vários credores | labels: backend,frontend,op,financeiro,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 6 Multi-credor | P1 | ~12 h | T15, T10 | R7 |

## Objetivo
Ao emitir a OP de uma NE com vários credores, escolher **qual credor** está sendo pago, respeitando o **bruto restante daquele credor** e calculando as retenções sobre o valor da OP.

## Contexto (estado atual)
- `OpPaymentData.tsx` carrega a NE (`loadNe`), preenche `credor`, `elemento`, `subelemento`, `saldoAnterior`, `valorEmpenho` e valida `valorPagamento ≤ saldo`.
- `OrdemPagamentoService.criar` trava a NE (`FOR UPDATE`), confere saldo total e usa o `credor_cpf_cnpj` enviado (FK `fk_op_credor`).
- O status da NE (`EMITIDO` → `PARCIALMENTE PAGO` → `LIQUIDADO`) é recalculado a cada `criar`, `atualizar` e `excluir`.

## Escopo
### Entra
**Servidor (`OrdemPagamentoService`)**
1. Se a NE tiver credores (`ne_credores`, ou sintetizado do legado), exigir que `credorCpfCnpj` pertença à NE → senão **422**.
2. Travar as linhas de `ne_credores` da NE (`FOR UPDATE`) e validar: `Σ OPs do credor na NE + novo valor ≤ valor_bruto` do credor. Mensagem: `"Saldo do credor insuficiente. Bruto R$ 6.000,00, já pago R$ 2.500,00, restante R$ 3.500,00."`
3. Manter a validação existente de saldo total da NE.
4. Em `atualizar`, mesma regra **excluindo a própria OP** do somatório.

**Formulário (`OpPaymentData`)**
5. Ao carregar a NE com mais de um credor, mostrar seletor **"Credor desta OP"** com bruto, pago e restante de cada um.
6. Com um único credor, selecionar automaticamente.
7. Ao escolher o credor: preencher nome, CPF/CNPJ, RG, endereço (dados do cadastro de credores) e sugerir `valorPagamento` = restante do credor (editável, nunca acima do restante).
8. Indicador de saldo passa a mostrar também o **saldo do credor**.

**Outros**
9. `OpRecentTable` e a impressão exibem o credor de cada OP; NE com vários credores imprime a relação de credores e brutos (via da NE).

### Não entra
Mudar o cálculo de retenções (continua T10, aplicado sobre o valor da OP).

## Especificação técnica
- O número `/NN` do sub-empenho continua **sequencial por NE** (não por credor).
- Retenções são calculadas sobre o `valorPagamento` da OP (bruto daquele pagamento).
- Excluir uma OP só **libera** saldo do credor e da NE, então não precisa de validação extra de bruto (a regra de DARF paga, da T20, continua valendo).
- Concorrência: duas OPs simultâneas do mesmo credor — a trava `FOR UPDATE` garante que a segunda enxergue a primeira.

## Arquivos
- **Alterados:** `lib/services/ordem-pagamento.service.ts`, `components/op-form/OpPaymentData.tsx`, `components/op-form/OpRecentTable.tsx`, `components/consulta-impressao/EmpenhoVia.tsx`, `app/consulta-impressao/page.tsx`, `lib/schemas.ts`
- **Testes:** `tests/integration/ordens-pagamento.test.ts`, `tests/unit/calculos-op.test.ts`, componentes da OP

## Critérios de aceite
- [ ] NE com 2 credores (6.000 + 4.000): OP de 3.500 para o credor A → OK; nova OP de 3.000 para o mesmo credor → 422 (restante 2.500).
- [ ] OP para credor que **não** pertence à NE → 422.
- [ ] Soma das OPs dos dois credores até 10.000,00 leva a NE a `LIQUIDADO`.
- [ ] NE antiga com um credor continua funcionando sem ajuste de dados.
- [ ] Editar a OP respeita o restante sem contar a si mesma.
- [ ] O seletor mostra bruto/pago/restante corretos e o valor sugerido não passa do restante.
- [ ] Teste de concorrência (duas OPs ao mesmo tempo) não ultrapassa o bruto.

## Riscos e observações
Task de risco financeiro alto: validar em homologação com cenários reais (NE com 3 credores e pagamentos parciais).

## Decisões em aberto relacionadas
D7.

## Atualização de escopo (decisões de 07/10/2026)
- O seletor "Credor desta OP" exibe o selo **MEI**; para MEI o formulário já mostra "Isento (MEI)" e as retenções zeradas.
- O município do credor escolhido é enviado ao motor de cálculo (T25) quando o elemento for 3.3.90.33.

## Atualização de escopo (rodada 2, 13/10/2026)
**Substituída pelas T34 e T35.** O `SeletorCredorOp` sai; o credor da OP é escolhido na **lista de credores** da própria OP, e a emissão acontece em lote (`POST /api/ordens-pagamento/lote`), uma OP por credor, na mesma transação. A conferência "credor pertence à NE" e o limite por credor deixam de existir; vale o **saldo total da NE**.
