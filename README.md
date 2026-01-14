# BrowserX

> ⚠️ **Work in Progress** - BrowserX is in active development. Many components are experimental, incomplete, or undergoing significant changes. This project is not yet production-ready.

A multi-layered browser and proxy system built with TypeScript/Deno and Rust, designed for programmability, composability, and extensibility. BrowserX aims to provide a queryable interface to browser and proxy functionality, enabling both humans and AI/ML systems to interact with web content programmatically.

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
┌─────────────────────────────────────┐
│      Pixpane (Optional)             │  Native windowing & GPU
│  - Cross-platform windows (Rust)    │  rendering via FFI
│  - GPU acceleration (wgpu)          │
│  - Immediate-mode UI (egui)         │
└─────────────────────────────────────┘
```

**Data Flow**: User requests flow down through the query engine → proxy engine → browser engine → pixpane (if visual output needed). Each layer can be used independently or composed together.

## 🏗️ Repository Structure

```
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
│   └── pixpane/            # Native windowing layer (Rust)
│       ├── src/
│       │   ├── window/     # Window management (winit)
│       │   ├── rendering/  # GPU rendering (wgpu, egui)
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
deno run --allow-ffi --unstable-ffi test.ts
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

## 🛠️ Development

### Build Commands

```bash
# Browser type checking
cd browser && deno task check

# Proxy type checking
cd proxy-engine && deno check core/runtime.ts

# Build Pixpane + generate bindings
cd crates/pixpane && cargo build --release && deno run --allow-all gen_bindings.ts

# Run all tests
cd browser && deno test --allow-all
cd crates/pixpane && cargo test
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

## 📊 Current Status

### ✅ Implemented

- **Browser Engine**: Core type system, network primitives (TCP/TLS), HTTP parsing, DOM types, CSS types, rendering types
- **Proxy Engine**: Gateway routing, connection pooling, transport protocols (HTTP/1.1, HTTP/2, HTTP/3), cache manager, middleware system
- **Pixpane**: Window creation, GPU rendering, FFI bindings, egui UI integration

### 🚧 In Progress

- **Browser Engine**: HTML parser, CSS parser, layout engine, JavaScript V8 integration, compositor
- **Proxy Engine**: Load balancing implementations, WebSocket proxying, metrics collection
- **Query Engine**: Parser, executor, browser/proxy adapters
- **Integration**: End-to-end data flow between all layers

### 📋 Planned

- Complete rendering pipeline with GPU acceleration
- JavaScript execution with V8 isolates
- Storage systems (localStorage, IndexedDB, cookies)
- Query engine with full SQL-like syntax
- CLI interface for query engine
- Web UI for browser/proxy inspection
- Comprehensive test suites for all components

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
