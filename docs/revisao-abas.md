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
| 3 | Notas de Empenho | 🔧 N1–N11 corrigidos em 21/10/2026; falta o teste logado |
| 4 | Ordem de Pagamento | 🔧 O1–O8 corrigidos em 21/10/2026 (O1 pela opção a); falta o teste logado |
| 5 | Consulta / Impressão | 🔧 I1–I9 corrigidos em 21/10/2026; falta o teste logado |
| 6 | DARF | 🔧 D1–D5 corrigidos em 21/10/2026; falta o teste logado |
| 7 | Configurações (retenções, transporte, elementos) | 🔧 CF1–CF3 corrigidos em 21/10/2026 (CF2 pela opção a); falta o teste logado |
| 8 | Usuários | 🔧 U1–U7 corrigidos em 21/10/2026; falta o teste logado |
| 9 | Dashboard | 🔧 B1–B5 corrigidos em 22/10/2026; falta o teste logado |

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

---

## Aba 3 — Notas de Empenho

### Achados da revisão do código (antes do teste)

N1 a N5 foram **reproduzidos com teste automático**; os outros, confirmados lendo o código. Conferi também, e **estão certos**: o valor ao editar (correção do ×100), a Unidade Orçamentária e a Gestão, que continuam sendo enviadas mesmo com o campo travado, e o bloqueio de OP em NE cancelada.

| # | Achado | Gravidade | Proposta |
|---|---|---|---|
| N1 ✅ corrigido | O botão **Excluir** cancela a NE **na hora, sem pedir confirmação**, e o cancelamento não tem volta: a NE some da edição e não aceita mais OP. O botão diz "Excluir", mas a ação é "cancelar". O cancelamento também não fica registrado na auditoria. | 🟠 média | Pedir confirmação, chamar o botão de "Cancelar NE" e registrar na auditoria quem cancelou e quando. |
| N2 ✅ corrigido | Ao **editar** uma NE, aparece "Possível Duplicação de Valores" apontando para **a própria NE**. NEs canceladas também entram no aviso. | 🟠 média | Tirar do aviso a própria NE e as canceladas. |
| N3 ✅ corrigido | Uma NE **parcialmente paga** aparece com o selo **"A PAGAR"**, igual a uma NE sem nenhuma OP. | 🟡 baixa | Selo próprio: "PARCIAL". |
| N4 ✅ corrigido | Depois de **salvar ou cancelar**, a lista volta para a página 1 **sem o filtro**, mas a caixa de busca continua com o texto e o contador de página fica errado. | 🟡 baixa | Recarregar a mesma busca e a mesma página. |
| N5 ✅ corrigido | A busca consulta o servidor a cada tecla e não descarta respostas antigas: a lista pode mostrar o resultado de uma busca anterior. Fora da página 1, cada tecla faz duas consultas. | 🟡 baixa | Mesmo ajuste da aba Credores: esperar a digitação e ignorar respostas antigas. |
| N6 ✅ corrigido | Trocar o **número** de uma NE que já tem OP: as OPs acompanham, mas o **acompanhamento de DARF** fica com o número antigo. | 🟡 baixa | Atualizar também o DARF na mesma operação (só os dados, sem mudar o banco). |
| N7 ✅ corrigido | O perfil **Consulta** vê os botões Salvar e Excluir. O servidor bloqueia, mas a pessoa só descobre ao clicar. | 🟡 baixa | Aviso na tela e botões desabilitados, como na aba Credores. |
| N8 ✅ corrigido | No rodapé, "Privacidade", "Termos de Uso" e "Suporte Técnico" parecem links, mas não fazem nada. | 🟡 baixa | Tirar os três. |
| N9 ✅ corrigido | Clicar numa linha da tabela só a destaca; para editar, é preciso clicar no lápis. Na aba Credores, clicar na linha já abre o cadastro. | 🟡 baixa | Clicar na linha abre a NE para edição, como em Credores. |
| N10 ✅ corrigido | Pela API, editar uma NE **sem número** grava a NE com o número vazio (a tela não deixa, mas o servidor não confere). | 🟡 baixa | Validar o número no servidor também. |
| N11 ✅ corrigido | A mensagem "Não é possível reduzir o valor da NE…" mostra os valores no formato americano (`R$ 100.00`). | 🟡 baixa | Formato brasileiro (`R$ 100,00`). |

### Roteiro de teste (marcar ✅ / ❌)

**Cadastro**
- [ ] **N-1** Cadastrar uma NE `TESTE` com número, valor, elemento e subelemento → "NE cadastrada com sucesso!" e ela aparece no topo da lista com a data de hoje em "Cadastro".
- [ ] **N-2** Cadastrar com um número que já existe → "já está cadastrada" e nada é gravado.
- [ ] **N-3** Valor zero ou vazio → erro no campo Valor.
- [ ] **N-4** Trocar o elemento → o subelemento é limpo e a lista de subelementos muda.
- [ ] **N-5** Digitar valor, elemento e subelemento iguais aos de outra NE → aviso "Possível Duplicação". O botão "Carregar dados da NE…" abre a outra NE em modo edição.

