# BrowserX Integration & Use Cases Design

## Overview

This document outlines the design for fixing BrowserX integration gaps and implementing 8 comprehensive use cases to create a fully functional browser automation toolkit.

## Current State

BrowserX has substantial implementations (~360K lines of code) across 4 layers:
- **Query Engine**: Parser, planner, optimizer complete; executor partially connected
- **Browser Engine**: Networking, rendering, JavaScript, storage fully implemented
- **Proxy Engine**: Gateway, caching, middleware implemented; not connected to other layers
- **MCP Server**: New infrastructure; needs tool implementations

## Problem Statement

### Integration Gaps

1. **Browser context not propagated** - Executor stores context locally but never updates global context. SCREENSHOT(), PDF() fail after NAVIGATE.

2. **ProxyController ignores Runtime** - Constructor accepts Runtime but never uses it. All cache/interception operations use local stubs.

3. **QueryEngine never initializes ProxyController** - Executor created without proxy controller, so proxy operations fail silently.

4. **No Proxy → Browser routing** - Browser makes direct network requests, bypassing proxy entirely.

5. **Integration tests are stubs** - 82+ tests contain `assert(true); // TODO`.

### Missing Use Cases

1. Query Engine Execution (end-to-end)
2. Web Scraping API
3. Visual Testing
4. Network Recording (HAR)
5. Performance Metrics
6. Authentication Flows
7. PDF Generation
8. Form Automation

## Architecture

### Phased Approach

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Integration Fixes (Foundation)                        │
│  - Browser context propagation                                  │
│  - ProxyController → Runtime connection                         │
│  - QueryEngine → ProxyController initialization                 │
│  - Proxy → Browser network routing                              │
│  - Integration tests                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: Core Execution (Enables Everything Else)              │
│  - Query Engine Executor completion                             │
│  - Form Automation (uses executor)                              │
│  - Authentication Flows (uses forms + sessions)                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: Data & Testing Use Cases                              │
│  - Web Scraping API                                             │
│  - Network Recording (HAR)                                      │
│  - Visual Testing                                               │
│  - Performance Metrics                                          │
│  - PDF Generation                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow (Target State)

```
MCP Server / User Code
        ↓
Query Engine (parse → plan → optimize → execute)
        ↓
   ┌────┴────┐
   ↓         ↓
Proxy    Browser
Controller  Controller
   ↓         ↓
Proxy Runtime ←→ Browser Engine
   │              │
   └──────────────┘
    (network routing)
```

## Phase 1: Integration Fixes

### 1.1 Browser Context Propagation

**Files:**
- `query-engine/executor/executor.ts`
- `query-engine/controllers/browser/browser-context.ts`

**Changes:**
- After navigation, call `setCurrentBrowserController(this.browserController)`
- Ensure context stack is properly managed for nested operations
- Add context cleanup on query completion

### 1.2 ProxyController → Runtime Connection

**File:** `query-engine/controllers/proxy/proxy-controller.ts`

**Changes:**
- Wire `executeCacheLookup()` to `runtime.cache.get()`
- Wire `executeCacheStore()` to `runtime.cache.set()`
- Wire `addRequestInterceptor()` to `runtime.gateway.addMiddleware()`
- Wire `addResponseInterceptor()` to response middleware chain
- Add runtime health check on initialization

### 1.3 QueryEngine ProxyController Initialization

**File:** `query-engine/core/engine.ts`

**Changes:**
- Accept proxy configuration in QueryEngine config
- Create Runtime instance if proxy enabled
- Create ProxyController with Runtime
- Pass ProxyController to QueryExecutor
- Add cleanup on engine shutdown

### 1.4 Proxy → Browser Network Routing

**Files:**
- `browser/src/main.ts`
- `browser/src/engine/RequestPipeline.ts`

**Changes:**
- Add `proxyConfig` option to BrowserEngine
- Modify RequestPipeline to route through proxy when configured
- Handle proxy authentication headers
- Respect proxy bypass rules for certain hosts

### 1.5 Integration Tests

**Files:**
- `query-engine/tests/integration/*.test.ts`
- `query-engine/tests/e2e/*.test.ts`

**Test Scenarios:**
- Navigate + DOM query + screenshot (end-to-end)
- Cache lookup/store through proxy runtime
- Request interception with middleware
- Response modification
- Parallel execution with context isolation
- Error recovery and cleanup

## Phase 2: Core Execution

### 2.1 Query Engine Executor Completion

