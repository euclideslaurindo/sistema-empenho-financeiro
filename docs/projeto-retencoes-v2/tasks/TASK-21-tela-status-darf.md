# TASK-21 — Tela de status da DARF
<!-- milestone: M8 - DARF | labels: frontend,ux,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 8 DARF | P1 | ~12 h | T20 | R6 |

## Objetivo
Tela separada em `/darf` que lista **todos os credores que têm DARF**, com o status de cada uma, filtros por mês e baixa em lote.

## Contexto (estado atual)
- Menu lateral em `components/sidebar.tsx` (array `navItems`); o ícone `Landmark` já é importado.
- Padrão visual de status do projeto: `EMITIDO` azul, `PROCESSANDO` âmbar, `LIQUIDADO/PAGO` verde esmeralda, `CANCELADO` vermelho (classes Tailwind definidas no `contexto_sessao_atual.md`).
- Páginas usam `apiClient`, `sonner`, skeletons e paginação.

## Escopo
### Entra
1. Rota `app/darf/page.tsx` + item "DARF" no menu.
2. **Filtros:** competência (seletor de mês, padrão = mês atual), status (Todos/Pendente/Paga), busca (credor, CPF/CNPJ, NE, OP).
3. **Cartões de resumo:** Pendentes (nº de credores e valor), Pagas (idem), Total do mês.
4. **Tabela** (por OP) e **alternância "Por credor"**: credor, CPF/CNPJ, município, NE/sub, nº da OP, competência, INSS · Patronal · SEST/SENAT, **total da DARF**, status (badge), data de pagamento.
5. **Ações:** selecionar linhas → "Marcar como paga" (modal com data e observação) e "Reabrir"; botões desabilitados para CONSULTA.
6. Link da linha para a impressão da OP.
7. Paginação, skeleton, estado vazio ("Nenhuma DARF neste mês").
8. (Opcional) Exportar CSV do filtro atual.

### Não entra
Gerar a guia da DARF. Card no dashboard (pode ser feito depois; lembrar que o dashboard tem cache de 5 min).

## Especificação técnica
- Badges: `PENDENTE` âmbar (`bg-amber-500/10 text-amber-400 border-amber-500/20`), `PAGA` esmeralda (`bg-emerald-500/10 text-emerald-400 border-emerald-500/20`).
- Seleção em massa só dentro da página atual (com indicador claro); "selecionar todos do filtro" apenas se a API suportar.
- Valores formatados com `formatarBRL`; datas no formato brasileiro.
- Acessibilidade: tabela com `caption`, checkboxes rotulados, modal com `Radix Dialog` (já no projeto), foco preso no modal.
- Atualizar a lista após a baixa sem recarregar a página.

## Arquivos
- **Novos:** `app/darf/page.tsx`, `components/darf/DarfFiltros.tsx`, `components/darf/DarfTabela.tsx`, `components/darf/DarfBaixaModal.tsx`, `components/darf/*.test.tsx`
- **Alterado:** `components/sidebar.tsx`

## Critérios de aceite
- [ ] A tela abre no mês atual e mostra todos os credores com DARF.
- [ ] Alternar para "Por credor" soma as OPs do mesmo credor.
- [ ] Marcar 3 linhas como pagas pede a data, atualiza o status e os cartões de resumo.
- [ ] Reabrir volta para `PENDENTE` e limpa a data.
- [ ] CONSULTA vê tudo, mas sem botões de ação.
- [ ] Filtros por mês/status/busca funcionam em conjunto e com paginação.
- [ ] Acessível por teclado; modal com foco gerenciado.

## Riscos e observações
Quantidade grande de linhas: usar paginação do servidor; evitar carregar tudo.

## Decisões em aberto relacionadas
D5, D6.
