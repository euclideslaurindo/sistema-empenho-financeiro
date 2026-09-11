# 🛠️ Plano de Implementação — Sistema de Empenho Financeiro

Baseado na auditoria completa de 21 problemas confirmados no código-fonte.

---

## User Review Required

> [!IMPORTANT]
> Este plano **modifica arquivos críticos de autenticação e segurança**. Leia com atenção antes de aprovar, especialmente a Fase 1 — qualquer erro de configuração pode bloquear o acesso ao sistema.

> [!CAUTION]
> **Ação manual necessária ANTES da Fase 1:** Você deve alterar a senha do banco de dados MySQL (`qwe124578`) diretamente no servidor `DAGMCGPA100` e atualizar o arquivo `.env.local` com a nova senha. Isso precisa ser feito por você, não pode ser automatizado.

---

## Open Questions

> [!IMPORTANT]
> **Pergunta 1 — Rate Limiter no login:** O documento sugere usar `email` como chave do rate limiter (em vez de IP). Mas em ambiente de LAN, o problema era o IP compartilhado. Confirma que devemos usar a combinação `IP + email`? Isso limita por usuário, independente de IP.

> [!IMPORTANT]
> **Pergunta 2 — Rota `/api/auth/register`:** Devemos proteger o registro para que **somente ADMIN** possa criar usuários? Ou prefere manter a criação aberta mas com um **token de convite** que o admin gera? A opção mais simples e segura é exigir ADMIN.

> [!IMPORTANT]
> **Pergunta 3 — Rota `/api/migrate`:** Transformamos em script CLI (mais seguro) ou apenas adicionamos verificação de ADMIN? Sugiro mover para `scripts/` e remover o endpoint HTTP.

> [!IMPORTANT]
> **Pergunta 4 — Fase 3 (Testes):** Os testes de integração precisam de um banco MySQL de teste separado. Você tem disponibilidade de configurar um banco `empenho_test` no servidor, ou prefere usar um banco SQLite em memória só para os testes unitários?

---

## Proposed Changes

---

### 🔴 FASE 1 — Segurança Crítica (Prioridade Máxima)

> Objetivo: Fechar todas as 7 vulnerabilidades críticas e 4 graves antes de qualquer novo feature.

---

#### [NEW] [lib/jwt-secret.ts](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/lib/jwt-secret.ts)
Criar arquivo centralizado que exporta `JWT_SECRET`. Lança erro fatal se a variável de ambiente não estiver definida — eliminando o fallback hardcoded e centralizando em um único lugar.

#### [MODIFY] [middleware.ts](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/middleware.ts)
- Remover declaração local do `JWT_SECRET` (linha 5–7)
- Importar de `@/lib/jwt-secret`

#### [MODIFY] [lib/auth.ts](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/lib/auth.ts)
- Remover declaração local do `JWT_SECRET` (linha 4–6)
- Importar de `@/lib/jwt-secret`

#### [MODIFY] [app/api/auth/login/route.ts](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/app/api/auth/login/route.ts)
- Remover declaração local do `JWT_SECRET` (linha 7–9)
- Importar de `@/lib/jwt-secret`
- Reativar rate limiter usando chave `${ip}:${email}` (em vez de apenas IP)
- Remover `error.stack` da resposta de erro (linha 96)

#### [MODIFY] [app/api/auth/register/route.ts](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/app/api/auth/register/route.ts)
- Adicionar `getAuthUser` no início da função
- Exigir perfil `ADMIN` para criar usuários
- Retornar 403 se não for ADMIN

#### [MODIFY] [app/api/dashboard/stats/route.ts](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/app/api/dashboard/stats/route.ts)
- Adicionar `getAuthUser` no início da função GET
- Retornar 401 se não autenticado

#### [MODIFY] [app/api/migrate/route.ts](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/app/api/migrate/route.ts)
- Adicionar `getAuthUser` + verificação de perfil `ADMIN`
- Alternativa: mover lógica para `scripts/migrate.ts` e deletar rota (a definir na aprovação)

#### [MODIFY] [app/api/analise-planilha/route.ts](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/app/api/analise-planilha/route.ts)
- Adicionar `getAuthUser` no início da função GET
- Remover `stack: error.stack` da resposta de erro (linha 191)

#### [MODIFY] [next.config.ts](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/next.config.ts)
- Substituir `"Access-Control-Allow-Origin": "*"` por `process.env.APP_URL || "http://localhost:3000"`

#### [MODIFY] [.env.example](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/.env.example)
- Adicionar linha `JWT_SECRET="gere-uma-chave-segura-de-32-caracteres"`
- Adicionar comentário explicativo

---

### 🟡 FASE 2 — Limpeza de Código (1 dia)

> Objetivo: Remover dívida técnica, scripts obsoletos e dados mock.

---

