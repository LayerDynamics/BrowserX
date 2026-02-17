---
title: Architecture Overview
description: The five-layer architecture of BrowserX and how data flows through the system.
---

BrowserX is organized as five composable layers. Each layer can be used independently or stacked together for full-stack browser automation.

## Five-Layer Architecture

```
┌─────────────────────────────────────────┐
│      Query Engine                       │  SQL-like interface for browser/proxy
│  SELECT title FROM "https://example.com"│  operations, usable by humans and AI/ML
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│      MCP Server                         │  Model Context Protocol API
│  - AI tool integration                  │  for LLM-driven browser control
│  - stdio/HTTP transports                │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│      Runtime                            │  Unified orchestration layer
│  - Integrates browser, proxy, query     │  for composable workflows
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│      Proxy Engine                       │  Traffic routing, middleware, caching,
│  - Request/Response interception        │  load balancing, connection pooling
│  - Middleware pipeline                  │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│      Browser Engine                     │  Core rendering and networking
│  - HTML/CSS parsing, layout, paint      │  Full page load pipeline
│  - JavaScript execution (V8)            │  from DNS to pixels
│  - Network stack (TCP/TLS/HTTP)         │
└─────────────────────────────────────────┘
```

## Data Flow

User requests enter at the top of the stack and flow downward:

1. **Query Engine** — Parses SQL-like statements (SELECT, NAVIGATE, INSERT, CLICK, IF, FOR) and produces an execution plan.
2. **MCP Server** — Translates Model Context Protocol tool calls into runtime operations; provides AI agents with browser control.
3. **Runtime** — Orchestrates lifecycle, coordinates the browser pool, routes events, and applies plugins.
4. **Proxy Engine** — Intercepts outbound requests through a middleware pipeline; applies caching, load balancing, and TLS termination.
5. **Browser Engine** — Performs DNS resolution, TCP/TLS handshake, HTTP request, HTML/CSS parsing, layout, paint, and JavaScript execution.

Responses bubble back up through the same layers in reverse order.

## Module Documentation

| Module | Description | Docs |
|--------|-------------|------|
| Browser Engine | Full rendering pipeline, network stack, V8 JS engine | [/browser/](/browser/) |
| Proxy Engine | Middleware pipeline, caching, load balancing | [/proxy/](/proxy/) |
| Query Engine | SQL-like query language and execution pipeline | [/query/](/query/) |
| Runtime | Lifecycle management, plugin system, orchestration | [/runtime/](/runtime/) |
| MCP Server | AI agent integration via Model Context Protocol | [/mcp/](/mcp/) |
| DevTools | Chrome DevTools Protocol implementation (CDP) | [/devtools/](/devtools/) |

## Key Design Principles

### Composable by default

Each layer exposes a stable interface and can be used without the layers above it. You can use the Browser Engine directly for HTTP + rendering, add the Proxy Engine for traffic interception, or use the full stack for AI-driven automation.

### Headless-first

The Browser Engine runs headlessly in Deno without a display server. When GPU support is available, rendering uses WebGPU via `OffscreenWebGPU`; otherwise it falls back gracefully to a canvas shim that returns white pixels. All MCP tools work in headless mode.

### SQL-like interface

The Query Engine makes browser automation readable and composable. Queries are parsed through a full pipeline — Lexer → Parser → Semantic Analyzer → Optimizer → Planner → Executor — producing structured results that can be consumed programmatically or by AI agents.

### Runtime integration

The Runtime acts as the integration hub. The MCP Server uses the Runtime's `BrowserPool` for session lifecycle, registers health checks and metrics, and emits structured events (`session_created`, `session_closed`, `session_expired`) for observability.
