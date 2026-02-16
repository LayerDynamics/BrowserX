---
name: using-browserx
description: Use when automating browsers, scraping web data, executing SQL-like queries against web pages, managing proxy caching or request interception, or building any browser automation workflow with BrowserX MCP tools
---

# Using BrowserX

## Overview

BrowserX is a composable browser toolkit exposed via MCP. It provides three tool categories: **Query Engine** (SQL-like declarative queries), **Browser Tools** (imperative session-based automation), and **Proxy Tools** (caching and request interception).

**Core principle:** Use `browserx_query` for simple one-shot operations. Use `browser_*` tools for multi-step workflows needing session persistence. Use `proxy_*` tools for network-level control.

**Additional documentation:**
- `mcp-server/docs/AGENT_GUIDE.md` - Comprehensive agent guide with error recovery
- `mcp-server/docs/WORKFLOWS.md` - Step-by-step workflow examples with anti-patterns

## When to Use

- Extracting data from web pages (scraping, monitoring)
- Automating browser interactions (form filling, clicking, navigation)
- Taking screenshots or generating PDFs of web pages
- Caching HTTP responses or blocking/modifying requests
- Running SQL-like queries against the DOM
- Any task involving BrowserX MCP tools (`mcp__browserx__*`)

## Tool Selection Decision

```
Need to do something with a web page?
├── Simple, one-shot extraction? → browserx_query (SQL-like)
├── Multi-step workflow (login, fill form, navigate, screenshot)? → browser_* tools
├── Block/modify network requests? → proxy_add_interceptor
├── Cache responses? → proxy_cache_set/get
└── Long-running query? → browserx_query_async + browserx_query_status
```

## Quick Reference: All Tools

### Query Tools
| Tool | Purpose |
|------|---------|
| `browserx_query` | Execute SQL-like query (sync) |
| `browserx_query_async` | Execute query async, returns queryId |
| `browserx_query_status` | Check async query progress |
| `browserx_query_cancel` | Cancel running async query |
| `browserx_query_explain` | Dry-run: get execution plan without executing |

### Browser Tools
| Tool | Purpose |
|------|---------|
| `browser_navigate` | Navigate to URL; creates session if no sessionId |
| `browser_click` | Click element (CSS or XPath selector) |
| `browser_type` | Type into input (with optional clear, delay) |
| `browser_screenshot` | Capture page/element screenshot (PNG/JPEG) |
| `browser_pdf` | Generate PDF (A4/Letter/Legal/A3) |
| `browser_evaluate` | Execute arbitrary JavaScript in page |
| `browser_query_dom` | Extract structured data from DOM elements |
| `browser_wait` | Wait for condition (time/selector/function) |
| `browser_close_session` | Release browser session resources |
| `browser_list_sessions` | List all active sessions |

### Proxy Tools
| Tool | Purpose |
|------|---------|
| `proxy_cache_get` | Retrieve cached value by key |
| `proxy_cache_set` | Store value with optional TTL (milliseconds) |
| `proxy_cache_clear` | Clear cache entries by regex pattern |
| `proxy_add_interceptor` | Add request interceptor (allow/block/modify) |
| `proxy_remove_interceptor` | Remove interceptor by ID |

## BrowserX Query Language (SQL-like)

This is the most common source of errors. The syntax is specific and must be exact.

### Statements

```sql
-- Extract data from a page
SELECT title, description FROM "https://example.com"

-- Navigate with proxy/browser configuration
NAVIGATE TO "https://api.example.com"
  WITH {
    proxy: { cache: true, headers: {"Authorization": "Bearer token"} },
    browser: { viewport: {width: 1920, height: 1080} }
  }
  CAPTURE response.body, dom.title

-- Insert values into form fields
INSERT "user@example.com" INTO "#email"
INSERT "password" INTO "#password"

-- Click elements
CLICK "#submit"

-- Conditional execution
IF EXISTS("#login-form") THEN
  INSERT "user@example.com" INTO "#email"
  CLICK "#submit"
ELSE
  SELECT "Already logged in"

-- Loop through URLs
FOR EACH url IN ["https://example1.com", "https://example2.com"]
  SELECT title, description FROM url

-- Configure engine settings
SET timeout = 30000
SET proxy.cache = true

-- Display state
SHOW cache
SHOW cookies
SHOW headers
```

### Operators

| Type | Operators |
|------|-----------|
| Comparison | `=`, `!=`, `>`, `>=`, `<`, `<=` |
| Logical | `AND`, `OR`, `NOT` |
| Arithmetic | `+`, `-`, `*`, `/`, `%` |
| String | `\|\|` (concat), `LIKE`, `MATCHES` |
| Collection | `IN`, `CONTAINS` |

### Built-in Functions

