# TASK-35 — Tela de Ordem de Pagamento: lista de credores (uma OP por credor)
<!-- milestone: M11 - Ajustes do supervisor (rodada 2) | labels: frontend,ux,op,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 11 Rodada 2 | P1 | ~36 h (32–40 h) | T34, T33, T31 | R20, R21 |

## Objetivo
Trocar o bloco **Favorecido** (um credor só) por uma **lista de credores**, para emitir **várias OPs de uma vez** pela API de lote (T34). Cada credor tem a sua linha com número da OP, valor a pagar, nº do cheque, data do pagamento e a especificação do pagamento (minimizada).

Pedido do supervisor (13/10/2026): *"A partir do trecho FAVORECIDO, exibir como uma listagem para adicionar os credores, de forma que exiba CPF/CNPJ, nome do credor, município de expediente (se for o caso), valor a pagar, nº do cheque. Adicionar também a cada credor a especificação de pagamento (inicialmente minimizada)… Com esta mudança, pode excluir o campo Número da OP e deixar o campo de pesquisa NOTA DE EMPENHO (NE) no lugar. Da mesma forma o campo Nº DO CHEQUE, DATA DO PAGAMENTO."*

## Contexto (estado atual)
- `app/ordem-pagamento/page.tsx` (429 linhas): formulário em **react-hook-form** com um conjunto de campos **na raiz** (`valorPagamento`, `numeroCheque`, `dataPagamento`, `itens[]`, `irrf`, `iss`, `inss`, `sestSenat`, `patronal`, `taxaBancaria`, `taxaPix`…). O submit monta **um** payload e chama `POST /api/ordens-pagamento` (ou `PUT …/[id]` em edição).
- `components/op-form/OpPaymentData.tsx` (503 linhas): no topo — `FaixaNumeroPrevisto` (T13), **Número da OP**, **Data Emissão OP**, **Nº do Cheque**, **Data do Pagamento**, **Nota de Empenho (NE)** (busca com sugestões); depois `SeletorCredorOp` (T17) e o bloco **Favorecido** (CPF/CNPJ, Nome do Credor, RG, endereço, conta, com `buscarCpfSugestoes`/`buscarCredorSugestoes`, que chamam `GET /api/credores?busca=…&limit=8`). `CamposElementoSubelemento` mostra elemento/subelemento **somente leitura**, copiados da NE. **Atenção:** `CamposElementoSubelemento` (~66) e `InputValorPagamento` (~96) são **funções internas, não exportadas**, de `OpPaymentData.tsx`; para reaproveitá-las por linha é preciso extraí-las antes.
- `OpItemsTable.tsx` (itens: Especificação, Quantidade, Unidade, Valor unitário; o total dos itens tem que ser igual ao valor a pagar), `OpTaxesSection.tsx` (Retenções e Descontos, 440 linhas), `lib/retencoes-form.ts` (**funções puras**: recebem valores por parâmetro, não leem o formulário), `OpRecentTable.tsx` (OPs recentes da NE).
- **Quem lê os nomes da raiz do formulário** são os efeitos do `OpTaxesSection`: `AutoCalcEffect` (cálculo local) e `PreviaTransporteEffect` (prévia do servidor), via `useWatch` em `valorPagamento`, `elemento`, `empenho`, `cpfCnpj`, `dataPagamento`, `dataEmissao`, `camposInformados`, `credorMei`, `sobrescreverMei` e `NOMES_FORM`.
- **Prévia hoje (D43):** a prévia do servidor (`POST /api/ordens-pagamento/previa`) só é usada **no 3.3.90.33** (`PreviaTransporteEffect`); nos demais elementos o cálculo é feito **no navegador** (`AutoCalcEffect`).
- O print da tela mostra as seções: Dados do Pagamento · Favorecido · Discriminação de valores/itens · Retenções e Descontos.

## Escopo
### Entra
**1. Parte de cima (dados da emissão)**
- **Sai** o campo "Número da OP". No lugar entra a **pesquisa de Nota de Empenho (NE)**, com as mesmas sugestões de hoje.
- **Saem** do topo "Nº do Cheque" e "Data do Pagamento" (viram colunas por credor).
- **Fica** a **"Data Emissão OP"** (uma só para a emissão) — o supervisor não a citou (D34).
- Ao escolher a NE: Unidade Orçamentária, Gestão, Elemento e Subelemento (somente leitura) e uma **faixa de saldo**: **Valor da NE · Já gasto · Nesta emissão · Restante** (usa `GET /api/notas-empenho/saldo`, T31, mais a soma das linhas da tela).

