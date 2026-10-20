# Rodada 2 — Homologação, entrega e rollback (T37)

Fechamento da rodada de ajustes pedida pelo supervisor (prints de 13/10/2026): NE, credores e Ordem de Pagamento.
Tudo está na `main` (PRs #39 a #52). Este documento é o roteiro para **conferir, aprovar e entregar**.

> **Antes de tudo:** hoje o `.env.local` de desenvolvimento aponta para o servidor do **banco compartilhado de produção**.
> Todo teste feito "localmente" grava NE, OP e DARF de verdade, que os outros sistemas enxergam.
> Por isso o roteiro usa uma **NE de teste identificável** e termina com a **limpeza** pela própria aplicação.
> Ver também a recomendação 1 da seção 7.

---

## 1. Rastreabilidade: pedido do supervisor → como é verificado

| # | Pedido | Teste automatizado | Checklist (seção 3) |
|---|---|---|---|
| 1 | Título "Cadastro de Nota de Empenho" | `tests/unit/notas-empenho-page.test.tsx` — título, sem datas, "Observações" | C1 |
| 2 | Sem Data de Emissão/Pagamento na NE | `tests/integration/notas-empenho.test.ts` — "NE sem nenhuma data → 201, datas NULL"; `notas-empenho-id.test.ts` — "NE antiga mantém as datas" | C1, C2 |
| 3 | Subelemento sempre visível | `notas-empenho-page.test.tsx` — "Subelemento aparece antes de escolher o elemento; lista no .14, texto no .36" | C3 |
| 4 | "Observações" no lugar de "Especificação" | `notas-empenho-page.test.tsx` — formulário e lista | C1 |
| 5 | Credores fora da NE; NE sem credor | `notas-empenho.test.ts` — "salva sem nenhum credor"; `notas-empenho-page.test.tsx` — "sem seção de credores" | C1 |
| 6 | NE parcial com total, gasto e restante | `notas-empenho-saldo.test.ts` — "NE de 100 com 90 gastos em 3 OPs"; `ordens-pagamento-lote.test.ts` — "NE de 100 + 3 credores somando 90 … restante 10" | C4 |
| 7 | Credores na OP; nº da OP por credor | `ordens-pagamento-lote.test.ts` — "3 OPs em sequência"; `ordem-pagamento-page.test.tsx` — "número previsto por posição", "emitir 3 credores" | C4 |
| 8 | Cheque e data do pagamento por credor | `ordem-pagamento-page.test.tsx` — payload com cheque/data por linha; `darf-sync.test.ts` — "duas OPs … meses diferentes caem em competências diferentes" | C7, C10 |
| 9 | Especificação por credor, minimizada | `ordem-pagamento-page.test.tsx` — "painel começa fechado com o resumo dos itens" | C4 |
| 10 | Município (Expediente) | `transporte-op.test.ts` — "expediente Canhotinho: ISS 331,08 (315,875 + 15,20)"; `credores-page-expediente.test.tsx` | C6 |
| 11 | Sai o campo "Número da OP" | `ordem-pagamento-page.test.tsx` — "sem Número da OP nem bloco Favorecido" | C4 |

**Bloqueios da emissão:**
- `ordens-pagamento-lote.test.ts`:
  - soma > saldo → 422;
  - cheque repetido no lote → 409;
  - cheque já usado no banco → 409;
  - cheque gravado por outra transação no meio → 409;
  - credor inativo → 422;
  - itens ≠ valor → 400 com rollback.
- `ordem-pagamento-page.test.tsx`: Emitir desabilitado acima do saldo; cheque repetido nas duas linhas.

## 2. Regressão (o que já funcionava)

| Área | Testes |
|---|---|
| NE: criar, editar, duplicidade, cancelar | `notas-empenho.test.ts`, `notas-empenho-id.test.ts` (cancelar com e sem OP), `notas-empenho-duplicidade.test.ts` |
| Status da NE ao editar (PR 0) | `notas-empenho-id.test.ts` — parcial/liquidada/cancelada mantêm o status; `status-ne.test.ts`; `saldo-ne.test.ts` |
| OP: saldo, cheque, excluir, editar (API) | `ordem-pagamento.test.ts`, `ordens-pagamento.test.ts`, `op-status-ne.test.ts` (excluir devolve o saldo), `op-saldo-credor.test.ts` (editar), `ordem-pagamento-core.test.ts` |
| DARF | `darf.test.ts`, `darf-sync.test.ts` (PAGA não muda; falha desfaz a OP) |
| Retenções por elemento e prévia | `calculos-op.test.ts`, `OpTaxesSection.test.tsx`, `retencoes-*.test.ts` |
| MEI | `transporte-op.test.ts` (MEI zerado; ADMIN sobrescreve com auditoria), `OpTaxesSection.test.tsx` |
| Conformidade EJA Campo (T28) | `conformidade-eja-campo.test.ts` — 91 linhas, já com `municipioExpediente` |
| Numeração | `numeracao-op.test.ts`, `op-numeracao-sequencia.test.ts`, `proximo-numero.test.ts` |
| Impressão | `impressao-op.test.ts`, `consulta-impressao-ne-url.test.tsx` (via em branco de NE nova; "Imprimir esta emissão") |

**Concorrência** (duas emissões ao mesmo tempo na mesma NE):
- Nos testes ficam a ordem (a NE é travada antes de tudo), o rollback e o retry de colisão do número (`ordens-pagamento-lote.test.ts`).
- A disputa real entre duas transações só existe com banco de verdade, então fica no roteiro guiado (seção 4, passo 6).

## 3. Checklist de homologação (marcar e levar para o supervisor)

- [ ] **C1.** NE nova sem datas e sem credor salva; título "Cadastro de Nota de Empenho"; campo "Observações"; aparece na lista com a coluna "Cadastro".
- [ ] **C2.** NE antiga abre, edita e salva sem perder as datas.
- [ ] **C3.** Subelemento visível em todos os elementos (lista no 3.3.90.14, texto livre nos outros).
- [ ] **C4.** Emissão de 3 credores numa NE de R$ 100,00 somando R$ 90,00:
  - 3 OPs com números em sequência;
  - NE "PARCIALMENTE PAGO", com saldo de R$ 10,00 na lista e na faixa de saldo.
- [ ] **C5.** Um credor MEI na emissão: retenções zeradas ("Isento (MEI)").
- [ ] **C6.** Credor com Município (Expediente) no 3.3.90.33: a taxa de expediente entra no ISS (prévia e OP gravada).
- [ ] **C7.** Cheque repetido bloqueia, sem criar nada.
- [ ] **C8.** Soma maior que o saldo bloqueia, sem criar nada.
- [ ] **C9.** "Imprimir esta emissão" abre só as OPs da emissão; as vias saem com o nº, cheque e data de cada OP.
- [ ] **C10.** Tela de DARF: OPs com pagamento em meses diferentes em competências diferentes.
- [ ] **C11.** Outro sistema que usa o banco continua lendo NEs e OPs. Os usuários confirmaram em 13/10 que eles não leem as colunas de data e credor da NE (D47); conferir mesmo assim.
- [ ] **C12.** Editar uma NE parcial, liquidada ou cancelada mantém o status (PR 0).
- [ ] **C13.** OP antiga (de antes da rodada 2) aparece nas recentes, imprime e a DARF dela continua certa. A edição de OP **não existe na tela** desde 09/2026 (D48); a API de edição segue coberta por teste.
- [ ] **C14.** Duas emissões ao mesmo tempo na mesma NE (seção 4, passo 6) não repetem número nem estouram o saldo.
- [ ] **C15.** `conferencia_status_ne.sql` e `conferencia_rodada2.sql` rodados, com resultados anotados.

## 4. Roteiro de teste guiado

Use uma NE **só de teste**, com número e observação inconfundíveis, e anote os números das OPs criadas.

1. **Cadastro da NE:**
   - número `2026NE999901`;
   - Observações "TESTE RODADA 2 — APAGAR";
   - valor R$ 100,00;
   - elemento 3.3.90.36;
   - sem datas e sem credor.

   Confira C1 e C3.
2. **Emissão:** na Ordem de Pagamento, carregue a NE e adicione 3 credores **de teste**, um deles MEI, com R$ 30,00 cada.
   - Ponha cheques diferentes e duas datas de pagamento em **meses diferentes**.
   - Confira os números previstos e o líquido.
   - Emita. Confira C4, C5 e C10.
3. **Bloqueios:**
   - repita com dois credores no mesmo cheque → C7;
   - repita com uma soma maior que o restante → C8.

   Confira que **nenhuma** OP foi criada.
4. **Município (Expediente):** numa NE de teste do 3.3.90.33 (ou mude o elemento da NE de teste), use um credor com Município (Expediente) cadastrado. A prévia deve mostrar o ISS com a taxa → C6.
5. **Impressão:** no diálogo de sucesso, clique em "Imprimir esta emissão" → C9.
6. **Concorrência:**
   - abra a Ordem de Pagamento em **duas abas**, com a mesma NE e um credor diferente em cada;
   - em cada aba, um valor que **sozinho cabe** no restante, mas **somado** passa dele;
   - clique "Emitir" nas duas quase ao mesmo tempo.

   **Esperado:** uma emite e a outra recebe "Soma das OPs … maior que o saldo"; números sem repetição → C14.
7. **Conferência no banco:** rode `database/consultas/conferencia_rodada2.sql` com `@ne = '2026NE999901'` → C15.

### Limpeza dos dados de teste (pela aplicação, sem `DELETE` no banco)
A tela não tem botão de excluir OP. A exclusão usa a rota da aplicação, que **remove a DARF pendente e recalcula o status da NE**. Logado, no console do navegador (F12):

```js
// 1) listar as OPs da NE de teste
const { ordens } = await (await fetch('/api/ordens-pagamento?numeroNe=2026NE999901')).json();
console.table(ordens.map(o => ({ id: o.id, op: o.numeroEmpenho, sub: o.sub, credor: o.credorNome })));
// 2) conferir a lista acima e então excluir cada uma
for (const o of ordens) console.log(o.numeroEmpenho, (await fetch(`/api/ordens-pagamento/${o.id}`, { method: 'DELETE' })).status);
```

Depois, na tela de NE, **cancele** a NE `2026NE999901` (o botão só cancela NE sem OP).

## 5. Entrega (deploy) — fluxo atual: desenvolvimento local → pen drive → servidor

**Antes**
1. A `main` com o CI verde (Build & Test e E2E). Anotar o commit ou a tag da entrega (recomendação 2).
2. **Backup** do schema `empenho` (equipe do banco).
3. Rodar no Workbench só as **consultas de verificação** da `migration_17` (seção 1 do `conferencia_rodada2.sql`). A migration já está aplicada em produção desde 14/10; **não** é preciso rodá-la de novo.
4. Checklist da seção 3 aprovado pelo supervisor.

**Montagem do pacote** (`next.config.ts` usa `output: 'standalone'`, o mesmo que o `Dockerfile` e o CI usam)
```bash
npm ci
npm run build
# pacote = .next/standalone + public + .next/static
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
```
- Levar a pasta `.next/standalone` (ou o zip da tag, recomendação 2).
- **Não** levar `.env`, `.env.local`, `node_modules` de desenvolvimento nem arquivos de teste.
- O `.env` de produção fica no servidor.

**No servidor**
1. Parar a aplicação.
2. **Guardar a pasta da versão atual** (é o rollback).
3. Colocar a versão nova.
4. Iniciar com `node server.js` dentro da pasta, ou do jeito que o servidor já usa. **Confirmar com a equipe como ele roda hoje.**

**Depois (smoke test)**
- login;
- tela de NE (lista com Gasto/Restante);
- Ordem de Pagamento carregando uma NE;
- tela de DARF;
- opcional: emissão de teste com limpeza (seção 4).

**Comunicar aos usuários**
- "Os credores agora são escolhidos na Ordem de Pagamento (um ou vários por emissão)."
- "Novo campo **Município (Expediente)** no cadastro de credores."
- "A NE pode ficar com saldo: a tela mostra valor, gasto e restante."

## 6. Rollback
- **Código:** parar, voltar a pasta da versão anterior guardada no servidor e iniciar. O código antigo ignora `municipioExpediente` e funciona com as NEs novas: as colunas de data e credor são `NULL`áveis.
- **Banco:** nada a desfazer. A rodada 2 não criou nem alterou colunas em produção (a `municipioExpediente` já existia). **Nenhum `DROP`** sem aprovação explícita.
- **Dados:** OPs emitidas pela versão nova continuam válidas na antiga (mesmas tabelas e colunas).

## 7. Recomendações para o fluxo de entrega (para decidir com a equipe)
1. **Banco de teste separado (prioridade).** Pedir ao responsável pelo MySQL um schema `empenho_teste`, no mesmo servidor ou em outro, com a **estrutura** copiada do `empenho` e **sem dados reais**. O `.env.local` de desenvolvimento passa a apontar para ele. Assim nenhum teste cria NE, OP ou DARF no banco que os outros sistemas leem, e o roteiro da seção 4 deixa de precisar de limpeza em produção.
2. **Entregar uma versão marcada, não "arquivos soltos".** A cada entrega:
   - criar uma tag no GitHub (ex.: `v2.0.0-rodada2`) e levar no pen drive o pacote **dessa tag**;
   - assim se sabe exatamente o que está em produção, e o rollback é instalar o pacote da tag anterior;
   - manter um registro simples: data, tag, quem entregou e o resultado do smoke test.
3. **Mesmo jeito de rodar em todo lugar.** Seguir o `Dockerfile` ou o `node server.js` do pacote standalone. O `npm start` (`next start`) não funciona com `output: 'standalone'`.

## 8. Decisões registradas nesta rodada
- **D48 (19/10/2026):** a edição de OP **não está na tela** desde 09/2026 (commit `581c3ba`). Na T35-B decidiu-se **não recriá-la**. A rota `PUT /api/ordens-pagamento/[id]` continua e tem testes. Se a edição voltar a ser pedida, vira uma task própria.
- **D49 (19/10/2026):** sem ambiente de homologação separado. A homologação é o roteiro da seção 4 com dados de teste identificáveis e limpeza pela aplicação, até existir o banco de teste (recomendação 1).
