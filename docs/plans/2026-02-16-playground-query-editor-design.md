# Browser Playground and Query Editor Design

**Date:** 2026-02-16
**Status:** Approved
**Implementation:** Two parallel approaches using git worktrees

## Executive Summary

Build a fully-featured browser playground and visual query builder for the BrowserX documentation site. The playground serves three purposes: documentation demos, developer sandbox, and production tool. It features a split-view interface with Monaco-based code editor and Blockly-style visual query builder, real-time browser preview, and backend execution via Digital Ocean infrastructure.

## Goals

1. **Documentation Demo** - Visual demonstrations of BrowserX query syntax with example outputs
2. **Developer Sandbox** - Real testing environment for experimenting with BrowserX queries against live websites
3. **Production Tool** - Full-featured query editor with history, saved queries, sharing, and export capabilities

## Requirements

### Functional Requirements

- Split view: Query editor (left) + Live browser preview (right)
- Block-based visual query builder (Scratch/Blockly-style drag-and-drop)
- Real-time execution with live updates via WebSocket
- Full BrowserX query suite support (SELECT, NAVIGATE, CLICK, IF, FOR, etc.)
- Query history stored in browser IndexedDB
- Saved queries with names, descriptions, and tags
- Schema explorer with documentation of available functions and syntax
- Query explain showing execution plan
- Export results as JSON, CSV, or HTML
- Share queries via generated URLs
- Query templates for common patterns (login, scraping, forms)
- Console logs and execution details
- Browser preview with screenshots, DOM inspector, network activity

### Non-Functional Requirements

- **Open Access** - No authentication required
- **Rate Limiting** - IP-based token bucket algorithm (10 queries/min, burst of 3)
- **Performance** - Browser pool with instance reuse, max 60s query timeout
- **Scalability** - Support 50 concurrent executions, 20 browser instances
- **Deployment** - Single Digital Ocean droplet for all components
- **Real-time Updates** - WebSocket for streaming progress, screenshots, logs

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────┐
│  Frontend (Browser)                                 │
│  ┌───────────────────┐  ┌──────────────────────┐   │
│  │  Query Editor     │  │  Block Builder       │   │
│  │  (Monaco)         │  │  (Blockly/Custom)    │   │
│  └────────┬──────────┘  └─────────┬────────────┘   │
│           │                        │                │
│           └────────┬───────────────┘                │
│                    │                                │
│           ┌────────▼─────────┐                      │
│           │  State Manager   │                      │
│           │  (Zustand)       │                      │
│           └────────┬─────────┘                      │
│                    │                                │
│         ┌──────────▼──────────┐                     │
│         │  Browser Preview    │                     │
│         │  (Live Screenshots) │                     │
│         └─────────────────────┘                     │
└───────────────────┬─────────────────────────────────┘
                    │ WebSocket + HTTP
                    ▼
┌─────────────────────────────────────────────────────┐
│  Backend API                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │  Rate Limiter (IP-based, token bucket)      │   │
│  └────────────────┬────────────────────────────┘   │
│                   │                                 │
│  ┌────────────────▼────────────────────────────┐   │
│  │  Query Executor                             │   │
│  │  - Validates query                          │   │
│  │  - Streams execution progress (WebSocket)   │   │
│  │  - Manages browser instances                │   │
│  └────────────────┬────────────────────────────┘   │
│                   │                                 │
│  ┌────────────────▼────────────────────────────┐   │
│  │  BrowserX Runtime                           │   │
│  │  - Browser Pool                             │   │
│  │  - Query Engine                             │   │
│  │  - MCP Server components                    │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Implementation Approaches

We are pursuing **two parallel approaches** using git worktrees to evaluate which works best:

#### Approach A: Astro Island Architecture

**Branch:** `feature/playground-astro-island`
**Worktree:** `.worktrees/playground-astro-island`

Build the playground as an Astro island within the existing doc-site:

