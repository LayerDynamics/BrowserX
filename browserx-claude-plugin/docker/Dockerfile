FROM denoland/deno:2.6.9

WORKDIR /app

# Copy BrowserX source
COPY . .

# Cache dependencies
RUN deno cache mcp-server/mod.ts

# MCP HTTP transport port
EXPOSE 9847

# Environment defaults
ENV MCP_TRANSPORT=http
ENV MCP_PORT=9847
ENV MCP_MAX_SESSIONS=10
ENV MCP_PERMISSIONS=AUTOMATION

CMD ["deno", "task", "mcp:start:http"]
