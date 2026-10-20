# Revisão aba por aba

Conferência funcional do sistema, uma aba por vez. Para cada aba:

1. **Revisão do código:** o roteiro abaixo e os problemas já encontrados só lendo o código.
2. **Teste logado:** cada item recebe ✅ ou ❌. Para o ❌, um print ou uma descrição curta.
3. **Correção:** cada ❌ é corrigido com um teste automático que reproduz o problema; depois, teste de novo.

> Use **dados de teste identificáveis** (nomes começando com `TESTE`). O banco é compartilhado com outros sistemas.

| # | Aba | Situação |
|---|---|---|
| 1 | Login e Perfil | ✅ testado e corrigido em 20/10/2026 (L1–L6); L7 e L8 ficam para depois |
| 2 | Credores | — |
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
