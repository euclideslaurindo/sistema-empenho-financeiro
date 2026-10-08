# TASK-05 — Cascata elemento → subelemento nas telas
<!-- milestone: M2 - Elementos | labels: frontend,ux,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 2 Elementos | P1 | ~6 h | T04 | R10 |

## Objetivo
Trocar as listas fixas por dados da API, com o campo **Subelemento** dependente do **Elemento** escolhido.

## Contexto (estado atual)
- `app/notas-empenho/page.tsx` importa `ELEMENTOS` e `SUBELEMENTOS` de `lib/constants.ts` e usa dois `<select>` independentes (ids `ne-elemento` e `ne-subelemento`).
- Na OP (`OpPaymentData.tsx`) o elemento/subelemento **vêm da NE** selecionada (`setValue("elemento", ne.elemento)`); não há select próprio.
- A tela de NE observa `subelemento` para checar duplicidade (`subelementoWatch`).

## Escopo
### Entra
1. Hook `hooks/use-elementos.ts` (busca única por sessão, estado `loading/erro`, cache em memória).
2. Select de **Elemento** com os ativos (legados identificados como "(legado)" no rótulo).
3. Select de **Subelemento** filtrado pelo elemento; ao trocar o elemento, o subelemento é limpo.
4. Elemento **sem subelementos cadastrados** → campo de subelemento fica opcional/oculto (D9).
5. **Edição de NE antiga**: se o texto gravado não existir na lista (valor legado), ele aparece como opção extra "(legado) texto gravado", para não ser perdido ao salvar.
6. Na OP: exibir elemento e subelemento da NE em campos somente leitura, com o rótulo no mesmo formato.
7. Remover o uso de `ELEMENTOS`/`SUBELEMENTOS` de `lib/constants.ts` (manter o arquivo com `AUTH_COOKIE_NAME`).

### Não entra
Cálculo de retenções (T10/T11).

## Especificação técnica
- Valor gravado continua `"<codigo> - <descricao>"` em `elemento` e `subelemento` (compatível com os outros sistemas).
- **Verificar** se as rotas de NE/OP ainda gravam a coluna legada `elemento_subelemento` (o `contexto_sessao_atual.md` cita `CONCAT(elemento, '.', subelemento)`; no `INSERT` de OP lido em `OrdemPagamentoService.criar` ela não aparece). O que já existe deve ser **mantido como está**; esta task só troca a origem dos valores.
- Acessibilidade: `<label htmlFor>`, `aria-disabled` quando o subelemento depende do elemento, mensagem de erro com `aria-describedby`.
- Reaproveitar o padrão de `useWatch` isolado para não re-renderizar o formulário inteiro (lições dos bugs 50/51).

## Arquivos
- **Novo:** `hooks/use-elementos.ts`
- **Alterados:** `app/notas-empenho/page.tsx`, `components/op-form/OpPaymentData.tsx`, `lib/constants.ts`, `lib/schemas.ts` (se validar elemento), testes que importam `ELEMENTOS` (`tests/integration/notas-empenho.test.ts`)

## Critérios de aceite
- [ ] Ao escolher `3.3.90.14`, o subelemento oferece **só** `.01` e `.03`.
- [ ] Ao trocar de elemento, o subelemento volta para vazio.
- [ ] Editar uma NE antiga com subelemento de texto livre **não perde** o valor.
- [ ] Os 11 elementos aparecem; legados com a marcação.
- [ ] Nenhum import de `ELEMENTOS`/`SUBELEMENTOS` restante.
- [ ] Teclado e leitor de tela funcionam nos dois selects.

## Riscos e observações
- Falha de rede ao buscar elementos: exibir erro e **não** deixar salvar NE sem elemento válido quando o campo for obrigatório.
- Cache do hook deve ser invalidado quando o admin editar elementos (T08).

## Decisões em aberto relacionadas
D9.
