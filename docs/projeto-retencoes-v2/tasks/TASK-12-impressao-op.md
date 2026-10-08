# TASK-12 — Impressão da OP dinâmica
<!-- milestone: M4 - Ordem de Pagamento | labels: frontend,impressao,P2 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 4 OP | P2 | ~6 h | T10 | R2 |

## Objetivo
Fazer a via impressa da OP mostrar os rótulos/alíquotas **que foram usados naquela OP**, incluir **Taxa bancária** e **Taxa PIX**, e não ter mais percentuais fixos no layout.

## Contexto (estado atual)
- `components/consulta-impressao/ReciboVia.tsx` tem rótulos fixos: "IRRF (1,5%)", "ISS (5%)", "INSS (11%)", "PATRONAL (20%)", "SEST/SENAT (2,5%)" e "OUTROS / IBS-CBS", além do "Total de Descontos".
- `app/consulta-impressao/page.tsx` monta os dados da via a partir da OP (`op.irrf`, `op.iss`… e `elementoSubelemento` a partir de `op.elemento`/`op.subelemento`).
- As consultas de `OrdemPagamentoService.listar`/`buscarPorNumero` selecionam colunas explícitas.

## Escopo
### Entra
- Selecionar `taxa_bancaria`, `taxa_pix` e `retencoes_snapshot` nas consultas de OP.
- Rótulos lidos do **snapshot** da OP; para OPs antigas (sem snapshot), usar o rótulo do campo **sem percentual** (ou os percentuais históricos fixos de hoje, se o usuário preferir; **perguntar no PR**).
- Linhas novas "Taxa bancária (expediente)" e "Taxa PIX" (aparecem quando maiores que zero ou sempre, conforme decisão de layout).
- Remover impostos que não se aplicam ao elemento da via (ex.: `3.3.90.14` imprime só o líquido).
- Total de descontos coerente com a soma exibida.

### Não entra
Layout de NE com vários credores (T16/T17).

## Especificação técnica
- A impressão **não** busca a config atual: reimprimir uma OP de setembro depois de uma mudança de alíquota deve mostrar o que foi usado em setembro (snapshot).
- Cuidar do CSS de impressão existente (não quebrar a paginação A4).

## Arquivos
- **Alterados:** `components/consulta-impressao/ReciboVia.tsx`, `app/consulta-impressao/page.tsx`, `lib/services/ordem-pagamento.service.ts` (SELECTs), `lib/types/db.ts`

## Critérios de aceite
- [ ] OP nova com IRRF a 2% imprime "IRRF (2%)".
- [ ] OP antiga (sem snapshot) imprime sem erro e com os mesmos valores de antes.
- [ ] Taxa bancária e PIX aparecem na via com os valores corretos.
- [ ] Soma das linhas = "Total de Descontos"; líquido bate com a tela.
- [ ] Elemento `3.3.90.14` não mostra linhas de imposto.

## Riscos e observações
Teste visual de impressão (PDF/papel) é obrigatório: comparar uma via antiga antes/depois.

## Decisões em aberto relacionadas
D11.
