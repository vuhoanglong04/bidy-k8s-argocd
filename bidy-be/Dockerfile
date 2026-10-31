################################
# 1) deps: install production-only dependencies (cached layer)
################################
FROM node:24.22.1-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

################################
# 2) build: compile TypeScript with tsx/typescript, which are devDependencies
# and so aren't present in the production node_modules from the deps stage.
################################
FROM node:24.22.1-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

################################
# 3) runner: minimal production image
################################
FROM node:24.22.1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8001

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 expressjs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --chown=expressjs:nodejs . .

EXPOSE 8001

# Runs the compiled output (skips nodemon/prestart validate-env hook, which
# is a dev-loop convenience, not needed once env vars are supplied by compose)
CMD ["node", "dist/server.js"]
