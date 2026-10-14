# TASK-18 — Município do credor
<!-- milestone: M7 - Município | labels: backend,frontend,credores,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 7 Município | P1 | ~3 h | – | R8, R13 |

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

## Atualização de escopo (decisões de 07/10/2026)
O município deixou de ser só informativo: no **3.3.90.33** ele define o ISS e a **taxa de expediente da prefeitura** (T24/T25). Por isso, além do que está acima:
- **Normalização para comparação:** minúsculas, sem acentos, sem espaços duplicados, sem sufixo de UF (ex.: "Águas Belas/PE" ≡ "aguas belas"), com apelidos conhecidos (ex.: "SBU" → "São Bento do Una").
- Credor com município que **não existe** na tabela de ISS: a OP usa o ISS padrão e **avisa** "município sem cadastro de ISS", em vez de falhar.
- A tela de credores pode oferecer sugestão a partir dos municípios cadastrados na T24 (sem impedir texto livre).
- Passa a ser **P1** (era P2) por influenciar valores de OP.

## Atualização de escopo (rodada 2, 13/10/2026)
O **Município** do cadastro (endereço) e o novo **Município (Expediente)** são coisas diferentes. A taxa de expediente da prefeitura passa a vir **somente** do Município (Expediente) (T33); a `cidade` do endereço **não** é mais usada no cálculo. A normalização e a tabela `iss_municipios` continuam valendo.
