# TASK-30 — Nota de Empenho sem credor: retirar "vários credores" da NE
<!-- milestone: M11 - Ajustes do supervisor (rodada 2) | labels: frontend,backend,ne,financeiro,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 11 Rodada 2 | P1 | ~11 h (10–12 h) | T29 | R17, R18 |

## Objetivo
A NE passa a ser **só o empenho** (número, valor, elemento…): pode ser **salva sem credor** e sem "fechar" o valor. Os credores deixam de ser escolhidos na NE e passam a ser escolhidos **na Ordem de Pagamento** (T34/T35).

Exemplo do supervisor: NE de R$ 100,00 → uma emissão com vários credores gasta R$ 90,00 → **restam R$ 10,00** na NE.

## Contexto (estado atual)
- **Tela da NE** (`app/notas-empenho/page.tsx`): importa `BotaoSalvarNe` e `NeCredoresField` (`components/ne-form/NeCredoresField.tsx`, ~linha 446). O botão Salvar **bloqueia** sem credor e enquanto "Soma dos brutos" ≠ "Valor da NE" (alerta amarelo "Adicione ao menos um credor").
- **Helpers** (`lib/ne-credores.ts`): `diferencaBrutos`, `dividirIgualmente`, `montarPayloadCredores` (usados pela tela da NE e pelo `NeCredoresField`) e `mensagemSomaBrutos` (usado por `validarCredoresPayload`, no serviço da NE). `somenteDigitos` é usado também pelos serviços da NE e da OP e pelo `SeletorCredorOp`.
- **Serviço da NE** (`lib/services/notas-empenho.service.ts`): `credoresPayloadSchema` (`.min(1, 'Informe ao menos um credor.')`), `validarCredoresPayload` (soma dos brutos = valor), `resolverCredoresCadastrados`, `inserirLinhasCredores`, `montarCredoresDaNe`, `anexarCredores` (usado em `listar`/`buscarPorNumero`: devolve `credores` com pago e selo MEI). Tudo vem das T15/T17.
- **Lógica de `ne_credores` dentro de `NotasEmpenhoService.atualizar`** (~394–568), além do `body.credores`:
  - leitura das linhas atuais de `ne_credores` e do pago por credor;
  - `conferirPagos` (409 "O credor … já recebeu OP nesta NE e não pode ser removido" e "O valor bruto do credor … não pode ficar abaixo do que ele já recebeu");
  - 409 "Não é possível alterar os credores de uma NE cancelada";
  - 422 "Esta NE tem vários credores: ao alterar o valor, envie a lista de credores fechando a soma";
  - regravação das colunas legadas `credor_nome`/`cpf_cnpj` a partir do primeiro credor;
  - `DELETE`/`INSERT` em `ne_credores` e `UPDATE ne_credores SET numero_ne = ?` quando o número da NE muda.
- **Schema do formulário** (`lib/schemas.ts`): `notaEmpenhoSchema` tem `credorNome`, `cpfCnpj` e `credores`.
- **Serviço da OP** (`lib/services/ordem-pagamento.service.ts`): `validarSaldoCredor` (~93–133) lê `ne_credores` e devolve **422** "O credor … não pertence à NE" ou "Saldo do credor insuficiente"; é chamada em `criar` e em `atualizar`.
- **Duplicidade:** `NotasEmpenhoService.verificarDuplicidade(valor, credor, subelemento, cpfCnpj)` e a rota `/api/notas-empenho/duplicidade`. No front (`page.tsx` ~160–190) é só um **aviso** com opção de carregar a NE parecida; hoje usa valor + credor + subelemento.
- As colunas `credor_nome` e `cpf_cnpj` de `notas_empenho` já são `NULL` (`migration_05.sql`). A tabela **`ne_credores` fica no banco** (regra: nunca `DROP`).

## Escopo
### Entra
**Frontend da NE**
1. Remover a seção "Credores" (`NeCredoresField`) e a barra "Soma dos brutos … | Valor da NE …".
2. O botão Salvar deixa de depender de credor; valida só o que a NE realmente exige (número, valor, etc.).
3. Tirar `credores`, `credorNome` e `cpfCnpj` do formulário e do payload.
4. Lista de NEs: **sai a coluna "Credores"** (a T31 coloca "Gasto/Restante" no lugar).
5. Abrir uma NE **antiga** para edição não mostra credores, e salvar **não apaga** as linhas de `ne_credores`.

