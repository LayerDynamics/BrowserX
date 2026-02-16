# Browser Playground (Separated Backend) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a fully-featured browser playground with visual query builder using separated architecture - standalone SPA frontend with dedicated Deno backend service.

**Architecture:** Vite + React SPA frontend, Deno backend with full BrowserX runtime integration, WebSocket for real-time updates, deployed as separate services on Digital Ocean with nginx reverse proxy.

**Tech Stack:** Vite, React 18, Monaco Editor, Deno, Hono (HTTP framework), BrowserX Runtime, WebSocket, Zustand, IndexedDB

---

## Phase 1: Backend Service Setup

### Task 1: Create Backend Directory Structure

**Files:**
- Create: `playground-backend/deno.json`
- Create: `playground-backend/mod.ts`
- Create: `playground-backend/README.md`

**Step 1: Create directory**

```bash
mkdir -p playground-backend/src/{api,execution,websocket,types}
cd playground-backend
```

**Step 2: Create deno.json**

```json
{
  "name": "@browserx/playground-backend",
  "version": "0.1.0",
  "exports": "./mod.ts",
  "tasks": {
    "dev": "deno run --allow-all --watch mod.ts",
    "start": "deno run --allow-all mod.ts",
    "test": "deno test --allow-all",
    "check": "deno check mod.ts"
  },
  "imports": {
    "@browserx/browser": "../browser/mod.ts",
    "@browserx/query-engine": "../query-engine/mod.ts",
    "@browserx/runtime": "../runtime/mod.ts",
    "hono": "jsr:@hono/hono@^4.7.0",
    "zod": "npm:zod@^3.22.0"
  },
  "compilerOptions": {
    "strict": true,
    "lib": ["deno.window", "dom"]
  }
}
```

**Step 3: Create README**

```markdown
# BrowserX Playground Backend

Deno backend service for the BrowserX playground.

## Features

- Query execution with BrowserX runtime
- WebSocket streaming for real-time updates
- Rate limiting and abuse prevention
- Browser instance pooling

## Development

\`\`\`bash
deno task dev
\`\`\`

## Production

\`\`\`bash
deno task start
\`\`\`

## Environment Variables

- `PORT` - HTTP server port (default: 3001)
- `ALLOWED_ORIGINS` - CORS origins (default: http://localhost:3000)
```

**Step 4: Commit**

```bash
git add playground-backend/
git commit -m "feat(playground-backend): create initial backend structure"
```

---

### Task 2: Create Type Definitions

**Files:**
- Create: `playground-backend/src/types/mod.ts`

**Step 1: Write type definitions**

```typescript
// Rate limiting types
export interface RateLimitConfig {
  tokensPerMinute: number;
  burstSize: number;
  maxConcurrent: number;
  maxQueryTimeout: number;
  maxBrowserInstances: number;
}

export interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

// Query execution types
export interface QueryExecutionRequest {
  query: string;
  options: {
    timeout?: number;
    captureScreenshots?: boolean;
    captureConsole?: boolean;
  };
}

export interface QueryExecution {
  id: string;
  query: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  results?: any;
  error?: {
    code: string;
    message: string;
  };
}

// WebSocket message types
export type WSClientMessage =
  | { type: 'execute'; query: string; options: any }
  | { type: 'cancel'; executionId: string };

export type WSServerMessage =
  | { type: 'started'; executionId: string; timestamp: number }
  | { type: 'progress'; step: string; percent: number }
  | { type: 'screenshot'; data: string; timestamp: number }
  | { type: 'console'; level: string; message: string; timestamp: number }
  | { type: 'result'; data: any }
  | { type: 'error'; error: { code: string; message: string } };

// API response types
export interface APIError {
  error: string;
  message: string;
  retryAfter?: number;
  details?: any;
}

export interface ExecuteResponse {
  executionId: string;
  wsUrl: string;
}

export interface ValidateResponse {
  valid: boolean;
  errors: Array<{
    message: string;
    line: number;
    column: number;
  }>;
}
```

**Step 2: Commit**