**DOM:**
- `TEXT(selector)` - Extract text content
- `HTML(selector)` - Extract inner HTML
- `ATTR(selector, name)` - Extract attribute value
- `COUNT(selector)` - Count matching elements
- `EXISTS(selector)` - Check if element exists

**String:**
- `UPPER(text)`, `LOWER(text)`, `TRIM(text)`
- `SUBSTRING(text, start, length)`
- `REPLACE(text, pattern, replacement)`
- `SPLIT(text, delimiter)`

**Network:**
- `HEADER(request, name)` - Get header value
- `STATUS(response)` - Get status code
- `BODY(response)` - Get response body
- `CACHED(url)` - Check if URL is cached

**Utility:**
- `PARSE_JSON(text)` - Parse JSON string
- `PARSE_HTML(text)` - Parse HTML string
- `WAIT(duration)` - Wait for duration
- `SCREENSHOT()` - Capture screenshot
- `PDF()` - Generate PDF

### Output Formats

`browserx_query` supports: `JSON` (default), `TABLE`, `CSV`, `HTML`, `XML`, `YAML`

## Session Management Pattern

Sessions are backed by the Runtime's **BrowserPool** — a unified resource pool that manages browser instance lifecycle. When you create a session, the SessionManager acquires a browser instance from the pool. When you close it, the instance is released back for reuse.

```
1. CREATE:  browser_navigate(url) → returns sessionId
              (acquires browser instance from BrowserPool)
2. USE:     Pass sessionId to ALL subsequent browser_* calls
3. CLEANUP: browser_close_session(sessionId) when done
              (releases instance back to pool for reuse)
```

**Critical rules:**
- `browser_navigate` WITHOUT sessionId creates a NEW session
- `browser_navigate` WITH sessionId reuses the existing session
- Sessions preserve: cookies, localStorage, navigation history, DOM state
- **Always close sessions** to release pool instances back for reuse
- Use `browser_list_sessions` to check active sessions
- Pool exhaustion error: `"Cannot create session: all browser pool slots are in use. Close an existing session first."`
- Use `system_dashboard` to check pool stats, health status, and session metrics

## Common Workflows

### Data Extraction (Simple)
```sql
-- Via browserx_query (one call)
SELECT title, price FROM "https://store.com/product/123"
```

### Data Extraction (Complex/Dynamic)
```
1. browser_navigate(url, waitUntil: "networkidle")  → sessionId
2. browser_wait(sessionId, type: "selector", selector: ".products-loaded")
3. browser_query_dom(sessionId, selector: ".product", extract: [
     {name: "title", getText: true},
     {name: "price", getText: true},
     {name: "link", attribute: "href"},
     {name: "sku", attribute: "data-sku"}
   ])
4. browser_close_session(sessionId)
```

### Form Automation (Login Flow)
```
1. browser_navigate("https://example.com/login")               → sessionId
2. browser_type(sessionId, "#email", "user@test.com", clear: true)
3. browser_type(sessionId, "#password", "pass123", clear: true)
4. browser_click(sessionId, "button[type=submit]")
5. browser_wait(sessionId, type: "selector", selector: ".dashboard")
6. browser_screenshot(sessionId, fullPage: true)
7. browser_close_session(sessionId)
```

### Blocking Trackers + Caching
```
1. proxy_add_interceptor(action: "block", urlPattern: ".*tracking\\.example\\.com.*")
2. proxy_add_interceptor(action: "modify", urlPattern: ".*api\\.example\\.com.*",
     modifications: {headers: {"Cache-Control": "max-age=300"}})
3. proxy_cache_set(key: "api-response", value: <data>, ttl: 300000)  // 5 min
4. proxy_cache_get(key: "api-response")  // retrieve later
```

### Validate Query Before Running
```
1. browserx_query_explain(query)  → execution plan, cost estimate
2. browserx_query(query)          → actual execution
```

### Long-Running Operations
```
1. browserx_query_async(query, timeout: 60000)  → queryId
2. browserx_query_status(queryId)                → progress %
3. browserx_query_cancel(queryId)                → if needed
```

## Waiting Strategies (Ranked by Robustness)

1. **`browser_wait` with selector** - Wait for specific DOM element. Most reliable.
   ```
   browser_wait(sessionId, type: "selector", selector: ".loaded", timeout: 10000)
   ```

2. **`browser_wait` with function** - Wait for JavaScript condition. For compound conditions.
   ```
   browser_wait(sessionId, type: "function",
     condition: "document.readyState === 'complete' && window.location.pathname === '/dashboard'",
     timeout: 10000)
   ```

3. **`browser_wait` with time** - Fixed delay. Last resort only.
   ```
   browser_wait(sessionId, type: "time", duration: 3000)
   ```

**Never use time waits when a selector or function wait would work.** Time waits are fragile and slow.

## MCP Server Setup

