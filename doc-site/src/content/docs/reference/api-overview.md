---
title: API Overview
description: Complete reference for the BrowserX REST API endpoints, query language statements, and TypeScript interfaces.
---

## REST API Endpoints

The BrowserX API service (runs on port 8080 in Docker, proxied through the doc site) exposes these endpoints:

### POST /execute

Execute a BrowserX query and return results.

**Request:**

```json
{
  "query": "SELECT title FROM \"https://example.com\"",
  "options": {
    "timeout": 30000,
    "captureScreenshots": false,
    "captureConsole": false
  }
}
```

**Response (success):**

```json
{
  "executionId": "exec_1234567890_abc123def",
  "results": {
    "queryId": "query_1234567890_xyz",
    "data": [{ "title": "Example Domain" }],
    "timing": {
      "lexerTime": 2.5,
      "parserTime": 3.1,
      "semanticAnalysisTime": 1.8,
      "optimizationTime": 2.3,
      "planningTime": 1.5,
      "executionTime": 450.2,
      "formattingTime": 0.8,
      "totalTime": 462.2
    },
    "metadata": {
      "stepsExecuted": 3,
      "browserNavigations": 1,
      "cacheHits": 0,
      "cacheMisses": 1
    }
  }
}
```

**Error Codes:**

| Code | Status | Meaning |
|------|--------|---------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests (10/min) |
| `INVALID_JSON` | 400 | Malformed request body |
| `INVALID_REQUEST_BODY` | 400 | Missing or invalid `query` field |
| `QUERY_EXECUTION_ERROR` | 500 | BrowserX engine error |

### POST /validate

Validate a query without executing it.

**Request:**

```json
{ "query": "SELECT title FROM \"https://example.com\"" }
```

**Response (valid):**

```json
{ "valid": true, "statements": 1 }
```

**Response (invalid):**

```json
{
  "valid": false,
  "errors": [{ "line": 1, "column": 8, "message": "Expected FROM keyword" }]
}
```

### GET /health

Health check endpoint. Returns `{"status": "ok"}` with HTTP 200.

---

## Query Language Statements

| Statement | Description | Example |
|-----------|-------------|---------|
| `SELECT` | Extract data from a page | `SELECT title FROM "https://example.com"` |
| `NAVIGATE` | Load a URL with options | `NAVIGATE TO "https://app.example.com"` |
| `CLICK` | Click a DOM element | `CLICK "#submit-button"` |
| `INSERT` | Type text into an input | `INSERT "hello" INTO "#search"` |
| `UPDATE` | Modify element attributes | `UPDATE ".badge" SET text = "new"` |
| `DELETE` | Remove elements | `DELETE ".cookie-banner"` |
| `IF EXISTS` | Conditional execution | `IF EXISTS("#login") THEN CLICK "#login"` |
| `FOR` | Loop over elements | `FOR item IN ".list-item" SELECT item.text` |
| `SET` | Assign variables | `SET $url = "https://example.com"` |
| `SHOW` | Display values | `SHOW $result` |
| `WITH` | Execute with options | `WITH { timeout: 5000 } SELECT title FROM $url` |
| `SCREENSHOT` | Capture page image | `SCREENSHOT AS "page.png"` |
| `WAIT` | Wait for selector/duration | `WAIT FOR "#content" TIMEOUT 5000` |
| `PDF` | Export page to PDF | `PDF AS "report.pdf"` |

---

## TypeScript Interfaces

### QueryEngine

```typescript
import { QueryEngine } from "@browserx/query-engine";

const engine = new QueryEngine(config?: QueryEngineConfig);

// Execute a query and return results
await engine.execute(query: string, options?: ExecuteOptions): Promise<QueryResult>

// Stream results as they arrive
engine.executeAsync(query: string, options?: ExecuteOptions): AsyncIterableIterator<QueryEvent>

// Get status of a running query
engine.getQueryStatus(queryId: string): QueryStatus | undefined
```

### QueryEngineConfig

```typescript
interface QueryEngineConfig {
  browser?: {
    headless?: boolean;      // default: true
    timeout?: number;        // default: 30000ms
    viewport?: { width: number; height: number };
  };
  proxy?: {
    enabled?: boolean;       // default: false
    url?: string;
    cache?: { enabled?: boolean; ttl?: number };
  };
  security?: {
    allowedDomains?: string[];
    maxRedirects?: number;
  };
}
```

### QueryResult

```typescript
interface QueryResult {
  queryId: string;
  data: unknown;
  timing: {
    lexerTime: number;
    parserTime: number;
    semanticAnalysisTime: number;
    optimizationTime: number;
    planningTime: number;
    executionTime: number;
    formattingTime: number;
    totalTime: number;
  };
  metadata: {
    query: string;
    ast: unknown;
    stepsExecuted: number;
    estimatedCost: number;
    actualCost: number;
    browserNavigations: number;
    cacheHits: number;
    cacheMisses: number;
  };
}
```

---

## MCP Tool Reference

When using BrowserX via the MCP server, the following tools are available to AI agents:

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to a URL |
| `browser_screenshot` | Capture a screenshot |
| `browser_click` | Click an element by selector |
| `browser_type` | Type text into an input |
| `browserx_query` | Execute a BrowserX SQL-like query |
| `browser_get_page_content` | Get current page DOM/text |
| `browser_evaluate` | Execute JavaScript in the page |

See [MCP Tools](/mcp/tools/) for full tool documentation.