**Edição**
- [ ] **N-6** Clicar no lápis de uma NE → os campos carregam, incluindo o valor no formato `1.234,56` e a Data de Provisão.
- [ ] **N-7** Salvar sem mexer em nada → o valor continua o mesmo (correção do ×100, PR #55).
- [ ] **N-8** Ao editar uma NE, o aviso de duplicidade **não** aponta para a própria NE (N2 corrigido).
- [ ] **N-9** Numa NE com OP, reduzir o valor para menos do que já foi gasto → "Não é possível reduzir…".
- [ ] **N-10** A faixa de saldo mostra valor, gasto e restante corretos de uma NE com OP.

**Lista e busca**
- [ ] **N-11** Buscar por parte do número → filtra. Com busca ativa, editar e salvar uma NE → a lista continua filtrada e na mesma página (N4 corrigido).
- [ ] **N-12** Anterior e Próxima funcionam e mostram "Página X de Y".
- [ ] **N-13** Os selos: NE sem OP = "A PAGAR"; NE paga em parte = "PARCIAL" (N3 corrigido); NE paga toda = "PAGO"; cancelada = "CANCELADO" e riscada.
- [ ] **N-14** As colunas Valor, Gasto e Restante batem com as OPs da NE.

**Cancelamento**
- [ ] **N-15** Abrir uma NE **sem OP** e clicar em "Cancelar NE" → pede confirmação. "Voltar" não cancela; confirmando, ela fica CANCELADA (N1 corrigido).
- [ ] **N-16** Numa NE **com OP**, clicar em "Cancelar NE" e confirmar → "existem N ordem(ns) de pagamento vinculada(s)" e nada muda.
- [ ] **N-17** Uma NE cancelada não tem lápis de edição e não aceita OP nova.

**Perfil Consulta**
- [ ] **N-18** Logado como **Consulta**, aparece o aviso "Seu perfil é Consulta" e Salvar/Cancelar NE ficam desabilitados (N7 corrigido).

**Outras correções**
- [ ] **N-19** Clicar numa linha da tabela (fora do lápis) → a NE abre em "Modo Edição". Numa NE cancelada, nada acontece (N9).
- [ ] **N-20** Numa NE com OP e com DARF no acompanhamento, trocar o número da NE e salvar → na aba DARF, a NE aparece com o número novo (N6).
- [ ] **N-21** Reduzir o valor abaixo do gasto → a mensagem mostra os valores como `R$ 1.234,56` (N11).

### Resultado do teste

| Item | ✅/❌ | Observação |
|---|---|---|
| | | |

---

## Aba 4 — Ordem de Pagamento

### Achados da revisão do código (antes do teste)

A emissão em lote (cálculo, saldo, numeração, cheques, prévia do transporte e DARF) foi revisada nas rodadas 1 e 2 e está coerente: o servidor recalcula tudo, trava a NE durante a emissão e desfaz o lote inteiro se uma linha falhar. Os achados abaixo são do que fica **em volta** da emissão.

| # | Achado | Gravidade | Proposta |
|---|---|---|---|
| O1 ✅ corrigido | **Não existe tela para excluir (estornar) uma OP.** A API existe e devolve o saldo à NE, mas nenhuma tela a chama. Uma OP emitida com valor ou credor errado não tem como ser desfeita pelo sistema. A NE dessa OP também não pode ser cancelada, e a mensagem de cancelamento manda "Exclua as OPs primeiro". A limpeza dos dados de teste da homologação também depende disso. | 🟠 média | **Decisão sua:** (a) botão "Excluir OP" na tabela de OPs recentes, com confirmação e motivo, só para ADMIN, recusando OP com DARF paga (a API já recusa); ou (b) deixar sem tela e corrigir a mensagem da NE. |
| O2 ✅ corrigido | A rota de criação de OP individual grava no log do servidor **o pedido inteiro** (CPF/CNPJ, valores, itens) a cada OP. | 🟡 baixa | Tirar o `console.log`. |
| O3 ✅ corrigido | Pela API, uma OP pode ser gravada com **descontos maiores que o valor bruto** (líquido negativo). A tela não deixa, mas o servidor não confere. | 🟡 baixa | O servidor recusa líquido negativo. |
| O4 ✅ corrigido | Pela API, um valor em texto no formato brasileiro (`"1.234,56"`) é lido como **R$ 1,23**. A tela manda número, então hoje não acontece pela tela. | 🟡 baixa | Usar a mesma leitura de valores da NE (correção do ×100). |
| O5 ✅ corrigido | O perfil **Consulta** vê "Emitir" habilitado; o servidor bloqueia só no envio. Até o perfil carregar, a tela trata todo mundo como Gestor: um Admin perde, nesses instantes, a opção de reter em credor MEI. | 🟡 baixa | Aviso e botão desabilitado para Consulta, com o perfil vindo do login (como nas abas 2 e 3). |
| O6 ✅ corrigido | **"Nova emissão"** descarta a lista de credores preenchida **sem pedir confirmação**. "Limpar lista" pede. | 🟡 baixa | Pedir confirmação quando houver credores na lista. |
| O7 ✅ corrigido | Na tabela de **OPs recentes**: o número sai sem a sub (`000123` em vez de `000123 /1`); a coluna "Data Pgto" fica quase sempre vazia, porque a data do pagamento é opcional; não dá para buscar pelo número da NE, embora ela apareça na tabela. A busca também pode mostrar resultado de uma busca antiga, como nas abas 2 e 3. | 🟡 baixa | Número com a sub, coluna "Emissão", busca também pela NE e descarte de respostas antigas. |
| O8 ✅ corrigido | Mensagens do servidor: itens que não batem com o valor terminam em **"Fraude detectada."**, e alguns valores saem em formato americano (`R$ 100.00`) ou sem ponto de milhar. | 🟡 baixa | Texto neutro ("Confira os itens") e valores no formato `R$ 1.234,56`. |

### Roteiro de teste (marcar ✅ / ❌)

**NE e credores**
- [ ] **O-1** Buscar a NE pelo número (sugestões aparecem a partir de 2 caracteres) e carregar → Unidade, Gestão, Elemento e Subelemento preenchidos e travados; a faixa mostra o saldo da NE.
- [ ] **O-2** Carregar uma NE **cancelada** → "A NE … está CANCELADA" e nada é carregado.
- [ ] **O-3** Adicionar um credor pelo nome e outro pelo CPF só com números → os dois entram na lista, cada um com o número de OP previsto.
- [ ] **O-4** Adicionar o mesmo credor duas vezes → "já está nesta emissão".
- [ ] **O-5** Com credores na lista, trocar de NE → pede confirmação. "Manter a NE atual" mantém tudo.

**Valores e retenções**
- [ ] **O-6** Valor a pagar em cada credor → o líquido da linha e a soma da barra acompanham.
- [ ] **O-7** Soma acima do saldo da NE → a barra fica vermelha e "Emitir" desabilita.
- [ ] **O-8** Abrir "Detalhes" → itens e retenções. Itens com soma diferente do valor → o erro aparece ao emitir.
- [ ] **O-9** Credor MEI → sem retenções; como Admin, a opção de liberar a retenção manual aparece.
- [ ] **O-10** NE do elemento 3.3.90.33 (transporte) → as retenções são calculadas pela prévia do servidor e aparecem na linha.
- [ ] **O-11** Mesmo número de cheque em dois credores → erro nas duas linhas.
- [ ] **O-12** "Aplicar data do 1º a todos" copia a data do pagamento.

**Emissão**
- [ ] **O-13** Emitir 2 credores → diálogo com as 2 OPs, número/sub, bruto e líquido; "Imprimir esta emissão" abre a consulta só com elas.
- [ ] **O-14** Depois de emitir, a lista esvazia, a NE continua carregada e o saldo diminui.
- [ ] **O-15** As OPs novas aparecem em "Ordens Recentes".
- [ ] **O-16** Na aba DARF, as retenções das OPs novas aparecem como pendentes.

**Outros**
- [ ] **O-17** Preencher credores e clicar em "Nova emissão" → pede confirmação; "Continuar esta emissão" mantém tudo (O6).
- [ ] **O-18** Logado como **Consulta** → aviso "Seu perfil é Consulta" e "Emitir" desabilitado (O5).
- [ ] **O-19** Logado como **Admin**, em "Ordens Recentes", clicar na lixeira de uma OP de teste → pede o motivo (mínimo 5 letras); confirmando, a OP some, o saldo da NE volta e as retenções pendentes saem da DARF (O1).
- [ ] **O-20** Como **Gestor**, a lixeira não aparece (O1).
- [ ] **O-21** Tentar excluir uma OP cuja DARF já foi paga → mensagem de erro e a OP continua (O1).
- [ ] **O-22** Em "Ordens Recentes", o número aparece com a sub, há as colunas Emissão e Pagamento, e a busca acha pelo número da NE (O7).

### Resultado do teste

| Item | ✅/❌ | Observação |
|---|---|---|
| | | |

---

## Aba 5 — Consulta / Impressão

### Achados da revisão do código (antes do teste)

I1 a I5 foram **reproduzidos com teste automático** (OP com dados de teste, documento gerado e conferido). Os outros foram confirmados lendo o código.

| # | Achado | Gravidade | Proposta |
|---|---|---|---|
| I1 ✅ corrigido | OP **sem cheque** sai no recibo com um **número de cheque inventado**: `040496`, `040497`… (um por documento). O documento em branco também sai com `040496`. | 🟠 média | Deixar o campo em branco quando a OP não tem cheque. |
| I2 ✅ corrigido | A **data do pagamento** da OP não é impressa: o campo "DEDUZIDO DA DOTAÇÃO PRÓPRIA / LIQUIDADO / PAGO — DATA" sai sempre vazio, mesmo com a data preenchida na OP. | 🟠 média | Preencher com a data do pagamento da OP. |
| I3 ✅ corrigido | "PROVISÃO CONCEDIDA — Data" sai com a **data de emissão da OP**, e não com a **Data de Provisão** cadastrada na NE. | 🟠 média | Usar a Data de Provisão da NE. |
| I4 ✅ corrigido | Na **Impressão em Lote**, editar um campo em um documento muda **todos os documentos** do lote: corrigir o nome de um credor troca o nome em todas as OPs. Número da NE e número do cheque editados viram uma sequência (o 2º documento ganha +1, o 3º +2…). Isso vem de quando o lote era de parcelas do mesmo credor; desde a rodada 2, cada OP é de um credor. | 🟠 média | Editar só o documento em que se mexeu, como já acontece na Consulta Individual. |
| I5 ✅ corrigido | O total de cada **item** é calculado e impresso com **3 casas** em alguns casos (ex.: 1,5 × 10,33 sai `15,495`). | 🟡 baixa | Mesma conta da OP: arredondar em centavos e imprimir com 2 casas. |
| I6 ✅ corrigido | "**Baixar PDF**" só abre a janela de impressão, igual ao "Imprimir". A tela também carrega duas bibliotecas de PDF/imagem que não usa. | 🟡 baixa | Um botão só, "Imprimir / Salvar em PDF", com a dica de escolher "Salvar como PDF" na janela; tirar as bibliotecas sem uso. |
| I7 ✅ corrigido | "**Gerar Documento em Branco**" com OPs marcadas na lista gera as **OPs**, e não um documento em branco. | 🟡 baixa | O botão gera sempre o documento em branco. |
| I8 ✅ corrigido | Janela "**Consultar NE**": diz que pesquisa por CPF/CNPJ e credor, mas só pesquisa pelo número da NE; mostra sempre "Credor: -" e repete o número em "Empenho"; quando não acha nada, fica "Carregando NEs do banco..." para sempre. | 🟡 baixa | Texto certo ("Pesquisar pelo número da NE"), tirar as linhas vazias, mostrar "Nenhuma NE encontrada" e ignorar respostas antigas. |
| I9 ✅ corrigido | Valor por extenso: milhões exatos saem "um milhão **reais**" (falta o "de") e o zero sai só "zero". | 🟡 baixa | "um milhão de reais" e "zero real". |

### Roteiro de teste (marcar ✅ / ❌)

**Consulta Individual**
- [ ] **I-1** Digitar o número da NE e clicar em Consultar → lista as OPs da NE, todas marcadas.
- [ ] **I-2** Pela lupa, abrir "Consultar NE" e escolher uma NE → o número vai para o campo.
- [ ] **I-3** Pelo "Imprimir esta emissão" da tela de OP → abre com só as OPs da emissão marcadas.
- [ ] **I-4** Gerar com 2 OPs → um par frente/verso por OP, cada um com o seu credor, CPF/CNPJ, valor bruto, descontos e líquido.
- [ ] **I-5** OP **sem cheque** → no recibo, o número do cheque fica em branco (I1 corrigido).
- [ ] **I-6** OP **com data de pagamento** → a data aparece em "DEDUZIDO… / PAGO — DATA" (I2 corrigido).
- [ ] **I-7** "PROVISÃO CONCEDIDA — Data" é a Data de Provisão da NE (I3 corrigido).
- [ ] **I-8** Itens da OP: especificação, unidade, quantidade, valor unitário e total batem com a OP, com 2 casas (achado I5).
- [ ] **I-9** Valor por extenso no recibo bate com o líquido.
- [ ] **I-10** "Editar Valores" → mudar um campo de um documento muda só aquele documento.

**Impressão em Lote**
- [ ] **I-11** NE com 3 OPs → "Buscar parcelas" → gerar o lote.
- [ ] **I-12** Editar o nome do credor no 1º documento → os outros documentos continuam com os nomes deles (I4 corrigido).

**Impressão**
- [ ] **I-13** "Apenas Frente", "Apenas Verso" e "Frente e Verso" → a impressão sai só com o que foi escolhido, uma página por via.
- [ ] **I-14** Imprimir e salvar em PDF pela janela do navegador → o PDF sai em A4, sem cortar.
- [ ] **I-15** "Gerar Documento em Branco" com OPs marcadas → gera só um documento em branco, sem cheque inventado (I7 corrigido).
- [ ] **I-16** Só há um botão de saída, "Imprimir / Salvar PDF"; na janela, "Salvar como PDF" gera o arquivo (I6).
- [ ] **I-17** Janela "Consultar NE": pesquisar por parte do número acha; um número que não existe mostra "Nenhuma NE encontrada" (I8).
- [ ] **I-18** Uma OP de R$ 1.000.000,00 sai por extenso "um milhão de reais" (I9).

### Resultado do teste

| Item | ✅/❌ | Observação |
|---|---|---|
| | | |

---

## Aba 6 — DARF

### Achados da revisão do código (antes do teste)

A base da aba está sólida:
- a DARF nasce e muda junto com a OP, na mesma transação;
- DARF paga trava a edição e a exclusão da OP;
- a baixa é atômica (ou todas as DARFs selecionadas mudam, ou nenhuma) e cada mudança vai para a auditoria;
- a data de pagamento não pode ser futura;
- só Admin e Gestor alteram o status.

Os achados são de uso.

| # | Achado | Gravidade | Proposta |
|---|---|---|---|
| D1 ✅ corrigido | Com uma seleção **misturada**, "Marcar como paga" também regrava as DARFs **já pagas**: a data de pagamento e a observação delas são trocadas sem aviso. "Reabrir" conta como "reabertas" também as que já estavam pendentes. | 🟠 média | Cada botão age só nas DARFs do status certo e mostra quantas são ("Marcar como paga (3)"). O servidor recusa DARF que já está no status pedido. |
| D2 ✅ corrigido | A tabela tem colunas fixas para **INSS, Patronal e SEST/SENAT**. Se o admin incluir IRRF ou ISS na DARF (Configurações permite), o **Total** passa a somar um valor que não aparece em nenhuma coluna. | 🟡 baixa | Mostrar uma coluna para cada retenção que entra na DARF nas linhas da página. |
| D3 ✅ corrigido | Busca: **CPF/CNPJ só com números** não acha o credor (o cadastro guarda com pontuação), e o **número da OP** só é achado pelo começo (`0012` não acha `2026.OP.0012`). | 🟡 baixa | Mesmo ajuste da aba Credores: comparar também só os dígitos e procurar a OP por qualquer trecho. |
| D4 ✅ corrigido | O número da OP na tabela abre a impressão com **todas** as OPs da NE marcadas, e não só aquela. | 🟡 baixa | Abrir já com só a OP da linha marcada (`?ops=`). |
| D5 ✅ corrigido | Textos fixos: "**Nenhuma DARF neste mês.**" aparece mesmo sem competência escolhida ou quando o vazio é por causa da busca/status; o card diz "**Total do mês**" também com todas as competências. | 🟡 baixa | Texto conforme o filtro ("Nenhuma DARF encontrada com estes filtros"; "Total" sem competência). |

### Roteiro de teste (marcar ✅ / ❌)

**Consulta**
- [ ] **D-1** Abrir a aba → competência do mês atual; os cards Pendentes, Pagas e Total batem com a tabela.
- [ ] **D-2** Emitir uma OP de teste com INSS/Patronal/SEST → a DARF dela aparece como Pendente, com os valores da OP.
- [ ] **D-3** Trocar a competência e o status → a tabela filtra; "Mês atual" volta para o mês corrente.
- [ ] **D-4** Buscar pelo nome do credor, pela NE e pelo CPF com pontuação → acha.
- [ ] **D-5** Buscar pelo CPF **só com números** e pelo final do número da OP (ex.: `0012`) → acha (D3 corrigido).
- [ ] **D-6** "Por credor" → uma linha por credor, com total e pendente.
- [ ] **D-7** Clicar no número da OP → abre a impressão da NE com só aquela OP marcada (D4 corrigido).

**Baixa**
- [ ] **D-8** Marcar 2 DARFs pendentes como pagas, com data de hoje e observação → viram "Paga", com a data em "Pago em".
- [ ] **D-9** Tentar uma data futura → mensagem de erro.
- [ ] **D-10** Reabrir uma DARF paga → volta para Pendente e a data some.
- [ ] **D-11** Selecionar uma DARF paga e uma pendente e clicar em "Marcar como paga" com outra data → os botões mostram "Marcar como paga (1)" e "Reabrir (1)"; a já paga continua com a data dela (D1 corrigido).
- [ ] **D-12** Com uma DARF paga, tentar excluir a OP dela (aba 4, como Admin) → "DARF já paga: reabra o status antes de excluir a OP."
- [ ] **D-13** Logado como **Consulta** → vê a tabela, mas não vê os botões de baixa.
- [ ] **D-14** Com IRRF marcado para entrar na DARF (Configurações), emitir uma OP → a tabela ganha a coluna IRRF e o Total bate com as colunas (D2).
- [ ] **D-15** Buscar algo que não existe → "Nenhuma DARF encontrada com estes filtros."; sem competência, o card diz "Total" (D5).

### Resultado do teste

| Item | ✅/❌ | Observação |
|---|---|---|
| | | |

---

## Aba 7 — Configurações

### Achados da revisão do código (antes do teste)

As telas de **Retenções e Descontos**, **Transporte (3.3.90.33)**, **ISS por município**, **Faixas do IRRF** e **Elementos** (rodadas 1 e 2) estão coerentes:
- só ADMIN altera, e o servidor confere;
- antes de salvar, a tela mostra o que vai mudar;
- se outro admin salvou antes, a gravação é recusada;
- sair com alteração não salva pede confirmação;
- excluir elemento só o desativa, com auditoria.

Os problemas estão em volta dessas telas.

| # | Achado | Gravidade | Proposta |
|---|---|---|---|
| CF1 ✅ corrigido | As rotas **`/api/setup`**, **`/api/setup/optimize`** e **`/api/setup/migrate`** são **públicas** (o `proxy.ts` libera `/api/setup` sem login). A `optimize` **não confere login nenhum** e, fora de produção (`npm run dev`), roda `CREATE INDEX` e **`ALTER TABLE … MODIFY COLUMN`** em `notas_empenho` e `ordens_pagamento`. Com o `.env.local` apontando para o banco compartilhado, qualquer pessoa na rede que abrir o endereço muda a estrutura do banco (o `MODIFY COLUMN` pode tirar o `NOT NULL` e o valor padrão das colunas). A `setup` cria tabelas e um admin com a senha padrão `Mudar@123` (só com `ENABLE_SETUP=true`). | 🔴 alta | **Apagar as três rotas** e tirar `/api/setup` da lista pública. Mudança de banco é só por script `.sql` rodado no Workbench (regra do projeto). Nada muda no banco. |
| CF2 ✅ corrigido | A tela **Configurações** é quase toda de enfeite: **Perfil** — "Nome completo" e "E-mail corporativo" são um registro só para o sistema inteiro (não do usuário) e não aparecem em lugar nenhum; Unidade/Gestão padrão não são usadas (a NE tem valores fixos); "Autopreencher credor", "Notificações por e-mail" e "2FA" são gravados, mas **nada usa**. **Permissões** — diz "Nível: Administrador" para todos e mostra "Ativo/Restrito" fixos. **Notificações** — as caixinhas **não salvam**. **Segurança** — "Sessões ativas: Este Computador (Windows / Chrome) — Ativo agora" é fixo. Quem não é admin consegue editar tudo, e o Salvar dá erro. Os atalhos de Retenções e Elementos ficam escondidos dentro da aba "Permissões". | 🟠 média | **Decisão sua.** Recomendo trocar por uma página simples: para o ADMIN, os cartões **Retenções e Descontos** e **Elementos**; para todos, **Alterar senha** e o link para **Meu Perfil**. Saem as abas falsas. A tabela `configuracoes_sistema` fica no banco, sem uso. |
| CF3 ✅ corrigido | Nas faixas do IRRF e nos parâmetros do transporte, um valor em reais digitado com ponto e sem vírgula (`2.428`) é lido como **2,428**, e não como 2.428. A conferência antes de salvar mostra o número e a validação da ordem das faixas costuma pegar, mas o erro é possível. | 🟡 baixa | Ler os valores em reais como na NE e na OP (`2.428` = dois mil quatrocentos e vinte e oito). As alíquotas (%) continuam como estão. |

### Roteiro de teste (marcar ✅ / ❌)

**Retenções e Descontos (ADMIN)**
- [ ] **CF-1** Abrir Configurações → Retenções e Descontos → os campos e a matriz por elemento carregam.
- [ ] **CF-2** Mudar a alíquota do IRRF de um valor de teste e salvar → a confirmação lista a mudança; depois de salvar, uma OP nova usa a alíquota nova; uma OP antiga reimpressa continua com a antiga.
- [ ] **CF-3** Mudar algo e sair pelo menu sem salvar → pede confirmação.
- [ ] **CF-4** Simulador → o resultado bate com uma OP emitida com os mesmos valores.

**Transporte, ISS e IRRF (ADMIN)**
- [ ] **CF-5** Aba Transporte → parâmetros, ISS por município e faixas do IRRF carregam; o simulador do transporte bate com a prévia da OP.
- [ ] **CF-6** Cadastrar um município de teste no ISS → aparece na lista e nas sugestões do cadastro de credor.
- [ ] **CF-7** Digitar `2.428` num limite de faixa do IRRF → a confirmação mostra 2428 (CF3 corrigido).

**Elementos (ADMIN)**
- [ ] **CF-8** Cadastrar um elemento e um subelemento de teste → aparecem na NE.
- [ ] **CF-9** Desativar o subelemento → some da NE nova; NE antiga com ele continua mostrando "(legado)".

**Acesso**
- [ ] **CF-10** Logado como **Gestor**, abrir `/configuracoes/retencoes` direto pelo endereço → "Acesso restrito a administradores".
- [ ] **CF-11** Tela Configurações como **Admin** → só os cartões Retenções e Descontos, Elementos, Alterar senha e Meu Perfil; como **Gestor** → só Alterar senha e Meu Perfil (CF2 corrigido).
- [ ] **CF-12** Abrir `/api/setup/optimize` no navegador sem estar logado → "Nao autenticado." (CF1 corrigido); logado → página não encontrada.

### Resultado do teste

| Item | ✅/❌ | Observação |
|---|---|---|
| | | |

---

## Aba 8 — Usuários

### Achados da revisão do código (antes do teste)

O que está certo:
- só ADMIN lista, cria, bloqueia e exclui (o servidor confere);
- **bloquear derruba o acesso na hora**: cada requisição confere no banco se o usuário está ativo;
- ninguém bloqueia ou exclui a si mesmo, nem o admin raiz;
- usuário com OP não pode ser excluído.

| # | Achado | Gravidade | Proposta |
|---|---|---|---|
| U1 ✅ corrigido | Não dá para criar um usuário **Consulta** (somente leitura): a tela oferece "Comum" e "Administrador", e o servidor transforma qualquer coisa que não seja ADMIN em GESTOR. Também não dá para **mudar o perfil** de um usuário já criado. | 🟠 média | Escolher entre Administrador, Gestor e Consulta ao criar, e poder trocar o perfil depois (o servidor aceita só os três). |
| U2 ✅ corrigido | A **senha provisória** não tem tamanho mínimo: o admin consegue criar um usuário com senha `1`. A troca de senha exige 8 caracteres. | 🟠 média | Mínimo de 8 caracteres também na criação, na tela e no servidor. |
| U3 ✅ corrigido | **Excluir** um usuário que já trabalhou no sistema **apaga o "quem fez"** de NEs, credores e da **auditoria** (o banco põe NULL no lugar). A exclusão só é barrada quando ele tem OP. | 🟠 média | Excluir só quem nunca registrou nada (NE, credor, OP ou auditoria); senão, a mensagem manda bloquear. |
| U4 ✅ corrigido | Abrir "Novo Usuário" de novo mostra os **dados do usuário anterior**, inclusive a senha digitada. | 🟡 baixa | Limpar o formulário ao abrir. |
| U5 ✅ corrigido | Quem não é admin consegue abrir `/usuarios`: vê o botão "Novo Usuário" e uma mensagem "Você é ADMIN?". Os botões de bloquear e excluir aparecem também para o **próprio usuário** e para o **admin raiz**, e o servidor recusa só depois do clique. | 🟡 baixa | Tela só para admin, com aviso. Sem esses botões na linha do próprio usuário e do admin raiz. |
| U6 ✅ corrigido | A coluna "Cargo" mostra o código (`GESTOR`, `CONSULTA`), diferente do Perfil, que mostra "Gestor", "Consulta (somente leitura)". Depois de excluir o último usuário de uma página, a lista fica numa página vazia. | 🟡 baixa | Mesmos nomes do Perfil e voltar uma página quando ela esvaziar. |
| U7 ✅ corrigido | A tela de Usuários **não tinha atalho em nenhum menu**: só abria digitando `/usuarios` no endereço (o link existia num menu lateral que não é mostrado). | 🟡 baixa | Cartão **Usuários** na página de Configurações, só para o Admin. |

### Roteiro de teste (marcar ✅ / ❌)

- [ ] **U-1** Como **Admin**, abrir **Configurações → Usuários** → a lista carrega, com perfil e status (U7).
- [ ] **U-2** Criar um usuário `TESTE` com e-mail novo e senha de 8+ caracteres → aparece na lista e consegue entrar.
- [ ] **U-3** Criar com e-mail que já existe → "Esse e-mail já está em uso."
- [ ] **U-4** Criar com senha `1` → "A senha provisória deve ter no mínimo 8 caracteres." (U2 corrigido).
- [ ] **U-5** Criar um usuário **Consulta** e entrar com ele → só consegue ver; Salvar, Excluir e Emitir ficam desabilitados (U1 corrigido).
- [ ] **U-5b** Na lista, trocar o perfil de um usuário de teste para Consulta → pede confirmação; no próximo clique dele, já vale o perfil novo (U1).
- [ ] **U-6** Bloquear o usuário de teste com ele logado em outro navegador → no próximo clique dele, volta para o login.
- [ ] **U-7** Desbloquear → ele entra de novo.
- [ ] **U-8** Excluir um usuário de teste que nunca mexeu em nada → some da lista.
- [ ] **U-9** Excluir um usuário que cadastrou uma NE (sem OP) → "Não é possível excluir: este usuário tem 1 nota(s) de empenho. Use \"Bloquear\"…" (U3 corrigido).
- [ ] **U-10** Na linha do próprio usuário e do admin raiz não há botões de bloquear, excluir nem troca de perfil (U5 corrigido).
- [ ] **U-11** Como **Gestor**, abrir `/usuarios` pelo endereço → "Acesso restrito a administradores." (U5 corrigido).

### Resultado do teste

| Item | ✅/❌ | Observação |
|---|---|---|
| U-9 | ✅ | testado pelo usuário em 22/10/2026: usuário com NE não foi excluído (mensagem pediu para bloquear); usuário sem histórico foi excluído |

---

## Aba 9 — Dashboard

### Achados da revisão do código (antes do teste)

As contas do servidor estão certas: os totais são somados no banco, em DECIMAL; o "Total a Pagar" é o saldo das NEs a pagar e parciais; NEs canceladas ficam de fora. Os achados são de atualização e de leitura dos números.

| # | Achado | Gravidade | Proposta |
|---|---|---|---|
| B1 ✅ corrigido | Os números ficam guardados em memória por **5 minutos**, para todos os usuários. Depois de emitir uma OP ou cadastrar uma NE, o Dashboard continua mostrando os valores antigos por até 5 minutos, sem avisar. Parece que o sistema não gravou. | 🟠 média | Mostrar "Atualizado às HH:MM" e um botão **Atualizar** que busca na hora; guardar por no máximo 1 minuto. |
| B2 ✅ corrigido | Se a consulta falhar, os cartões mostram **R$ 0,00** e **0**, iguais a um sistema vazio, sem nenhum aviso. | 🟡 baixa | Aviso "Não foi possível carregar o resumo" com "Tentar de novo". |
| B3 ✅ corrigido | Os indicadores não dizem o que medem: "Notas Emitidas" é **dos últimos 30 dias**, e o "+12%" de "Credores Ativos" é o **crescimento em 30 dias**. A seta é sempre para cima, mesmo quando o número cai. | 🟡 baixa | Textos "nos últimos 30 dias" / "novos em 30 dias" e seta para baixo quando cair. |
| B4 ✅ corrigido | Nas "Últimas Movimentações", NE paga em parte aparece como "PARCIALMENTE PAGO", e na aba Notas de Empenho aparece "PARCIAL" (N3). | 🟡 baixa | Mesmo selo da aba Notas de Empenho. |
| B5 ✅ corrigido | O perfil **Consulta** vê os botões "Novo Empenho" e "Novo Credor". A consulta das 3 últimas OPs é feita a cada carga, mas não aparece em lugar nenhum. | 🟡 baixa | Esconder os dois botões para o Consulta e tirar a consulta sem uso. |

### Roteiro de teste (marcar ✅ / ❌)

- [ ] **B-1** Abrir o Dashboard → "Total a Pagar" bate com a soma da coluna "Restante" das NEs a pagar e parciais (aba Notas de Empenho).
- [ ] **B-2** "Credores Ativos" bate com o total da aba Credores.
- [ ] **B-3** "Notas Emitidas" bate com as NEs não canceladas cadastradas nos últimos 30 dias.
- [ ] **B-4** Emitir uma OP e voltar ao Dashboard na hora → em até 1 minuto o número muda; clicando em "Atualizar", muda na hora, e "Atualizado às" mostra a hora (B1 corrigido).
- [ ] **B-5** "Últimas Movimentações" mostra as 5 NEs mais recentes, com o selo certo.
- [ ] **B-6** Clicar nos cartões → abrem Ordem de Pagamento, Credores e Notas de Empenho.
- [ ] **B-7** Logado como **Consulta** → sem os botões "Novo Empenho" e "Novo Credor" (B5 corrigido).
- [ ] **B-8** Com o servidor do banco fora do ar (ou sem rede) → aviso "Não foi possível carregar o resumo" com "Tentar de novo", e não R$ 0,00 (B2).
- [ ] **B-9** Os cartões dizem o período ("nos últimos 30 dias", "em 30 dias", "vs 30 dias atrás"), e a seta aponta para baixo quando o número cai (B3).

### Resultado do teste

| Item | ✅/❌ | Observação |
|---|---|---|
| | | |
