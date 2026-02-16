# BrowserX MCP Server - Agent Guide

This guide helps AI agents effectively use BrowserX MCP tools for browser automation, web scraping, and proxy control.

## Tool Selection

Choose the right tool for your task:

```
Need to interact with a web page?
├── Simple one-shot data extraction?
│   └── browserx_query (SQL-like, fastest for simple extractions)
│
├── Multi-step workflow (navigate → click → type → screenshot)?
│   └── browser_* tools (session-based, full control)
│
├── Check query before running?
│   └── browserx_query_explain (dry-run, returns execution plan)
│
├── Long-running query?
│   └── browserx_query_async + browserx_query_status
│
├── Cache or intercept network requests?
│   └── proxy_* tools
│
└── Check server health?
    └── system_dashboard
```

### When to Use `browserx_query` vs `browser_*` Tools

| Use `browserx_query` when... | Use `browser_*` tools when... |
|------------------------------|-------------------------------|
| Extracting data from a single page | Need to interact (click, type, scroll) |
| Simple CSS selector-based extraction | Multi-page navigation workflow |
| No authentication required | Login/authentication flows |
| Static content | Dynamic SPAs that load data via JavaScript |
| One-shot operation | Need to maintain session state |

## Session Management

**Critical**: Sessions are the foundation of multi-step browser workflows.

### Architecture

Sessions are backed by the Runtime's **BrowserPool**, a unified resource pool that manages browser instance lifecycle:

```
Agent Request
    ↓
MCP Tool (browser_navigate, browser_click, etc.)
    ↓
SessionManager ←→ BrowserPool (acquire/release instances)
    ↓                   ↓
BrowserSession      Runtime Lifecycle
(cookies, DOM,      (health checks, metrics,
 nav history)        events, idle cleanup)
```

When a session is created, the SessionManager acquires a browser instance from the pool. When closed, the instance is released back for reuse. This means:

- Browser instances are **reused** across sessions (faster creation)
- The Runtime manages instance **health, metrics, and cleanup**
- Pool exhaustion gives a clear error instead of silently failing

### Session Lifecycle

```
1. CREATE:  browser_navigate(url) → returns sessionId
              (SessionManager acquires instance from BrowserPool)
2. USE:     Pass sessionId to ALL subsequent browser_* calls
3. CLEANUP: browser_close_session(sessionId) when done
              (Instance released back to BrowserPool for reuse)
```

### Important Rules

- `browser_navigate` WITHOUT `sessionId` creates a NEW session
- `browser_navigate` WITH `sessionId` reuses the existing session
- Sessions preserve: cookies, localStorage, navigation history, DOM state
- **ALWAYS** close sessions to free resources back to the pool
- Use `browser_list_sessions` to check active sessions
- Max concurrent sessions: controlled by `MCP_MAX_SESSIONS` (default: 10)
- If all pool slots are in use, you'll get: `"Cannot create session: all browser pool slots are in use. Close an existing session first."`

### Example: Correct Session Usage

```
✅ CORRECT:
1. browser_navigate("https://example.com") → sessionId: "abc123"
2. browser_click("abc123", "#login-btn")
3. browser_type("abc123", "#email", "user@test.com")
4. browser_screenshot("abc123")
5. browser_close_session("abc123")

❌ WRONG:
1. browser_navigate("https://example.com") → sessionId: "abc123"
2. browser_click("xyz789", "#login-btn")  // Wrong sessionId!
3. browser_navigate("https://example.com") // Creates NEW session, loses state!
```

## Error Recovery Strategies

### Timeout Errors

**Symptoms**: Tool returns timeout error, operation did not complete

**Recovery**:
1. Increase `timeout` parameter (default is often 30000ms)
2. For navigation, try `waitUntil: "domcontentloaded"` instead of `"load"`
3. Verify the selector exists with `browser_query_dom` first
4. Check if page requires more time to load dynamic content

### Pool Exhaustion

**Symptoms**: `Cannot create session: all browser pool slots are in use`

