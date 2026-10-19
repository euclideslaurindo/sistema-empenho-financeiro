# TASK-29 — Nota de Empenho: novo título, sem datas de emissão/pagamento, "Observações" e Subelemento sempre visível
<!-- milestone: M11 - Ajustes do supervisor (rodada 2) | labels: frontend,backend,ne,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 11 Rodada 2 | P1 | ~7 h (6–7 h) | – | R16 |

## Objetivo
Aplicar na tela **Nota de Empenho** os quatro ajustes de interface pedidos pelo supervisor (print de 13/10/2026): trocar o título, tirar as datas de emissão e de pagamento, renomear "Especificação" para "Observações" e deixar o **Subelemento sempre visível**.

## Contexto (estado atual — `main`, commit `caf215e`)
- `app/notas-empenho/page.tsx`
  - título do formulário: "Emissão de Notas de Empenho" (perto da linha 319);
  - campos: Data de Provisão (~418), **Data de Emissão** (~431–443), **Data de Pagamento** (~529) e o rótulo **"Especificação"** (~543, campo `historico`);
  - lista de NEs: cabeçalhos "Número · Data · Quem Atualizou · Especificação · Credores · Valor · Status · Ações"; a coluna **Data** mostra `formatDate(ne.dataPagamento)` (~653);
  - os carregamentos que preenchem `dataPagamento` e `dataEmissao`: `handleLoadDuplicate` (~192–208, "carregar a NE parecida" do aviso de duplicidade), `handleIncluir` (~210–225, limpa o formulário) e a **edição inline no botão "Editar"** da lista (~692–706). **Não existe** uma função `handleEdit`;
  - **alerta de "data passada de 60 dias"** (~117–136, exibido em ~348): calculado a partir da Data de Pagamento;
  - a interface `NotaEmpenho` usada pela tela é **local** (`page.tsx` ~28–46); o tipo de banco é `NotaEmpenhoDB` (`lib/types/db.ts`);
  - `mostrarCampoSubelemento` (~155) só é verdadeiro quando o elemento escolhido **tem subelementos cadastrados** (hoje só o 3.3.90.14, com `.01` e `.03`, em `subelementos_despesa` — `migration_11.sql`) ou quando há um valor legado. Por isso, no print do supervisor (nenhum elemento selecionado), o campo não aparece. A lista de elementos vem de `useElementos()` (`hooks/use-elementos.ts`, tipos `ElementoOption`/`SubelementoOption`).
- `lib/schemas.ts` → `notaEmpenhoSchema.dataPagamento` é **obrigatório** (`min(1, "Data é obrigatória")`); `dataEmissao` é opcional.
- `lib/services/notas-empenho.service.ts` → `criarNotaEmpenhoSchema` já aceita `dataPagamento`/`dataEmissao` como opcionais; `criar` calcula `exercicio` a partir de `dataPagamento` (~364; ano corrente quando falta); `atualizar` grava `data_pagamento = dataPagamento || null` **sem condição** (apaga a data quando o campo não vem) e **não** mexe em `exercicio`; `listar` e `buscarPorNumero` devolvem `dataPagamento` e `dataEmissao`.
- Banco (confirmado no Workbench em 13/10/2026): `data_pagamento`, `data_emissao` e `data_provisao_concedida` aceitam `NULL`; `subelemento` é `VARCHAR(250)`. O campo "Especificação" é a coluna `historico`.
- Os outros sistemas que usam o banco **não leem** `data_pagamento`/`data_emissao` da NE (confirmação do usuário em 13/10/2026 — D47).
- Ordem de Pagamento: já mostra Elemento e Subelemento **somente leitura**, copiados da NE (`CamposElementoSubelemento`, em `components/op-form/OpPaymentData.tsx`). A OP continua lendo o subelemento **da NE** no servidor.

