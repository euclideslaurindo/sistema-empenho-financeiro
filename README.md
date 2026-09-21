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
mysql -u admin -p < database/database.sql
```
Ou abra o arquivo `database/database.sql` no MySQL Workbench/HeidiSQL e execute.


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

## Setup Inicial - Criando o Usuário Admin

1. **Configure as variáveis de ambiente:**
   Copy `.env.example` to `.env.local` and fill in your database credentials:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and set:
   - `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD` (your database details)
   - `ENABLE_SETUP=true` (only for development)
   - `ADMIN_INITIAL_PASSWORD=YourSecurePassword` (or leave empty for default `Mudar@123`)

2. **Create initial admin user:**
   Run the setup route once to create the database tables and admin user:
   ```bash
   curl http://localhost:3000/api/setup
   # or open in browser: http://localhost:3000/api/setup
   ```
   This creates:
   - Database tables (`usuarios`, `configuracoes_sistema`, etc.)
   - Admin user with email `admin@admin.com` and password from `ADMIN_INITIAL_PASSWORD` (or `Mudar@123` as fallback)

3. **Disable setup route:**
   After initial setup, set `ENABLE_SETUP=false` in `.env.local` to prevent accidental re-runs.

4. **Login:**
   - **Email:** `admin@admin.com`
   - **Password:** Value set in `ADMIN_INITIAL_PASSWORD` env var, or `Mudar@123` if not specified

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
