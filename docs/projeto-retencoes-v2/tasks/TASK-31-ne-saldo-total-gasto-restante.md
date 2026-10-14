# TASK-31 — NE com saldo parcial: valor total, gasto e restante
<!-- milestone: M11 - Ajustes do supervisor (rodada 2) | labels: backend,frontend,ne,financeiro,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 11 Rodada 2 | P1 | ~11 h (10–12 h, inclui o PR 0) | T30 | R18 |

## Objetivo
Permitir que uma NE seja usada **parcialmente** e mostrar, na tela e na lista, **quanto vale, quanto já foi gasto e quanto resta**. Isso substitui a regra antiga "soma dos brutos = valor da NE". De quebra, deixar o **status da NE** sempre coerente com o saldo.

## Contexto (estado atual, conferido no código)
- **O status da NE é recalculado em TRÊS lugares** de `lib/services/ordem-pagamento.service.ts`, cada um com a sua cópia da regra e em ponto flutuante (`Math.round(x*100)/100`):
  - `criar` (~430–432): `saldoRestante <= 0 → LIQUIDADO`, `< valor → PARCIALMENTE PAGO`, senão `EMITIDO`;
  - `atualizar` (~660–681);
  - `excluir` (~730–748).
- **Bug atual (vira o PR 0 desta task):** `NotasEmpenhoService.atualizar` grava `status = body.status || 'EMITIDO'`, e a tela da NE **sempre** envia `status: "EMITIDO"` (`app/notas-empenho/page.tsx` ~252). Resultado: editar e salvar uma NE `PARCIALMENTE PAGO`, `LIQUIDADO` **ou `CANCELADO`** a devolve a `EMITIDO`. Isso também distorce o dashboard (`lib/services/dashboard.service.ts` soma NEs por status).
- **Reduzir o valor da NE abaixo do já gasto já é bloqueado** em `NotasEmpenhoService.atualizar` (~433–444) com **HTTP 409** "Não é possível reduzir o valor da NE para R$ X pois já foram geradas OPs no valor total de R$ Y." — coberto por `tests/integration/notas-empenho-id.test.ts` ("Reduzir valor abaixo do total já pago retorna 409"). **Continua 409 (D46).**
- O "pago" que a NE enxerga hoje vem de `anexarCredores` (por credor), que a T30 remove.
- **"Gasto" = soma do valor a pagar (bruto) das OPs** — decisão confirmada: "valor a pagar" é o bruto, a base das retenções.
- `ExecRows` (`(sql, params) => Promise<any[]>`) existe em `lib/services/numeracao-op.ts`, mas é **privado**: precisa ser exportado (ou movido para um módulo comum) para o helper de saldo usar.
- A tela da NE lista: Número · Data · Quem Atualizou · Especificação · Credores · Valor · Status · Ações.

## Escopo
### Entra
**PR 0 — status da NE na edição (pode sair antes do resto, independente da rodada 2)**
1. `NotasEmpenhoService.atualizar` **deixa de aceitar `status` do payload**: o status passa a ser derivado do saldo (`recalcularStatusNe`) depois do `UPDATE`; uma NE `CANCELADO` continua `CANCELADO` (só o `cancelar` põe e ninguém tira). A tela deixa de enviar `status`.
2. Consulta de **conferência** das NEs já afetadas, para o usuário rodar no Workbench (só leitura), anexada ao PR:
```sql
USE empenho;
-- a) status diferente do que o saldo indica (ignora CANCELADO)
SELECT ne.numero, ne.status, ne.valor, COALESCE(SUM(op.valor_pagamento), 0) AS gasto,
       CASE WHEN COALESCE(SUM(op.valor_pagamento), 0) = 0 THEN 'EMITIDO'
            WHEN COALESCE(SUM(op.valor_pagamento), 0) >= ne.valor THEN 'LIQUIDADO'
            ELSE 'PARCIALMENTE PAGO' END AS status_esperado
  FROM notas_empenho ne
  LEFT JOIN ordens_pagamento op ON op.numero_ne = ne.numero
 WHERE ne.status <> 'CANCELADO'
 GROUP BY ne.id, ne.numero, ne.status, ne.valor
HAVING status_esperado <> ne.status;
-- b) NEs que estavam CANCELADO antes de uma edição e hoje não estão
SELECT ne.numero, ne.status, a.created_at AS editada_em
  FROM auditoria_financeira a
  JOIN notas_empenho ne ON ne.id = a.entidade_id
 WHERE a.entidade = 'notas_empenho' AND a.acao = 'UPDATE'
   AND JSON_UNQUOTE(JSON_EXTRACT(a.dados_anteriores, '$.status')) = 'CANCELADO'
   AND ne.status <> 'CANCELADO';
```
   (Se o `JOIN` da consulta a der "Illegal mix of collations", trocar por duas consultas.) A correção dos dados afetados é decisão do usuário, fora do código.

