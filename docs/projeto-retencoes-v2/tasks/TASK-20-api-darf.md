# TASK-20 — Serviço e API da DARF
<!-- milestone: M8 - DARF | labels: backend,api,financeiro,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 8 DARF | P1 | ~10 h | T19, T10 | R6 |

## Objetivo
Manter `darf_acompanhamento` **sempre coerente com as OPs** e expor a consulta e a baixa (marcar como paga) por API.

## Contexto (estado atual)
`OrdemPagamentoService.criar/atualizar/excluir` já rodam em transação e já gravam auditoria; é o ponto natural para sincronizar a DARF. A configuração `entra_darf` (T03/T06) define quais campos compõem a DARF.

## Escopo
### Entra
**1. Sincronização (`lib/services/darf.service.ts`)** — `sincronizarDarfDaOp(conn, op)` chamada **dentro da transação** de OP:
- `criar`: calcula `valor_darf = Σ campos com entra_darf` (em centavos); se `> 0`, insere com `PENDENTE`; competência = `data_pagamento` (fallback `data_emissao`) em `YYYY-MM`.
- `atualizar`: recalcula; se a DARF estiver `PENDENTE`, atualiza valor/competência/credor; se **zerou**, remove a linha; se estiver `PAGA` e o valor/competência mudariam → **409** "DARF já paga: reabra o status antes de alterar a OP" (D13).
- `excluir`: remove a linha `PENDENTE`; se `PAGA` → **409** (D13).

**2. Consulta**
- `GET /api/darf?competencia=2026-10&status=PENDENTE&busca=&page=1&limit=50&agrupar=credor|op`
  - `agrupar=op` (padrão): uma linha por OP.
  - `agrupar=credor`: uma linha por credor com a soma e a quantidade de OPs.
  - Devolve `totais`: `{ pendente: { qtd, valor, credores }, paga: { qtd, valor, credores } }` para o filtro aplicado.
- Todos os perfis autenticados podem consultar.

**3. Baixa**
- `POST /api/darf/status` `{ ids: string[], status: 'PAGA'|'PENDENTE', dataPagamento?: 'YYYY-MM-DD', observacao?: string }` (ADMIN e GESTOR).
- `PAGA` exige `dataPagamento` (não futura) e grava `atualizado_por`.
- `PENDENTE` (reabrir) limpa `data_pagamento`.
- Operação em lote **atômica** (transação); auditoria por registro (`entidade = 'darf_acompanhamento'`).

### Não entra
Geração do documento/guia da DARF e integração com a Receita (fora do escopo).

## Especificação técnica
- Valores em centavos; `valor_darf` e `detalhe_json` gravam o que foi usado (snapshot do detalhe).
- Filtro por `busca`: nome do credor, CPF/CNPJ, nº da NE ou nº da OP (usar `LIKE` com prefixo quando possível para aproveitar índice).
- Paginação padrão do projeto (`page`, `limit`, `pagination`).
- `CONSULTA` recebe 403 no `POST`.

## Arquivos
- **Novos:** `lib/services/darf.service.ts`, `app/api/darf/route.ts`, `app/api/darf/status/route.ts`, `tests/integration/darf.test.ts`, `tests/unit/darf-sync.test.ts`
- **Alterados:** `lib/services/ordem-pagamento.service.ts` (chamar a sincronização em `criar`, `atualizar`, `excluir`), `lib/types/db.ts`

## Critérios de aceite
- [ ] Criar OP com INSS/Patronal/SEST → nasce 1 linha `PENDENTE` com a competência correta.
- [ ] OP do elemento `3.3.90.14` (sem DARF) **não** cria linha.
- [ ] Editar o valor da OP com DARF `PENDENTE` atualiza o `valor_darf`.
- [ ] Editar/excluir OP com DARF `PAGA` → 409.
- [ ] Marcar 10 DARFs como pagas de uma vez: tudo ou nada.
- [ ] `agrupar=credor` soma corretamente por credor no mês.
- [ ] `CONSULTA` consulta, mas não altera (403).
- [ ] Falha na sincronização **desfaz** a OP (mesma transação).

## Riscos e observações
- Acoplamento com a transação da OP: testar o rollback.
- Se o admin alterar `entra_darf`, as DARFs já criadas **não** são recalculadas (documentar na tela da T07).

## Decisões em aberto relacionadas
D4, D5, D6, D13.
