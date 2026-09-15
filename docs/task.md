- [x] `app/api/auth/login/route.ts`: Remover o mock de login e conectar à tabela `usuarios`.
- [x] `app/api/auth/register/route.ts`: Criar rota de cadastro de novos usuários com perfil `GESTOR` (usuário normal).
- [x] `app/login/page.tsx`: Adicionar formulário de "Criar Conta" (nome e senha).
- [x] `database/database.sql` / `lib/db.ts`: Não alterar estrutura da tabela, contornar salvando o "nome de usuário" na coluna `email` do banco para respeitar a estrutura existente sem precisar de permissão `ALTER`.

# Tarefas - Correção Estrutural OP

- `[x]` Atualizar Backend (`app/api/ordens-pagamento/route.ts`)
  - `[x]` Refatorar `ordemPagamentoSchema` para tratar valores financeiros sem string replacement frágil
  - `[x]` Validar corretamente o array de itens no schema Zod
  - `[x]` Atualizar query `INSERT` para gravar `itens_json`
  - `[x]` Atualizar query `GET` para retornar `itens_json` na listagem/busca de OP
- `[x]` Atualizar Frontend (`app/ordem-pagamento/page.tsx`)
  - `[x]` Garantir que `onSubmit` mande números puros (floats/centavos) para o backend (sanitização de máscara)
  - `[x]` (Opcional) Refatorar tipagem para garantir comunicação limpa
- `[x]` Teste e Validação
  - `[x]` Ajustar (se necessário) script de testes `test_verificacao.js` para o novo formato monetário
  - `[x]` Rodar `test_verificacao.js` para certificar que o fluxo não quebrou.