**Backend**
3. **Helper único** `lib/services/saldo-ne.ts`:
   - `obterSaldoNe(exec, numeroNe)` → `{ valorCents, gastoCents, restanteCents, percentualGasto, qtdOps }`;
   - `agregarSaldos(exec, numeros[])` → mapa por número, com **1 única consulta** (`GROUP BY numero_ne`), para a lista não fazer N consultas;
   - `recalcularStatusNe(conn, numero)` → `EMITIDO` (gasto 0), `PARCIALMENTE PAGO` (0 < gasto < valor) ou `LIQUIDADO` (gasto ≥ valor); **nunca** sobrescreve `CANCELADO`.
4. **Unificar o status:** `criar`, `atualizar` e `excluir` da OP e o `atualizar` da NE passam a chamar `recalcularStatusNe` (dentro da mesma transação), no lugar das três cópias atuais.
5. `listar` e `buscarPorNumero` da NE passam a incluir `saldo: { valor, gasto, restante, percentualGasto, qtdOps }`.
6. Nova rota **`GET /api/notas-empenho/saldo?numero=…`** (leitura, todos os perfis autenticados) com o mesmo formato; usada pela tela de OP (T35).
7. **Reduzir o valor da NE abaixo do gasto continua 409** com a mensagem atual (D46) — só passa a usar o helper em centavos.

**Frontend**
8. **Formulário da NE:** ao abrir uma NE existente, faixa "**Valor da NE · Gasto · Restante**" com barra de progresso (`role="progressbar"`, `aria-valuenow`). Em NE nova: gasto R$ 0,00 e restante = valor digitado (atualiza ao digitar).
9. **Lista de NEs:** a coluna **Credores** (removida na T30) dá lugar a **Gasto** e **Restante** (com mini-barra) e ao selo do status.
10. Valores formatados com `formatarBRL` (centavos inteiros, T01).

### Não entra
- Encerrar ou anular o restante de uma NE (pode virar tarefa futura).
- Reservar saldo por credor.
- Corrigir automaticamente os dados das NEs afetadas pelo bug do status (o PR 0 só entrega a consulta).

## Especificação técnica
```ts
// lib/services/saldo-ne.ts
import type { ExecRows } from '@/lib/services/numeracao-op'; // exportar o tipo
export interface SaldoNe {
  valorCents: number;
  gastoCents: number;      // SUM(valor_pagamento) das OPs da NE (bruto)
  restanteCents: number;   // valor - gasto
  percentualGasto: number; // 0..100, 2 casas
  qtdOps: number;
}
export async function agregarSaldos(exec: ExecRows, numeros: string[]): Promise<Record<string, SaldoNe>> {
  // SELECT ne.numero, ne.valor, COALESCE(SUM(op.valor_pagamento),0) AS gasto, COUNT(op.id) AS qtd
  //   FROM notas_empenho ne LEFT JOIN ordens_pagamento op ON op.numero_ne = ne.numero
  //  WHERE ne.numero IN (?) GROUP BY ne.numero, ne.valor
}
```
- Sempre em **centavos inteiros** (`toCents`/`fromCents`, T01); nada de `valor - pago` em ponto flutuante (hoje o serviço da OP faz `Math.round(x*100)/100`).
- Cuidado com **collation**: `notas_empenho` e `ordens_pagamento` podem ter collations diferentes no banco compartilhado (já aconteceu com `ne_credores`; ver comentário em `anexarCredores`). Se o `JOIN` der erro de collation, usar duas consultas e juntar em memória.

## Arquivos afetados
- **Novos:** `lib/services/saldo-ne.ts`, `app/api/notas-empenho/saldo/route.ts`, `components/ne-form/FaixaSaldoNe.tsx` (+ testes)
- **Alterados:** `lib/services/notas-empenho.service.ts` (status derivado no `atualizar`), `lib/services/ordem-pagamento.service.ts` (`recalcularStatusNe` em `criar`, `atualizar` e `excluir`), `lib/services/numeracao-op.ts` (exportar `ExecRows`), `app/notas-empenho/page.tsx` (não enviar `status`; faixa e colunas)

