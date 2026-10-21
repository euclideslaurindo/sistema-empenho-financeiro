# Revisão aba por aba

Conferência funcional do sistema, uma aba por vez. Para cada aba:

1. **Revisão do código:** o roteiro abaixo e os problemas já encontrados só lendo o código.
2. **Teste logado:** cada item recebe ✅ ou ❌. Para o ❌, um print ou uma descrição curta.
3. **Correção:** cada ❌ é corrigido com um teste automático que reproduz o problema; depois, teste de novo.

> Use **dados de teste identificáveis** (nomes começando com `TESTE`). O banco é compartilhado com outros sistemas.

| # | Aba | Situação |
|---|---|---|
| 1 | Login e Perfil | ✅ testado e corrigido em 20/10/2026 (L1–L6); L7 e L8 ficam para depois |
| 2 | Credores | 🔧 C1–C9 corrigidos em 21/10/2026; falta o teste logado |
| 3 | Notas de Empenho | — |
| 4 | Ordem de Pagamento | — |
| 5 | Consulta / Impressão | — |
| 6 | DARF | — |
| 7 | Configurações (retenções, transporte, elementos) | — |
| 8 | Usuários | — |
| 9 | Dashboard | — |

---

## Aba 1 — Login e Perfil

### Achados da revisão do código (antes do teste)

| # | Achado | Gravidade | Proposta |
|---|---|---|---|
| L1 ✅ corrigido | A troca de senha não tem campo **"confirmar nova senha"**: um erro de digitação deixa o usuário sem conseguir entrar. | 🟠 média | Campo de confirmação, que precisa bater com a nova senha. |
| L2 ✅ corrigido | No login por **nome de usuário**, a busca usa `LIKE 'nome.%'` e pega o primeiro resultado. Com nomes parecidos ("joao" e "joao.silva"), pode pegar o usuário errado e recusar uma senha certa. | 🟠 média (confirmar no teste L-4) | Busca exata pelo nome do usuário. |
| L3 ✅ corrigido | O login responde "Usuário não encontrado" ou "Credenciais inválidas", o que permite descobrir quais usuários existem. | 🟡 baixa | Uma mensagem só: "Usuário ou senha inválidos". |
| L4 ✅ corrigido | O Perfil mostra "Acesso Total: **Nível 1**" para todos (a API não manda esse campo) e não mostra o perfil real (ADMIN/GESTOR/CONSULTA). | 🟡 baixa | Mostrar o perfil real. |
| L5 ✅ corrigido | "Matrícula" sai sempre "-", e "Departamento: Tesouraria" está fixo no código. | 🟡 baixa | Tirar os campos ou buscar do cadastro. |
| L6 ✅ corrigido | "Preferências de Notificação" são só visuais: as caixinhas não salvam nada e o sistema não envia e-mail. | 🟡 baixa | Tirar a seção (ou deixar escrito "em breve"). |
| L7 ⏸ depois | Depois do login, vai sempre para o Dashboard, mesmo que a pessoa tenha tentado abrir outra página. | 🟡 baixa | Voltar para a página que ela tentou abrir. |
| L8 ⏸ depois | Trocar a senha não derruba sessões já abertas em outros computadores (o token vale 8 h). | 🟡 baixa | Registrar como limitação conhecida ou invalidar os tokens antigos. |

### Roteiro de teste (marcar ✅ / ❌)

**Login**
- [ ] **L-1** Login com e-mail e senha certos → abre o Dashboard.
- [ ] **L-2** Senha errada → mensagem de erro e continua na tela de login.
- [ ] **L-3** Login pelo **nome de usuário** (de um usuário criado na aba Usuários) em vez do e-mail → entra.
- [ ] **L-4** Dois usuários de nomes parecidos (ex.: `TESTE joao` e `TESTE joao silva`): cada um entra com a própria senha (achado L2).
- [ ] **L-5** Usuário **desativado** → "Sua conta está desativada".
- [ ] **L-6** Mais de 10 tentativas erradas seguidas → "Muitas tentativas… tente novamente em X segundos".
- [ ] **L-7** Abrir uma página interna (ex.: `/ordem-pagamento`) sem estar logado → vai para o login.
- [ ] **L-8** "Sair" no menu → volta para o login, e o botão Voltar do navegador não reabre o sistema.
- [ ] **L-9** O ícone de olho mostra e esconde a senha.

