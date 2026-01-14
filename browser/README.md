# Browser Engine - Composable Toolkit

A fully composable browser engine built with TypeScript/Deno. Every component can be used independently or combined as needed.

## Architecture

The browser is designed as a composable toolkit with well-defined layers and public APIs for all subsystems:

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Class                        │
│  (High-level orchestration and configuration)           │
└─────────────────────────────────────────────────────────┘
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐  ┌──────────────┐  ┌────────────┐
    │  Request    │  │  Rendering   │  │  Storage   │
    │  Pipeline   │  │  Pipeline    │  │  Systems   │
    └─────────────┘  └──────────────┘  └────────────┘
              │              │              │
              ▼              ▼              ▼
       Network Layer   Rendering Layer   Data Layer
```

## Key Features

### 🔧 Fully Composable

Every component exposes its subsystems through public getter methods. You can:

- Use the HTTP stack without the rendering engine
- Use the rendering engine without JavaScript execution
- Use the WebGPU engine for custom GPU operations
- Mix and match components for your specific use case

### 📦 Major Components

#### Browser Class

Main entry point for full browser functionality.

```typescript
import { Browser } from "./mod.ts";

const browser = new Browser({
    width: 1024,
    height: 768,
    enableJavaScript: false,
    enableStorage: true,
});

// Access all subsystems
const requestPipeline = browser.getRequestPipeline();
const renderingPipeline = browser.getRenderingPipeline();
const storageManager = browser.getStorageManager();
const cookieManager = browser.getCookieManager();
const quotaManager = browser.getQuotaManager();
```

#### RequestPipeline

HTTP networking stack with DNS, connection pooling, and caching.

```typescript
import { RequestPipeline } from "./mod.ts";

const pipeline = new RequestPipeline();
const result = await pipeline.get("https://example.com");

// Access subsystems
const dnsResolver = pipeline.getDNSResolver();
const dnsCache = pipeline.getDNSCache();
const connectionPool = pipeline.getConnectionPool();
const connectionManager = pipeline.getConnectionManager();
const cacheStorage = pipeline.getCacheStorage();
```

#### RenderingPipeline

HTML/CSS parsing, layout, and rendering.

```typescript
import { RenderingPipeline } from "./mod.ts";

const pipeline = new RenderingPipeline({
    width: 1024,
    height: 768,
});

const result = await pipeline.render("https://example.com");

// Access subsystems
const requestPipeline = pipeline.getRequestPipeline();
const compositor = pipeline.getCompositor();
```

#### ScriptExecutor

JavaScript execution with V8.

```typescript
import { ScriptExecutor } from "./mod.ts";

const executor = new ScriptExecutor(document, "https://example.com");
const result = await executor.execute("2 + 2");

// Access subsystems
const isolate = executor.getIsolate();
const context = executor.getContext();
const eventLoop = executor.getEventLoop();
const windowObject = executor.getWindow();
const document = executor.getDocument();
```

#### WebGPUEngine

GPU-accelerated rendering with WebGPU.

```typescript
import { WebGPU } from "./mod.ts";

const engine = new WebGPU.WebGPUEngine({ canvas });
await engine.initialize();

// Access subsystems
const driver = engine.getDriver();
const memoryManager = engine.getMemoryManager();
const bufferPool = engine.getBufferPool();
const stagingPool = engine.getStagingPool();
const pipelineManager = engine.getPipelineManager();
const textureManager = engine.getTextureManager();
const compositor = engine.getCompositor();
```

## Installation & Usage

### Prerequisites

- Deno 1.40+ (https://deno.land)

### Running the Browser

```bash
# Navigate to browser directory
cd browser

# Type check
deno task check

# Run tests
deno task test

# Start browser with URL
deno run --allow-all src/main.ts https://example.com
```

### Using as a Library

```typescript
// Import full browser
import { Browser } from "jsr:@browserx/browser";

// Import specific components
import { RequestPipeline, RenderingPipeline } from "jsr:@browserx/browser";