**Recovery**:
1. Close unused sessions with `browser_close_session`
2. Check `browser_list_sessions` for sessions you may have forgotten
3. Check `system_dashboard` for pool stats (total, idle, in-use instances)
4. Wait for idle sessions to be auto-cleaned (30 min timeout)

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
2. Wait for element to appear: `browser_wait(sessionId, type: "selector", selector: yourSelector)`
3. Check if element is in an iframe (not supported yet)
4. Try alternative selectors (ID vs class vs XPath)

### Navigation Failed

**Symptoms**: `Navigation failed`, `Net error`

**Recovery**:
1. Verify URL is valid and accessible
2. Check for redirects that may block automation
3. Try with different `waitUntil` options
4. Check if site requires authentication

### Permission Denied

**Symptoms**: `Permission denied`, `Operation not allowed`

**Recovery**:
1. Check MCP server permission level (`MCP_PERMISSIONS` env var)
2. `READONLY` - Query only, no navigation
3. `AUTOMATION` - Full browser control (default)
4. `FULL` - Browser + proxy control

## Performance Tips

### Navigation Speed

```typescript
// Faster (waits for DOM only):
browser_navigate(url, waitUntil: "domcontentloaded")

// Slower but more complete (waits for all resources):
browser_navigate(url, waitUntil: "load")

// Slowest but best for SPAs (waits for network idle):
browser_navigate(url, waitUntil: "networkidle")
```

### Waiting Strategies (Ranked by Reliability)

1. **Selector wait** (BEST) - Wait for specific element:
   ```
   browser_wait(sessionId, type: "selector", selector: ".loaded")
   ```

2. **Function wait** (GOOD) - Wait for JavaScript condition:
   ```
   browser_wait(sessionId, type: "function", condition: "window.dataLoaded === true")
   ```

3. **Time wait** (AVOID) - Fixed delay:
   ```
   browser_wait(sessionId, type: "time", duration: 3000)
   ```
   **Only use time waits as last resort. They are slow and unreliable.**

### Session Reuse

```
// Efficient: Reuse session for multiple pages on same site
browser_navigate(sessionId, "https://site.com/page1")
browser_navigate(sessionId, "https://site.com/page2")
browser_navigate(sessionId, "https://site.com/page3")

// Inefficient: Creating new session per page
browser_navigate("https://site.com/page1")  // New session
browser_navigate("https://site.com/page2")  // New session
browser_navigate("https://site.com/page3")  // New session
```

### Query vs DOM Tools

```
// Use browserx_query for simple extraction (faster, single call):
browserx_query("SELECT title, price FROM 'https://shop.com/product'")

// Use browser_* for complex interaction (multiple calls):
browser_navigate("https://shop.com")
browser_click(sessionId, ".category")
browser_wait(sessionId, type: "selector", selector: ".products")
browser_query_dom(sessionId, ".product", extract: [{name: "title", getText: true}])
```

## Tool Reference Quick Guide

### Browser Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `browser_navigate` | Go to URL | `url`, `sessionId?`, `waitUntil?` |
| `browser_click` | Click element | `sessionId`, `selector` |
| `browser_type` | Type text | `sessionId`, `selector`, `text`, `clear?` |
| `browser_screenshot` | Capture image | `sessionId`, `fullPage?`, `selector?` |
| `browser_pdf` | Generate PDF | `sessionId`, `format?` |
| `browser_evaluate` | Run JavaScript | `sessionId`, `script` |
| `browser_query_dom` | Extract data | `sessionId`, `selector`, `extract` |
| `browser_wait` | Wait for condition | `sessionId`, `type`, `selector/condition/duration` |
| `browser_close_session` | End session | `sessionId` |
| `browser_list_sessions` | List active | (none) |

### Query Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `browserx_query` | Execute query | `query`, `format?` |
| `browserx_query_explain` | Analyze plan | `query` |
| `browserx_query_async` | Start async | `query`, `timeout?` |
| `browserx_query_status` | Check progress | `queryId` |
| `browserx_query_cancel` | Stop query | `queryId` |