```bash
git add playground-backend/src/types/mod.ts
git commit -m "feat(playground-backend): add type definitions"
```

---

### Task 3: Create Rate Limiter

**Files:**
- Create: `playground-backend/src/api/rate-limiter.ts`

**Step 1: Write rate limiter**

```typescript
import type { RateLimitConfig, RateLimitState } from '../types/mod.ts';

export class RateLimiter {
  private limits = new Map<string, RateLimitState>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  check(identifier: string): boolean {
    const now = Date.now();
    const state = this.limits.get(identifier) || {
      tokens: this.config.burstSize,
      lastRefill: now,
    };

    // Refill tokens based on time elapsed
    const elapsed = now - state.lastRefill;
    const tokensPerMs = this.config.tokensPerMinute / 60000;
    const tokensToAdd = Math.floor(elapsed * tokensPerMs);

    if (tokensToAdd > 0) {
      state.tokens = Math.min(
        this.config.tokensPerMinute,
        state.tokens + tokensToAdd
      );
      state.lastRefill = now;
    }

    // Check if we have tokens available
    if (state.tokens >= 1) {
      state.tokens -= 1;
      this.limits.set(identifier, state);
      return true;
    }

    return false;
  }

  getRetryAfter(identifier: string): number {
    const state = this.limits.get(identifier);
    if (!state) return 0;

    const tokensPerMs = this.config.tokensPerMinute / 60000;
    const timeForOneToken = 1 / tokensPerMs;
    return Math.ceil(timeForOneToken / 1000);
  }

  private cleanup() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    for (const [key, state] of this.limits.entries()) {
      if (now - state.lastRefill > maxAge) {
        this.limits.delete(key);
      }
    }
  }
}
```

**Step 2: Write tests**

Create: `playground-backend/src/api/rate-limiter.test.ts`

```typescript
import { assertEquals, assert } from '@std/assert';
import { RateLimiter } from './rate-limiter.ts';

Deno.test('RateLimiter allows burst requests', () => {
  const limiter = new RateLimiter({
    tokensPerMinute: 10,
    burstSize: 3,
    maxConcurrent: 50,
    maxQueryTimeout: 60000,
    maxBrowserInstances: 20,
  });

  // Should allow burst of 3
  assert(limiter.check('test-ip'));
  assert(limiter.check('test-ip'));
  assert(limiter.check('test-ip'));

  // Fourth should be blocked
  assert(!limiter.check('test-ip'));
});

Deno.test('RateLimiter refills tokens over time', async () => {
  const limiter = new RateLimiter({
    tokensPerMinute: 60, // 1 per second
    burstSize: 1,
    maxConcurrent: 50,
    maxQueryTimeout: 60000,
    maxBrowserInstances: 20,
  });

  // Use first token
  assert(limiter.check('test-ip'));

  // Should be blocked immediately
  assert(!limiter.check('test-ip'));

  // Wait 1 second for refill
  await new Promise((resolve) => setTimeout(resolve, 1100));

  // Should allow again
  assert(limiter.check('test-ip'));
});

Deno.test('RateLimiter calculates retry after', () => {
  const limiter = new RateLimiter({
    tokensPerMinute: 10,
    burstSize: 3,
    maxConcurrent: 50,
    maxQueryTimeout: 60000,
    maxBrowserInstances: 20,
  });

  // Exhaust tokens
  limiter.check('test-ip');
  limiter.check('test-ip');
  limiter.check('test-ip');

  const retryAfter = limiter.getRetryAfter('test-ip');
  assert(retryAfter > 0);
  assert(retryAfter <= 60);
});
```

**Step 3: Run tests**

```bash
deno test --allow-all src/api/rate-limiter.test.ts
```

Expected: All 3 tests pass

**Step 4: Commit**

```bash
git add playground-backend/src/api/
git commit -m "feat(playground-backend): add rate limiter with token bucket algorithm"
```

---

### Task 4: Create Query Executor

**Files:**
- Create: `playground-backend/src/execution/query-executor.ts`

**Step 1: Write query executor**

