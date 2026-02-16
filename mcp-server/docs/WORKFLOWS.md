# BrowserX Workflow Examples

This document provides step-by-step workflow examples for common browser automation tasks.

## How Sessions Work

Sessions are backed by the Runtime's BrowserPool. Understanding this flow helps with debugging and resource management:

```
First browser tool call
    ↓
ServiceInitializer (lazy init)
    ↓
┌──────────────────────────────────┐
│ 1. Runtime starts                │  BrowserPool, HealthChecker,
│    (if not already running)      │  MetricsCollector, EventCoordinator
└──────────────────────────────────┘
    ↓
┌──────────────────────────────────┐
│ 2. SessionManager initializes    │  Wired to pool, health, metrics
│    - browserPool injected        │
│    - eventEmitter injected       │
│    - health check registered     │
│    - metrics collector registered│
└──────────────────────────────────┘
    ↓
┌──────────────────────────────────┐
│ 3. Session created               │  pool.acquire() → BrowserInstance
│    - Pool instance acquired      │  Session wraps the instance
│    - session_created event       │
└──────────────────────────────────┘
    ↓
┌──────────────────────────────────┐
│ 4. Agent uses session            │  navigate, click, type, screenshot
│    (sessionId passed to tools)   │
└──────────────────────────────────┘
    ↓
┌──────────────────────────────────┐
│ 5. Session closed                │  pool.release() → instance reused
│    - Pool instance released      │  session_closed event
│    - Or: idle timeout expires    │  session_expired event
└──────────────────────────────────┘
```

### Shutdown Ordering

When the MCP server shuts down, order matters:

1. **SessionManager shuts down first** — releases all pool instances
2. **Runtime shuts down second** — stops BrowserPool (closes remaining instances)

This prevents destroying pool instances while sessions still hold references to them.

---

## Workflow 1: Login and Extract Data

**Scenario**: Log into a website and extract data from a protected page.

### Steps

```
1. browser_navigate("https://example.com/login")
   → Returns: { sessionId: "sess_abc123", ... }

2. browser_wait("sess_abc123", type: "selector", selector: "#email")
   → Wait for login form to load

3. browser_type("sess_abc123", "#email", "user@example.com", clear: true)
   → Clear any existing text and type email

4. browser_type("sess_abc123", "#password", "password123", clear: true)
   → Type password

5. browser_click("sess_abc123", "button[type=submit]")
   → Submit login form

6. browser_wait("sess_abc123", type: "selector", selector: ".dashboard")
   → Wait for dashboard to confirm login success

7. browser_navigate("sess_abc123", "https://example.com/data")
   → Navigate to data page (session maintains login)

8. browser_query_dom("sess_abc123", ".data-row", extract: [
     { name: "id", attribute: "data-id" },
     { name: "name", getText: true },
     { name: "value", getText: true }
   ])
   → Extract data from page

9. browser_close_session("sess_abc123")
   → Clean up session
```

### Error Handling

- **Login fails**: Check for `.error-message` element after clicking submit
- **Data not found**: Verify selectors with `browser_query_dom` before extraction
- **Session expired**: Re-run from step 1 with new session

---

## Workflow 2: Form Filling with Validation

**Scenario**: Fill out a multi-field form and verify successful submission.

### Steps

```
1. browser_navigate("https://example.com/apply")
   → Returns: { sessionId: "sess_xyz789", ... }

2. browser_query_dom("sess_xyz789", "form input, form select, form textarea")
   → Discover all form fields and their selectors

3. browser_type("sess_xyz789", "#firstName", "John", clear: true)
4. browser_type("sess_xyz789", "#lastName", "Doe", clear: true)
5. browser_type("sess_xyz789", "#email", "john.doe@example.com", clear: true)
6. browser_type("sess_xyz789", "#phone", "555-123-4567", clear: true)

7. browser_click("sess_xyz789", "#terms-checkbox")
   → Check terms and conditions

8. browser_click("sess_xyz789", "button[type=submit]")
   → Submit form

9. browser_wait("sess_xyz789", type: "function",
     condition: "document.querySelector('.success-message') || document.querySelector('.error-message')")
   → Wait for either success or error

10. browser_query_dom("sess_xyz789", ".success-message, .error-message",
      extract: [{ name: "message", getText: true }])
    → Check submission result

11. browser_screenshot("sess_xyz789")
    → Capture result for verification

12. browser_close_session("sess_xyz789")
```

### Handling Validation Errors