**Backend da NE**
6. `criar` e `atualizar` **ignoram** `credores`, `credorNome` e `cpfCnpj` se vierem (compatibilidade): não gravam em `ne_credores` e, em NE nova, as colunas legadas ficam `NULL`. Em `atualizar`, **sai toda a lógica de `ne_credores` listada no Contexto** (leitura, `conferirPagos`, os 409/422 de credores, a regravação das colunas legadas e o `DELETE`/`INSERT`/`UPDATE` em `ne_credores`); `credor_nome`/`cpf_cnpj` de NEs antigas **não são tocados** pelo `UPDATE`. Consequência aceita: ao renomear uma NE, as linhas antigas de `ne_credores` continuam com o número velho — inofensivo, porque ninguém mais as lê (D36).
7. Remover as regras "ao menos um credor" e "soma dos brutos = valor da NE".
8. `listar` e `buscarPorNumero` **deixam de chamar `anexarCredores`**; a resposta não tem mais `credores`. Os campos `credorNome`/`cpfCnpj` continuam sendo devolvidos (NEs antigas) para consulta e impressão.

**Duplicidade sem credor**
9. Nova regra: **mesmo valor + mesmo elemento + mesmo subelemento (quando informado)**. Continua sendo **apenas aviso** (D33). O front envia `valor`, `elemento` e `subelemento`. O backend ainda aceita os parâmetros antigos (`credor`, `cpfCnpj`), mas não os exige. A consulta deixa de usar `ne_credores`.
9a. **Bug atual (sugestão de corrigir junto — a confirmar):** o botão "Carregar dados da NE …" do aviso preenche só o número, porque `verificarDuplicidade` devolve apenas `numero` e `data_emissao` (que fica nula nas NEs novas). Devolver os campos que `handleLoadDuplicate` usa (`id`, `numero`, `valor`, `elemento`, `subelemento`, `unidadeOrcamentaria`, `gestao`, `historico`, `dataProvisaoConcedida`) e `criadaEm` no lugar de `data_emissao`.

**Ordem de Pagamento (mudança mínima)**
10. Remover as chamadas a `validarSaldoCredor` em `criar` e `atualizar` da OP. Continua valendo o **saldo total da NE** (`saldoDisponivel`). A função e o teste `tests/unit/op-saldo-credor.test.ts` saem (ou ficam marcados como legado). (D36)

**Limpeza**
11. Remover `components/ne-form/NeCredoresField.tsx` e o teste; reduzir `lib/ne-credores.ts` ao que ainda é usado (`somenteDigitos`); ajustar `tests/unit/ne-credores.test.ts`.

### Não entra
- `DROP` de `ne_credores` (nunca) e migração de dados.
- A lista de credores na OP (T35) e a API de emissão em lote (T34).

## Especificação técnica
**Contrato de API (mudanças)**
| Rota | Antes | Depois |
|---|---|---|
| `POST /api/notas-empenho` | `credores` obrigatório no formato novo; soma dos brutos = valor | `credores` ignorado; nenhum credor exigido |
| `PUT /api/notas-empenho/[id]` | `credores` opcional, revalida a soma | `credores` ignorado; `ne_credores` intocada |
| `GET /api/notas-empenho` (e por número) | itens com `credores[]` | itens **sem** `credores`; mantém `credorNome`/`cpfCnpj` legados |
| `GET /api/notas-empenho/duplicidade` | `valor` + `credor`/`cpfCnpj` + `subelemento` | `valor` + `elemento` + `subelemento` (credor opcional) |

```ts
// verificarDuplicidade — nova assinatura
static async verificarDuplicidade(p: {
  valor: string | null; elemento?: string; subelemento?: string;
  credor?: string; cpfCnpj?: string;     // legado, opcional
}) {
  // SELECT id, numero, valor, elemento, subelemento, …, DATE_FORMAT(created_at,'%Y-%m-%d') AS criadaEm FROM notas_empenho
  //  WHERE valor = ? AND (elemento = ? OR ? = '') AND (subelemento = ? OR ? = '') LIMIT 1
}
```

