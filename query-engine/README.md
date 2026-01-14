# Query Engine

The Query Engine is a unified interface layer that provides declarative, SQL-like control over both the Browser Engine and Proxy Engine in BrowserX.

## Overview

Instead of imperatively calling individual APIs, express your intent through queries that the engine translates into coordinated actions across browser and proxy subsystems.

```sql
-- Extract product price from a website
SELECT price, title FROM "https://example.com/product/123"

-- Navigate with proxy configuration
NAVIGATE TO "https://api.example.com"
  WITH {
    proxy: { cache: true, headers: {"Authorization": "Bearer token"} }
  }
  CAPTURE response.body, dom.title
```

## Architecture

The Query Engine follows a multi-stage compilation and execution pipeline:

```
Query String → Lexer → Parser → Semantic Analyzer → Optimizer → Planner → Executor → Formatter → Result
```

### Pipeline Stages

1. **Lexer** - Tokenizes query string into token stream
2. **Parser** - Builds Abstract Syntax Tree (AST) from tokens
3. **Semantic Analyzer** - Type checking and validation
4. **Optimizer** - Query transformation and optimization
5. **Planner** - Physical execution plan generation
6. **Executor** - Step-by-step query execution
7. **Formatter** - Result formatting (JSON, table, CSV, etc.)

## Installation

```typescript
import { QueryEngine } from "./query-engine/mod.ts";

// Create and initialize engine
const engine = new QueryEngine({
  browser: {
    headless: true,
    defaultTimeout: 30000,
  },
  proxy: {
    enabled: true,
    defaultCache: true,
  },
  security: {
    permissions: ["NAVIGATE_PUBLIC", "READ_COOKIES", "SCREENSHOT"],
  },
});

await engine.initialize();
```

## Usage Examples

### Basic Data Extraction

```typescript
// Execute a query
const result = await engine.execute(
  `SELECT title, description FROM "https://example.com"`,
);

console.log(result.data);
// { title: "Example Domain", description: "..." }
```

### Navigation with Options

```typescript
const result = await engine.execute(`
  NAVIGATE TO "https://api.example.com/users"
    WITH {
      proxy: {
        headers: {"Authorization": "Bearer token123"},
        cache: false
      },
      browser: {
        viewport: {width: 1920, height: 1080}
      }
    }
    CAPTURE response.status, response.body
`);
```

### Conditional Execution

```typescript
const result = await engine.execute(`
  IF EXISTS("#login-form") THEN
    INSERT "user@example.com" INTO "#email"
    INSERT "password" INTO "#password"
    CLICK "#submit"
  ELSE
    SELECT "Already logged in"
`);
```

### Iteration

```typescript
const urls = ["https://example1.com", "https://example2.com", "https://example3.com"];

const result = await engine.execute(`
  FOR EACH url IN ${JSON.stringify(urls)}
    SELECT title, description FROM url
`);
```

### Async Execution

```typescript
// Start query asynchronously
const queryId = await engine.executeAsync(`
  SELECT * FROM "https://slow-site.com"
`);

// Check status
const status = await engine.getQueryStatus(queryId);
console.log(`Progress: ${status.progress}%`);

// Cancel if needed
await engine.cancelQuery(queryId);
```

## Query Language Features

### Statements

- **SELECT** - Extract data from sources
- **NAVIGATE** - Navigate to URLs
- **SET** - Configure engine settings
- **SHOW** - Display state (cache, cookies, headers, etc.)
- **FOR** - Iteration
- **IF** - Conditional execution
- **INSERT** - Insert values into form fields
- **UPDATE** - Update element properties
- **DELETE** - Delete elements
- **WITH** - Common Table Expressions (CTEs)

### Operators

- **Comparison**: `=`, `!=`, `>`, `>=`, `<`, `<=`
- **Logical**: `AND`, `OR`, `NOT`
- **Arithmetic**: `+`, `-`, `*`, `/`, `%`
- **String**: `||` (concatenation), `LIKE`, `MATCHES`
- **Collection**: `IN`, `CONTAINS`

### Built-in Functions

**String Functions:**

- `UPPER(text)`, `LOWER(text)`, `TRIM(text)`
- `SUBSTRING(text, start, length)`
- `REPLACE(text, pattern, replacement)`
- `SPLIT(text, delimiter)`

