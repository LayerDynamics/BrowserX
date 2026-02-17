# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies first for better layer caching
COPY doc-site/package.json doc-site/package-lock.json ./
RUN npm ci

# Copy all doc-site source files
COPY doc-site/ .

# BROWSERX_API_URL is used by the SSR server for API proxy calls
ARG BROWSERX_API_URL=http://browserx-api:8080
ENV BROWSERX_API_URL=${BROWSERX_API_URL}

RUN npm run build

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Only copy what the standalone server needs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "./dist/server/entry.mjs"]