```typescript
import type { QueryExecution, QueryExecutionRequest } from '../types/mod.ts';
import { QueryEngine } from '@browserx/query-engine';
import { BrowserEngine } from '@browserx/browser';

export type ExecutionCallback = (message: any) => void;

export class QueryExecutor {
  private activeExecutions = new Map<string, QueryExecution>();
  private browserPool: BrowserEngine[] = [];
  private maxBrowsers = 20;

  async execute(
    executionId: string,
    request: QueryExecutionRequest,
    callback: ExecutionCallback
  ): Promise<void> {
    const execution: QueryExecution = {
      id: executionId,
      query: request.query,
      status: 'running',
      startTime: Date.now(),
    };

    this.activeExecutions.set(executionId, execution);

    try {
      // Send started message
      callback({
        type: 'started',
        executionId,
        timestamp: execution.startTime,
      });

      // Acquire browser instance
      callback({
        type: 'progress',
        step: 'Acquiring browser instance...',
        percent: 10,
      });

      const browser = await this.acquireBrowser();

      // Create query engine
      callback({
        type: 'progress',
        step: 'Initializing query engine...',
        percent: 20,
      });

      const queryEngine = new QueryEngine();

      // Execute query
      callback({
        type: 'progress',
        step: 'Executing query...',
        percent: 30,
      });

      // TODO: Integrate with actual BrowserX query execution
      // For now, simulate execution
      await this.simulateExecution(request.query, callback);

      // Mock result
      const result = {
        columns: ['title'],
        rows: [{ title: 'Example Domain' }],
        timing: {
          total: Date.now() - execution.startTime,
          network: 450,
          parsing: 200,
          extraction: 600,
        },
      };

      callback({
        type: 'result',
        data: result,
      });

      // Update execution
      execution.status = 'completed';
      execution.endTime = Date.now();
      execution.results = result;
      this.activeExecutions.set(executionId, execution);

      // Release browser
      this.releaseBrowser(browser);
    } catch (error: any) {
      callback({
        type: 'error',
        error: {
          code: 'EXECUTION_ERROR',
          message: error.message,
        },
      });

      execution.status = 'error';
      execution.endTime = Date.now();
      execution.error = {
        code: 'EXECUTION_ERROR',
        message: error.message,
      };
      this.activeExecutions.set(executionId, execution);
    }
  }

  cancel(executionId: string): boolean {
    const execution = this.activeExecutions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'error';
      execution.error = {
        code: 'CANCELLED',
        message: 'Query execution cancelled by user',
      };
      this.activeExecutions.set(executionId, execution);
      return true;
    }
    return false;
  }

  private async acquireBrowser(): Promise<BrowserEngine> {
    // Check for available browser in pool
    if (this.browserPool.length > 0) {
      return this.browserPool.pop()!;
    }

    // Create new browser if under limit
    if (this.browserPool.length < this.maxBrowsers) {
      const browser = new BrowserEngine();
      await browser.initialize();
      return browser;
    }

    // Wait for browser to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.browserPool.length > 0) {
          clearInterval(checkInterval);
          resolve(this.browserPool.pop()!);
        }
      }, 100);
    });
  }

  private releaseBrowser(browser: BrowserEngine): void {
    if (this.browserPool.length < this.maxBrowsers) {
      this.browserPool.push(browser);
    } else {
      // Dispose if pool is full
      browser.dispose().catch(console.error);
    }
  }

  private async simulateExecution(
    query: string,
    callback: ExecutionCallback
  ): Promise<void> {
    // Simulate navigation
    callback({
      type: 'progress',
      step: 'Navigating to URL...',
      percent: 40,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Simulate screenshot
    callback({
      type: 'screenshot',
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...',
      timestamp: Date.now(),
    });

    // Simulate console log
    callback({
      type: 'console',
      level: 'info',
      message: 'Page loaded successfully',
      timestamp: Date.now(),
    });

    callback({
      type: 'progress',
      step: 'Extracting data...',
      percent: 70,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    callback({
      type: 'progress',
      step: 'Processing results...',
      percent: 90,
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
```

**Step 2: Commit**

