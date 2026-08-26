# Sistema de Empenho — Gestão Financeira
**Estado de Pernambuco · Secretaria da Fazenda**

---

## Pré-requisitos
- Node.js 18+
- MySQL 8.0+
- npm ou bun

---

## Instalação e Configuração

### 1. Banco de Dados
Execute o script SQL no seu MySQL:
```bash
mysql -u admin -p < database.sql
```
Ou abra o arquivo `database.sql` no MySQL Workbench/HeidiSQL e execute.

Credenciais do banco (já configuradas em `lib/db.ts`):
- **Host:** DAGMCGPA100
- **Porta:** 3306
- **Usuário:** admin
- **Senha:** qwe124578
- **Banco:** empenho

### 2. Instalar dependências
```bash
npm install
```

### 3. Rodar em desenvolvimento
```bash
npm run dev
```
Acesse: http://localhost:3000

### 4. Rodar em produção
```bash
npm run build
npm start
```

---

## Credenciais de Acesso Padrão
| Matrícula | Senha    | Nível |
|-----------|----------|-------|
| admin     | admin123 | Admin |

---

## Estrutura das Rotas de API
```
POST  /api/auth/login              → Autenticação
GET   /api/credores                → Listar credores
POST  /api/credores                → Criar credor
PUT   /api/credores/[id]           → Atualizar credor
DEL   /api/credores/[id]           → Excluir credor
GET   /api/notas-empenho           → Listar NEs
POST  /api/notas-empenho           → Criar NE
PUT   /api/notas-empenho/[id]      → Atualizar NE
DEL   /api/notas-empenho/[id]      → Cancelar NE
POST  /api/ordens-pagamento        → Salvar ordem
GET   /api/ordens-pagamento        → Listar ordens
GET   /api/dashboard/stats         → KPIs do dashboard
```

---

## Rotas do Sistema
| URL | Módulo |
|-----|--------|
| /login | Autenticação |
| / | Dashboard |
| /credores | Cadastro de Credores |
| /notas-empenho | Notas de Empenho |
| /ordem-pagamento | Ordem de Pagamento |
| /consulta-impressao | Consulta e Impressão |
| /configuracoes | Configurações |
| /perfil | Perfil do Usuário |
| /suporte | Suporte |
