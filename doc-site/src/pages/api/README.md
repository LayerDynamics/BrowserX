# BrowserX Playground API Routes

This directory contains API routes for the BrowserX Playground.

## Execute API (`/api/execute`)

The execute endpoint accepts POST requests with BrowserX queries and returns execution results.

### Request Format

```json
{
  "query": "SELECT title FROM \"https://example.com\"",
  "options": {
    "timeout": 30000,
    "captureScreenshots": true,
    "captureConsole": true
  }
}
```

### Response Format (Success)

```json
{
  "executionId": "exec_1234567890_abc123",
  "results": {
    "queryId": "query_1234567890_xyz789",
    "data": [...],
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
      "query": "...",
      "ast": {...},
      "stepsExecuted": 3,
      "estimatedCost": 500,
      "actualCost": 462.2,
      "browserNavigations": 1,
      "cacheHits": 0,
      "cacheMisses": 1
    }
  }
}
```

### Response Format (Error)

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later."
  }
}
```

### Rate Limiting

The API implements token bucket rate limiting:
- **Burst capacity**: 3 requests
- **Refill rate**: 1 token per 6 seconds (10 per minute)
- Rate limits are per client IP (from `x-forwarded-for` header)
- Returns HTTP 429 with `Retry-After: 6` header when rate limited

### Error Codes

- `RATE_LIMIT_EXCEEDED` (429) - Too many requests
- `INVALID_JSON` (400) - Request body is not valid JSON
- `INVALID_REQUEST_BODY` (400) - Missing or invalid fields
- `QUERY_EXECUTION_ERROR` (500) - Query execution failed

## BrowserX Integration Status

### Current Implementation (Mock)

The API currently returns **mock responses** to demonstrate the interface. This is because:

1. **Deno vs Node.js incompatibility**: BrowserX packages are Deno-based and cannot be directly imported in Astro's Node.js/npm environment
2. **Development mode**: Mock responses allow frontend development without requiring full backend setup

### Production Integration Options

#### Option 1: Separate BrowserX Service (Recommended)

Run BrowserX as a standalone Deno service and proxy requests:

```
Astro (Node.js) → HTTP → BrowserX Service (Deno) → Browser Engine
```

**Pros:**
- Clean separation of concerns
- Can scale independently
- No runtime compatibility issues

**Cons:**
- Additional service to deploy
- Network latency between services

#### Option 2: Deno Deploy

Deploy the entire application on Deno Deploy, which supports both Astro and BrowserX:

```
Deno Deploy (Astro + BrowserX in same runtime)
```

**Pros:**
- Single deployment target
- No compatibility issues
- Simpler architecture

**Cons:**
- Less flexibility in scaling
- Dependent on Deno Deploy platform

#### Option 3: Node.js Bridge Package

Create a bridge package that wraps BrowserX for Node.js:

```
Astro → @browserx/node-bridge → Deno subprocess → BrowserX
```

**Pros:**
- Looks like native Node.js integration
- Can be published to npm

**Cons:**
- Complex to maintain
- Overhead of subprocess communication
- Requires Deno runtime installed

### Testing

Test the API with curl:

```bash
# Basic query
curl -X POST http://localhost:4321/api/execute \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT title FROM \"https://example.com\""}'

# With options
curl -X POST http://localhost:4321/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT title FROM \"https://example.com\"",
    "options": {
      "timeout": 5000,
      "captureScreenshots": true
    }
  }'
```

### Next Steps

1. Implement separate BrowserX service (see Option 1 above)
2. Add WebSocket support for streaming updates
3. Add authentication/authorization
4. Add query validation endpoint
5. Add query history/persistence