**Perfil**
- [ ] **P-1** O Perfil mostra o nome, o e-mail e o último acesso corretos.
- [ ] **P-2** Editar o nome e salvar → a mensagem confirma, o nome muda no Perfil e no menu, e continua igual depois de recarregar a página.
- [ ] **P-3** Trocar o e-mail para um que **já existe** → mensagem "Este e-mail já está em uso".
- [ ] **P-4** Trocar a senha (senha atual certa, nova com 8 ou mais caracteres) → sair e entrar com a senha nova funciona.
- [ ] **P-5** Trocar a senha com a **senha atual errada** → mensagem de erro e a senha antiga continua valendo.
- [ ] **P-6** Nova senha com menos de 8 caracteres → mensagem de erro.
- [ ] **P-7** O que aparece em "Nível", "Matrícula", "Departamento" e "Preferências" faz sentido para vocês? (achados L4 a L6)

### Resultado do teste

| Item | ✅/❌ | Observação |
|---|---|---|
| L-1 a L-9 | ✅ | testado pelo usuário em 20/10/2026 |
| P-1 a P-7 | ✅ | testado pelo usuário em 20/10/2026 |

### O que foi corrigido (20/10/2026)
- **L1:** a troca de senha tem o campo "Confirmar Nova Senha". Se for diferente, o campo avisa e o botão Confirmar fica desabilitado; senha com menos de 8 caracteres é recusada antes de enviar.
- **L2:** o login por nome de usuário só aceita o nome **exato** ("joao" não pega mais "joao.silva"). Entre homônimos (mesmo nome), entra quem tiver a senha.
- **L3:** usuário inexistente e senha errada dão a **mesma** mensagem, "Usuário ou senha inválidos". "Conta desativada" só aparece para quem acertou a senha.
- **L4 a L6:** o Perfil mostra o perfil real (Administrador, Gestor ou Consulta). Saíram "Nível 1", "Matrícula", "Departamento: Tesouraria" e as "Preferências de Notificação", que não faziam nada. Título: "Meu Perfil".

**Para você reconferir:** trocar a senha errando a confirmação (o botão fica desabilitado); entrar pelo nome de usuário; ver o perfil correto na tela de Perfil.

---

## Aba 2 — Credores

### Achados da revisão do código (antes do teste)

C1, C2 e C4 foram **reproduzidos com teste automático**. C3 e C5 foram confirmados lendo o schema do banco.

| # | Achado | Gravidade | Proposta |
|---|---|---|---|
| C1 ✅ corrigido | Basta **passar pelo campo CNPJ** (clicar e sair) para o sistema consultar a Receita e **sobrescrever** nome, endereço, CEP e telefone. Isso vale também ao **editar** um credor já cadastrado: o nome corrigido à mão volta a ser a razão social da Receita. | 🟠 média | Consultar só quando o CNPJ mudou e preencher só os campos vazios. Ao editar, perguntar antes de trocar. |
| C2 ✅ corrigido | No **CEP**, quando a consulta volta sem rua (cidades com CEP único), o sistema **apaga** o logradouro e o bairro que já estavam preenchidos. | 🟠 média | Só preencher com o que veio da consulta, sem apagar o que já existe. |
| C3 ✅ corrigido | Um credor **excluído** continua "ocupando" o CPF/CNPJ. Cadastrá-lo de novo dá "Este CPF/CNPJ já está cadastrado", mas ele não aparece na lista nem na busca. A confirmação diz que "pode ser revertida por um administrador", mas não existe tela para isso. | 🟠 média | Ao cadastrar o CPF/CNPJ de um credor excluído, **reativar** o cadastro com os dados novos (sem mudar o banco) e corrigir o texto da confirmação. |
| C4 ✅ corrigido | A busca da tabela consulta o servidor **a cada tecla** e não descarta respostas antigas. Se uma resposta antiga chegar depois, a tabela mostra o resultado de uma busca anterior. | 🟡 baixa | Esperar a pessoa parar de digitar e ignorar respostas antigas. |
| C5 ✅ corrigido | Trocar o **CPF/CNPJ** de um credor que já tem OP: as OPs acompanham a troca, mas o **acompanhamento de DARF** fica com o documento antigo. O mesmo credor aparece em duas linhas no DARF. | 🟡 baixa | Não deixar trocar o CPF/CNPJ de credor com OP; mostrar o motivo. |
| C6 ✅ corrigido | O preenchimento pelo CNPJ põe o CEP **sem máscara** (`51000000` em vez de `51000-000`) e, na consulta reserva, o telefone sem formato. | 🟡 baixa | Aplicar as mesmas máscaras da digitação. |
| C7 ✅ corrigido | O botão do **olho** ("Visualizar Detalhes") só mostra um aviso com o nome: não abre nada. | 🟡 baixa | Tirar o botão (clicar na linha já carrega o credor) ou mostrar os dados de fato. |
| C8 ✅ corrigido | No rodapé, "Termos de Uso", "Política de Privacidade" e "Suporte" parecem links, mas não fazem nada. O Suporte foi retirado do sistema. | 🟡 baixa | Tirar os três. |
| C9 ✅ corrigido | O perfil **Consulta** vê os botões Salvar e Excluir. O servidor bloqueia, mas a pessoa só descobre depois de preencher tudo e clicar. | 🟡 baixa | Desabilitar os botões para o perfil Consulta, com o motivo. |

