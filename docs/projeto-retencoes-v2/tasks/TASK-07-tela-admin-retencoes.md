# TASK-07 — Tela do admin: Retenções e Descontos
<!-- milestone: M3 - Config admin | labels: frontend,admin,ux,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 3 Config admin | P1 | ~10 h | T06, T01 | R4, R5 |

## Objetivo
Tela exclusiva do perfil **ADMIN** para editar **todos** os campos de *Retenções e Descontos* e a matriz "quais impostos se aplicam a cada elemento". Ao salvar, vale para todos os usuários.

## Contexto (estado atual)
- A página `/configuracoes` (`app/configuracoes/page.tsx`) usa abas (`Tabs`) para perfil/sistema; há texto "Nível: Administrador".
- O `Sidebar` tem um link fixo para `/configuracoes` e o `userProfile` vem do `useAppStore`.
- Não existe hoje nenhum lugar para o admin ajustar alíquotas.

## Escopo
### Entra
Rota `app/configuracoes/retencoes/page.tsx` (e atalho/aba em `/configuracoes` visível só para ADMIN), com:

**Seção 1 — Campos** (uma linha por campo: IRRF, ISS, INSS, Patronal, SEST/SENAT, Outros, Taxa bancária, Taxa PIX)
| Controle | Observação |
|---|---|
| Rótulo | texto curto, exibido no formulário e na impressão |
| Tipo | somente leitura (percentual ou valor digitado) |
| Alíquota (%) | máscara com até 4 casas; desabilitada se o cálculo não for automático |
| Cálculo automático | desmarcar = operador digita o valor (caso do ISS, D1) |
| Editável pelo operador | libera a alteração manual na OP em casos específicos (D2) |
| Entra na DARF | só nos campos tributários |
| Ativo | esconde o campo do formulário |

**Seção 2 — Regras por elemento:** matriz elementos × impostos (checkbox), com selo "legado", e atalhos "marcar linha/coluna". `3.3.90.14` aparece sem nada marcado.

**Seção 3 — Simulador:** escolher elemento, digitar bruto e ver o resultado usando **o mesmo motor** (`lib/retencoes.ts`), com arredondamento da T01. Evita que o admin descubra o erro só numa OP real.

**Salvar:** botão com confirmação mostrando o diff ("IRRF: 1,5% → 2,0%; 3.3.90.30 passa a ter ISS"). Aviso fixo: "Vale para todas as OPs novas. OPs já emitidas não mudam."

### Não entra
CRUD de elementos (T08). Novos campos além dos 8.

## Especificação técnica
- Carregar com `GET /api/configuracoes/retencoes` e `GET /api/elementos`.
- Estado local com `react-hook-form` + `useFieldArray`; detecção de alterações (`isDirty`) e **bloqueio ao sair com alterações não salvas**.
- Guarda de acesso: se `perfil !== 'ADMIN'`, redirecionar com `toast` (e o servidor já devolve 403).
- Seguir o visual existente (cards `rounded-3xl`, tipografia `font-black uppercase tracking-widest`, `sonner` para mensagens, skeleton no carregamento).
- Acessibilidade: tabela com `<th scope>`, checkboxes com `aria-label` ("3.3.90.36 aplica IRRF"), foco visível, navegação por teclado.
- Alíquota digitada em formato brasileiro (`1,5`) e enviada como número (`1.5`).

## Arquivos
- **Novos:** `app/configuracoes/retencoes/page.tsx`, `components/admin/RetencoesCamposTable.tsx`, `components/admin/RetencoesMatriz.tsx`, `components/admin/RetencoesSimulador.tsx`, `hooks/use-retencoes-config.ts`
- **Alterados:** `app/configuracoes/page.tsx` (link/aba ADMIN), `components/sidebar.tsx` (se necessário)
- **Testes:** `components/admin/*.test.tsx`

## Critérios de aceite
- [ ] Usuário GESTOR/CONSULTA não vê o atalho e, ao digitar a URL, é bloqueado.
- [ ] Alterar IRRF de 1,5% para 2% e salvar: a próxima OP de **qualquer** usuário calcula 2%.
- [ ] Desmarcar "cálculo automático" do ISS faz o campo virar digitado no formulário da OP.
- [ ] Marcar "Editável pelo operador" no IRRF permite o GESTOR alterar o valor na OP; desmarcado, não permite.
- [ ] O simulador reproduz exatamente os casos A–F do README.
- [ ] Sair da tela com alterações pendentes pede confirmação.
- [ ] Erro de validação da API aparece junto do campo.

## Riscos e observações
- Tela de alto impacto financeiro: a confirmação com diff é obrigatória, não opcional.
- Se dois admins editarem ao mesmo tempo, tratar o 409 da T06 mostrando "recarregar".

## Decisões em aberto relacionadas
D1, D2, D4.