#### [DELETE] Scripts residuais da raiz
- `fix_remaining.js`
- `update_colors.js`
- `update_colors2.js`
- `update_colors3.js`
- `remove-mocks.js`
- `setup_db.js` ← **urgente** (contém senha do banco)
- `tsconfig.tsbuildinfo` (+ adicionar ao `.gitignore`)

#### [MODIFY] [lib/store.ts](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/lib/store.ts)
- Remover 3 credores mock hardcoded do estado inicial
- Substituir pelo estado inicial vazio `credores: []`

#### [MODIFY] [app/api/credores/route.ts](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/app/api/credores/route.ts)
- Substituir `LIMIT ${limit} OFFSET ${offset}` por placeholders `?`

#### [MODIFY] [app/api/ordens-pagamento/route.ts](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/app/api/ordens-pagamento/route.ts)
- Substituir `LIMIT ${limit} OFFSET ${offset}` por placeholders `?`
- Corrigir race condition na geração de número de OP: usar `SELECT ... FOR UPDATE` dentro da transação existente

#### [MODIFY] [app/api/auth/login/route.ts](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/app/api/auth/login/route.ts) *(já alterado na Fase 1)*
- Confirmar que `error.stack` foi removido

---

### 🧪 FASE 3 — Testes Automatizados (3–5 dias)

> Objetivo: Instalar Vitest e criar cobertura de testes prioritários.

---

#### [NEW] `vitest.config.ts`
Configuração do Vitest com alias `@/` apontando para a raiz do projeto.

#### [NEW] `tests/setup.ts`
Arquivo de setup global para os testes (variáveis de ambiente de teste, mocks globais).

#### [NEW] `tests/unit/utils.test.ts`
Testes unitários das funções de `lib/utils.ts`:
- `maskCurrency` — formatação BR
- `parseFormNumber` — parsing de string mascarada para número
- `numeroPorExtenso` — conversão de número para texto

#### [NEW] `tests/unit/calculos-op.test.ts`
Testes das regras de negócio financeiras:
- Cálculo de IRRF (1,5%), INSS (11%), ISS (5%)
- Valor líquido = valor bruto − total descontos
- Precisão decimal em centavos

#### [NEW] `tests/integration/credores.test.ts`
Testes de integração da API de credores:
- GET `/api/credores` retorna 401 sem auth
- POST cria credor com dados válidos
- POST rejeita CPF/CNPJ duplicado

#### [NEW] `tests/integration/ordens-pagamento.test.ts`
Testes das regras de negócio mais críticas:
- OP com valor > saldo da NE retorna 422
- OP cria corretamente e atualiza status da NE para `LIQUIDADO`
- OP parcial atualiza status para `PARCIALMENTE PAGO`

#### [MODIFY] [package.json](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/package.json)
- Adicionar script `"test": "vitest run"` e `"test:watch": "vitest"`

---

### 🚀 FASE 4 — Infraestrutura (2–3 dias)

> Objetivo: Containerização e pipeline CI/CD no GitHub.

---

#### [NEW] `Dockerfile`
Dockerfile multi-stage (deps → builder → runner) com usuário não-root e output `standalone` do Next.js.

#### [NEW] `docker-compose.yml`
Orquestra `app` (Next.js) + `db` (MySQL 8) com healthcheck e variáveis via `.env`.

#### [NEW] `.github/workflows/ci.yml`
Pipeline GitHub Actions com 3 jobs em sequência:
1. **quality** — TypeScript + ESLint
2. **test** — Vitest com MySQL de teste efêmero
3. **build** — `next build` para validar que compila

#### [NEW] `app/api/health/route.ts`
Endpoint simples `GET /api/health` que retorna `{ status: 'ok', timestamp }` para monitoramento e healthcheck do Docker.

#### [MODIFY] [.gitignore](file:///c:/Users/euclides.souza/Desktop/sistema-empenho/sistema-empenho-financeiro/.gitignore)
- Garantir que `tsconfig.tsbuildinfo`, `.env.local` e arquivos `.xlsx` estejam listados

---

## Verification Plan

### Após Fase 1 — Testes Manuais
- [ ] `node test_verificacao.js` — todos os 12 testes devem continuar passando
- [ ] Testar login com `admin@admin.com` — deve funcionar normalmente
- [ ] Acessar `GET /api/dashboard/stats` sem cookie — deve retornar 401
- [ ] Tentar `POST /api/auth/register` sem estar logado como ADMIN — deve retornar 403
- [ ] Verificar que `GET /api/migrate` exige ADMIN

### Após Fase 2 — Limpeza
- [ ] Scripts residuais deletados da raiz
- [ ] `lib/store.ts` sem credores mock
- [ ] Página de credores no frontend ainda carrega normalmente

### Após Fase 3 — Testes
- [ ] `npm test` roda e todos os testes passam
- [ ] Cobertura mínima: funções de cálculo financeiro, APIs principais

### Após Fase 4 — Infraestrutura
- [ ] `docker-compose up` sobe a aplicação completa
- [ ] Push para `main` dispara o pipeline no GitHub Actions
- [ ] `GET /api/health` retorna 200