- **Frontend**: Astro SSR + React/Svelte islands for interactive components
- **Query Editor**: Monaco Editor (already installed)
- **Block Builder**: Blockly library or custom block system
- **Backend**: Astro API routes (`pages/api/`) for query execution
- **Real-time**: WebSocket server in Astro middleware
- **State**: Zustand/Jotai for client state, IndexedDB for query history

**Pros:**
- Unified codebase and deployment
- Leverages existing Astro infrastructure
- Monaco already installed
- Single Digital Ocean deployment
- SEO-friendly for doc pages
- Easy to maintain alongside docs

**Cons:**
- Astro API routes less mature than Express/Fastify
- Limited to Astro's server capabilities
- Playground and docs share same process

#### Approach B: Separated SPA + Dedicated Backend

**Branch:** `feature/playground-separated-backend`
**Worktree:** `.worktrees/playground-separated-backend`

Build playground as standalone SPA with separate backend service:

- **Frontend**: Vite + React/Svelte SPA
- **Editor**: Monaco + Blockly
- **Backend**: Deno server with BrowserX runtime
- **Communication**: WebSocket + REST API
- **Deployment**: Frontend proxied through Astro, backend as separate service
- **State**: React Query/SWR for server state

**Pros:**
- Complete separation of concerns
- Backend can scale independently
- Use full BrowserX runtime with browser pool
- Can reuse backend for mobile app or CLI
- Better for long-running queries
- Easier to add WASM later

**Cons:**
- Two separate deployments to manage
- Requires reverse proxy configuration
- More infrastructure overhead

## Components

### Frontend Components

#### 1. PlaygroundLayout

Main container component managing the split-view layout.

```typescript
interface PlaygroundLayout {
  editorPanel: QueryEditorPanel;
  previewPanel: BrowserPreviewPanel;
  controlBar: ControlBar;
  statusBar: StatusBar;
}
```

#### 2. QueryEditorPanel

Monaco-based code editor with BrowserX query syntax support.

```typescript
interface QueryEditorPanel {
  monaco: MonacoEditor;           // Code editor
  syntaxHighlighter: BrowserXSyntaxHighlighter;
  autoComplete: QueryAutoComplete;
  linter: QueryValidator;
  tabs: EditorTab[];              // Multiple query tabs
}
```

Features:
- Syntax highlighting for BrowserX query language
- Real-time validation and error highlighting
- Auto-completion for keywords, functions, selectors
- Multi-tab support for working with multiple queries
- Format/prettify query command

#### 3. BlockBuilder

Visual query builder using Blockly-style drag-and-drop interface.

```typescript
interface BlockBuilder {
  canvas: BlockCanvas;            // Drag-drop area
  toolbox: BlockToolbox;          // Available blocks
  blocks: {
    navigate: NavigateBlock;
    select: SelectBlock;
    click: ClickBlock;
    insert: InsertBlock;
    conditional: IfBlock;
    loop: ForBlock;
  };
  codeGenerator: CodeGenerator;   // Blocks → Query code
  bidirectionalSync: boolean;     // Code changes update blocks
}
```

Block Types:
- **Navigate**: Navigate to URL with options
- **Select**: Extract data from page
- **Click**: Click elements by selector
- **Insert**: Type into input fields
- **If/Then/Else**: Conditional execution
- **For Loop**: Iterate over data
- **With Options**: Configure proxy, headers, timeouts

#### 4. BrowserPreviewPanel

Live view of browser execution with real-time updates.

```typescript
interface BrowserPreviewPanel {
  screenshot: ImageDisplay;       // Current page screenshot
  console: ConsoleOutput[];       // Browser console logs
  network: NetworkActivity[];     // Network requests
  domTree: DOMTreeView;          // Optional DOM inspector
  refreshInterval: number;        // Screenshot update rate
}
```

View Modes:
- **Screenshot**: Live screenshot updates (default)
- **DOM**: Interactive DOM tree inspector
- **Network**: Network activity timeline
- **Console**: Browser console output

#### 5. ControlBar

Execution controls and additional features.