### Proxy Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `proxy_cache_get` | Get cached | `key` |
| `proxy_cache_set` | Store value | `key`, `value`, `ttl?` |
| `proxy_cache_clear` | Clear cache | `pattern` |
| `proxy_add_interceptor` | Add rule | `urlPattern`, `action` |
| `proxy_remove_interceptor` | Remove rule | `interceptorId` |

## Common Patterns

### Login Flow

```
1. browser_navigate(loginUrl) → sessionId
2. browser_wait(sessionId, type: "selector", selector: "#email")
3. browser_type(sessionId, "#email", "user@example.com", clear: true)
4. browser_type(sessionId, "#password", "password123", clear: true)
5. browser_click(sessionId, "button[type=submit]")
6. browser_wait(sessionId, type: "selector", selector: ".dashboard")
```

### Data Extraction

```
1. browser_navigate(url) → sessionId
2. browser_wait(sessionId, type: "selector", selector: ".data-loaded")
3. browser_query_dom(sessionId, ".item", extract: [
     {name: "title", getText: true},
     {name: "link", attribute: "href"},
     {name: "price", getText: true}
   ])
4. browser_close_session(sessionId)
```

### Form Submission

```
1. browser_navigate(formUrl) → sessionId
2. browser_query_dom(sessionId, "input, select") // Discover fields
3. browser_type(sessionId, "#field1", "value1", clear: true)
4. browser_type(sessionId, "#field2", "value2", clear: true)
5. browser_click(sessionId, "button[type=submit]")
6. browser_wait(sessionId, type: "function", condition: "!document.querySelector('.error')")
7. browser_screenshot(sessionId) // Capture result
8. browser_close_session(sessionId)
```

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Correct Approach |
|--------------|--------------|------------------|
| Time waits instead of selector waits | Slow, unreliable | Use `browser_wait` with `type: "selector"` |
| Not closing sessions | Resource leak, hits max sessions | Always call `browser_close_session` |
| Not verifying selectors | Clicks/types fail silently | Use `browser_query_dom` first |
| Forgetting sessionId | Creates new session, loses state | Pass sessionId to ALL calls |
| Hardcoded timeouts | Fails on slow networks | Use `waitUntil` and selector waits |
| Ignoring errors | Workflow continues incorrectly | Check each tool's response |

## Monitoring and Health

### System Dashboard

Use `system_dashboard` to check the health of the MCP server and its subsystems:

- **Session Manager**: Reports `healthy` (has capacity) or `degraded` (at max sessions)
- **Browser Pool**: Shows total, idle, and in-use instance counts
- **Runtime**: Overall system state and component health

### Session Metrics

The Runtime tracks these session metrics (available via `system_dashboard`):

| Metric | Type | Description |
|--------|------|-------------|
| `browserx_mcp_active_sessions` | gauge | Currently active sessions |
| `browserx_mcp_sessions_created_total` | counter | Total sessions created |
| `browserx_mcp_sessions_closed_total` | counter | Total sessions closed |

### Session Events

The Runtime event system tracks session lifecycle:

- `session_created` — New session acquired a pool instance
- `session_closed` — Session released its pool instance (manual close)
- `session_expired` — Session was idle too long and auto-cleaned

### Resource Management

Sessions are automatically managed:

- **Idle timeout**: Sessions unused for 30 minutes are automatically closed
- **Pool reuse**: Released browser instances return to the pool for reuse
- **Shutdown ordering**: On server shutdown, all sessions release their pool instances before the pool itself stops

## Data Persistence

Screenshots and activity logs are automatically saved:

```
.browserx/usage_data/
├── screenshots/YYYY-MM-DD/{timestamp}_{id}.png
├── logs/YYYY-MM-DD.jsonl
└── metadata/{sessionId}.json
```

The `browser_screenshot` tool returns `filePath` alongside the image data, allowing reference to saved screenshots.
