# Browser Composable Toolkit Examples

These examples demonstrate how to use the browser's composable toolkit to access and use individual components independently.

## Overview

The browser is designed as a composable toolkit where every component can be used independently or combined as needed. You can:

- Use the HTTP stack without the rendering engine
- Use the rendering engine without JavaScript execution
- Use the WebGPU engine for custom GPU operations
- Mix and match components for your specific use case

## Examples

### 1. Request Pipeline (HTTP Networking)

**File:** `01-request-pipeline.ts`

Demonstrates using the HTTP networking stack independently:
- DNS resolution with caching
- Connection pooling
- HTTP requests with timing
- Cache management

```bash
deno run --allow-net examples/01-request-pipeline.ts
```

### 2. Rendering Pipeline (HTML/CSS Rendering)

**File:** `02-rendering-pipeline.ts`

Shows how to render HTML/CSS without a full browser:
- HTML parsing and DOM construction
- CSS parsing and CSSOM
- Layout computation
- Display list generation

```bash
deno run --allow-net examples/02-rendering-pipeline.ts
```

### 3. Script Executor (JavaScript Engine)

**File:** `03-script-executor.ts`

Demonstrates JavaScript execution with V8:
- Execute JavaScript code
- Access V8 isolate and context
- Manage event loop
- Monitor heap usage

```bash
deno run examples/03-script-executor.ts
```

### 4. WebGPU Engine (GPU Rendering)

**File:** `04-webgpu-engine.ts`

Shows GPU-accelerated rendering with WebGPU:
- Initialize WebGPU device
- Create render pipelines
- Manage GPU memory
- Render to canvas

```bash
deno run --allow-all examples/04-webgpu-engine.ts
```

### 5. Storage Systems

**File:** `05-storage-systems.ts`

Demonstrates browser storage APIs:
- localStorage and sessionStorage
- Cookie management
- IndexedDB operations
- Quota management

```bash
deno run examples/05-storage-systems.ts
```

### 6. Component Composition

**File:** `06-composition.ts`

Shows how to compose multiple components:
- Combine HTTP + rendering + JavaScript
- Share subsystems between components
- Build custom workflows
- Access internal statistics

```bash
deno run --allow-net examples/06-composition.ts
```

## Composable Toolkit Pattern

Each major class exposes its subsystems through public getter methods:

```typescript
// Browser class
const browser = new Browser();
const requestPipeline = browser.getRequestPipeline();
const renderingPipeline = browser.getRenderingPipeline();
const storageManager = browser.getStorageManager();
const cookieManager = browser.getCookieManager();
const quotaManager = browser.getQuotaManager();

// RequestPipeline class
const dnsResolver = requestPipeline.getDNSResolver();
const dnsCache = requestPipeline.getDNSCache();
const connectionPool = requestPipeline.getConnectionPool();
const connectionManager = requestPipeline.getConnectionManager();
const cacheStorage = requestPipeline.getCacheStorage();

// RenderingPipeline class
const compositor = renderingPipeline.getCompositor();

// ScriptExecutor class
const isolate = scriptExecutor.getIsolate();
const context = scriptExecutor.getContext();
const eventLoop = scriptExecutor.getEventLoop();
const windowObject = scriptExecutor.getWindow();
const document = scriptExecutor.getDocument();

// WebGPUEngine class
const driver = webgpuEngine.getDriver();
const memoryManager = webgpuEngine.getMemoryManager();
const bufferPool = webgpuEngine.getBufferPool();
const stagingPool = webgpuEngine.getStagingPool();
const pipelineManager = webgpuEngine.getPipelineManager();
const textureManager = webgpuEngine.getTextureManager();
const device = webgpuEngine.getDevice();
const canvasContext = webgpuEngine.getCanvasContext();
const compositor = webgpuEngine.getCompositor();
```

## Benefits

1. **Flexibility**: Use only what you need
2. **Testing**: Test components in isolation
3. **Performance**: Skip unnecessary layers
4. **Debugging**: Direct access to internal state
5. **Custom Workflows**: Build specialized tools
6. **Learning**: Understand browser internals

## API Documentation

All public getter methods include comprehensive JSDoc documentation with:
- Description of the subsystem
- What it provides
- How to use it
- Code examples
- Related methods

View documentation in your IDE by hovering over method names or viewing source files.