```typescript
interface ControlBar {
  executeButton: Button;
  cancelButton: Button;
  exportButton: DropdownMenu;    // JSON, CSV, HTML
  saveButton: Button;            // Save query
  shareButton: Button;           // Generate shareable URL
  historyButton: Button;         // Show query history
}
```

#### 6. SidePanel Components

- **HistoryPanel**: List of previously executed queries
- **SavedQueriesPanel**: Named, persistent query collection
- **TemplatesPanel**: Pre-built query patterns
- **SchemaExplorer**: Documentation browser for query syntax
- **SettingsPanel**: User preferences (theme, timeouts, etc.)

### Backend Components

#### Approach A: Astro API Routes

```typescript
// pages/api/execute.ts
POST /api/execute
  - Accepts query, options
  - Returns execution ID
  - Upgrades to WebSocket

// pages/api/validate.ts
POST /api/validate
  - Validates query syntax
  - Returns errors/warnings

// pages/api/share.ts
POST /api/share
  - Creates shareable query link
  - Returns short URL

// pages/api/templates.ts
GET /api/templates
  - Returns available query templates
```

#### Approach B: Deno Server

```typescript
class PlaygroundAPI {
  rateLimit: RateLimiter;
  browserPool: BrowserPool;
  queryExecutor: QueryExecutor;
  wsManager: WebSocketManager;

  // HTTP endpoints
  POST /execute
  POST /validate
  POST /share
  GET /templates

  // WebSocket endpoint
  WS /ws/:executionId
}
```

## Data Flow

### Query Execution Flow

1. **User Input**
   - User writes query in editor OR builds with blocks
   - Client validates syntax (Monaco linter)

2. **Submission**
   - User clicks Execute
   - POST /api/execute with query and options

3. **Backend Processing**
   - Rate limit check (return 429 if exceeded)
   - Validate query (return 400 if invalid)
   - Acquire browser from pool
   - Create execution ID
   - Return execution ID + WebSocket URL

4. **WebSocket Connection**
   - Client upgrades to WebSocket
   - Backend streams real-time events

5. **Execution Stream**
   - `progress`: "Navigating to URL..."
   - `screenshot`: base64 image data
   - `console`: browser console logs
   - `result`: final extracted data
   - `error`: if something fails

6. **UI Updates**
   - Progress bar updates
   - Browser preview panel shows screenshots
   - Console output displays logs
   - Results table/JSON viewer populates

7. **Completion**
   - Browser returned to pool
   - Results stored in IndexedDB
   - Added to history

### WebSocket Protocol

#### Client → Server Messages

```typescript
// Start execution
{
  "type": "execute",
  "query": "SELECT title FROM \"https://example.com\"",
  "options": {
    "timeout": 30000,
    "captureScreenshots": true,
    "captureConsole": true
  }
}

// Cancel execution
{
  "type": "cancel",
  "executionId": "exec_123"
}
```

#### Server → Client Messages

```typescript
// Execution started
{
  "type": "started",
  "executionId": "exec_123",
  "timestamp": 1234567890
}

// Progress update
{
  "type": "progress",
  "step": "Navigating to https://example.com",
  "percent": 25
}

// Screenshot update
{
  "type": "screenshot",
  "data": "data:image/png;base64,iVBOR...",
  "timestamp": 1234567891
}

// Console log
{
  "type": "console",
  "level": "info",
  "message": "Page loaded",
  "timestamp": 1234567892
}

// Final result
{
  "type": "result",
  "data": {
    "columns": ["title"],
    "rows": [{"title": "Example Domain"}],
    "timing": {
      "total": 1250,
      "network": 450,
      "parsing": 200,
      "extraction": 600
    }
  }
}

// Error
{
  "type": "error",
  "error": {
    "code": "TIMEOUT",
    "message": "Query execution timed out after 30s"
  }
}
```

### State Management

Using Zustand for client-side state:

```typescript
interface PlaygroundStore {
  // Editor state
  currentQuery: string;
  editorMode: 'code' | 'blocks';

  // Execution state
  activeExecution: QueryExecution | null;
  executionHistory: HistoryEntry[];

  // Results state
  currentResults: QueryResult | null;
  screenshots: Screenshot[];
  consoleLogs: ConsoleLog[];

  // Saved queries
  savedQueries: SavedQuery[];
  templates: SavedQuery[];

  // UI state
  previewMode: 'screenshot' | 'dom' | 'network';
  showHistory: boolean;
  showTemplates: boolean;

  // Actions
  setQuery: (query: string) => void;
  executeQuery: () => Promise<void>;
  cancelExecution: () => void;
  saveQuery: (name: string) => void;
  loadQuery: (id: string) => void;
}
```

## Data Structures

### Query Execution

```typescript
interface QueryExecution {
  id: string;
  query: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  results?: QueryResult;
  error?: Error;
  logs: ExecutionLog[];
  screenshots: Screenshot[];
}
```

### Saved Query

```typescript
interface SavedQuery {
  id: string;
  name: string;
  description: string;
  query: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  isTemplate: boolean;
}
```

### History Entry

```typescript
interface HistoryEntry {
  id: string;
  query: string;
  timestamp: number;
  duration: number;
  success: boolean;
  resultCount?: number;
}
```

## Error Handling

### Rate Limiting

Using token bucket algorithm:

```typescript
interface RateLimitConfig {
  tokensPerMinute: 10;          // 10 queries per minute
  burstSize: 3;                 // Allow burst of 3 queries
  storage: 'memory';            // In-memory for simplicity
  maxQueryTimeout: 60000;       // 60 second max per query
  maxConcurrent: 50;            // 50 concurrent executions
  maxBrowserInstances: 20;      // Pool size
  instanceIdleTimeout: 120000;  // 2 min idle timeout
}
```

### Error Scenarios

#### 1. Rate Limit Exceeded (HTTP 429)

```json
{
  "status": 429,
  "error": "Rate limit exceeded",
  "retryAfter": 45,
  "message": "Too many requests. Please wait 45 seconds."
}
```

#### 2. Invalid Query Syntax (HTTP 400)

```json
{
  "status": 400,
  "error": "Invalid query syntax",
  "details": {
    "line": 1,
    "column": 15,
    "message": "Expected FROM after SELECT"
  }
}
```

#### 3. Query Timeout (HTTP 408)

```json
{
  "status": 408,
  "error": "Query timeout",
  "message": "Execution exceeded 60 second timeout",
  "partialResults": {}
}
```

#### 4. Browser Pool Exhausted (HTTP 503)

```json
{
  "status": 503,
  "error": "Service unavailable",
  "message": "All browser instances busy. Please try again.",
  "retryAfter": 30
}
```

#### 5. Target Website Error (HTTP 502)

```json
{
  "status": 502,
  "error": "Target unreachable",
  "message": "Could not load https://example.com",
  "targetUrl": "https://example.com"
}
```

### Client-Side Error Handling

```typescript
// Graceful degradation
try {
  await executeQuery();
} catch (error) {
  if (error.status === 429) {
    showRateLimitMessage(error.retryAfter);
  } else if (error.status === 503) {
    showQueueMessage("High load - retrying...");
    retryWithBackoff();
  } else {
    showErrorDialog(error);
  }
}

// WebSocket reconnection
websocket.on('close', () => {
  if (activeExecution) {
    attemptReconnect(3);  // 3 retries with exponential backoff
  }
});
```

## Testing Strategy

### Frontend Tests

Using Vitest + Testing Library:

```typescript
describe('QueryEditorPanel', () => {
  test('validates syntax on input');
  test('shows autocomplete suggestions');
  test('highlights syntax errors');
  test('formats query on demand');
});

describe('BlockBuilder', () => {
  test('generates code from blocks');
  test('updates blocks when code changes');
  test('validates block connections');
});

describe('BrowserPreviewPanel', () => {
  test('displays screenshot updates');
  test('shows console logs in real-time');
  test('handles missing screenshots gracefully');
});
```

### Backend Tests

