# Plano de Implementação (Aprovado)

## 1. Automação do Sub-empenho e OP
* **Número da OP Automático:** Será adicionada a coluna `numero_op` na tabela `ordens_pagamento`. A rota de criação (POST) na API vai gerar automaticamente o número no formato `ANO.OP.XXXXX`. O campo manual na interface será removido ou ficará apenas como leitura.
* **Sub-empenho Automático:** A API irá consultar quantas OPs já existem para aquela Nota de Empenho (NE) e incrementará automaticamente o sub-empenho (01, 02, 03...).

## 2. Retenções e Descontos (Regra do Admin)
* **API / Backend:** A API de sessão/login será checada para garantir que o nível do usuário esteja disponível.
* **Frontend:** Os campos de impostos na aba de Ordem de Pagamento serão bloqueados (somente-leitura) para usuários com `perfil !== 'ADMIN'`, com os percentuais fixos (IRRF 1.5%, ISS 5%, INSS 11%, Patronal 20%, Sest/Senat 2.5%, Outros 0%).

## 3. Relatório e Impressão
* **Como funciona atualmente:** A aba de relatórios (Consulta/Impressão) **já puxa as informações da Ordem de Pagamento**! Quando você digita o número da NE e manda buscar as parcelas, ele já pega o CNPJ, Valor e Endereço salvos na OP.
* **Melhoria proposta:** Para facilitar, vou colocar um botão **"Imprimir OP"** diretamente na aba de Ordem de Pagamento, logo após salvar, para que você não precise ir na aba de relatórios digitar o número de novo. Ele já vai abrir o documento preenchido!

---
> [!IMPORTANT]
> **Ação Necessária**
> Se este plano final estiver alinhado com o que você pensou, basta clicar em **Proceed/Aprovar** para eu começar a escrever o código!