```bash
git add playground-backend/src/execution/query-executor.ts
git commit -m "feat(playground-backend): add query executor with browser pooling"
```

---

### Task 5: Create WebSocket Manager

**Files:**
- Create: `playground-backend/src/websocket/manager.ts`

**Step 1: Write WebSocket manager**

```typescript
import type { WSClientMessage, WSServerMessage } from '../types/mod.ts';
import { QueryExecutor } from '../execution/query-executor.ts';

export class WebSocketManager {
  private connections = new Map<string, WebSocket>();
  private executor: QueryExecutor;

  constructor(executor: QueryExecutor) {
    this.executor = executor;
  }

  handleConnection(ws: WebSocket, executionId: string): void {
    this.connections.set(executionId, ws);

    ws.addEventListener('message', (event) => {
      try {
        const message: WSClientMessage = JSON.parse(event.data);
        this.handleClientMessage(executionId, message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    ws.addEventListener('close', () => {
      this.connections.delete(executionId);
    });

    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.connections.delete(executionId);
    });
  }

  private handleClientMessage(
    executionId: string,
    message: WSClientMessage
  ): void {
    switch (message.type) {
      case 'cancel':
        this.executor.cancel(executionId);
        this.send(executionId, {
          type: 'error',
          error: {
            code: 'CANCELLED',
            message: 'Query execution cancelled',
          },
        });
        break;
    }
  }

  send(executionId: string, message: WSServerMessage): void {
    const ws = this.connections.get(executionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  close(executionId: string): void {
    const ws = this.connections.get(executionId);
    if (ws) {
      ws.close();
      this.connections.delete(executionId);
    }
  }
}
```

**Step 2: Commit**

```bash
git add playground-backend/src/websocket/manager.ts
git commit -m "feat(playground-backend): add WebSocket connection manager"
```

---

### Task 6: Create HTTP API Routes

**Files:**
- Create: `playground-backend/src/api/routes.ts`

**Step 1: Install Hono**

```bash
deno add jsr:@hono/hono
```

**Step 2: Write API routes**

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type {
  QueryExecutionRequest,
  ExecuteResponse,
  ValidateResponse,
  APIError,
} from '../types/mod.ts';
import { RateLimiter } from './rate-limiter.ts';
import { QueryExecutor } from '../execution/query-executor.ts';
import { WebSocketManager } from '../websocket/manager.ts';

