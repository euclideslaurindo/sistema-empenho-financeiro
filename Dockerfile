# ---- Etapa 1: Instalar dependências ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Etapa 2: Compilar ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Gate de qualidade: builda só se lint/tipos/testes passarem, mesmo se alguém
# rodar `docker build` manualmente fora do CI (que já roda essas mesmas
# checagens em .github/workflows/ci.yml).
ENV JWT_SECRET="build-time-only-not-used-in-prod"
ENV APP_URL="http://localhost:3000"
RUN npm run lint:types && npm run lint && npm test
RUN npm run build

# ---- Etapa 3: Executar ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Se necessário public directory
COPY --from=builder /app/public ./public

# Configuração para standalone (necessita ter output: "standalone" no next.config.ts)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
