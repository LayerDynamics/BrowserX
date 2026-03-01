# BrowserX

> ⚠️ **Work in Progress** - BrowserX is in active development. Many components are experimental, incomplete, or undergoing significant changes. This project is not yet production-ready.

**A browser toolkit built with TypeScript/Deno and Rust.** BrowserX is a fully composable, programmable browser system with **11 standalone packages** — every component from networking to rendering to GPU acceleration can be used independently or combined to create custom browser experiences.

## 🎯 What is BrowserX?

BrowserX is not a traditional browser. It's a **toolkit for building anything browser-related**. Whether you need a headless scraper, a custom renderer, a programmable proxy, or a full-featured browser with AI integration, BrowserX provides the building blocks.

### The BrowserX Toolkit — 11 Composable Packages

All packages are designed to work together as an integrated system, but each is a standalone composable unit with its own workspace, API, and test suite:

**TypeScript/Deno Packages (7):**

- **Browser Engine** (`@browserx/browser`) - Complete rendering pipeline: HTML/CSS parsing, layout, JavaScript execution, DOM manipulation
- **Proxy Engine** (`@browserx/proxy-engine`) - Programmable traffic routing: middleware, load balancing, caching, request/response transformation
- **Query Engine** (`@browserx/query-engine`) - SQL-like interface: query browser state, DOM tree, network activity, and proxy metrics
- **Runtime** (`@browserx/runtime`) - Unified orchestration layer integrating all engines with plugin architecture
- **MCP Server** (`@browserx/mcp-server`) - Model Context Protocol server for AI-driven browser automation
- **DevTools** (`@browserx/dev-tools`) - Chrome DevTools Protocol (CDP) implementation with 14 debugging domains
- **GraphX** (`@browserx/graphx`) - Graph data structures, algorithms (topological sort, shortest path, cycle detection), and visualization

**Rust FFI Crates (4):**

- **pixpane** - Native windowing: cross-platform windows, GPU rendering via wgpu, immediate-mode UI with egui
- **webgpu_x** - GPU compute: WebGPU bindings for compute shaders, texture readback, and bind group management
- **bytecodex** - Bytecode optimization: constant folding, dead store elimination, peephole optimization, validation
- **transportx** - QUIC/HTTP3 transport: connection management, stream multiplexing via quiche FFI

### Built to Work Together

The toolkit is designed for **composability at every level**:

- Use the **Browser Engine** alone for server-side rendering or scraping
- Combine **Browser + Proxy** for traffic inspection and modification
- Add **Pixpane** for native window output with GPU acceleration
- Layer on **Query Engine** for AI/ML-friendly programmatic access
- Use **webgpu_x** for custom GPU compute alongside rendering

Every component exposes its internals through public APIs, allowing you to compose exactly what you need—nothing more, nothing less.

### What You Can Build

**Testing & Automation:**

- Headless browser testing with full DOM/layout introspection
- Visual regression testing with pixel-perfect rendering
- Performance testing with detailed timing breakdowns
- AI-powered test generation using query interface

**AI & Machine Learning:**

- AI agents that inspect render trees and layout information
- Browser automation driven by natural language queries
- Training data collection from real browser sessions
- Custom rendering for vision model inputs

**Development Tools:**

- Custom DevTools with deep protocol visibility
- Traffic debugging and manipulation proxies
- Performance profiling at every layer
- Browser experimentation and research

**Production Services:**

- Programmable CDN with edge rendering
- Screenshot and PDF generation services
- Web scraping with full JavaScript support
- API gateway with browser-level protocol handling

## 🎯 Project Vision

BrowserX reimagines the browser as a composable, queryable system where every layer can be accessed, controlled, and extended programmatically. Instead of a monolithic black box, BrowserX exposes:

- **Browser Engine**: Full rendering pipeline from HTML parsing to GPU compositing
- **Proxy Engine**: Programmable traffic routing, interception, and transformation
- **Query Engine**: SQL-like interface for browser and proxy operations
- **Native Windowing**: Cross-platform GPU-accelerated rendering via Rust FFI

This architecture enables use cases like:

- Automated testing with deep introspection
- AI agents that can inspect render trees and layout
- Traffic analysis and manipulation at any protocol layer
- Browser automation with query-based selectors
- Custom rendering pipelines and display strategies

## 📐 Architecture

Understanding the Layers:

```ascii
┌─────────────────────────────────────┐
│      MCP Server                     │  Model Context Protocol API
│  - AI tool integration              │  for LLM-driven browser control
│  - stdio/HTTP transports            │  Screenshot & activity persistence
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│      Query Engine                   │  SQL-like queryable interface
│  "SELECT * FROM browser             │  for humans and AI/ML
│   WHERE url LIKE '%.example.com'"   │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│      Runtime                        │  Unified orchestration layer
│  - Integrates browser, proxy, query │  Plugin architecture, lifecycle
│  - Plugin system with disposables   │  management, composable workflows
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│      Proxy Engine                   │  Traffic routing, middleware,
│  - Request/Response interception    │  caching, load balancing
│  - Middleware pipeline              │
│  - Connection pooling               │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│      Browser Engine                 │  Core rendering and networking
│  - HTML/CSS parsing                 │  Full page load pipeline
│  - JavaScript execution (V8)        │  from DNS to pixels
│  - Layout & Rendering               │
│  - Network stack (TCP/TLS/HTTP)     │
│  - WebGPU rendering (Deno native)   │
└─────────────────────────────────────┘
                 ↓
      ┌──────────┴──────────┐
      ↓                     ↓
┌──────────────────┐  ┌──────────────────┐
│ Pixpane (Rust)   │  │ webgpu_x (Rust)  │
│ - Windows/UI     │  │ - GPU Compute    │
│ - GPU Rendering  │  │ - Kernels        │
│ - egui (FFI)     │  │ - Tensors (FFI)  │
└──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐
│ bytecodex (Rust) │  │ transportx(Rust) │
│ - Const folding  │  │ - QUIC/HTTP3     │
│ - Dead store     │  │ - Stream mux     │
│ - Peephole (FFI) │  │ - quiche (FFI)   │
└──────────────────┘  └──────────────────┘
```

**Data Flow**: User requests flow down through the MCP server → query engine → runtime → proxy engine → browser engine. The browser engine can then output to:

- **Pixpane** for visual rendering (windows, UI, display)
- **webgpu_x** for GPU compute workloads (ML, custom shaders, tensor operations)

Each layer can be used independently or composed together.

## 🏗️ Repository Structure

```text
BrowserX/
├── browser/                  # Browser Engine (TypeScript/Deno)
│   ├── src/
│   │   ├── engine/          # Core: network, rendering, JavaScript, storage
│   │   ├── types/           # Type system: HTTP, DOM, CSS, rendering types
│   │   └── os/              # Platform abstractions
│   ├── docs/                # 19 detailed architecture documents
│   └── examples/            # Browser usage examples
│
├── proxy-engine/            # Proxy Engine (TypeScript/Deno)
│   ├── core/               # Gateway, routing, caching, connection pooling
│   │   ├── network/        # Network primitives, transport protocols
│   │   ├── proxy_types/    # Auth, reverse, load balance, WebSocket proxies
│   │   └── cache/          # Cache manager with eviction policies
│   └── gateway/            # Request/response routing and middleware
│
├── query-engine/            # Query Engine (TypeScript/Deno)
│   ├── parser/             # SQL-like query parser
│   ├── executor/           # Query execution engine
│   └── adapters/           # Adapters for browser/proxy backends
│
├── runtime/                 # Runtime (TypeScript/Deno)
│   ├── src/
│   │   ├── config/         # Runtime configuration
│   │   ├── plugins/        # Plugin system (manager, loader, registry)
│   │   └── types.ts        # Runtime type definitions
│   └── tests/              # Runtime and plugin tests
│
├── mcp-server/              # MCP Server (TypeScript/Deno)
│   ├── server/             # MCP server setup, transports (stdio/HTTP)
│   ├── tools/              # Tool implementations (browser, query, proxy)
│   ├── resources/          # Resource providers (page, metrics)
│   ├── activity/           # Activity tracking and persistence
│   └── session/            # Browser session management
│
├── dev-tools/               # DevTools Protocol (TypeScript/Deno)
│   ├── src/domains/        # CDP domains (DOM, CSS, Network, etc.)
│   └── tests/              # 847+ tests across 24 test files
│
├── graphx/                  # Graph Library (TypeScript/Deno)
│   ├── src/
│   │   ├── graph/          # Graph, DiGraph, DAG data structures
│   │   ├── algorithms/     # Topological sort, shortest path, cycle detection
│   │   ├── layout/         # Force-directed, hierarchical layouts
│   │   └── export/         # SVG, DOT, JSON export
│   └── tests/              # 164 tests
│
├── crates/
│   ├── pixpane/            # Native windowing layer (Rust)
│   │   ├── src/
│   │   │   ├── window/     # Window management (winit)
│   │   │   ├── rendering/  # GPU rendering (wgpu, egui)
│   │   │   └── deno_bindings.rs  # FFI exports via deno_bindgen
│   │   └── bindings/       # Generated TypeScript bindings
│   │
│   ├── webgpu_x/           # GPU compute layer (Rust)
│   │   ├── src/
│   │   │   ├── compute/    # Compute kernels and workgroups
│   │   │   ├── tensor/     # Tensor operations and storage
│   │   │   ├── shader/     # WGSL shader generation
│   │   │   └── deno_bindings.rs  # FFI exports via deno_bindgen
│   │   └── bindings/       # Generated TypeScript bindings
│   │
│   ├── bytecodex/          # Bytecode optimizer (Rust)
│   │   └── src/            # Constant folding, dead store elimination, peephole
│   │
│   └── transportx/         # QUIC/HTTP3 transport (Rust)
│       └── src/            # Connection management, stream mux via quiche
│
├── resources/               # Reference implementations and dependencies
│   ├── deno_bindgen-0.8.1/ # Custom deno_bindgen for FFI generation
│   ├── deno/               # Deno runtime fork (for reference)
│   ├── wgpu/               # wgpu graphics library (for reference)
│   └── [other references]  # Additional libraries for research
│
└── resource/devdocs/        # Architecture documentation
    ├── Browser.md          # Complete browser architecture (30k+ tokens)
    ├── ProxyEngine.md      # Complete proxy architecture (57k+ tokens)
    ├── QueryEngine.md      # Query engine design
    ├── WEBGPU_RENDERING.md # WebGPU rendering architecture
    ├── WEBGPU_FIXES.md     # Deno WebGPU workarounds
    └── 01-19*.md           # 19 detailed browser subsystem documents
```