**2. Lista de credores (substitui `SeletorCredorOp` e o bloco Favorecido)**
- Botão **"Adicionar credor"** com busca por nome ou CPF/CNPJ (mesmos endpoints de autocomplete). Credor já presente na lista não é adicionado de novo.
- Colunas de cada linha: **#** · **CPF/CNPJ** · **Nome** (selo **MEI**) · **Município (Expediente)** (só se houver, ex.: "Canhotinho") · **Valor a pagar** · **Nº do cheque** · **Data do pagamento** · **Nº da OP (previsto)** · ações (**detalhes**, **remover**).
- **Nº da OP previsto** por linha: `NE …/01 · 2026.OP.0012` (somente leitura), vindo de `proximo-numero?quantidade=N`. O número é atribuído **pela posição da linha** (a 1ª linha recebe o 1º número, e assim por diante): ao remover ou reordenar linhas, os números são recalculados pela nova posição (não ficam presos à linha). Se mudar ao salvar, mostrar o aviso que já existe ("o número mudou porque outra OP foi salva antes").
- **Detalhes de cada credor** (painel **minimizado** por padrão, abre ao clicar):
  1. **Especificação do pagamento** = a **tabela de itens** que já existe, mas **por credor** (ex.: Locomoção R$ 50,00 + Alimentação R$ 70,00). Enquanto fechado, mostra um resumo: "2 itens · R$ 120,00". A soma dos itens tem que ser igual ao **valor a pagar** da linha (regra atual).
  2. **Retenções e Descontos** do credor (reaproveita `OpTaxesSection` por linha), incluindo **Taxa bancária** e **Taxa PIX** digitadas por credor. A origem dos valores segue a D43: NE do **3.3.90.33** → prévia do servidor (`previa-lote`); demais elementos → cálculo local da linha.
  3. **Valor líquido** e avisos ("Isento (MEI)", "Município de expediente sem cadastro de ISS").
  4. Dados do credor (RG, endereço, banco/conta/PIX) **somente leitura**, vindos do cadastro.
- **"Valor a pagar"** é o **bruto** (base das retenções).
- Atalho opcional **"Aplicar data a todos"** (copia a data do pagamento da primeira linha para as demais) (D40).

**3. Barra de totais (fixa no rodapé da lista)**
- "**Soma desta emissão R$ X · Restante da NE R$ Y**". Se a soma passar do saldo, a barra fica em alerta e o botão **Emitir** fica desabilitado, com a mensagem "A soma passa do saldo da NE em R$ Z".

**4. Salvar**
- Botão **"Emitir N ordens de pagamento"** → `POST /api/ordens-pagamento/lote` (T34).
- Validação por linha, antes de enviar: valor > 0; **cheque único dentro da lista** (erro inline); itens somando o valor a pagar; credor presente.
- Erros do servidor no formato `credores[i]: …` destacam a **linha i**.
- **Sucesso:** diálogo com a lista das OPs criadas (nº da OP, credor, líquido) e ação **Imprimir** de cada uma (rota de impressão já existente); depois limpa a lista mantendo a NE carregada.

**5. Edição de uma OP existente (OP recente)**
- Continua **individual** (D37): o formulário carrega **uma** linha, com o credor travado (não adiciona nem remove) e salva por `PUT /api/ordens-pagamento/[id]`.

**6. Refatoração (a parte difícil)**
- Extrair `InputValorPagamento` e `CamposElementoSubelemento` de `OpPaymentData.tsx` (hoje internas) para componentes exportados.
- `InputValorPagamento`, `OpItemsTable` e os efeitos do `OpTaxesSection` (`AutoCalcEffect`, `PreviaTransporteEffect` e o resumo de totais) hoje leem **nomes na raiz** do formulário. Passam a receber um `basePath` (ex.: `credores.2`), com **padrão vazio** para o modo de edição continuar igual. `lib/retencoes-form.ts` não precisa de `basePath` (funções puras); no máximo um helper para montar os nomes com prefixo.
- O formulário usa `useFieldArray({ name: "credores" })`, cada item com: `cpfCnpj, nomeCredor, isMei, municipioExpediente, valorPagamento, numeroCheque, dataPagamento, itens[], campos de retenção, camposInformados, taxaBancaria, taxaPix, sobrescreverMei, previa`.
- **Prévia (D43):** se o elemento da NE for **3.3.90.33**, `POST /api/ordens-pagamento/previa-lote` com **debounce** de ~400 ms, enviando **só as linhas que mudaram** (o endpoint aceita qualquer subconjunto e devolve o resultado por índice). Nos demais elementos, o cálculo local (`AutoCalcEffect`) roda **por linha**, sem chamar o servidor.
- O banner MEI e a sobrescrita do ADMIN (T26) passam a ser **por linha**.
- **Remover:** `SeletorCredorOp` (+ teste), a lógica de `credorDaListaNe` e o campo `credoresNe` do formulário (`app/ordem-pagamento/page.tsx` ~88/124/231–233 e `OpPaymentData.tsx` ~32–39, ~168–171 e ~209, que também seleciona sozinho o credor quando a NE tinha um só); `FaixaNumeroPrevisto` vira um selo por linha.

**7. Responsivo e acessível**
- Em tela estreita cada linha vira um **cartão**; painéis com `aria-expanded`; erros ligados ao campo (`aria-describedby`); foco vai para a linha com erro.