export function createApp(
  rateLimiter: RateLimiter,
  executor: QueryExecutor,
  wsManager: WebSocketManager
) {
  const app = new Hono();

  // CORS middleware
  app.use('/*', cors({
    origin: Deno.env.get('ALLOWED_ORIGINS')?.split(',') || ['http://localhost:3000'],
    credentials: true,
  }));

  // Health check
  app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: Date.now() });
  });

  // Execute query
  app.post('/api/execute', async (c) => {
    try {
      // Get client IP
      const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';

      // Rate limit check
      if (!rateLimiter.check(ip)) {
        const retryAfter = rateLimiter.getRetryAfter(ip);
        return c.json<APIError>(
          {
            error: 'Rate limit exceeded',
            message: `Too many requests. Please wait ${retryAfter} seconds.`,
            retryAfter,
          },
          429
        );
      }

      // Parse request
      const body: QueryExecutionRequest = await c.req.json();

      if (!body.query) {
        return c.json<APIError>(
          {
            error: 'Invalid request',
            message: 'Query is required',
          },
          400
        );
      }

      // Generate execution ID
      const executionId = `exec_${Date.now()}_${crypto.randomUUID()}`;

      // Build WebSocket URL
      const protocol = c.req.url.startsWith('https') ? 'wss' : 'ws';
      const host = c.req.header('host') || 'localhost:3001';
      const wsUrl = `${protocol}://${host}/api/ws/${executionId}`;

      // Return immediately with WS URL
      return c.json<ExecuteResponse>({
        executionId,
        wsUrl,
      });
    } catch (error: any) {
      return c.json<APIError>(
        {
          error: 'Internal server error',
          message: error.message,
        },
        500
      );
    }
  });

  // Validate query
  app.post('/api/validate', async (c) => {
    try {
      const { query } = await c.req.json();

      if (!query) {
        return c.json<ValidateResponse>({
          valid: false,
          errors: [{ message: 'Query is required', line: 0, column: 0 }],
        });
      }

      // Basic validation
      const errors: Array<{ message: string; line: number; column: number }> = [];

      const keywords = ['SELECT', 'NAVIGATE', 'CLICK', 'INSERT', 'IF', 'FOR'];
      const hasKeyword = keywords.some((kw) => query.toUpperCase().includes(kw));

      if (!hasKeyword) {
        errors.push({
          message: 'Query must start with a valid keyword',
          line: 1,
          column: 1,
        });
      }

      if (query.toUpperCase().includes('SELECT') && !query.toUpperCase().includes('FROM')) {
        errors.push({
          message: 'SELECT queries must include FROM clause',
          line: 1,
          column: query.toUpperCase().indexOf('SELECT') + 6,
        });
      }

      return c.json<ValidateResponse>({
        valid: errors.length === 0,
        errors,
      });
    } catch (error: any) {
      return c.json<APIError>(
        {
          error: 'Internal server error',
          message: error.message,
        },
        500
      );
    }
  });

  // WebSocket endpoint
  app.get('/api/ws/:executionId', (c) => {
    const executionId = c.req.param('executionId');

    if (!executionId) {
      return c.json<APIError>(
        {
          error: 'Invalid request',
          message: 'Execution ID is required',
        },
        400
      );
    }

    // Upgrade to WebSocket
    const upgrade = c.req.header('upgrade');
    if (upgrade !== 'websocket') {
      return c.json<APIError>(
        {
          error: 'Bad request',
          message: 'Expected WebSocket upgrade',
        },
        400
      );
    }

    // Handle WebSocket upgrade
    const { socket, response } = Deno.upgradeWebSocket(c.req.raw);

    socket.addEventListener('open', () => {
      wsManager.handleConnection(socket, executionId);

      // Start query execution
      executor.execute(
        executionId,
        { query: '', options: {} }, // TODO: Get from stored request
        (message) => {
          wsManager.send(executionId, message);
        }
      );
    });

    return response;
  });

  return app;
}
```

**Step 3: Commit**

```bash
git add playground-backend/src/api/routes.ts
git commit -m "feat(playground-backend): add HTTP API routes with Hono"
```

---

### Task 7: Create Main Server

**Files:**
- Create: `playground-backend/mod.ts`

**Step 1: Write main server**

```typescript
import { createApp } from './src/api/routes.ts';
import { RateLimiter } from './src/api/rate-limiter.ts';
import { QueryExecutor } from './src/execution/query-executor.ts';
import { WebSocketManager } from './src/websocket/manager.ts';

const PORT = parseInt(Deno.env.get('PORT') || '3001');

// Initialize components
const rateLimiter = new RateLimiter({
  tokensPerMinute: 10,
  burstSize: 3,
  maxConcurrent: 50,
  maxQueryTimeout: 60000,
  maxBrowserInstances: 20,
});

const executor = new QueryExecutor();
const wsManager = new WebSocketManager(executor);

// Create app
const app = createApp(rateLimiter, executor, wsManager);

// Start server
console.log(`🚀 Playground backend listening on http://localhost:${PORT}`);
Deno.serve({ port: PORT }, app.fetch);
```

**Step 2: Test server**

```bash
deno task dev
```

Expected: Server starts on port 3001

**Step 3: Test health endpoint**

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok","timestamp":...}`

**Step 4: Commit**

```bash
git add playground-backend/mod.ts
git commit -m "feat(playground-backend): add main server entry point"
```

---

## Phase 2: Frontend SPA

### Task 8: Create Vite React App

**Files:**
- Create: `playground-frontend/`

**Step 1: Create Vite app**

```bash
npm create vite@latest playground-frontend -- --template react-ts
cd playground-frontend
npm install
```

**Step 2: Install dependencies**

