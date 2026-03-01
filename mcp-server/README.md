# BrowserX MCP Server

Model Context Protocol (MCP) server that exposes BrowserX capabilities to LLMs like Claude, enabling AI-driven browser automation, web scraping, and proxy control.

**For AI Agents**: See [docs/AGENT_GUIDE.md](./docs/AGENT_GUIDE.md) for tool selection, session management, and error recovery. See [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) for step-by-step workflow examples.

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
| `MCP_PORT` | `9847` | HTTP port (if http transport) |
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

### Graph Visualization Tools

| Tool | Description |
|------|-------------|
| `browserx_visualize_dom` | Visualize DOM tree as SVG graph |
| `browserx_dependency_graph` | Visualize query execution dependency graph |
| `browserx_plugin_graph` | Visualize runtime plugin dependency graph |

## Resources

MCP resources provide passive state retrieval (read-only). Use **tools** for actions.

### Page Resources

Access current page state for active browser sessions:

| Resource URI | Description | Returns |
|-------------|-------------|---------|
| `page://{sessionId}/content` | Full page HTML | HTML string |
| `page://{sessionId}/screenshot` | Current viewport screenshot | Base64 PNG image |
| `page://{sessionId}/title` | Document title | String |
| `page://{sessionId}/url` | Current URL | String |

**Usage**: Replace `{sessionId}` with the session ID from `browser_navigate`.

### Metrics Resources

Monitor server and engine performance:

| Resource URI | Description | Returns |
|-------------|-------------|---------|
| `metrics://query-engine` | Query execution stats | Query count, avg time, cache stats |
| `metrics://browser-pool` | Browser session pool | Active sessions, available capacity |
| `metrics://runtime` | Runtime performance | Memory usage, uptime, request rate |
| `metrics://cache` | Cache statistics | Entries, hit rate, size |

### Visibility Resources

Server dashboard and operation tracking:

| Resource URI | Description | Returns |
|-------------|-------------|---------|
| `visibility://dashboard` | Server health dashboard | Status, active operations, errors |
| `visibility://operations` | Running operations | Active tool calls, progress |

### When to Use Resources vs Tools

| Use Resources when... | Use Tools when... |
|-----------------------|-------------------|
| Checking current state | Performing actions |
| Monitoring metrics | Navigating or interacting |
| Passive observation | Modifying state |
| Getting screenshots without navigation | Taking fresh screenshots |

## Prompts

Pre-built workflow templates for common automation tasks:

| Prompt | Use When | Inputs |
|--------|----------|--------|
| `extract-data` | Scraping data from a page | `url`, `dataDescription` |
| `fill-form` | Automating form submission | `url`, `formFields` (JSON) |
| `monitor-page` | Detecting page changes | `url`, `selector`, `description` |
| `screenshot-with-context` | Capturing page with metadata | `url` |
| `multi-step-workflow` | Executing step sequences | `steps` (JSON array) |
| `query-builder` | Building BrowserX queries | `task`, `url` (optional) |

**Example**: Use `extract-data` prompt with:
- `url`: "https://shop.example.com/products"
- `dataDescription`: "product names, prices, and image URLs"

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

## Data Persistence

Screenshots and activity data are automatically saved to persistent storage:

```text
.browserx/usage_data/
├── screenshots/          # Saved screenshots organized by date
│   └── YYYY-MM-DD/
│       └── {timestamp}_{id}.png
├── logs/                 # Daily activity logs in JSONL format
│   └── YYYY-MM-DD.jsonl
└── metadata/             # Session metadata
    └── {sessionId}.json
```

### What Gets Saved

| Activity | Location | Format |
|----------|----------|--------|
| Screenshots | `screenshots/YYYY-MM-DD/` | PNG files |
| Navigation | `logs/YYYY-MM-DD.jsonl` | JSON lines |
| Clicks | `logs/YYYY-MM-DD.jsonl` | JSON lines |
| Queries | `logs/YYYY-MM-DD.jsonl` | JSON lines |
| Errors | `logs/YYYY-MM-DD.jsonl` | JSON lines |
| Session info | `metadata/{sessionId}.json` | JSON |

### Screenshot Response

The `browser_screenshot` tool returns both the image data AND the saved file path:

```json
{
  "sessionId": "session-123",
  "format": "png",
  "size": 45678,
  "filePath": ".browserx/usage_data/screenshots/2024-01-15/1705312345_abc123.png",
  "_image": {
    "data": "base64...",
    "mimeType": "image/png"
  }
}
```

### Disabling Persistence

Activity tracking can be disabled via the ActivityTracker:

```typescript
context.activityTracker.setEnabled(false);
```

## Runtime Integration

The MCP server is fully integrated with the BrowserX Runtime lifecycle:

- **SessionManager** delegates browser instance lifecycle to Runtime's `BrowserPool` (acquire/release)
- **ServiceInitializer** provides lazy initialization — Runtime starts on first browser tool call, not at server startup
- **Health checks**: `session-manager` → healthy/degraded based on capacity
- **Metrics**: `browserx_mcp_active_sessions`, `sessions_created_total`, `sessions_closed_total`
- **Critical shutdown ordering**: SessionManager → Runtime (sessions release pool instances first)
- Falls back to standalone `BrowserEngine` creation when no pool is provided (legacy mode)

## Architecture

```text
MCP Server
├── server/          # MCP server setup and transports
│   ├── mcp-server.ts
│   └── transports/  # stdio, http
├── tools/           # Tool implementations
│   ├── query-tools.ts
│   ├── browser-tools.ts
│   ├── proxy-tools.ts
│   └── graph-tools.ts  # DOM, dependency, plugin graph visualization
├── resources/       # Resource providers
├── prompts/         # Prompt templates
├── security/        # Permission guard, input validation
├── activity/        # Activity tracking and persistence
│   ├── ActivityTracker.ts  # File-based persistence
│   └── activity-logger.ts  # Console logging
└── session/         # Browser session management
```