## Arquivos afetados
- **Alterados:** `app/notas-empenho/page.tsx`, `lib/schemas.ts`, `lib/services/notas-empenho.service.ts`, `app/api/notas-empenho/duplicidade/route.ts`, `lib/services/ordem-pagamento.service.ts`, `lib/ne-credores.ts`
- **Removidos:** `components/ne-form/NeCredoresField.tsx` e `NeCredoresField.test.tsx`; `tests/unit/op-saldo-credor.test.ts` (ou marcado como legado)
- **Testes:** `tests/integration/notas-empenho*.test.ts`, `tests/unit/ne-credores.test.ts`, `tests/integration/ordem-pagamento.test.ts`

## Critérios de aceite
- [ ] Salvar uma NE **sem credor** funciona (201) e o botão Salvar não é bloqueado por credor.
- [ ] Salvar uma NE de R$ 100,00 **sem** nenhum vínculo de valor funciona (não há mais "soma dos brutos").
- [ ] A lista de NEs não tem mais a coluna "Credores".
- [ ] Editar e salvar uma NE antiga **não apaga** nada em `ne_credores`.
- [ ] `GET /api/notas-empenho` não devolve `credores`.
- [ ] Criar OP para uma NE que **tem** linhas em `ne_credores` (dados de teste da homologação) **não** dá mais 422 "credor não pertence à NE".
- [ ] O aviso de duplicidade aparece para NE com mesmo valor + elemento + subelemento, sem pedir credor.
- [ ] Nenhuma referência a `NeCredoresField` no código.
- [ ] `npm run lint:types`, `npm run lint`, `npm test` e `npm run build` verdes.

## Testes
- **Integração:** criar NE sem credor; criar com `credores` no payload (ignorado); `GET` sem `credores`; duplicidade com e sem credor; OP em NE com `ne_credores` antiga.
- **Componente:** formulário da NE salva sem credor.
- **Regressão:** cheque duplicado e saldo insuficiente da OP continuam funcionando.

## Riscos e observações
- Nas NEs **novas** `credor_nome`/`cpf_cnpj` ficam `NULL`. Os outros sistemas **não leem** essas colunas da NE (confirmação do usuário em 13/10/2026, D47); nada é removido (nunca `DROP`).
- O formulário da OP (T17) usa `ne.credores` (campo `credoresNe`) para o seletor de credor e para selecionar sozinho o credor quando a NE tinha um só; depois desta task a lista vem vazia. O build **não** quebra e o preenchimento manual do Favorecido (CPF/CNPJ com sugestões do cadastro) continua funcionando, mas o fluxo só faz sentido com a lista de credores da OP. Por isso a T30 sai **no mesmo release** de T31, T34 (lote) e T35 (lista) — D44.
- A regra de duplicidade sem credor pode avisar em NEs legítimas de mesmo valor (por exemplo, repetições mensais); como é só aviso, o usuário continua.

## Decisões em aberto relacionadas
D33 (regra de duplicidade), D36 (`ne_credores` deixa de ser lida/validada). **Fechadas:** D30 (NE sem credor), D44 (mesmo release de T31/T34/T35), D47 (outros sistemas não leem as colunas de credor da NE).

## Implementação (14/10/2026)
- Tela da NE: sem seção de credores e sem a coluna "Credores"; botão Salvar comum (não bloqueia por credor); payload sem `credores`/`credorNome`/`cpfCnpj`.
- `lib/schemas.ts`: sem os campos de credor.
- Serviço da NE: `criar`/`atualizar` ignoram credor; NE nova com `credor_nome`/`cpf_cnpj` NULL; `atualizar` não toca `ne_credores` nem as colunas de credor; `listar`/`buscarPorNumero` sem `credores` (sem consultar `ne_credores`/`credores`); removidas as funções de multi-credor.
- Duplicidade: valor + elemento + subelemento (só aviso), devolvendo os dados da NE; o "Carregar dados da NE" agora preenche o formulário (bug antigo corrigido, item 9a).
- OP: `validarSaldoCredor` removida; vale só o saldo total da NE.
- Limpeza: `NeCredoresField` removido; `lib/ne-credores.ts` só com `somenteDigitos`.
- Testes: `op-saldo-credor.test.ts` e os blocos de credores dos testes de NE reescritos para o comportamento novo; teste novo da rota de duplicidade; tela sem credor e "Carregar dados".
