# TASK-22 — Testes de regressão e fechamento de qualidade
<!-- milestone: M9 - Fechamento | labels: testes,qualidade,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 9 Fechamento | P1 | ~12 h | todas | todos |

## Objetivo
Garantir que o conjunto de mudanças está coberto por testes e que **nada do que funcionava deixou de funcionar**.

## Contexto (estado atual)
- Vitest para unitários/integração (`tests/unit`, `tests/integration`), Playwright para e2e (`e2e/`, hoje só login), Testing Library nos componentes. O CI executa `lint:types`, `lint`, `test` e `build`.
- Os testes existentes simulam `conn.execute` por **trecho de SQL**; mudanças de consulta quebram mocks.

## Escopo
### Entra
1. **Matriz de cálculo** parametrizada com os casos A–F do README (por elemento, perfil e flags de edição).
2. **Regressão** dos fluxos existentes: criar NE (um credor), criar OP, editar, excluir, cheque duplicado, saldo insuficiente, status da NE.
3. **Contrato de API**: permissões (401/403), validações Zod (400), conflitos (409), regras financeiras (422).
4. **Componentes**: `OpTaxesSection`, `NeCredoresField`, `DarfTabela`, telas admin.
5. **E2E (Playwright)** com banco de teste: (a) admin altera alíquota → GESTOR vê o novo valor; (b) NE com 2 credores → OPs até o limite; (c) OP com DARF → tela de DARF → marcar como paga.
6. **Teste de concorrência** para número da OP e para o bruto do credor.
7. **Cobertura:** reportar com `npm run test:coverage`; meta de **≥ 90%** em `lib/money.ts`, `lib/retencoes.ts`, `lib/elementos.ts` e `darf.service.ts`.
8. Checklist de regressão manual (homologação) anexado ao PR.

### Não entra
Testes de carga.

## Checklist de regressão manual (homologação)
- [ ] OP de cada elemento da matriz com valores dos casos A–F.
- [ ] OP com taxa bancária e PIX; impressão confere.
- [ ] Mudar IRRF no admin: nova OP muda, OP antiga **não**.
- [ ] Reimprimir OP antiga: mesmos valores de antes.
- [ ] NE antiga (um credor) continua abrindo, editando e gerando OP.
- [ ] NE com 3 credores: brutos fecham, OPs parciais, status da NE correto.
- [ ] DARF: nasce, edita, baixa, bloqueia edição quando paga.
- [ ] Perfis: ADMIN, GESTOR e CONSULTA em cada tela nova.
- [ ] Outro sistema que usa o banco continua lendo/gravando NEs e OPs.

## Arquivos
`tests/**`, `e2e/**`, `playwright.config.ts`, `vitest.config.ts`.

## Critérios de aceite
- [ ] `npm run lint:types`, `npm run lint`, `npm test`, `npm run build` verdes no CI.
- [ ] Cobertura mínima definida atingida nos módulos novos.
- [ ] Zero testes antigos removidos para "passar" (só atualizados com justificativa).
- [ ] Checklist manual preenchido.

## Riscos e observações
Testes e2e exigem banco isolado; usar o `docker-compose.yml` existente ou um schema de teste, **nunca** o `empenho` de produção.

## Decisões em aberto relacionadas
Todas as D que ainda estiverem abertas devem estar resolvidas ou registradas antes de fechar.
