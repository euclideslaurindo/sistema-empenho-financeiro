# TASK-13 — Número previsto da OP e do sub-empenho
<!-- milestone: M5 - Número previsto | labels: backend,frontend,op,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 5 Número | P1 | ~5 h | – | R9 |

## Objetivo
Ao cadastrar a OP, mostrar no formulário **qual será** o número: o nº da OP (ex.: `2026.OP.0004`) e se é a **NE …/01** ou **/02**.

## Contexto (estado atual)
Em `OrdemPagamentoService.criar` o servidor calcula, **só no momento de salvar**:
- nº da OP: `MAX(CAST(SUBSTRING_INDEX(numero_empenho,'.',-1) AS UNSIGNED))` entre `numero_empenho LIKE 'ANO.OP.%'`, +1, no formato `ANO.OP.0001` (atenção: a coluna `numero_empenho` guarda o **número da OP**; `numero_ne` guarda a NE);
- sub-empenho: `MAX(CAST(sub AS UNSIGNED))` da mesma NE, +1, com 2 dígitos.
Há retry de até 5 tentativas por causa da `UNIQUE KEY`. A tela não mostra nada disso (a listagem apenas exibe "Parcela /{sub}").

## Escopo
### Entra
1. Extrair o cálculo para uma função compartilhada `calcularProximoNumeroOp(execFn, numeroNe, { travar })` usada por `criar` (com `FOR UPDATE`) e pela previsão (sem travar).
2. `GET /api/ordens-pagamento/proximo-numero?numeroNe=…` (ADMIN/GESTOR).
3. Faixa de destaque no formulário (`OpPaymentData`): **"Esta será a OP 2026.OP.0004 · NE 2026NE000982/02 (previsto)"**, atualizada ao escolher/alterar a NE.
4. `POST /api/ordens-pagamento` passa a devolver `numeroOp` e `sub` **definitivos**; o `toast` de sucesso os exibe.
5. No modo edição, mostrar os números **reais** (sem "previsto").

### Não entra
Renomear colunas (`numero_empenho` fica como está; apenas documentar).

## Especificação técnica
```json
GET /api/ordens-pagamento/proximo-numero?numeroNe=2026NE000982
{ "numeroOp": "2026.OP.0004", "sub": "02", "rotulo": "NE 2026NE000982/02", "previsto": true }
```
- NE inexistente → 404; NE cancelada → 409 (mesmas regras do `criar`).
- Ano = ano corrente do servidor (igual ao `criar`).
- Se o número definitivo for diferente do previsto (outra pessoa salvou antes), o `toast` informa o definitivo.
- Não usar cache.

## Arquivos
- **Novos:** `app/api/ordens-pagamento/proximo-numero/route.ts`, `lib/services/numeracao-op.ts`, `tests/integration/proximo-numero.test.ts`
- **Alterados:** `lib/services/ordem-pagamento.service.ts` (usar a função extraída), `components/op-form/OpPaymentData.tsx`, `app/ordem-pagamento/page.tsx`

## Critérios de aceite
- [ ] NE sem OPs → previsão `/01`; com duas OPs → `/03`.
- [ ] Nº da OP segue a sequência do ano, igual ao que será gravado.
- [ ] Duas OPs salvas em sequência recebem números diferentes e o `toast` mostra o definitivo.
- [ ] Trocar a NE no formulário atualiza a faixa.
- [ ] Em edição, a faixa mostra o número real e não pede previsão.
- [ ] Comportamento do `criar` (retry, `FOR UPDATE`, UNIQUE) permanece idêntico; testes existentes passam.

## Riscos e observações
- É **previsão**, não reserva: nunca bloquear números numa consulta de leitura.
- Em NEs com vários credores (T17), a sequência `/01`, `/02` continua **por NE**, não por credor.

## Decisões em aberto relacionadas
Nenhuma.
