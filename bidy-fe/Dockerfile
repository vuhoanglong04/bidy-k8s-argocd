# syntax=docker/dockerfile:1

################################
# 1) deps: install dependencies only (cached layer)
################################
FROM node:24.22.1-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

################################
# 2) builder: build the Next.js app
################################
FROM node:24.22.1-alpine AS builder
WORKDIR /app

# Build-time public config — NEXT_PUBLIC_* vars are inlined into the client
# bundle at build time, so they MUST arrive as build args, not runtime env.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_DESCRIPTION
ARG NEXT_PUBLIC_MAX_IMAGE_SIZE
ARG NEXT_PUBLIC_SUPPORTED_FORMATS
ARG NEXT_PUBLIC_DEFAULT_PAGE_SIZE
ARG NEXT_PUBLIC_ADMIN_PAGE_SIZE
ARG NEXT_PUBLIC_ENABLE_CHAT
ARG NEXT_PUBLIC_ENABLE_NOTIFICATIONS
ARG NEXT_PUBLIC_ENABLE_DARK_MODE
ARG NEXT_PUBLIC_SHOW_DEV_TOOLS
ARG NEXT_PUBLIC_ENABLE_DEBUG
ARG NEXT_PUBLIC_LOG_LEVEL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_APP_DESCRIPTION=$NEXT_PUBLIC_APP_DESCRIPTION \
    NEXT_PUBLIC_MAX_IMAGE_SIZE=$NEXT_PUBLIC_MAX_IMAGE_SIZE \
    NEXT_PUBLIC_SUPPORTED_FORMATS=$NEXT_PUBLIC_SUPPORTED_FORMATS \
    NEXT_PUBLIC_DEFAULT_PAGE_SIZE=$NEXT_PUBLIC_DEFAULT_PAGE_SIZE \
    NEXT_PUBLIC_ADMIN_PAGE_SIZE=$NEXT_PUBLIC_ADMIN_PAGE_SIZE \
    NEXT_PUBLIC_ENABLE_CHAT=$NEXT_PUBLIC_ENABLE_CHAT \
    NEXT_PUBLIC_ENABLE_NOTIFICATIONS=$NEXT_PUBLIC_ENABLE_NOTIFICATIONS \
    NEXT_PUBLIC_ENABLE_DARK_MODE=$NEXT_PUBLIC_ENABLE_DARK_MODE \
    NEXT_PUBLIC_SHOW_DEV_TOOLS=$NEXT_PUBLIC_SHOW_DEV_TOOLS \
    NEXT_PUBLIC_ENABLE_DEBUG=$NEXT_PUBLIC_ENABLE_DEBUG \
    NEXT_PUBLIC_LOG_LEVEL=$NEXT_PUBLIC_LOG_LEVEL \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

################################
# 3) runner: minimal production image
################################
FROM node:24.22.1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# npm/corepack ship their own copies of brace-expansion/undici etc. that Trivy
# flags; the app only needs `node` at runtime.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# Standalone output already contains a minimal node_modules + server.js
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

CMD ["node", "server.js"]