## Critérios de aceite
- [ ] **PR 0:** editar e salvar uma NE `PARCIALMENTE PAGO`/`LIQUIDADO` mantém o status certo; editar uma NE `CANCELADO` continua `CANCELADO`; a tela não envia mais `status`.
- [ ] **PR 0:** as consultas de conferência estão no PR com o resultado do banco de homologação.
- [ ] NE de R$ 100,00 com uma emissão de R$ 90,00 mostra **gasto R$ 90,00 e restante R$ 10,00**, status "PARCIALMENTE PAGO".
- [ ] NE sem OP mostra gasto R$ 0,00 e status "EMITIDO".
- [ ] NE totalmente gasta mostra restante R$ 0,00 e "LIQUIDADO".
- [ ] Excluir uma OP devolve o saldo e recalcula o status.
- [ ] Reduzir o valor da NE abaixo do gasto continua dando **409** com a mensagem atual (D46).
- [ ] O status da NE só é calculado por `recalcularStatusNe` (nenhuma das três cópias antigas sobra).
- [ ] A lista usa **1 consulta** de agregação (não N+1); com 50 NEs por página continua rápida.
- [ ] Status `CANCELADO` nunca é sobrescrito pelo recálculo.
- [ ] `GET /api/notas-empenho/saldo?numero=…` devolve `404` para NE inexistente.
- [ ] Gerar uma OP maior que o restante continua dando **422** "Saldo insuficiente".

## Testes
- **Unitário:** `agregarSaldos`, `recalcularStatusNe` e `percentualGasto` (0, parcial, 100%, CANCELADO); arredondamento em centavos.
- **Integração:** criar OP → saldo e status; excluir OP → saldo e status; `PUT` da NE com valor menor que o gasto (409); `PUT` da NE parcial/cancelada mantendo o status.
- **Componente:** `FaixaSaldoNe` (valores e barra).

## Riscos e observações
- Se existirem NEs com `valor_pagamento` de OPs **maior** que o valor da NE (dados antigos inconsistentes), o restante ficaria negativo: mostrar em vermelho com o aviso "NE com gasto acima do valor".
- O recálculo de status em `excluir` precisa rodar **dentro da mesma transação** da exclusão.
- NEs já afetadas pelo bug do status (ver consultas do PR 0) continuam erradas até alguém corrigi-las; o saldo mostrado estará certo, o selo de status não.
- **Release:** sai no **mesmo release** de T30, T34 (lote) e T35 (lista) — D44. O PR 0 pode sair antes.

## Decisões relacionadas
**Fechadas:** D28 (gasto = valor a pagar/bruto), D30 (NE pode ficar com saldo), D44 (mesmo release de T30/T34/T35), D46 (redução abaixo do gasto continua 409).

## Implementação (14/10/2026)
- `lib/services/saldo-ne.ts`: `montarSaldo`/`saldoParaResposta` (centavos), `obterSaldoNe` (sem JOIN) e `recalcularStatusNe` (com `FOR UPDATE`; CANCELADO preservado; só grava se mudou). `ExecRows` exportado de `numeracao-op.ts`.
- OP: `criar`, `atualizar` e `excluir` usam `recalcularStatusNe` (as três cópias da regra saíram); saldo comparado em centavos, mesmas mensagens.
- NE: `listar`/`buscarPorNumero` devolvem `saldo` a partir de `gasto`/`qtdOps` acrescentados ao `LEFT JOIN` agregado que já existia — **sem** a consulta extra `agregarSaldos` prevista (mesmo resultado, uma consulta a menos). Redução abaixo do gasto em centavos, ainda 409 (D46).
- Rota `GET /api/notas-empenho/saldo?numero=` (400 sem número, 404 NE inexistente).
- Tela: `FaixaSaldoNe` (Valor · Gasto · Restante, barra acessível, aviso de gasto acima do valor) e colunas Gasto/Restante na lista.
- Testes: `saldo-ne.test.ts`, `op-status-ne.test.ts`, `notas-empenho-saldo.test.ts`, `FaixaSaldoNe.test.tsx` e casos novos na lista e na tela.