// Import WebGPU separately (namespace export)
import * as WebGPU from "jsr:@browserx/browser";
const engine = new WebGPU.WebGPUEngine({ canvas });
```

## Examples

See the [`examples/`](./examples/) directory for comprehensive usage examples:

1. **Request Pipeline** (`01-request-pipeline.ts`) - HTTP networking independently
2. **Rendering Pipeline** (`02-rendering-pipeline.ts`) - HTML/CSS parsing and layout
3. **Script Executor** (`03-script-executor.ts`) - JavaScript execution with V8
4. **WebGPU Engine** (`04-webgpu-engine.ts`) - GPU-accelerated rendering
5. **Storage Systems** (`05-storage-systems.ts`) - localStorage, cookies, IndexedDB
6. **Composition** (`06-composition.ts`) - Combining multiple components

Run examples:

```bash
deno run --allow-net examples/01-request-pipeline.ts
deno run --allow-net examples/02-rendering-pipeline.ts
deno run examples/03-script-executor.ts
deno run --allow-all examples/04-webgpu-engine.ts
deno run examples/05-storage-systems.ts
deno run --allow-net examples/06-composition.ts
```

## API Reference

### Composable Toolkit Pattern

All major classes expose their subsystems through public getter methods with comprehensive JSDoc documentation:

**Browser**
- `getRequestPipeline(): RequestPipeline`
- `getRenderingPipeline(): RenderingPipeline`
- `getStorageManager(): StorageManager`
- `getCookieManager(): CookieManager`
- `getQuotaManager(): QuotaManager`

**RequestPipeline**
- `getDNSResolver(): DNSResolver`
- `getDNSCache(): DNSCache`
- `getConnectionPool(): ConnectionPool`
- `getConnectionManager(): ConnectionManager`
- `getCacheStorage(): CacheStorage`

**RenderingPipeline**
- `getRequestPipeline(): RequestPipeline`
- `getCompositor(): CompositorThread`

**ScriptExecutor**
- `getIsolate(): V8Isolate`
- `getContext(): V8Context`
- `getWindow(): WindowObject`
- `getEventLoop(): EventLoop`
- `getDocument(): DOMNode`

**WebGPUEngine**
- `getDriver(): WebGPUDriver`
- `getMemoryManager(): MemoryManager`
- `getBufferPool(): BufferPool`
- `getStagingPool(): StagingBufferPool`
- `getPipelineManager(): PipelineManager`
- `getTextureManager(): WebGPUTextureManager`
- `getDevice(): GPUDevice`
- `getGPUDevice(): GPUDevice`
- `getCanvasContext(): GPUCanvasContext`
- `getCompositor(): WebGPUCompositor`

All getter methods include:
- Description of the subsystem
- What it provides
- How to use it
- Code examples
- Type information

View documentation in your IDE by hovering over method names.

## Architecture Details

### Network Layer

- **DNS Resolution**: Async DNS with caching and TTL management
- **Connection Pool**: Reusable TCP/TLS connections with keep-alive
- **HTTP Protocol**: HTTP/1.1, HTTP/2, HTTP/3 support
- **TLS Security**: TLS 1.2/1.3 with certificate validation
- **Caching**: HTTP caching with ETags and Last-Modified

### Rendering Layer

- **HTML Parser**: Tokenization and tree building (HTML5 spec compliant)
- **CSS Parser**: Tokenization, parsing, and CSSOM construction
- **Style Resolution**: Selector matching, cascade, and inheritance
- **Layout Engine**: Box model, flexbox, grid, and text layout
- **Paint Engine**: Display list generation and recording
- **Compositor**: Layer composition, tiling, and GPU upload

### JavaScript Layer

- **V8 Integration**: Full V8 isolate and context management
- **Event Loop**: Macro/micro task scheduling
- **Web APIs**: window, console, setTimeout, DOM manipulation
- **Garbage Collection**: Automatic memory management

### Storage Layer

- **localStorage**: Persistent key-value storage per origin
- **sessionStorage**: Session-scoped storage per origin
- **Cookies**: HTTP cookie management with domain/path matching
- **IndexedDB**: Object stores with indexes and transactions
- **Cache API**: HTTP response caching for service workers
- **Quota Management**: Storage quota enforcement

### WebGPU Layer

- **Driver Management**: GPU device initialization and recovery
- **Memory Management**: Buffer pool, staging pool, allocation tracking
- **Buffer Operations**: Vertex, index, uniform, storage buffers
- **Texture Management**: 2D/3D textures, mipmaps, samplers
- **Pipeline Management**: Render and compute pipeline caching
- **Compositor**: Layer composition and presentation

## Testing

```bash
# Run all tests
deno task test

# Run specific test file
deno test --allow-all src/engine/network/DNSResolver.test.ts

# Watch mode
deno task test:watch
```

## Type Checking

```bash
# Check all files
deno task check

# Watch mode
deno task check:watch

# Check specific file
deno check src/main.ts
```

## Linting & Formatting

```bash
# Lint
deno task lint

# Format
deno task fmt

# Format check (no modifications)
deno task fmt:check
```

## Use Cases

### Web Scraping

Use RequestPipeline + RenderingPipeline without JavaScript:

```typescript
const pipeline = new RenderingPipeline({ enableJavaScript: false });
const result = await pipeline.render(url);
const dom = result.dom; // Parse and extract data
```

### API Testing

Use RequestPipeline directly:

```typescript
const pipeline = new RequestPipeline();
const result = await pipeline.get("https://api.example.com/data");
console.log(result.response.statusCode, result.timing);
```

### Server-Side Rendering

Render HTML/CSS without browser UI:

```typescript
const pipeline = new RenderingPipeline({ width: 1200, height: 800 });
const result = await pipeline.render(url);
const pixels = await pipeline.screenshot();
```

### Custom GPU Operations

Use WebGPU engine for graphics:

```typescript
const engine = new WebGPUEngine({ canvas });
await engine.initialize();
// Create buffers, textures, render...
```

### JavaScript Sandboxing

Execute untrusted code safely:

```typescript
const executor = new ScriptExecutor(document, origin);
const result = await executor.execute(untrustedCode);
if (!result.success) {
    console.error(result.error);
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run type checking and tests
6. Submit a pull request

## License

BrowserX Browser Engine is part of the BrowserX project and is licensed under the [MIT License](../LICENSE).

## Documentation

- [Architecture Overview](./docs/01.ArchitectureOverview.md)
- [Core Types](./docs/02.CoreTypes.md)
- [Network Layer](./docs/03.NetworkPrimitivesLayer.md)
- [Rendering Engine](./docs/08.HTMLParsingEngine.md)
- [JavaScript Engine](./docs/14.JavascriptEngine(v8)Integration.md)
- [Storage Systems](./docs/15.DataPersistenceLayer.md)

See [`docs/`](./docs/) directory for complete technical documentation.
