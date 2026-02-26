# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies first for better layer caching
COPY doc-site/package.json doc-site/package-lock.json ./
RUN npm ci

# Copy all doc-site source files
COPY doc-site/ .

# BROWSERX_API_URL is used by the SSR server for API proxy calls (build-time only)
ARG BROWSERX_API_URL=http://browserx-api:8080

RUN npm run build

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Only copy what the standalone server needs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

RUN addgroup -S app && adduser -S app -G app
RUN chown -R app:app /app
USER app

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production
ENV BROWSERX_API_URL=

EXPOSE 3000

CMD ["node", "./dist/server/entry.mjs"]
