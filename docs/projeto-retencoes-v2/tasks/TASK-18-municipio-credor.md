# TASK-18 — Município do credor
<!-- milestone: M7 - Município | labels: backend,frontend,credores,P2 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 7 Município | P2 | ~3 h | – | R8 |

## Objetivo
Garantir que o **município** do credor seja salvo, editado, listado e visível nas telas onde o credor aparece.

## Contexto (estado atual)
- A tabela `credores` já tem `cidade` e `uf`; o formulário `app/credores/page.tsx` tem o campo **"Município"** (`credor-cidade`) e o `credor.service.ts` grava `cidade`/`uf` e os devolve no `SELECT`.
- O campo é preenchido automaticamente pelas consultas de CNPJ (`data.municipio`) e CEP (`data.localidade`).
- Não há garantia de que apareça na listagem, na busca/autocomplete da OP, na NE com vários credores ou na impressão.

## Escopo
### Entra
1. **Auditoria ponta a ponta:** criar → listar → editar → reabrir, conferindo que `cidade`/`uf` persistem (inclusive em `PUT /api/credores/[id]`).
2. Corrigir qualquer ponto em que o município se perca (ex.: edição que sobrescreve com vazio).
3. Normalização: `trim` e colapso de espaços; opcionalmente caixa alta/alta-baixa padronizada (definir regra única).
4. Exibir o município:
   - na tabela de credores;
   - nos resultados do autocomplete de credor (OP e NE da T16);
   - nas vias impressas, ao lado do endereço.
5. Teste do preenchimento automático (CNPJ/CEP) sem apagar valor digitado manualmente.

### Não entra
ISS por município (adiado). Tabela de municípios/IBGE.

## Especificação técnica
- Sem migration (coluna existente). Se a conferência no banco real mostrar tamanho insuficiente (`VARCHAR(100)`), tratar em migration separada.
- Validação: máx. 100 caracteres; UF com 2 letras maiúsculas quando informada.

## Arquivos
- **Alterados (conforme a auditoria):** `app/credores/page.tsx`, `lib/services/credor.service.ts`, `app/api/credores/route.ts`, `app/api/credores/[id]/route.ts`, `components/op-form/OpPaymentData.tsx`, `components/consulta-impressao/*`
- **Testes:** `tests/integration/credores.test.ts`, `tests/integration/credores-id.test.ts`

## Critérios de aceite
- [ ] Cadastrar credor com município "Garanhuns/PE" e ver o valor depois de recarregar a página.
- [ ] Editar sem tocar no município **não** o apaga.
- [ ] O município aparece na lista, no autocomplete e na via impressa.
- [ ] Busca por CNPJ preenche o município, sem sobrescrever o que o usuário já digitou.

## Riscos e observações
Se a auditoria não encontrar nenhum defeito, a task se resume a **exibir** o município nos novos pontos e a documentar. Confirmar com o usuário o que ele sentiu falta (D10).

## Decisões em aberto relacionadas
D10.
