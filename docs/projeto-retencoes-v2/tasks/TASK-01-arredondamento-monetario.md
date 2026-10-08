# TASK-01 — Função única de arredondamento monetário
<!-- milestone: M1 - Fundação | labels: backend,frontend,calculo,P0 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 0 Fundação | P0 | ~4 h | – | R1 |

## Objetivo
Criar **uma só** implementação de cálculo com centavos inteiros e a regra: *se o 3º decimal for 5 ou mais, o valor sobe* (9,975 → 9,98). Ela passa a ser usada por todo cálculo de retenção, no formulário e no servidor.

## Contexto (estado atual)
- `OpTaxesSection.tsx` calcula `maskCurrency(vp * 0.015)` e `Math.round(vp * 0.05 * 100) / 100` etc.; o servidor repete a conta em `OrdemPagamentoService.criar` e `atualizar` (bloco `perfil !== 'ADMIN'`).
- `maskCurrency(number)` faz `Math.round(value * 100)`. Com ponto flutuante, 11,00 × 0,015 = 0,165 vira `16.499999999999996` → **0,16** (deveria ser 0,17). Numa varredura de 1,00 a 20.000,00 há **2.030 valores** em que o IRRF 1,5% diverge da regra.
- `lib/utils.ts` já tem `parseFormNumber` e `maskCurrency` (devem continuar com a mesma assinatura).
- `tsconfig` usa `target: es2022`, então `BigInt` está disponível.

## Escopo
### Entra
- Novo arquivo `lib/money.ts` (puro, sem dependência de React/DB).
- Substituir **todos** os cálculos monetários de retenção por essas funções (a troca nos arquivos de OP é concluída nas T10/T11; aqui entra o módulo, os testes e a troca em `lib/utils.ts` se aplicável).
- Testes unitários completos.

### Não entra
- Mudar o formato de exibição (`maskCurrency`) nem dados já gravados.
- Recalcular OPs antigas.

## Especificação técnica
```ts
// lib/money.ts
export type Centavos = number; // inteiro

/** "1.500,00" | "1500.00" | 1500 -> 150000. Usa parseFormNumber e arredonda a entrada (já em 2 casas). */
export function toCents(valor: string | number | null | undefined): Centavos;

/** 150000 -> 1500 (para gravar em DECIMAL) */
export function fromCents(c: Centavos): number;

/**
 * Percentual do valor-base com a regra do 3º decimal.
 * aliquotaPercent: 1.5 (= 1,5%), aceita até 4 casas decimais (ex.: 2.5, 11, 0.8333).
 * floor((base * aliquota4casas + 500_000) / 1_000_000), com BigInt para não estourar 2^53.
 */
export function calcPercentCents(baseCents: Centavos, aliquotaPercent: number | string): Centavos;

/** Para valores que já vieram em ponto flutuante: toFixed(10) remove o ruído binário e aplica a regra do 3º decimal. */
export function arredondarMoeda(valor: number): number;

export function somarCents(...valores: Centavos[]): Centavos;
export function formatarBRL(c: Centavos): string; // "1.500,00"
```
Regras:
- Valores **negativos** não são esperados; `calcPercentCents` lança `RangeError` se `baseCents < 0` ou `aliquota < 0`/`> 100`.
- A regra "olhar o 3º decimal" é equivalente ao meio-para-cima em valores não negativos (9,9749 → 9,97; 9,975 → 9,98).
- Nunca usar `Number.EPSILON` como remendo nos cálculos novos.

## Arquivos
- **Novo:** `lib/money.ts`, `tests/unit/money.test.ts`
- **Revisar (sem trocar ainda):** `lib/utils.ts`, `components/op-form/OpTaxesSection.tsx`, `lib/services/ordem-pagamento.service.ts` (trocas feitas em T10/T11)

## Critérios de aceite
- [ ] `calcPercentCents(66500, 1.5)` = `998` (R$ 9,98).
- [ ] `calcPercentCents(1100, 1.5)` = `17` (R$ 0,17).
- [ ] `calcPercentCents(66500, 2.5)` = `1663` (R$ 16,63).
- [ ] `arredondarMoeda(1.005)` = `1.01` e `arredondarMoeda(2.675)` = `2.68`.
- [ ] Nenhum cálculo novo usa `Math.round(x * 100) / 100` sobre produto de ponto flutuante.
- [ ] Teste de **propriedade**: para centavos de 1 a 2.000.000 e alíquotas {1.5, 2.5, 5, 11, 20}, o resultado é igual a uma implementação de referência com BigInt/strings.
- [ ] `tests/unit/calculos-op.test.ts` (caso "33.333 → 33.33") continua passando.

## Testes (tabela mínima)
| Base | Alíquota | Esperado |
|---:|---:|---:|
| 665,00 | 1,5% | 9,98 |
| 665,00 | 5% | 33,25 |
| 665,00 | 11% | 73,15 |
| 665,00 | 20% | 133,00 |
| 665,00 | 2,5% | 16,63 |
| 11,00 | 1,5% | 0,17 |
| 0,00 | qualquer | 0,00 |
| 0,01 | 1,5% | 0,00 |
| 10.000.000.000,00 | 20% | sem overflow (BigInt) |

## Riscos e observações
- Valores de relatórios antigos podem diferir em centavos dos novos; é esperado e aceito (a regra é nova). Documentar no PR.
- Se o usuário confirmar com a equipe (Henrique) outra regra de casas decimais, só `calcPercentCents` muda.

## Decisões em aberto relacionadas
Nenhuma (regra confirmada: 3º decimal ≥ 5 sobe).