## 🚀 Getting Started

### Clone the Repository

```bash
git clone https://github.com/LayerDynamics/BrowserX.git
cd BrowserX
```

### Prerequisites

- **Deno** 2.x or later ([install](https://deno.land/))
- **Rust** 1.70+ with Cargo ([install](https://rustup.rs/))
- **Git** for version control

### Quick Start

**Note**: Most components are still being implemented. See individual component READMEs for current status.

#### Browser Engine

```bash
cd browser

# Type check
deno task check

# Run tests
deno task test

# Run example (when available)
deno run --allow-all examples/basic.ts
```

#### Proxy Engine

```bash
cd proxy-engine

# Type check
deno check core/runtime.ts

# Run tests (when available)
deno test --allow-all
```

#### Pixpane (Native Windowing)

```bash
cd crates/pixpane

# Build Rust library
cargo build --release

# Generate TypeScript bindings
deno run --allow-all gen_bindings.ts

# Run FFI test
deno run --allow-ffi --unstable-ffi tests/test.ts
```

#### webgpu_x (GPU Compute)

```bash
cd crates/webgpu_x

# Build Rust library
cargo build --release

# Generate TypeScript bindings
deno run --allow-all gen_bindings.ts

# Run FFI test
deno run --allow-ffi --unstable-ffi tests/test.ts
```

#### MCP Server (AI Integration)

```bash
# Start MCP server with stdio transport (for Claude Desktop)
deno task mcp:start

# Start with HTTP transport (for custom integrations)
deno task mcp:start:http

# Type check
deno task mcp:check
```

**Claude Desktop Integration** - Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

#### Runtime

```bash
# Type check
deno task runtime:check

# Run tests (includes plugin system tests)
deno task runtime:test
```

## 📁 Data Persistence

BrowserX automatically saves screenshots and activity data for debugging and analysis:

```text
.browserx/usage_data/
├── screenshots/          # Saved screenshots organized by date
│   └── YYYY-MM-DD/
│       └── {timestamp}_{id}.png
├── logs/                 # Daily activity logs in JSONL format
│   └── YYYY-MM-DD.jsonl
└── metadata/             # Session metadata
    └── {sessionId}.json
```

The `browser_screenshot` MCP tool returns both the image data AND the saved file path, enabling AI agents to reference previously captured screenshots.

## 📚 Documentation

### Architecture Guides

- **[Browser.md](./resource/devdocs/Browser.md)** - Complete browser architecture: multi-process model, page load sequence, rendering pipeline, network stack
- **[ProxyEngine.md](./resource/devdocs/ProxyEngine.md)** - Proxy architecture: layered design, connection pooling, caching, middleware
- **[QueryEngine.md](./resource/devdocs/QueryEngine.md)** - Query engine design and composability model
- **[WEBGPU_RENDERING.md](./resource/devdocs/WEBGPU_RENDERING.md)** - WebGPU rendering architecture for Deno
- **[browser/docs/](./browser/docs/)** - 19 detailed technical documents covering every browser subsystem

### Component Documentation

- **[browser/README.md](./browser/README.md)** - Browser engine API and usage
- **[proxy-engine/README.md](./proxy-engine/README.md)** - Proxy engine configuration and middleware
- **[query-engine/README.md](./query-engine/README.md)** - Query syntax and execution
- **[runtime/README.md](./runtime/README.md)** - Runtime lifecycle, configuration, plugin system
- **[mcp-server/README.md](./mcp-server/README.md)** - MCP server tools, resources, AI integration
- **[crates/pixpane/README.md](./crates/pixpane/README.md)** - FFI bindings and window management
- **[crates/webgpu_x/README.md](./crates/webgpu_x/README.md)** - GPU compute, kernels, and tensor operations

## 🛠️ Development

### Build Commands

```bash
# Browser type checking
cd browser && deno task check

# Proxy type checking
cd proxy-engine && deno check core/runtime.ts

# Build Pixpane + generate bindings
cd crates/pixpane && cargo build --release && deno run --allow-all gen_bindings.ts

# Build webgpu_x + generate bindings
cd crates/webgpu_x && cargo build --release && deno run --allow-all gen_bindings.ts

# Run all tests
cd browser && deno test --allow-all
cd crates/pixpane && cargo test
cd crates/webgpu_x && cargo test
```

### Key Technologies

**Browser & Proxy Engines:**

- TypeScript/Deno for type-safe, modern JavaScript runtime
- Multi-process architecture inspired by Chromium
- Event-driven async I/O for high performance

**Pixpane (Native Layer):**

- Rust for systems-level performance and safety
- wgpu 22 for cross-platform GPU acceleration
- winit 0.30 for window management
- egui 0.29 for immediate-mode UI
- deno_bindgen 0.8.1 for FFI code generation

**webgpu_x (GPU Compute Layer):**

- Rust for high-performance compute kernels
- wgpu 22 for GPU compute and shader execution
- WGSL shader language support
- Tensor operations for ML workloads
- deno_bindgen 0.8.1 for FFI code generation

## 📊 Current Status

### ✅ Implemented

**Browser Engine** :

- Complete type system (11 type files: HTTP, DOM, CSS, rendering, network, JavaScript, storage, events, WebGPU)
- Network layer: TCP connection management, TLS 1.3 implementation with handshake and certificate validation, connection pooling, DNS resolution
- HTTP protocol: Request/response parsing, header handling, connection reuse
- HTML tokenizer: Full state machine with 80+ tokenization states
- CSS parser: Selector matching, specificity calculation, cascade resolution
- JavaScript engine: V8 isolate management, execution contexts, heap management, bytecode compilation with 11 ops, bytecodex FFI optimization (721 tests)
- CSS at-rules: `@media`, `@keyframes`, `@font-face`, `@import` parsing with media query matching, percentage length resolution
- Storage types: Interfaces for localStorage, sessionStorage, IndexedDB, cookies, quota management
- WebGPU rendering: Offscreen rendering via Deno's native WebGPU, GPU readback, WGSL compositor shaders, compositeLayer GPU compositing
- Window subsystem: `Window` + `WindowContext` classes with OS abstractions

**Proxy Engine** :

- Runtime orchestration: Lifecycle management, graceful shutdown, signal handling
- Gateway layer: Request/response routing with pattern matching, middleware chain execution
- Connection management: Pooling with configurable size limits, health checking, lifecycle tracking
- Transport protocols: HTTP/1.1, HTTP/2, HTTP/3, WebSocket, TLS termination
- Cache layer: Memory/disk storage with encryption, TTL management, LRU/LFU/FIFO eviction policies
- Middleware system: Auth, rate limiting, logging, CORS, compression, header manipulation
- Network primitives: TCP sockets, IP address handling, buffer pools
- Event system: Event loop, async handling, priority queuing
- Process/thread management: Multi-process architecture, worker pools, task scheduling
- Proxy types: Reverse proxy, load balancer, auth proxy, WebSocket proxy, SSE proxy, TLS proxy, event-driven proxy
- Load balancing: Round-robin, least connections, weighted, IP hash, least response time, random (1878 tests)
- ALPN protocol negotiation: TLS ClientHello parsing and extension building
- HTTP/2 GOAWAY: Stream draining and graceful connection shutdown

**Query Engine** :

- Lexer: Token generation from query strings
- Parser: Recursive descent parser building Abstract Syntax Trees (AST)
- SQL-like statements: SELECT, INSERT, UPDATE, DELETE, NAVIGATE, SET, SHOW, FOR, IF, WITH
- Query analysis: Semantic analysis, type checking, validation
- Planner: Query plan generation
- Optimizer: Query optimization strategies
- Executor: Query execution engine
- Type system: Primitive types, collections, functions
- Error handling: Comprehensive error types and recovery
- Browser wiring: DOM functions (CLICK, TYPE, TEXT, HTML, ATTR, COUNT, EXISTS) async with browser controller
- Result formatting: Multiple output formats (JSON, CSV, table)
- Dependency graph: GraphX-backed `DependencyGraphBuilder` with topological sort and cycle detection

**Pixpane** :

- Window management: Creation, configuration, lifecycle control (winit 0.30)
- Event loop: pump_events model with non-blocking polling, thread-safe event queue
- GPU rendering: wgpu 22 integration with surface management, texture uploads
- egui integration: Immediate-mode UI (egui 0.29) with full widget support
- FFI layer: deno_bindgen 0.8.1 with comprehensive TypeScript bindings
- Thread safety: Lazy-static window registry with parking_lot synchronization
- Pixel rendering: RGBA8 buffer uploads, fullscreen texture rendering
- Window operations: Resize, move, minimize, maximize, fullscreen, visibility control

**webgpu_x** :

- Compute kernels: Kernel specification, parameter binding, workgroup configuration
- WGSL generation: Automatic shader code generation from kernel specs
- Tensor types: Float32, Float16, Int32, Int8, UInt8 with size calculations
- Tensor access: ReadOnly, WriteOnly, ReadWrite, Uniform patterns
- GPU infrastructure: Device management, queue handling, buffer operations
- FFI bindings: Comprehensive Deno integration for GPU compute
- Shader support: WGSL type mapping, storage qualifiers
- GPU readback: Texture-to-CPU data transfer for screenshot capture
- Bind group creation: Resource binding for render pipelines
- Command encoding: Render pass commands and queue submission

**Runtime** :

- Unified orchestration: Integrates browser, proxy, and query engines
- Plugin system: PluginManager with topological sort activation, reverse deactivation
- Plugin lifecycle: All contributions return Disposable for automatic cleanup
- Plugin registry: Discovery, validation, and loading of plugins
- Configuration: RuntimeConfig with plugin enablement (opt-in by default)
- Lifecycle components: LifecycleManager, HealthChecker, UnifiedMetricsCollector, EventCoordinator
- BrowserPool: acquire/release pattern with idle timeout, max lifetime, automatic cleanup
- GraphX integration: PluginManager uses GraphX DAG + topologicalSort for activation ordering (98 plugin tests)

**MCP Server** :

- Model Context Protocol: Full MCP SDK integration (v1.12.0)
- Browser tools: `browser_navigate`, `browser_screenshot`, `browser_click`, `browser_type`, `browser_evaluate`
- Query tools: `browserx_query`, `browserx_query_async`, `browserx_query_explain`
- Proxy tools: `proxy_cache_get`, `proxy_cache_set`, `proxy_add_interceptor`
- Transports: stdio (default for Claude Desktop), HTTP on port 9847
- Activity tracking: Persistent file-based logging of screenshots and activities
- Data persistence: Screenshots saved to `.browserx/usage_data/screenshots/`, activity logs in JSONL format
- Lazy initialization: Fast startup (<100ms) with services initialized on first use
- Runtime integration: ServiceInitializer with BrowserPool delegation, health checks, metrics
- Session management: SessionManager delegates to Runtime BrowserPool with critical shutdown ordering
- Graph tools: `browserx_visualize_dom`, `browserx_dependency_graph`, `browserx_plugin_graph`

**DevTools** :

- Chrome DevTools Protocol: 14 debugging domains implemented
- Domains: Runtime, Debugger, DOM, CSS, Network, Storage, Console, Page, Emulation, Overlay, Security, Rendering, Performance, Memory
- Event system: EventBus for cross-domain pub/sub communication
- Test coverage: 847+ tests across 24 test files

**GraphX** :

- Graph data structures: Graph (undirected), DiGraph (directed), DAG (directed acyclic)
- Algorithms: BFS, DFS, Dijkstra shortest path, topological sort, cycle detection, connected components
- Layout engines: Force-directed (Fruchterman-Reingold), hierarchical (Sugiyama), radial, grid
- SVG rendering: Headless SVG generation with themes, labels, arrowheads
- Cross-codebase integration: Runtime PluginManager, Query Engine DependencyGraphBuilder, MCP visualization tools
- Test coverage: 164 tests across graph structures, algorithms, layout, and rendering

**bytecodex** :

- Constant folding: Folds arithmetic on constant operands into single constants
- Dead store elimination: Removes unused register stores
- Peephole optimization: Pattern-matches small instruction windows
- Bytecode validation: Opcode validity, operand counts, constant pool bounds, jump targets
- Disassembly: Human-readable bytecode output
- V8Compiler integration: `compile(source, { optimize: true })` runs bytecodex FFI pass (15 Rust tests)

**transportx** :

- QUIC/HTTP3 transport: Connection management and stream multiplexing via quiche FFI

### 🚧 In Progress

**Browser Engine:**

- Layout engine: Box model calculation, block/flexbox/grid layout algorithms, text measurement
- Paint engine: Display list generation, rasterization
- Compositor: Layer management, tiling, GPU texture uploads, VSync synchronization
- Full rendering pipeline: End-to-end integration from HTML to pixels

**Proxy Engine:**

- Metrics collection: Request tracking, latency histograms, throughput measurement
- Distributed tracing: Trace context propagation, span collection

**Query Engine:**

- Advanced SQL features: Subqueries, joins, aggregations, window functions

**Integration:**

- End-to-end data flow: MCP Server → Query Engine → Runtime → Proxy Engine → Browser Engine
- Cross-layer communication: Event propagation, state synchronization
- Performance optimization: Pipeline parallelization, caching strategies

### 📋 Planned

**Core Functionality:**

- Complete HTML tree builder with error recovery and special element handling
- CSS layout engine: Complete flexbox and grid implementations, positioned elements
- JavaScript V8: Full DOM API bindings, Web APIs (fetch, setTimeout, Promise)
- Storage implementations: Actual localStorage, sessionStorage, IndexedDB, cookie persistence
- GPU acceleration: Hardware-accelerated compositing, canvas rendering

**Developer Tools:**

- CLI interface: Interactive query shell for browser/proxy inspection
- Web UI: Browser-based inspector for debugging and metrics visualization
- Performance profiler: CPU/memory/network profiling tools

**Testing & Quality:**

- Comprehensive test suites: Unit tests, integration tests, end-to-end tests
- Browser compatibility tests: Rendering accuracy vs Chrome/Firefox
- Performance benchmarks: Page load times, rendering speed, memory usage
- Fuzzing: Protocol fuzzing, parser fuzzing for security

**Advanced Features:**

- Service workers: Background processing, offline support
- WebAssembly: WASM execution in V8
- WebRTC: Peer-to-peer communication
- WebSocket server: Bidirectional communication support
- HTTP/3 optimizations: QUIC transport enhancements

## 🤝 Contributing

BrowserX is in early development. Contributions are welcome, but please note:

- **Architecture is evolving**: Core designs may change significantly
- **Documentation is primary**: Focus on understanding and documenting the architecture
- **Stubs are intentional**: Many files contain stubs for planned functionality
- **Used imports matter**: If an import is unused, it's likely meant to be used - implement it rather than removing it

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## 📄 License

BrowserX is licensed under the [MIT License](./LICENSE).

## 🔗 Related Projects

- **Deno** - Modern JavaScript/TypeScript runtime
- **Chromium** - Architectural inspiration for multi-process browser
- **wgpu** - Cross-platform GPU API
- **V8** - JavaScript engine

## 💡 Philosophy

BrowserX is built on these principles:

1. **Composability**: Every layer is usable independently
2. **Programmability**: Query and control everything via code
3. **Transparency**: Expose internal state and operations
4. **Extensibility**: Plugin architecture at every layer
5. **Performance**: Multi-process, async I/O, GPU acceleration
6. **Type Safety**: Strong typing throughout TypeScript and Rust

---

**Note**: This project is experimental and educational. It is not intended to replace production browsers like Chrome, Firefox, or Safari, but rather to explore alternative architectures and enable new use cases for programmable web interaction.
