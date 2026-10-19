# TASK-36 — Consulta, impressão e telas auxiliares: ajustes da rodada 2
<!-- milestone: M11 - Ajustes do supervisor (rodada 2) | labels: frontend,impressao,ne,P2 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 11 Rodada 2 | P2 | ~3 h (2–3 h; +4 h se fizer "Imprimir esta emissão") | T29, T30, T35 | R22 |

## Objetivo
Garantir que o que mudou na NE e na OP **não quebra nem confunde** as telas de consulta/impressão, a DARF e os resumos: nomes novos, NE sem credor e várias OPs emitidas juntas.

## Contexto (estado atual, conferido no código)
- **A via impressa é montada a partir da OP, não da NE.** Em `app/consulta-impressao/page.tsx` (`gerarDocFormatado`, ~311–350) as datas vêm da **OP** (`op.dataPagamento`, `op.dataEmissao`, ~338–340) e passam por `formatDateOnlyBR` (`lib/utils.ts`), que **já devolve "-"** para vazio. Por isso as datas que a NE deixa de ter (T29) **não** causam "Invalid Date" na via.
- Sem OP selecionada, a consulta gera uma via "em branco" a partir da NE (~389–442): usa `neDB.credorNome || frenteData.credorNome` e `neDB.cpfCnpj || …` (NE nova sem credor cai no valor da tela, sem erro), `elemento`/`subelemento`, `valor` e `historico` da NE. Não usa datas da NE.
- **Credores da NE na via:** `buscarCredoresNe` (~302) e `neDB.credores` (~428) alimentam `credoresNe`, que o `EmpenhoVia` (`components/consulta-impressao/EmpenhoVia.tsx` ~147) imprime quando há **2 ou mais** credores. Depois da T30 a API da NE não devolve mais `credores`: essa linha nunca mais aparece e o código fica morto.
- O cabeçalho oficial da via é **"ESPECIFICAÇÃO OU HISTÓRICO"** (`EmpenhoVia.tsx` ~334).
- **Dashboard:** a lógica fica em `lib/services/dashboard.service.ts` (a rota `app/api/dashboard/stats/route.ts` tem 17 linhas). Usa só `created_at` e `status` da NE — nenhuma data de pagamento/emissão nem credor da NE. Depende de o `status` estar certo (ver PR 0 da T31).
- **DARF:** `lib/services/darf.service.ts` usa a `data_pagamento` **da OP** (fallback `data_emissao` da OP) para a competência, então já acompanha a data de cada credor.

## Escopo
### Entra
1. **Via impressa da NE:** manter o cabeçalho oficial **"ESPECIFICAÇÃO OU HISTÓRICO"** (layout do documento — D39). Conferir que a via "em branco" de uma NE nova (sem credor, sem datas) sai sem erro.
2. **Remover o código morto de credores da NE na impressão:** `buscarCredoresNe`, o campo `credoresNe` da via e a linha de credores do `EmpenhoVia` (~147). Depois da T30 esse código não quebra (a lista vem vazia), só fica sem efeito.
3. **Consulta de NE:** qualquer rótulo **de tela** "Especificação" ligado à NE passa a "Observações" (a tabela de itens da OP, "Especificação do que está sendo pago", **não** muda: é a especificação do pagamento, não as Observações da NE).
4. **DARF e dashboard:** só **confirmar** (teste), já que não dependem de datas nem de credor da NE.
5. **Impressão da OP:** validar que nº da OP, cheque e data do pagamento impressos são os **da própria OP** com várias OPs emitidas juntas (já são).
6. **Opcional (se couber):** "**Imprimir esta emissão**" — `/consulta-impressao?ops=id1,id2,…` com as vias em sequência e quebra de página (`page-break-after: always`), usada pelo diálogo de sucesso da T35.
7. Atualizar textos de ajuda/rótulos restantes ("Emissão de Notas de Empenho" → "Cadastro de Nota de Empenho") em breadcrumbs, `metadata` e testes, se houver fora da T29.

### Não entra
- Redesenhar as vias oficiais.
- Mudar regras de cálculo.

## Especificação técnica
- Procurar com `grep -rn "credoresNe\|buscarCredoresNe\|Especifica\|Emissão de Notas" app components lib` e revisar **cada** ocorrência ligada à NE.
- `credoresNe` também aparece no formulário da OP (`app/ordem-pagamento/page.tsx` ~88/124/231 e `OpPaymentData.tsx` ~32/168/209); essa parte sai na T35 junto com o `SeletorCredorOp`.

## Arquivos afetados
- **Alterados:** `app/consulta-impressao/page.tsx`, `components/consulta-impressao/EmpenhoVia.tsx`, textos/metadata
- **Sem alteração prevista:** `app/darf/page.tsx`, `lib/services/darf.service.ts`, `lib/services/dashboard.service.ts` (só testes de confirmação)
- **Testes:** `tests/unit/impressao-op.test.ts`, testes de componente da consulta, `tests/integration/darf.test.ts`

## Critérios de aceite
- [ ] Gerar a via "em branco" de uma NE **sem credor e sem datas** funciona, sem "Invalid Date" nem "01/01/1970".
- [ ] O cabeçalho oficial da via da NE continua "ESPECIFICAÇÃO OU HISTÓRICO".
- [ ] Não há mais referência a `credoresNe`/`buscarCredoresNe` na impressão.
- [ ] Nenhuma tela de **cadastro/lista** usa mais "Especificação" para as Observações da NE.
- [ ] A competência da DARF de duas OPs da mesma emissão com datas de pagamento em meses diferentes cai em **competências diferentes**.
- [ ] (Opcional) "Imprimir esta emissão" imprime todas as OPs criadas, uma por página.
- [ ] `npm run lint:types`, `npm run lint`, `npm test` e `npm run build` verdes.

## Testes
- **Unitário:** via em branco de NE sem credor/sem datas.
- **Integração:** DARF com duas OPs de datas em meses diferentes.

## Riscos e observações
O supervisor pediu o nome "Observações" **na aba de cadastro**; a via impressa é um documento oficial, por isso não foi renomeada (decisão D39 — confirmar com ele).

## Decisões relacionadas
D39 (a via impressa não muda de nome). A D44 (mesmo release de T30/T31/T34/T35) não inclui esta task: o código de `credoresNe` só fica sem efeito depois da T30, então removê-lo pode vir no mesmo release ou no seguinte.
