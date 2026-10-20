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

> O `database.sql` está desatualizado: o schema atual vem das migrations `database/migration_*.sql` (numeração real em `docs/projeto-retencoes-v2/README.md`, seção 15), que rodam **manualmente** no Workbench.
>
> **Desenvolvimento e testes usam um banco de teste**, nunca o banco compartilhado de produção: o mesmo banco é lido por outros sistemas, e tudo o que se testa nele (NE, OP, DARF) fica gravado de verdade. Ver `docs/projeto-retencoes-v2/HOMOLOGACAO-RODADA-2.md`, seção 7.


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
O projeto usa `output: 'standalone'` (`next.config.ts`): o `npm start` (`next start`) **não** serve esse build. O jeito certo é o mesmo do `Dockerfile` e do CI:
```bash
npm ci
npm run build
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
node .next/standalone/server.js   # com as variáveis do .env de produção no ambiente
```
Ou pelo Docker: `docker compose up -d --build`. Roteiro completo de entrega e rollback: `docs/projeto-retencoes-v2/HOMOLOGACAO-RODADA-2.md`.

### 5. Fluxo principal (a partir da rodada 2)
1. **Nota de Empenho** (`/notas-empenho`): cadastro **sem credor e sem datas**; a lista mostra valor, gasto e restante.
2. **Ordem de Pagamento** (`/ordem-pagamento`): carregar a NE, adicionar **um ou vários credores** (cada um com valor, cheque, data do pagamento e itens) e **emitir**: uma OP por credor, numa transação só (`POST /api/ordens-pagamento/lote`).
3. **Impressão** (`/consulta-impressao`): "Imprimir esta emissão" abre a consulta só com as OPs emitidas.
4. **DARF** (`/darf`): uma por OP, na competência do mês do pagamento da OP.

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