```
After step 10, check the result:

If error message found:
  1. browser_query_dom("sess_xyz789", ".field-error", extract: [...])
     → Find which fields have errors
  2. Correct the fields using browser_type with clear: true
  3. Re-submit from step 8
```

---

## Workflow 3: Screenshot Comparison / Change Detection

**Scenario**: Monitor a page for visual or content changes.

### Initial Capture

```
1. browser_navigate("https://example.com/monitor")
   → Returns: { sessionId: "sess_mon001", ... }

2. browser_wait("sess_mon001", type: "selector", selector: ".content")
   → Ensure content is loaded

3. browser_screenshot("sess_mon001", fullPage: true)
   → Returns: { filePath: "...", data: "base64...", ... }
   → Store filePath as "baseline"

4. browser_query_dom("sess_mon001", ".key-metric",
     extract: [{ name: "value", getText: true }])
   → Store current values as baseline

5. browser_close_session("sess_mon001")
```

### Comparison Check (Later)

```
1. browser_navigate("https://example.com/monitor")
   → Returns: { sessionId: "sess_mon002", ... }

2. browser_wait("sess_mon002", type: "selector", selector: ".content")

3. browser_screenshot("sess_mon002", fullPage: true)
   → Returns current screenshot

4. browser_query_dom("sess_mon002", ".key-metric",
     extract: [{ name: "value", getText: true }])
   → Compare with baseline values

5. // Compare screenshots (visual diff)
   // Compare extracted values (data diff)
   // Report any changes

6. browser_close_session("sess_mon002")
```

---

## Workflow 4: Multi-Page Data Collection

**Scenario**: Navigate through pagination to collect data from multiple pages.

### Steps

```
1. browser_navigate("https://example.com/products?page=1")
   → Returns: { sessionId: "sess_collect", ... }

2. Initialize: allData = []

3. LOOP:
   a. browser_wait("sess_collect", type: "selector", selector: ".product-list")

   b. browser_query_dom("sess_collect", ".product", extract: [
        { name: "name", getText: true },
        { name: "price", getText: true },
        { name: "url", attribute: "href" }
      ])
      → Append results to allData

   c. browser_query_dom("sess_collect", ".pagination .next:not(.disabled)")
      → Check if next page exists

   d. If next page exists:
      browser_click("sess_collect", ".pagination .next")
      browser_wait("sess_collect", type: "selector", selector: ".product-list")
      → Go to step 3a

   e. If no next page: EXIT LOOP

4. browser_close_session("sess_collect")

5. Return allData
```

### Using BrowserX Query (Alternative)

```sql
-- Simpler for static pagination patterns:
FOR page IN RANGE(1, 10)
  NAVIGATE TO CONCAT('https://example.com/products?page=', page)
  SELECT name, price FROM '.product'
END
```

---

## Workflow 5: File Download Capture

**Scenario**: Navigate to a page and capture a dynamically generated file.

### Steps

```
1. browser_navigate("https://example.com/reports")
   → Returns: { sessionId: "sess_dl", ... }

2. browser_click("sess_dl", "#generate-report")
   → Trigger report generation

3. browser_wait("sess_dl", type: "selector", selector: "#download-link")
   → Wait for download link to appear

4. browser_query_dom("sess_dl", "#download-link",
     extract: [{ name: "href", attribute: "href" }])
   → Get the download URL

5. // Use the URL to fetch the file content
   // Or use browser_evaluate to read file data

6. browser_close_session("sess_dl")
```

---

## Workflow 6: JavaScript-Heavy SPA Navigation

**Scenario**: Navigate a single-page application with client-side routing.

### Steps

```
1. browser_navigate("https://spa.example.com", waitUntil: "networkidle")
   → Returns: { sessionId: "sess_spa", ... }
   → Use networkidle for SPAs that load data asynchronously

2. browser_wait("sess_spa", type: "function",
     condition: "window.__appReady === true")
   → Wait for app-specific ready state

3. browser_click("sess_spa", "[data-route='/dashboard']")
   → Click navigation element

4. browser_wait("sess_spa", type: "function",
     condition: "window.location.pathname === '/dashboard'")
   → Wait for route change

5. browser_wait("sess_spa", type: "selector", selector: ".dashboard-loaded")
   → Wait for dashboard content

6. browser_query_dom("sess_spa", ".dashboard-widget", extract: [...])
   → Extract data

7. browser_close_session("sess_spa")
```

### SPA-Specific Tips