## Escopo
### Entra
1. **Título:** "Emissão de Notas de Empenho" → **"Cadastro de Nota de Empenho"** (título da página; também `document.title`/breadcrumb, se existirem). O nome do item do menu lateral **não muda**.
2. **Remover do formulário** os campos **Data de Emissão** e **Data de Pagamento**. A **Data de Provisão continua** (não foi citada).
3. **Validação:** tirar `dataPagamento` e `dataEmissao` do `notaEmpenhoSchema`. No backend, a API **continua aceitando** os dois campos (compatibilidade), mas a tela não os envia.
4. **Preservar o que já existe:** em `atualizar`, quando `dataPagamento`/`dataEmissao` **não** vierem no payload, o `UPDATE` **não pode apagar** o valor gravado em NEs antigas.
5. **`exercicio` (D42):** numa NE nova, é o **ano dos 4 primeiros caracteres do número da NE** (ex.: `2026NE000123` → `2026`), desde que sejam dígitos entre **2000 e 2099**; senão, o ano da **Data de Provisão**; senão, o ano corrente. Em `atualizar`, o `exercicio` **nunca** é recalculado (hoje já não é).
5a. **Alerta de "data passada de 60 dias"** (ligado à Data de Pagamento): **sai** junto com o campo (D45).
6. **Lista de NEs:** a coluna **Data** passa a mostrar a **data de cadastro** da NE (`created_at`), com o rótulo **"Cadastro"**. A API devolve o novo campo `criadaEm` (`YYYY-MM-DD`). (Suposição D32 — ver README.)
7. **"Especificação" → "Observações"** no formulário (label, `id`, placeholder, mensagens) e no cabeçalho da lista. O campo do payload e a coluna do banco **continuam `historico`** (não se renomeia API nem coluna).
8. **Subelemento sempre visível**, logo abaixo do Elemento:
   - elemento **com lista** cadastrada → `<select>` atual, inclusive a opção "(legado) …" para valores antigos;
   - elemento **sem lista**, ou **nenhum elemento** escolhido → **campo de texto livre, opcional**, `maxLength = 250`, placeholder "Subelemento (opcional)" (decisão D26);
   - trocar o elemento **manualmente** limpa o subelemento (comportamento atual); abrir uma NE para edição **não** limpa;
   - o valor continua indo no campo `subelemento` do payload.

### Não entra
- Remover os credores da NE (T30) e o saldo total/gasto/restante (T31).
- Alterar a **via impressa** da NE (T36).
- Mudar qualquer coluna do banco.

## Especificação técnica
**Componente novo** `components/ne-form/SubelementoCampo.tsx` (extrai a lógica de `mostrarCampoSubelemento`):
```tsx
type Props = {
  elementos: ElementoOption[];       // de useElementos() (hooks/use-elementos.ts, T05)
  elementoAtual: string;             // valor do campo "elemento"
  valor: string;                     // valor do campo "subelemento"
  onChange: (v: string) => void;
};
// lista = elementos.find(e => e.valor === elementoAtual)?.subelementos ?? []
// lista.length > 0  -> <select> (+ opção "(legado) valor" se o valor não estiver na lista)
// lista.length === 0 -> <input type="text" maxLength={250} />
```
**Backend** (`notas-empenho.service.ts`):
```ts
// criar(): exercicio (D42)
const anoDoNumero = /^(20\d{2})/.exec(numero.trim())?.[1];          // 2000–2099
const anoDaProvisao = dataProvisaoConcedida ? dataProvisaoConcedida.substring(0, 4) : null;
const exercicio = anoDoNumero ?? anoDaProvisao ?? String(new Date().getFullYear());

// atualizar(): só inclui as colunas de data no UPDATE se a chave veio no payload
// (padrão já usado nos outros campos); caso contrário, mantém o valor do banco.
```
**Consulta de lista:** acrescentar `DATE_FORMAT(ne.created_at, '%Y-%m-%d') AS criadaEm` em `listar` e em `buscarPorNumero`.

## Arquivos afetados
- **Alterados:** `app/notas-empenho/page.tsx` (inclusive a interface local `NotaEmpenho`: `criadaEm`), `lib/schemas.ts`, `lib/services/notas-empenho.service.ts`, `lib/types/db.ts` (`NotaEmpenhoDB`, se for usado na resposta)
- **Novo:** `components/ne-form/SubelementoCampo.tsx` (+ `SubelementoCampo.test.tsx`)
- **Testes:** `tests/integration/notas-empenho.test.ts`, `tests/integration/notas-empenho-id.test.ts`

