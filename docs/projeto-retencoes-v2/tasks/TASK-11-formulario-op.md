# TASK-11 — Formulário da OP: campos novos e cálculo dirigido pela configuração
<!-- milestone: M4 - Ordem de Pagamento | labels: frontend,op,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 4 OP | P1 | ~10 h | T10 | R1, R2, R3, R5 |

## Objetivo
Fazer a seção **Retenções e Descontos** da OP refletir a configuração do admin e o elemento da NE, incluir **Taxa bancária** e **Taxa PIX** e usar o mesmo motor de cálculo do servidor.

## Contexto (estado atual)
- `components/op-form/OpTaxesSection.tsx`: checkboxes `appliedTax_*` + "Cálculo Automático", inputs desabilitados para quem não é ADMIN, `AutoCalcEffect` com alíquotas fixas e rótulo fixo ("ISS (5%)").
- `app/ordem-pagamento/page.tsx`: `handleNovaOp()` faz `reset` **sem** `appliedTax_patronal` e `appliedTax_sestSenat` (ficam `undefined` e voltam desmarcados depois da primeira OP) e usa `0` numérico onde os defaults usam `""` — **bug existente** que esta task corrige ao eliminar os checkboxes.
- O formulário valida o total de descontos no `onSubmit` e envia `totalDescontos`/`valorLiquido`.

## Escopo
### Entra
1. Hook `useRetencoesConfig()` (busca ao montar e ao voltar o foco; sem cache persistente).
2. Campos desenhados a partir da config (ordem, rótulo com a alíquota atual, ativo/inativo).
3. Impostos que **não se aplicam** ao elemento ficam desabilitados/zerados, com dica "não se aplica a 3.3.90.14".
4. Campos editáveis conforme `editavelOperador` ou perfil ADMIN; os demais ficam somente leitura.
5. Novos inputs **Taxa bancária (expediente)** e **Taxa PIX** (máscara de moeda, vazios por padrão, sempre editáveis a menos que o admin desative).
6. `TaxesTotalSummary` somando todos os descontos, mostrando **Base de cálculo (bruto)**, **Total de descontos** e **Valor líquido**.
7. `AutoCalcEffect` passa a chamar `calcularRetencoes` (client) e recalcula ao mudar valor, elemento ou config.
8. Remover `autoCalculate` e `appliedTax_*`; corrigir `reset`/defaults.
9. Ao salvar, usar os valores devolvidos pelo servidor (se divergirem, avisar: "valores recalculados pelo servidor").

### Não entra
Impressão (T12); número previsto (T13).

## Especificação técnica
- Manter o padrão de **sub-componentes isolados com `useWatch`** (evita re-render do formulário inteiro).
- Debounce de 350 ms já usado no cálculo pode ser mantido.
- Quando o campo não é automático (ex.: ISS digitado), mostrar placeholder e exigir preenchimento no `onSubmit`.
- Mensagens de erro do 422 do servidor exibidas via `toast.error`.
- Acessibilidade: `aria-disabled`, `aria-describedby` para as dicas, rótulos associados.

## Arquivos
- **Alterados:** `components/op-form/OpTaxesSection.tsx`, `components/op-form/OpTaxesSection.test.tsx`, `app/ordem-pagamento/page.tsx`, `lib/schemas.ts` (se houver schema do formulário)
- **Novo:** `hooks/use-retencoes-config.ts` (criado na T07 se já existir)

## Critérios de aceite
- [ ] NE `3.3.90.14`: todos os impostos aparecem desabilitados e zerados.
- [ ] NE `3.3.90.30`: ISS desabilitado; os demais calculados.
- [ ] Rótulo mostra a alíquota vigente (ex.: "IRRF (2%)" depois que o admin mudar).
- [ ] Digitar Taxa bancária 8,50 reduz o líquido em 8,50 e entra no total de descontos.
- [ ] GESTOR sem permissão não consegue editar o campo; com `editavelOperador` consegue.
- [ ] Depois de "Nova OP", o formulário volta ao estado correto (sem os checkboxes quebrados).
- [ ] O cálculo no formulário é idêntico ao do servidor (mesmos 6 casos do README).

## Riscos e observações
Mudanças de config feitas **enquanto** o operador preenche: o servidor é a autoridade; avisar se os valores recalculados mudarem.

## Decisões em aberto relacionadas
D1, D2, D11.
