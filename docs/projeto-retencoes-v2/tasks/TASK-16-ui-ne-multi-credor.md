# TASK-16 — Tela da NE: seleção de vários credores e valor bruto
<!-- milestone: M6 - NE com vários credores | labels: frontend,ux,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 6 Multi-credor | P1 | ~14 h | T15 | R7 |

## Objetivo
No cadastro da NE, permitir **selecionar vários credores** e **informar o valor bruto de cada um**, mostrando em tempo real se a soma fecha com o valor da NE.

## Contexto (estado atual)
- `app/notas-empenho/page.tsx` tem um único par de campos `credorNome`/`cpfCnpj` com autocomplete e uma checagem de duplicidade baseada nesses campos.
- Já existem o hook `hooks/use-listbox-keyboard-nav.ts` e `hooks/use-debounce.ts`, usados no autocomplete de credor da OP.
- A listagem de NEs mostra `credorNome`.

## Escopo
### Entra
1. Componente `components/ne-form/NeCredoresField.tsx` com `useFieldArray`:
   - busca de credor (por nome/CPF-CNPJ) usando `/api/credores`;
   - cada credor adicionado vira uma linha: nome, CPF/CNPJ, selo **MEI** (se houver), município, campo **Valor bruto** (máscara de moeda) e botão remover;
   - evita adicionar o mesmo credor duas vezes.
2. **Barra de conferência** fixa abaixo da lista: `Soma dos brutos R$ X · Valor da NE R$ Y · Falta/Sobra R$ Z`, em verde quando a diferença é 0,00 e âmbar/vermelho caso contrário.
3. Botão **Salvar** desabilitado enquanto a soma não fechar (e o servidor valida de novo).
4. Auxílio opcional "Dividir igualmente" (último credor recebe o resto dos centavos).
5. Ao editar NE antiga (um credor), a lista já vem com 1 linha (bruto = valor da NE).
6. Listagem de NEs: coluna de credores com "N credores" e detalhe expansível.
7. Ajustar a checagem de duplicidade para o novo formato (primeiro credor ou conjunto).

### Não entra
Regras de OP (T17).

## Especificação técnica
- Todos os cálculos de soma em **centavos** (`toCents`/`somarCents` da T01).
- Isolar a soma em um sub-componente com `useWatch` (padrão dos bugs 50/51) para não re-renderizar o formulário a cada tecla.
- Se o valor da NE mudar, recalcular a diferença na hora.
- Mensagens e estados vazios claros ("Adicione ao menos um credor").
- Acessibilidade: `role="listbox"`/`aria-activedescendant` no autocomplete, anúncio da diferença com `aria-live="polite"`.

## Arquivos
- **Novo:** `components/ne-form/NeCredoresField.tsx`, `components/ne-form/NeCredoresField.test.tsx`
- **Alterados:** `app/notas-empenho/page.tsx`, `lib/schemas.ts` (schema do formulário da NE: `notaEmpenhoSchema`)

## Critérios de aceite
- [ ] Adicionar 3 credores e informar brutos que somam o valor da NE habilita o **Salvar**.
- [ ] Diferença de R$ 0,01 mantém **Salvar** desabilitado e mostra "Falta/Sobra R$ 0,01".
- [ ] Remover um credor atualiza a soma.
- [ ] Não é possível adicionar o mesmo credor duas vezes.
- [ ] Editar NE com OP já emitida: o credor com OP não pode ser removido e o campo bruto respeita o mínimo (mensagem vinda da API).
- [ ] Teclado: setas/Enter no autocomplete, Tab entre campos, foco devolvido após remover.
- [ ] Lista de NEs exibe "2 credores" e expande os nomes.

## Riscos e observações
Formulário passa a ser mais pesado; testar com 30+ credores (performance dos `useWatch`).

## Decisões em aberto relacionadas
D7.