Using Deno test:

```typescript
Deno.test('POST /api/execute validates query', async () => {
  const response = await fetch('/api/execute', {
    method: 'POST',
    body: JSON.stringify({ query: 'INVALID' })
  });
  assertEquals(response.status, 400);
});

Deno.test('Rate limiter blocks excessive requests', async () => {
  const responses = await Promise.all(
    Array(11).fill(null).map(() => executeQuery())
  );
  const rateLimited = responses.filter(r => r.status === 429);
  assert(rateLimited.length > 0);
});

Deno.test('Browser pool manages instances', async () => {
  const pool = new BrowserPool({ maxInstances: 2 });
  const b1 = await pool.acquire();
  const b2 = await pool.acquire();

  const b3Promise = pool.acquire();
  await delay(100);

  pool.release(b1);
  const b3 = await b3Promise;
  assertExists(b3);
});
```

### Integration Tests

End-to-end flow testing:

```typescript
Deno.test('Complete query execution flow', async () => {
  // 1. Submit query
  const { executionId } = await api.execute({
    query: 'SELECT title FROM "https://example.com"'
  });

  // 2. Connect WebSocket
  const ws = new WebSocket(`/api/ws/${executionId}`);
  const messages = [];
  ws.onmessage = (msg) => messages.push(JSON.parse(msg.data));

  // 3. Wait for completion
  await waitFor(() =>
    messages.find(m => m.type === 'result')
  );

  // 4. Verify results
  const result = messages.find(m => m.type === 'result');
  assertEquals(result.data.rows[0].title, 'Example Domain');
});
```

## Deployment

### Infrastructure

- **Platform**: Digital Ocean Droplet
- **OS**: Ubuntu 22.04 LTS
- **Services**:
  - Doc-site (Astro) on port 3000
  - Backend API on port 3001 (Approach B only)
  - Nginx reverse proxy on port 80/443

### Nginx Configuration (Approach B)

```nginx
server {
  listen 80;
  server_name browserx.dev;

  # Doc-site
  location / {
    proxy_pass http://localhost:3000;
  }

  # Playground API
  location /api/ {
    proxy_pass http://localhost:3001;
  }

  # WebSocket
  location /ws/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

### Resource Limits

- **Memory**: 8GB RAM recommended
- **CPU**: 4 cores minimum
- **Disk**: 50GB SSD
- **Browser Instances**: Max 20 concurrent
- **Concurrent Queries**: Max 50

## Security Considerations

1. **Input Validation**: All queries validated before execution
2. **Rate Limiting**: IP-based token bucket (10/min, burst 3)
3. **Timeouts**: 60s max per query execution
4. **Resource Limits**: Pool size caps prevent resource exhaustion
5. **Sandboxing**: Browser instances run in isolated contexts
6. **No Sensitive Operations**: Queries cannot access local filesystem or internal networks
7. **CORS**: Restrict API access to doc-site origin

## Future Enhancements

1. **WebAssembly**: Compile query engine to WASM for fully client-side execution
2. **Authentication**: Optional user accounts for higher rate limits
3. **Query Marketplace**: Share and discover community queries
4. **AI Query Assistant**: Natural language → Query generation
5. **Advanced Analytics**: Query performance profiling
6. **Collaborative Editing**: Real-time multi-user editing
7. **Mobile App**: Native iOS/Android playground app

## Success Metrics

1. **Usage**: 1000+ unique playground users in first month
2. **Engagement**: Average 5+ queries per user session
3. **Performance**: <3s average query execution time
4. **Reliability**: 99.5% uptime, <1% error rate
5. **User Satisfaction**: Positive feedback on ease of use

## Implementation Plan

See separate implementation plans for each approach:
- Approach A: TBD (writing-plans skill)
- Approach B: TBD (writing-plans skill)

Both implementations will be developed in parallel using git worktrees, allowing us to evaluate which approach works best before committing to one.

---

**Approved by:** User
**Design Date:** 2026-02-16
**Implementation Start:** 2026-02-16