### Não entra
- Importar a lista de credores de planilha (backlog).
- Impressão em lote (opcional na T36).
- Alterar as regras de cálculo (motor, T10/T25).

## Especificação técnica
```tsx
const { fields, append, remove } = useFieldArray({ control, name: "credores" });

type CredorLinha = {
  cpfCnpj: string; nomeCredor: string; isMei: boolean; municipioExpediente?: string;
  valorPagamento: string; numeroCheque?: string; dataPagamento?: string;
  itens: ItemOp[]; taxaBancaria?: string; taxaPix?: string;
  irrf?: string; iss?: string; inss?: string; sestSenat?: string; patronal?: string; outrosDescontos?: string;
  sobrescreverMei?: boolean;
  previa?: PreviaLinha;     // vem do servidor, não é digitada
};

// OpTaxesSection({ basePath = "" }) → register(`${basePath}.taxaBancaria`) etc.
```
**Sugestão de entrega em duas PRs (mais uma opcional):**
1. **Refatoração sem mudança visual:** extrair `InputValorPagamento`/`CamposElementoSubelemento` e aplicar `basePath` neles, no `OpItemsTable` e nos efeitos do `OpTaxesSection`; a tela continua com **uma** linha (paridade total com o comportamento atual).
2. **Lista de credores + lote:** colunas, painel de detalhes, barra de totais e o `POST …/lote`. Sai no **mesmo release** de T30, T31 e da parte do lote da T34 (D44).
3. *(Opcional, se a 2 ficar grande)* cartões no celular e acessibilidade.

## Arquivos afetados
- **Alterados:** `app/ordem-pagamento/page.tsx`, `components/op-form/OpPaymentData.tsx`, `OpItemsTable.tsx`, `OpTaxesSection.tsx`, `lib/retencoes-form.ts`, `lib/schemas.ts`
- **Novos:** `components/op-form/CredoresOpLista.tsx`, `CredorOpLinha.tsx`, `CredorOpDetalhes.tsx`, `FaixaSaldoEmissao.tsx`, `NumeroPrevistoSelo.tsx`
- **Removidos:** `components/op-form/SeletorCredorOp.tsx` e `.test.tsx`; ajuste de `FaixaNumeroPrevisto.tsx`
- **Testes:** `components/op-form/*.test.tsx`, `tests/unit/retencoes-form.test.ts`, e2e opcional (Playwright)

## Critérios de aceite
- [ ] O campo "Número da OP" não existe mais; a pesquisa de NE ocupa o lugar dele.
- [ ] "Nº do cheque" e "Data do pagamento" só existem **por credor**.
- [ ] Dá para adicionar 3 credores, cada um com valor, cheque, data e itens próprios.
- [ ] Cada linha mostra o **nº da OP previsto** em sequência.
- [ ] A especificação (itens) de cada credor começa **minimizada** e mostra o resumo "N itens · R$ X".
- [ ] A soma dos itens diferente do valor a pagar impede emitir (como hoje) e destaca a linha.
- [ ] A soma da emissão maior que o saldo da NE **desabilita Emitir** e mostra o excesso.
- [ ] Cheque repetido na lista aparece como erro inline nas duas linhas.
- [ ] Credor MEI mostra o selo e retenções zeradas ("Isento (MEI)").
- [ ] O município de expediente aparece só nos credores que têm; no .33 ele altera o ISS na prévia.
- [ ] Emitir cria N OPs (diálogo de sucesso com os números e links de impressão) e a faixa de saldo se atualiza.
- [ ] Erro do servidor `credores[i]: …` destaca a linha i; **nenhuma** OP é criada em caso de erro.
- [ ] Editar uma OP existente continua funcionando com **uma** linha travada.
- [ ] Em celular a lista vira cartões e é utilizável.
- [ ] `npm run lint:types`, `npm run lint`, `npm test` e `npm run build` verdes.

## Testes
- **Componente:** adicionar/remover credor; duplicado; soma > saldo; cheque duplicado; itens ≠ valor; selo MEI; expansão do painel; resumo dos itens; modo edição.
- **Unitário:** nomes de campo com `basePath`; montagem do payload do lote; renumeração prevista ao remover/reordenar linhas.
- **Componente (D43):** NE do .33 chama `previa-lote` só com as linhas alteradas; NE de outro elemento não chama o servidor.
- **E2E (opcional):** NE → 3 credores → emitir → ver as 3 OPs e o saldo.

## Riscos e observações
- Tela de **maior esforço** da rodada. O `basePath` mexe em componentes que hoje funcionam; a PR 1 (paridade) reduz o risco.
- Com muitos credores (dezenas), manter os painéis fechados e a prévia com debounce; avaliar virtualização só se ficar lento.
- O supervisor não citou a Data Emissão OP nem o botão "Aplicar data a todos": ficam como suposições (D34, D40) para ele confirmar na homologação.

## Decisões em aberto relacionadas
D34 (Data Emissão OP no topo), D35, D37, D40. **Fechadas:** D28, D29, D43 (prévia: servidor só no .33), D44 (mesmo release de T30/T31/T34).