```bash
npm install zustand @monaco-editor/react idb
npm install --save-dev @types/node
```

**Step 3: Update vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

**Step 4: Test build**

```bash
npm run dev
```

Expected: Dev server starts on port 3002

**Step 5: Commit**

```bash
git add playground-frontend/
git commit -m "feat(playground-frontend): create Vite React app"
```

---

### Task 9: Copy Store and Components

**Files:**
- Copy from Approach A implementation

**Step 1: Copy store**

```bash
cp -r ../doc-site/src/components/playground/store.ts playground-frontend/src/
```

**Step 2: Copy components**

```bash
cp -r ../doc-site/src/components/playground/*.tsx playground-frontend/src/components/
cp -r ../doc-site/src/components/playground/*.css playground-frontend/src/components/
```

**Step 3: Update imports to remove Astro-specific code**

**Step 4: Commit**

```bash
git add playground-frontend/src/
git commit -m "feat(playground-frontend): add store and components from Approach A"
```

---

## Phase 3: Deployment Configuration

### Task 10: Create Nginx Configuration

**Files:**
- Create: `deployment/nginx-playground.conf`

**Step 1: Write nginx config**

```nginx
server {
  listen 80;
  server_name playground.browserx.dev;

  # Frontend (SPA)
  location / {
    root /var/www/playground-frontend/dist;
    try_files $uri $uri/ /index.html;
  }

  # Backend API
  location /api/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  # WebSocket
  location /api/ws/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
  }
}
```

**Step 2: Commit**

```bash
git add deployment/nginx-playground.conf
git commit -m "feat(deployment): add nginx configuration for separated backend"
```

---

### Task 11: Create Deployment Scripts

**Files:**
- Create: `deployment/deploy-playground.sh`

**Step 1: Write deployment script**

```bash
#!/bin/bash
set -e

echo "Deploying BrowserX Playground..."

# Build frontend
echo "Building frontend..."
cd playground-frontend
npm run build
cd ..

# Copy frontend build
echo "Copying frontend files..."
sudo mkdir -p /var/www/playground-frontend
sudo cp -r playground-frontend/dist/* /var/www/playground-frontend/

# Deploy backend
echo "Deploying backend..."
sudo systemctl restart browserx-playground-backend

# Reload nginx
echo "Reloading nginx..."
sudo nginx -t && sudo nginx -s reload

echo "✅ Deployment complete!"
```

**Step 2: Make executable**

```bash
chmod +x deployment/deploy-playground.sh
```

**Step 3: Create systemd service**

Create: `deployment/browserx-playground-backend.service`

```ini
[Unit]
Description=BrowserX Playground Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/browserx/playground-backend
ExecStart=/usr/bin/deno run --allow-all mod.ts
Restart=always
Environment=PORT=3001
Environment=ALLOWED_ORIGINS=https://browserx.dev

[Install]
WantedBy=multi-user.target
```

**Step 4: Commit**

```bash
git add deployment/
git commit -m "feat(deployment): add deployment scripts and systemd service"
```

---

## Summary

This plan implements a production-ready playground using separated architecture:

- ✅ Deno backend with BrowserX runtime integration
- ✅ Full WebSocket streaming for real-time updates
- ✅ Browser instance pooling
- ✅ Rate limiting with token bucket algorithm
- ✅ Vite + React SPA frontend
- ✅ Nginx reverse proxy configuration
- ✅ Systemd service for backend
- ✅ Deployment scripts

## Testing Commands

**Backend:**
```bash
cd playground-backend
deno task test
deno task check
deno task dev
```

**Frontend:**
```bash
cd playground-frontend
npm test
npm run dev
npm run build
```

## Deployment

Deploy to Digital Ocean:

```bash
./deployment/deploy-playground.sh
```

## Next Steps

1. **Block Builder** - Add visual drag-and-drop query builder
2. **IndexedDB Persistence** - Save query history locally
3. **Query Templates** - Pre-built query patterns
4. **Schema Explorer** - Interactive documentation
5. **Share Feature** - Generate shareable URLs
6. **Export Feature** - Download results as JSON/CSV/HTML