**Components:**
- Complete all step executors (NAVIGATE, SELECT, INSERT, UPDATE, DELETE)
- Wire DOM operations to BrowserController
- Wire network operations to ProxyController
- Implement result formatting (JSON, table, CSV)
- Add execution timeout and cancellation
- Implement parallel step execution where safe

### 2.2 Form Automation

**New Files:**
- `browser/src/api/FormAutomation.ts`
- `query-engine/controllers/browser/form-controller.ts`

**Features:**
- Form detection (find forms on page)
- Field type detection (text, email, password, select, checkbox, radio, file)
- Auto-fill with validation
- File upload handling
- Form submission with success verification
- Multi-step form workflows
- CAPTCHA detection (notify, don't solve)

### 2.3 Authentication Flows

**New Files:**
- `browser/src/api/AuthenticationManager.ts`
- `query-engine/controllers/auth/auth-controller.ts`

**Features:**
- Basic/Bearer authentication
- OAuth 2.0 flow automation
- Session token management
- Cookie persistence across requests
- Auto-refresh expired tokens
- Login form detection and auto-fill
- CSRF token extraction

## Phase 3: Data & Testing Use Cases

### 3.1 Web Scraping API

**New Files:**
- `browser/src/api/WebScraper.ts`
- `browser/src/api/ScrapeConfig.ts`

**Features:**
- High-level scraping orchestration
- Pagination detection and handling (next button, infinite scroll, page numbers)
- Rate limiting per domain
- Proxy rotation support
- Structured data extraction (CSS selectors, XPath)
- JSON-LD and microdata parsing
- Error recovery with retries
- Concurrent scraping with limits

### 3.2 Network Recording (HAR)

**New Files:**
- `proxy-engine/recording/HARRecorder.ts`
- `proxy-engine/recording/HARPlayer.ts`
- `proxy-engine/recording/types.ts`

**Features:**
- HAR 1.2 format support
- Record all network traffic during session
- Playback recorded traffic (mock server)
- Request matching (URL, method, headers)
- Network throttling presets (slow-3g, fast-3g, 4g)
- Offline simulation
- Selective recording (filter by domain/type)

### 3.3 Visual Testing

**New Files:**
- `browser/src/api/VisualTester.ts`
- `browser/src/api/ImageComparator.ts`

**Features:**
- Baseline screenshot management
- Pixel-by-pixel comparison with threshold
- Diff image generation (highlight changes)
- Multi-viewport testing (mobile, tablet, desktop)
- Element-specific screenshots
- Ignore regions (dynamic content)
- Report generation (HTML, JSON)

### 3.4 Performance Metrics

**New Files:**
- `browser/src/api/PerformanceProfiler.ts`
- `browser/src/api/WebVitals.ts`

**Features:**
- Core Web Vitals (LCP, FID, CLS)
- First Paint / First Contentful Paint
- Time to Interactive
- Resource timing breakdown
- JavaScript execution profiling
- Memory usage tracking
- Performance budget enforcement
- Export formats (JSON, CSV, Prometheus)

### 3.5 PDF Generation

**File:** `browser/src/api/PDFGenerator.ts` (complete existing stub)

**Features:**
- Render current page to PDF
- Page size options (A4, Letter, custom)
- Orientation (portrait, landscape)
- Margins configuration
- Headers and footers with page numbers
- Print media emulation
- Background graphics option
- Scale factor

## Testing Strategy

Each phase includes tests:

### Phase 1 Tests
- Integration tests for each fix
- End-to-end flow tests

### Phase 2 Tests
- Query executor unit tests for each step type
- Form automation tests with mock forms
- Authentication flow tests with mock OAuth server

### Phase 3 Tests
- Scraper tests with mock websites
- HAR recording/playback round-trip tests
- Visual comparison accuracy tests
- Performance metric accuracy tests
- PDF output validation tests

## Success Criteria

1. **Phase 1 Complete:** All integration tests pass; query execution works end-to-end
2. **Phase 2 Complete:** Forms can be detected, filled, submitted; OAuth flows work
3. **Phase 3 Complete:** All 8 use cases have working implementations with tests

## Dependencies

- Deno 1.x with `--allow-all` permissions for tests
- Network access for integration tests
- Display environment for Pixpane tests (optional)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Proxy routing breaks browser performance | Add bypass for same-origin requests |
| HAR files get large | Add size limits and compression |
| Visual tests are flaky | Use threshold tolerance, ignore dynamic regions |
| OAuth providers change | Abstract provider-specific logic |

## Timeline Estimate

- **Phase 1:** Integration fixes
- **Phase 2:** Core execution
- **Phase 3:** Use cases (can parallelize)

(No specific time estimates per project guidelines)