**DOM Functions:**

- `TEXT(selector)` - Extract text content
- `HTML(selector)` - Extract HTML
- `ATTR(selector, name)` - Extract attribute
- `COUNT(selector)` - Count matching elements
- `EXISTS(selector)` - Check if element exists

**Network Functions:**

- `HEADER(request, name)` - Get header value
- `STATUS(response)` - Get status code
- `BODY(response)` - Get response body
- `CACHED(url)` - Check if URL is cached

**Utility Functions:**

- `PARSE_JSON(text)` - Parse JSON string
- `PARSE_HTML(text)` - Parse HTML string
- `WAIT(duration)` - Wait for duration
- `SCREENSHOT()` - Capture screenshot
- `PDF()` - Generate PDF

## Configuration

```typescript
interface QueryEngineConfig {
  browser?: {
    headless?: boolean;
    defaultViewport?: { width: number; height: number };
    defaultTimeout?: number;
  };
  proxy?: {
    enabled?: boolean;
    defaultCache?: boolean;
    defaultTimeout?: number;
  };
  resources?: {
    browsers?: { min?: number; max?: number; idleTimeout?: number };
    pages?: { max?: number; idleTimeout?: number };
    connections?: { max?: number; idleTimeout?: number };
  };
  security?: {
    permissions?: Permission[];
    sandbox?: { enabled?: boolean; timeout?: number };
    rateLimit?: { perSecond?: number; perMinute?: number; perHour?: number };
  };
  metrics?: {
    enabled?: boolean;
    tracing?: boolean;
    exportFormat?: "prometheus" | "json";
  };
}
```

## Security

The Query Engine enforces multiple security layers:

- **Permissions** - Require explicit permissions for sensitive operations
- **Sandboxing** - Execute queries in isolated V8 contexts
- **Rate Limiting** - Prevent abuse through rate limits
- **URL Validation** - Whitelist/blacklist domains and protocols
- **Resource Limits** - Enforce limits on memory, duration, navigations

## Performance

### Optimization Strategies

- **Constant Folding** - Evaluate constant expressions at compile time
- **Predicate Pushdown** - Move filters closer to data source
- **Cache Utilization** - Use cached data when possible
- **Parallel Execution** - Execute independent queries in parallel
- **Connection Pooling** - Reuse browser instances and proxy connections

### Monitoring

```typescript
// Get metrics
const metrics = engine.getMetrics();

console.log(metrics);
/*
{
  queries: { total: 100, successful: 95, failed: 5 },
  performance: { averageExecutionTime: 523, p50: 450, p95: 1200, p99: 2000 },
  resources: { browsers: 3, pages: 10, connections: 15, memoryUsage: 524288000 },
  errors: { byType: { NetworkError: 3, TimeoutError: 2 }, total: 5 }
}
*/
```

## Implementation Status

### ✅ Implemented

- Folder structure
- Type definitions
- Lexer with 80+ token types
- Parser with recursive descent parsing
- AST node definitions
- Main QueryEngine class
- Query execution pipeline skeleton

### 🚧 In Progress

- Semantic Analyzer
- Query Optimizer
- Execution Planner
- Query Executor
- Browser Controller
- Proxy Controller
- Result Formatter
- Security Validator
- State Manager
- Metrics Collector
- Error Recovery Manager
- Resource Manager

## Development

### Running Tests

```bash
# Unit tests
deno test --allow-all tests/unit/

# Integration tests
deno test --allow-all tests/integration/

# All tests
deno test --allow-all tests/
```

### Type Checking

```bash
deno check mod.ts
```

### Linting

```bash
deno lint
```

## Architecture Documentation

- **[QueryEngine.md](../QueryEngine.md)** - High-level architecture and use cases
- **[QueryEngineAbstraction.md](./QueryEngineAbstraction.md)** - Low-level implementation reference
- **[FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md)** - Complete folder structure outline

## Examples

See the `/examples` directory for complete working examples:

- Web scraping with pagination
- API testing through proxy
- Visual regression testing
- Performance monitoring
- Login flow automation
- Data collection for AI/ML

## License

Part of BrowserX project.
