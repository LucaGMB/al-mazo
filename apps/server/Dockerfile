FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
RUN pnpm --filter @al-mazo/shared build

COPY apps/server ./apps/server
RUN pnpm --filter al-mazo-server prisma:generate
RUN pnpm --filter al-mazo-server build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/server ./apps/server

WORKDIR /app/apps/server
EXPOSE 3000

CMD ["sh", "-c", "pnpm prisma:deploy && node dist/server.js"]