### Starting the Server
```bash
# stdio transport (for Claude Desktop)
deno task mcp:start

# HTTP transport (for custom integrations)
deno task mcp:start:http
```

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `stdio` | Transport: `stdio` or `http` |
| `MCP_PORT` | `3000` | HTTP port |
| `MCP_PERMISSIONS` | `AUTOMATION` | Level: `READONLY`, `AUTOMATION`, `FULL` |
| `MCP_MAX_SESSIONS` | `10` | Max concurrent browser sessions |

### Permission Levels
- **READONLY** - Query data only, no navigation or mutations
- **AUTOMATION** - Navigate, click, type, screenshot (default)
- **FULL** - All capabilities including cache manipulation

### Claude Desktop Integration
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

### MCP Resources

**Page Resources** (`page://{sessionId}/*`):
- `page://{sessionId}/content` - Full page HTML
- `page://{sessionId}/screenshot` - Current viewport screenshot
- `page://{sessionId}/title` - Document title
- `page://{sessionId}/url` - Current URL

**Metrics Resources**:
- `metrics://query-engine` - Query execution stats
- `metrics://browser-pool` - Session pool health
- `metrics://runtime` - Runtime performance
- `metrics://cache` - Cache statistics

**Tip**: Use resources for passive state retrieval; use tools for actions.

## Error Recovery Strategies

### Timeout Errors
**Symptoms**: Tool returns timeout error, operation did not complete
**Recovery**:
1. Increase `timeout` parameter
2. For navigation, try `waitUntil: "domcontentloaded"` instead of `"load"`
3. Verify selector exists with `browser_query_dom` first

### Pool Exhaustion
**Symptoms**: `Cannot create session: all browser pool slots are in use`
**Recovery**:
1. Close unused sessions with `browser_close_session`
2. Check `browser_list_sessions` for forgotten sessions
3. Use `system_dashboard` to see pool stats (total/idle/in-use)
4. Wait for idle timeout (30 min) to auto-clean stale sessions

### Session Not Found
**Symptoms**: `Session not found` or `Invalid session ID`
**Recovery**:
1. Create new session with `browser_navigate` (no sessionId)
2. Re-execute workflow from the beginning
3. Check `browser_list_sessions` for active sessions

### Element Not Found
**Symptoms**: `Element not found`, `No element matches selector`
**Recovery**:
1. Verify selector with `browser_query_dom(sessionId, yourSelector)`
2. Wait for element: `browser_wait(sessionId, type: "selector", selector: yourSelector)`
3. Try alternative selectors (ID vs class vs XPath)

### Navigation Failed
**Symptoms**: `Navigation failed`, `Net error`
**Recovery**:
1. Verify URL is valid and accessible
2. Check for redirects blocking automation
3. Try different `waitUntil` options

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Wrong query syntax: `SET 'selector' TO 'value'` | Use `INSERT "value" INTO "selector"` |
| Wrong query syntax: `INSERT CLICK ON 'selector'` | Use `CLICK "selector"` |
| Forgetting sessionId on subsequent calls | Always pass sessionId from `browser_navigate` response |
| Not waiting after navigation/click | Use `browser_wait` with selector or function, not time |
| Using time-based waits | Use selector or function waits instead |
| Not closing sessions | Always `browser_close_session` when done |
| Guessing query syntax | Use `browserx_query_explain` to validate first |
| Cache TTL in seconds | TTL is in **milliseconds** (5 min = 300000) |
| Missing WITH clause for NAVIGATE | Use `NAVIGATE TO url WITH {proxy: {...}, browser: {...}}` |
| Missing CAPTURE clause | Use `NAVIGATE TO url CAPTURE response.body, dom.title` |
| Not checking proxy controller availability | Proxy tools return error if proxy not enabled in config |

## Architecture Reference

```
Query Engine (SQL-like)     →  Declarative interface for AI/humans
        ↓
MCP Server                  →  Tool API (stdio/HTTP transport)
  ├── SessionManager        →  Manages browser sessions (acquire/release from pool)
  └── ServiceInitializer    →  Lazy init: Runtime starts on first browser tool call
        ↓
Runtime                     →  Orchestrates browser + proxy + query
  ├── BrowserPool           →  Manages browser instance lifecycle (acquire/release)
  ├── HealthChecker         →  Component health monitoring (session-manager, pool)
  ├── MetricsCollector      →  Session and pool metrics
  └── EventCoordinator      →  session_created/closed/expired events
        ↓
Proxy Engine                →  Traffic routing, middleware, caching
        ↓
Browser Engine              →  HTML/CSS parsing, JS execution, rendering
```

**Session flow:** `browser_navigate` → `SessionManager.createSession()` → `BrowserPool.acquire()` → `BrowserInstance` → session wraps instance

**Shutdown order:** SessionManager (releases all pool instances) → Runtime (stops BrowserPool)

Query pipeline: `Query String → Lexer → Parser → Semantic Analyzer → Optimizer → Planner → Executor → Formatter`
