# BrowserX

> ⚠️ **Work in Progress** - BrowserX is in active development. Many components are experimental, incomplete, or undergoing significant changes. This project is not yet production-ready.

**A browser toolkit built with TypeScript/Deno and Rust.** BrowserX is a fully composable, programmable browser system where every component—from networking to rendering to GPU acceleration—can be used independently or combined to create custom browser experiences.

## 🎯 What is BrowserX?

BrowserX is not a traditional browser. It's a **toolkit for building anything browser-related**. Whether you need a headless scraper, a custom renderer, a programmable proxy, or a full-featured browser with AI integration, BrowserX provides the building blocks.

### The BrowserX Toolkit

All modules and crates are designed to work together as an integrated system:

**TypeScript/Deno Modules:**

- **Browser Engine** - Complete rendering pipeline: HTML/CSS parsing, layout, JavaScript execution, DOM manipulation
- **Proxy Engine** - Programmable traffic routing: middleware, load balancing, caching, request/response transformation
- **Query Engine** - SQL-like interface: query browser state, DOM tree, network activity, and proxy metrics

**Rust Crates (via FFI):**

- **Pixpane** - Native windowing: cross-platform windows, GPU rendering via wgpu, immediate-mode UI with egui
- **webgpu_x** - GPU compute: WebGPU bindings for compute shaders, tensor operations, and custom GPU workloads

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
│      Query Engine (WIP)             │  SQL-like queryable interface
│  "SELECT * FROM browser             │  for humans and AI/ML
│   WHERE url LIKE '%.example.com'"   │
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
```

**Data Flow**: User requests flow down through the query engine → proxy engine → browser engine. The browser engine can then output to:

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
├── query-engine/            # Query Engine (TypeScript/Deno) - WIP
│   ├── parser/             # SQL-like query parser
│   ├── executor/           # Query execution engine
│   └── adapters/           # Adapters for browser/proxy backends
│
├── crates/
│   ├── pixpane/            # Native windowing layer (Rust)
│   │   ├── src/
│   │   │   ├── window/     # Window management (winit)
│   │   │   ├── rendering/  # GPU rendering (wgpu, egui)
│   │   │   └── deno_bindings.rs  # FFI exports via deno_bindgen
│   │   └── bindings/       # Generated TypeScript bindings
│   │
│   └── webgpu_x/           # GPU compute layer (Rust)
│       ├── src/
│       │   ├── compute/    # Compute kernels and workgroups
│       │   ├── tensor/     # Tensor operations and storage
│       │   ├── shader/     # WGSL shader generation
│       │   └── deno_bindings.rs  # FFI exports via deno_bindgen
│       └── bindings/       # Generated TypeScript bindings
│
├── resources/               # Reference implementations and dependencies
│   ├── deno_bindgen-0.8.1/ # Custom deno_bindgen for FFI generation
│   ├── deno/               # Deno runtime fork (for reference)
│   ├── wgpu/               # wgpu graphics library (for reference)
│   └── [other references]  # Additional libraries for research
│
└── docs/
    ├── Browser.md          # Complete browser architecture (30k+ tokens)
    ├── ProxyEngine.md      # Complete proxy architecture (57k+ tokens)
    ├── QueryEngine.md      # Query engine design
    └── CLAUDE.md           # AI assistant guidance (for development)
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

## 📚 Documentation

### Architecture Guides

- **[Browser.md](./Browser.md)** - Complete browser architecture: multi-process model, page load sequence, rendering pipeline, network stack
- **[ProxyEngine.md](./ProxyEngine.md)** - Proxy architecture: layered design, connection pooling, caching, middleware
- **[QueryEngine.md](./QueryEngine.md)** - Query engine design and composability model
- **[browser/docs/](./browser/docs/)** - 19 detailed technical documents covering every browser subsystem

### Component Documentation

- **[browser/README.md](./browser/README.md)** - Browser engine API and usage
- **[proxy-engine/README.md](./proxy-engine/README.md)** - Proxy engine configuration and middleware
- **[query-engine/README.md](./query-engine/README.md)** - Query syntax and execution
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
- HTML tokenizer: Full state machine with 60+ tokenization states
- CSS parser: Selector matching, specificity calculation, cascade resolution
- JavaScript engine: V8 isolate management, execution contexts, heap management
- Storage types: Interfaces for localStorage, sessionStorage, IndexedDB, cookies, quota management

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

### 🚧 In Progress

**Browser Engine:**

- Layout engine: Box model calculation, block/flexbox/grid layout algorithms, text measurement
- Paint engine: Display list generation, rasterization
- Compositor: Layer management, tiling, GPU texture uploads, VSync synchronization
- JavaScript execution: V8 bytecode compilation, JIT optimization, event loop integration
- Full rendering pipeline: End-to-end integration from HTML to pixels

**Proxy Engine:**

- Load balancer implementations: Active load balancing algorithms (round-robin, least connections, IP hash)
- WebSocket proxying: Full duplex proxying, frame handling
- Metrics collection: Request tracking, latency histograms, throughput measurement
- Distributed tracing: Trace context propagation, span collection

**Query Engine:**

- Browser adapter: Integration with browser engine for DOM/CSSOM queries
- Proxy adapter: Integration with proxy engine for network/cache queries
- Advanced SQL features: Subqueries, joins, aggregations, window functions
- Query result formatting: Multiple output formats (JSON, CSV, table)

**Integration:**

- End-to-end data flow: Query Engine → Proxy Engine → Browser Engine → Pixpane
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
- DevTools protocol: Chrome DevTools Protocol compatibility
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