## Critérios de aceite
- [ ] O título da tela é "Cadastro de Nota de Empenho".
- [ ] Não existem mais os campos Data de Emissão e Data de Pagamento na tela; Data de Provisão continua.
- [ ] É possível **salvar uma NE sem nenhuma data** (HTTP 201).
- [ ] Editar uma NE **antiga** e salvar **mantém** `data_pagamento` e `data_emissao` do banco.
- [ ] `exercicio` de uma NE nova vem do número da NE (`2026NE…` → 2026); sem ano válido no número, da Data de Provisão; sem ela, do ano corrente (D42).
- [ ] O alerta de "data passada de 60 dias" não existe mais.
- [ ] A lista mostra a coluna "Cadastro" e o cabeçalho "Observações"; o formulário mostra "Observações".
- [ ] O campo Subelemento aparece **antes** de escolher o elemento, como texto livre.
- [ ] Escolher 3.3.90.14 mostra o `<select>` com `.01` e `.03`; escolher 3.3.90.36 mostra texto livre.
- [ ] Trocar de 3.3.90.14 para 3.3.90.36 limpa o subelemento; abrir uma NE antiga com subelemento "(legado)" não perde o valor ao salvar.
- [ ] A Ordem de Pagamento continua mostrando elemento/subelemento da NE.
- [ ] `npm run lint:types`, `npm run lint`, `npm test` e `npm run build` verdes.

## Testes
- **Unitário/componente:** `SubelementoCampo` (com lista, sem lista, legado, troca de elemento).
- **Integração:** criar NE sem datas; criar com datas (compat); `PUT` sem datas preserva as existentes; `exercicio` pelo número da NE, pela Data de Provisão (número sem ano) e pelo ano corrente; `criadaEm` presente.
- **Regressão:** duplicidade e demais campos da NE continuam iguais.

## Riscos e observações
- O banco é **compartilhado**, mas os outros sistemas **não leem** `data_pagamento`/`data_emissao` da NE (confirmação do usuário em 13/10/2026, D47). Nada é removido (nunca `DROP`); as NEs **novas** apenas deixam de ter essas datas preenchidas.
- A via impressa usa as datas **da OP**, não da NE, e `formatDateOnlyBR` já devolve "-" para vazio (ver T36).
- Bug conhecido, fora do escopo desta task: o botão "Carregar dados da NE …" do aviso de duplicidade preenche só o número, porque `verificarDuplicidade` devolve apenas `numero` e `data_emissao` (ver T30).

## Decisões relacionadas
D32 (a coluna "Data" da lista vira data de cadastro). **Fechadas:** D26 (subelemento sempre visível, texto livre), D31 ("Observações" no plural), D42 (`exercicio` pelo número da NE), D45 (o alerta de 60 dias sai), D47 (outros sistemas não leem as datas da NE).

## Implementação (14/10/2026)
- Tela: título "Cadastro de Nota de Empenho"; sem Data de Emissão/Data de Pagamento (formulário, carregamentos e payload); sem o alerta de 60 dias; "Observações" no campo e na lista; coluna "Cadastro" com `criadaEm`.
- `components/ne-form/SubelementoCampo.tsx`: lista quando o elemento tem subelementos (com "(legado) …"), texto livre (máx. 250) nos demais e sem elemento escolhido.
- `lib/schemas.ts`: sem `dataPagamento`/`dataEmissao`.
- Serviço: `exercicio` pela D42 (`/^(20\d{2})/` no número → provisão → ano corrente); o `UPDATE` monta o `SET` por coluna e só inclui `data_pagamento`/`data_emissao` se a chave vier; `criadaEm` em `listar` e `buscarPorNumero`.
- Testes: `SubelementoCampo.test.tsx`, `tests/unit/notas-empenho-page.test.tsx` e casos novos em `notas-empenho*.test.ts`. Os testes do status (PR 0) passaram a ler o `UPDATE` pelo nome da coluna.
