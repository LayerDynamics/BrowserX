FROM denoland/deno:2.6.9

WORKDIR /app

# Copy entire monorepo — needed to resolve workspace imports (query-engine, etc.)
COPY . .

# Cache the API service and all its transitive dependencies
RUN deno cache services/browserx-api/main.ts

EXPOSE 8080

ENV DENO_ENV=production
ENV BROWSERX_API_PORT=8080

CMD ["deno", "run", \
  "--allow-net", \
  "--allow-read", \
  "--allow-env", \
  "--allow-ffi", \
  "services/browserx-api/main.ts"]
