# BrowserX MCP Server

Model Context Protocol (MCP) server that exposes BrowserX capabilities to LLMs like Claude, enabling AI-driven browser automation, web scraping, and proxy control.

## Quick Start

```bash
# stdio transport (default, for Claude Desktop)
deno task mcp:start

# HTTP transport (for custom integrations)
deno task mcp:start:http
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `stdio` | Transport mode: `stdio` or `http` |
| `MCP_PORT` | `3000` | HTTP port (if http transport) |
| `MCP_PERMISSIONS` | `AUTOMATION` | Permission level: `READONLY`, `AUTOMATION`, `FULL` |
| `MCP_MAX_SESSIONS` | `10` | Max concurrent browser sessions |

### Command Line

```bash
# HTTP transport on custom port
deno run --allow-all mod.ts --http --port=9847
```

## Available Tools

### Query Tools

| Tool | Description |
|------|-------------|
| `browserx_query` | Execute BrowserX SQL-like queries |
| `browserx_query_explain` | Analyze query execution plan without executing |
| `browserx_query_async` | Execute query asynchronously, returns query ID |
| `browserx_query_status` | Check status of async query |
| `browserx_query_cancel` | Cancel running async query |

### Browser Tools

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to URL in browser session |
| `browser_click` | Click element by CSS selector |
| `browser_type` | Type text into input element |
| `browser_screenshot` | Capture page screenshot |
| `browser_pdf` | Generate PDF of current page |
| `browser_evaluate` | Execute JavaScript in page context |
| `browser_query_dom` | Query DOM elements and extract data |
| `browser_wait` | Wait for condition (time, selector, or function) |
| `browser_close_session` | Close browser session |
| `browser_list_sessions` | List active browser sessions |

### Proxy Tools

| Tool | Description |
|------|-------------|
| `proxy_cache_get` | Retrieve cached HTTP response |
| `proxy_cache_set` | Store value in cache with optional TTL |
| `proxy_cache_clear` | Clear cache entries matching pattern |
| `proxy_add_interceptor` | Add request interceptor (allow/block/modify) |
| `proxy_remove_interceptor` | Remove request interceptor |

## Resources

- `page://current` - Current page state and DOM
- `metrics://runtime` - Runtime performance metrics
- `metrics://cache` - Cache statistics

## Prompts

- `automation_workflow` - Pre-built automation workflow templates

## Permission Levels

- **READONLY**: Query data only, no navigation or mutations
- **AUTOMATION**: Navigate, click, type, screenshot (default)
- **FULL**: All capabilities including cache manipulation

## Integration with Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "browserx": {
      "command": "deno",
      "args": ["task", "mcp:start"],
      "cwd": "/path/to/BrowserX"
    }
  }
}
```

## Example Usage

```sql
-- Extract page title
SELECT title FROM "https://example.com"

-- Navigate and capture screenshot
NAVIGATE TO "https://example.com"
CAPTURE screenshot

-- Fill form and submit
INSERT "user@example.com" INTO "#email"
INSERT "password123" INTO "#password"
CLICK "#submit"
```

## Development

```bash
# Type check
deno task mcp:check

# Run with watch mode
deno task mcp:dev

# Compile to binary
deno task mcp:compile
```

## Architecture

```text
MCP Server
├── server/          # MCP server setup and transports
│   ├── mcp-server.ts
│   └── transports/  # stdio, http
├── tools/           # Tool implementations
│   ├── query-tools.ts
│   ├── browser-tools.ts
│   └── proxy-tools.ts
├── resources/       # Resource providers
├── prompts/         # Prompt templates
├── security/        # Permission guard, input validation
└── session/         # Browser session management
```
