# Atualização do Banco de Dados (MySQL)

Como adicionamos novas regras de negócios no sistema para o controle rigoroso da **Contabilidade Pública**, foram necessárias algumas alterações na estrutura do banco de dados existente.

Caso você vá rodar este projeto em um outro computador ou ambiente, você precisará atualizar o banco de dados local daquela máquina. Siga os passos abaixo na ordem apresentada.

## 1. Atualização da Estrutura das Tabelas

Abra o seu console do MySQL (ou programa como DBeaver, MySQL Workbench, phpMyAdmin) conectado no banco `empenho` e execute os seguintes comandos SQL para adicionar as novas colunas necessárias:

```sql
-- Adiciona a coluna de ano de exercício para as notas de empenho
ALTER TABLE notas_empenho ADD COLUMN exercicio VARCHAR(4);

-- Adiciona o vínculo obrigatório da ordem de pagamento com a liquidação
ALTER TABLE ordens_pagamento ADD COLUMN liquidacao_id VARCHAR(36);
```

*(Nota: Caso você vá criar o banco do zero no outro computador usando o arquivo `database.sql`, ele já contém essas alterações embutidas! Você só precisa rodar os comandos `ALTER TABLE` acima se o banco antigo já existir lá).*

## 2. Migração dos Dados Antigos (Backfill)

Como os relatórios antigos não possuíam o vínculo da liquidação na Ordem de Pagamento, criamos um script para preencher essas lacunas automaticamente para você, sem quebrar o sistema.

Após rodar o SQL acima, abra o terminal na raiz do projeto e execute o script Node.js abaixo:

```bash
node scripts/migrate_liquidacoes_op.js
```

### O que esse script faz?
1. Ele varre as Notas de Empenho antigas e descobre o ano pela `data_pagamento`, preenchendo a nova coluna `exercicio`.
2. Ele varre as Ordens de Pagamento antigas e as vincula com as `liquidacoes` correspondentes, garantindo o rastreio e funcionamento correto das novas travas de limite de pagamento.

---
Após seguir estes 2 passos, o sistema estará 100% atualizado e pronto para rodar com as novas regras de negócios!