- Always use `waitUntil: "networkidle"` for initial load
- Use function waits to check `window.location` for route changes
- Look for app-specific ready flags (e.g., `window.__dataLoaded`)
- Allow extra time for client-side rendering

---

## Anti-Patterns to Avoid

### 1. Time Waits Instead of Selector Waits

```
❌ BAD:
browser_wait(sessionId, type: "time", duration: 5000)
browser_click(sessionId, "#button")

✅ GOOD:
browser_wait(sessionId, type: "selector", selector: "#button")
browser_click(sessionId, "#button")
```

**Why**: Time waits are slow and unreliable. The element might load in 500ms (wasted 4.5s) or might not load even after 5s (fails).

### 2. Not Closing Sessions

```
❌ BAD:
browser_navigate(url1) → sessionId1
browser_navigate(url2) → sessionId2
browser_navigate(url3) → sessionId3
// Sessions never closed, resource leak

✅ GOOD:
browser_navigate(url1) → sessionId
// ... do work ...
browser_close_session(sessionId)
```

**Why**: Sessions consume memory and count toward `MCP_MAX_SESSIONS`. Leaked sessions block new operations.

### 3. Not Verifying Selectors

```
❌ BAD:
browser_click(sessionId, "#submit-button")
// Fails silently if selector doesn't exist

✅ GOOD:
browser_query_dom(sessionId, "#submit-button")
// If empty result, handle missing element
browser_click(sessionId, "#submit-button")
```

**Why**: Clicking/typing on non-existent elements fails. Verify first.

### 4. Forgetting SessionId

```
❌ BAD:
browser_navigate("https://example.com/login") → sessionId
browser_type(sessionId, "#email", "user@test.com")
browser_navigate("https://example.com/dashboard")  // Creates NEW session!
// Login state is lost

✅ GOOD:
browser_navigate("https://example.com/login") → sessionId
browser_type(sessionId, "#email", "user@test.com")
browser_navigate(sessionId, "https://example.com/dashboard")  // Same session
// Login state preserved
```

### 5. Ignoring Error Responses

```
❌ BAD:
browser_click(sessionId, "#button")
browser_type(sessionId, "#input", "text")
// Continues even if click failed

✅ GOOD:
result = browser_click(sessionId, "#button")
if (result.error) {
  // Handle error, maybe retry or fail gracefully
}
browser_type(sessionId, "#input", "text")
```

---

## BrowserX Query Alternatives

Some workflows can be simplified using `browserx_query`:

### Simple Extraction

```sql
-- Instead of navigate + query_dom:
SELECT title, price, description
FROM 'https://shop.com/product/123'
```

### Form Filling

```sql
NAVIGATE TO 'https://example.com/form'
INSERT 'john@example.com' INTO '#email'
INSERT 'John Doe' INTO '#name'
CLICK '#submit'
```

### Conditional Logic

```sql
IF EXISTS('#login-required') THEN
  INSERT 'user@test.com' INTO '#email'
  INSERT 'password' INTO '#password'
  CLICK '#login'
ELSE
  SELECT data FROM '.content'
END
```

### Looping

```sql
FOR page IN RANGE(1, 5)
  NAVIGATE TO CONCAT('https://example.com/page/', page)
  SELECT title, link FROM '.article'
END
```

Use `browserx_query_explain` to preview execution before running complex queries.

---

## Workflow 7: Monitoring and Debugging

**Scenario**: Check system health, diagnose resource issues, and monitor session usage.

### Check System Health

```
1. system_dashboard
   → Returns health status for all components:
     - session-manager: "healthy" or "degraded" (at max capacity)
     - browser-pool: total/idle/in-use instance counts
     - runtime: overall state

2. browser_list_sessions
   → Returns all active sessions with:
     - sessionId, age, last used time, current URL
```

### Diagnose "Cannot Create Session" Errors

```
1. browser_list_sessions
   → Check which sessions are active

2. Identify sessions that are no longer needed:
   - Look for old sessions (high age)
   - Look for idle sessions (high lastUsed time)

3. browser_close_session(oldSessionId)
   → Release the browser instance back to the pool

4. Retry your original operation
```

### Monitor Session Metrics

The Runtime exposes session metrics via `system_dashboard`:

- `browserx_mcp_active_sessions` — Current session count (gauge)
- `browserx_mcp_sessions_created_total` — Lifetime session creates (counter)
- `browserx_mcp_sessions_closed_total` — Lifetime session closes (counter)

A growing gap between created and closed counts indicates session leaks.
