# TASK-37 — Rodada 2: testes de regressão, checklist de homologação e deploy
<!-- milestone: M11 - Ajustes do supervisor (rodada 2) | labels: testes,qualidade,deploy,documentacao,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 11 Rodada 2 | P1 | ~10 h | T29–T36, **T28** | R16–R22 |

## Objetivo
Fechar a rodada de ajustes do supervisor: provar que **cada pedido dele funciona**, que **nada que funcionava quebrou**, e colocar em produção na ordem certa.

## Contexto
- O supervisor testou o sistema e pediu mudanças em NE, credores e OP (prints de 13/10/2026).
- O banco é **compartilhado** e as migrations rodam **manualmente** no Workbench (`migration_17` é a nova).
- A T22/T23 são o fechamento da rodada 1; esta task repete o processo para a rodada 2.
- **Depende da T28:** hoje o teste de conformidade com a planilha EJA Campo existe só como um caso dentro de `tests/unit/retencoes-transporte.test.ts`; a T28 o transforma no teste formal que esta task roda com `municipioExpediente`.
- **Release (D44):** T30, T31, T34 (lote) e T35 (lista) saem **juntas**; T32 e T33 podem sair antes (a T33 só depois da `migration_17` no ambiente). O PR 0 da T31 (status da NE) pode sair a qualquer momento.

## Escopo
### Entra
**1. Rastreabilidade: pedido do supervisor → teste**
| Pedido | Como verificar |
|---|---|
| Título "Cadastro de Nota de Empenho" | teste de componente + conferência visual |
| Sem Data de Emissão/Pagamento na NE | salvar NE sem datas (201); NE antiga mantém datas |
| Campo Subelemento na NE | aparece sempre; lista no .14; texto livre nos demais |
| "Observações" no lugar de "Especificação" | formulário e lista |
| Credores fora da NE; NE sem credor | salvar sem credor; API sem `credores` |
| NE parcial com total/gasto/restante | NE 100 + emissão 90 → gasto 90, restante 10 |
| Credores na OP; nº da OP por credor | lote de 3 credores → 3 OPs com números sequenciais |
| Cheque e data do pagamento por credor | duas datas diferentes → duas competências de DARF |
| Especificação por credor (minimizada) | itens por credor; resumo "N itens" |
| Município (Expediente) | credor com Canhotinho no .33 → ISS com R$ 15,20 |
| Sai o campo "Número da OP" | pesquisa de NE no lugar |

**2. Regressão**
- NE: criar/editar/duplicidade/cancelar; OP individual (criar, editar, excluir, cheque duplicado, saldo insuficiente); DARF; retenções por elemento; MEI; **teste de conformidade da planilha EJA Campo (T28)** com `municipioExpediente`.
- Concorrência: duas emissões em lote na mesma NE.

**3. Checklist de homologação manual** (anexar ao PR)
- [ ] NE nova sem datas e sem credor salva; aparece na lista como "Cadastro".
- [ ] NE antiga abre, edita e salva sem perder datas.
- [ ] Subelemento visível em todos os elementos.
- [ ] Emissão de 3 credores numa NE de R$ 100,00 (R$ 90,00): saldo R$ 10,00.
- [ ] Um credor MEI na emissão: retenções zeradas.
- [ ] Um credor com Município (Expediente) no .33: taxa de expediente no ISS.
- [ ] Cheque repetido bloqueia sem criar nada.
- [ ] Soma maior que o saldo bloqueia sem criar nada.
- [ ] OPs impressas com o nº, cheque e data corretos.
- [ ] Tela de DARF com competências corretas.
- [ ] Outro sistema que usa o banco continua lendo NEs e OPs (o usuário confirmou em 13/10/2026 que eles não leem as colunas de data/credor da NE — D47; conferir mesmo assim).
- [ ] Editar uma NE parcial/liquidada/cancelada mantém o status (PR 0 da T31).
- [ ] Editar uma OP antiga (individual) continua funcionando.

**4. Deploy (ordem obrigatória)**
1. Backup do schema `empenho`.
2. Rodar `database/migration_17.sql` em **homologação**; conferir as consultas de verificação (`credores.municipioExpediente` existe; **não** existe `municipio_expediente`; as cinco colunas da NE com `IS_NULLABLE = YES`).
3. Revisão do supervisor na homologação.
4. Rodar a `migration_17` em produção (fora do horário de uso).
5. **Só depois**, deploy do código.
6. Smoke test: login, NE sem credor, emissão em lote de teste, DARF.
7. Comunicar: "credores agora são escolhidos na Ordem de Pagamento"; "novo campo Município (Expediente) no cadastro de credores"; "NE pode ficar com saldo".

**5. Documentação**
- Atualizar `README.md` do repositório (fluxo NE → OP em lote), `docs/projeto-retencoes-v2/README.md` e `ARQUITETURA.md`, `contexto_sessao_atual.md` e `docs/CONTEXTO_PROXIMA_SESSAO.md`.
- Registrar a **numeração real das migrations** (11 a 17) e a mudança de comportamento do ISS/expediente (T33).

**6. Rollback**
- Código: voltar ao release anterior (o código antigo ignora `municipioExpediente`).
- Banco: **não** remover coluna (a `municipioExpediente` nem foi criada pela `migration_17` em produção); qualquer `DROP` só com aprovação explícita.

### Não entra
Mudança de infraestrutura; importação de planilha.

## Arquivos afetados
`tests/**`, `e2e/**`, `README.md`, `docs/**`, `database/migration_17.sql`, `contexto_sessao_atual.md`.

## Critérios de aceite
- [ ] `npm run lint:types`, `npm run lint`, `npm test` e `npm run build` verdes no CI.
- [ ] Todos os pedidos da tabela de rastreabilidade têm teste automatizado ou item no checklist.
- [ ] Checklist de homologação preenchido e aprovado pelo supervisor.
- [ ] `migration_17` aplicada em homologação e depois em produção, **antes** do deploy.
- [ ] Nenhum teste antigo removido só para "passar" (apenas atualizados, com justificativa — ex.: os de `ne_credores`).
- [ ] Documentação atualizada.
- [ ] Nenhum commit/push feito sem o usuário pedir.

## Riscos e observações
- Se o código for para produção **antes** da migration, o cadastro de credores e o cálculo do .33 quebram (coluna inexistente).
- Os testes que dependiam de `ne_credores` (T15/T16/T17) precisam ser **reescritos**, não apagados: o comportamento novo é "NE sem credor + lote".

## Decisões em aberto relacionadas
Todas as D da rodada 2 devem estar fechadas ou registradas antes de produção. **Fechadas em 13/10/2026:** D41 a D47 (ver README, seção 4).