Não é bug: o aviso "CPF/CNPJ já cadastrado" enquanto se digita só olha os 20 credores da página aberta. O servidor confere todos e recusa a duplicidade com mensagem ao salvar.

### Roteiro de teste (marcar ✅ / ❌)

**Cadastro**
- [ ] **C-1** Cadastrar `TESTE` com CPF válido, nome e município → "Credor salvo com sucesso!", aparece na tabela e o formulário entra em "Modo Edição".
- [ ] **C-2** CPF com dígito errado (ex.: `123.456.789-00`) → "CPF ou CNPJ inválido".
- [ ] **C-3** CPF de um credor que já existe → "já cadastrado" e nada é gravado.
- [ ] **C-4** Digitar um CNPJ real e sair do campo → nome e endereço preenchidos pela Receita.
- [ ] **C-5** Digitar um CEP e sair do campo → rua, bairro, município e UF preenchidos.
- [ ] **C-6** Marcar **MEI** com um CPF → aviso "MEI tem CNPJ" (não impede salvar). O selo MEI aparece na tabela.
- [ ] **C-7** Município (Expediente) de uma cidade sem cadastro de ISS → aviso de taxa R$ 0,00.
- [ ] **C-8** "Limpar" esvazia o formulário e sai do "Modo Edição".

**Edição**
- [ ] **C-9** Clicar num credor da tabela → o formulário carrega todos os campos, incluindo a data de emissão do RG.
- [ ] **C-10** Mudar o telefone e salvar → "Credor atualizado!", e o valor continua depois de recarregar a página.
- [ ] **C-11** Editar um credor **com CNPJ**: mudar o nome, clicar no campo CNPJ e sair, salvar → o nome digitado é mantido e a Receita não é consultada de novo (C1 corrigido).
- [ ] **C-12** Num credor com rua preenchida, digitar o CEP geral de uma cidade pequena (que tem um CEP só para a cidade toda) e sair → a rua e o bairro continuam (C2 corrigido).

**Busca e tabela**
- [ ] **C-13** Buscar por parte do nome → filtra.
- [ ] **C-14** Buscar pelo CPF **só com números** → acha (corrigido no PR #55).
- [ ] **C-15** Com mais de 20 credores: Próxima e Anterior funcionam e mostram "Página X de Y".
- [ ] **C-16** Abrir `/credores?busca=TESTE` → a página já abre filtrada.

**Exclusão**
- [ ] **C-17** Excluir um credor **sem OP** → some da lista.
- [ ] **C-18** Excluir um credor **com OP** → "existem N ordem(ns) de pagamento vinculada(s)" e ele continua.
- [ ] **C-19** Cadastrar de novo o CPF do credor excluído em C-17 → "o cadastro foi reativado" e o credor volta para a lista com os dados novos (C3 corrigido).

**Perfil Consulta**
- [ ] **C-20** Logado como **Consulta**, aparece o aviso "Seu perfil é Consulta" e Salvar/Excluir ficam desabilitados (C9 corrigido).

**Outras correções**
- [ ] **C-21** Num credor **com OP**, trocar o CPF/CNPJ e salvar → "Não é possível trocar o CPF/CNPJ: este credor já tem N ordem(ns)…". Num credor sem OP, a troca funciona (C5).
- [ ] **C-22** Preencher pelo CNPJ → CEP no formato `00000-000` e telefone `(00) 0000-0000` (C6).
- [ ] **C-23** Digitar rápido na busca → a tabela mostra o resultado do texto final (C4).
- [ ] **C-24** A tabela não tem mais o botão do olho, e o rodapé não tem mais Termos, Privacidade e Suporte (C7 e C8).

### Resultado do teste

| Item | ✅/❌ | Observação |
|---|---|---|
| | | |
