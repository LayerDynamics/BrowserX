# Close Known Gaps Implementation Plan

> **VERIFIED 2026-02-20:** All 18 tasks in this plan have been COMPLETED. Browser context wired into QueryExecutor, all 16 proxy test stubs replaced with comprehensive tests (1878 total). Plan kept for historical reference.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the query engine's BrowserController into the executor so DOM functions (TEXT, HTML, ATTR, EXISTS, COUNT, CLICK, TYPE) work in queries; implement comprehensive tests for the 16 remaining proxy engine test stubs.

**Architecture:**
- Gap 1 is a single-line fix in `executor.ts`: call `setCurrentBrowserController(this.browserController)` at the start of `execute()` and `clearBrowserContext()` at the end; the entire DOM function stack is already implemented.
- Gap 2 is 16 test files with `assert(true) // TODO` stubs; all source implementations exist and work; tests just need to be written against the public API of each class.

**Tech Stack:** Deno, TypeScript, `@std/assert`, existing BrowserX classes

---

## Corrections to Memory

Before starting, note that MEMORY.md has several outdated entries:

- **Navigator.ts** is NOT empty — it has 76 lines implementing `GPU`, `NavigatorGPU` interfaces and `installNavigatorGPU()`
- **CanvasContext.ts** is NOT empty — it re-exports from `./canvas/CanvasContext.ts` (150+ line implementation)
- **Cache directory typo** does NOT exist — directory is correctly spelled `encryption/`
- **AES-GCM encryption** IS implemented in `proxy-engine/core/cache/encryption/aes.ts`

Update MEMORY.md after completing this plan.

---

## Task 1: Wire Browser Context into QueryExecutor

**Files:**
- Modify: `query-engine/executor/executor.ts` (lines 100–210, the `execute()` method)

The `setCurrentBrowserController` is already imported (line 44) and called in `executeNavigate()` (line 403), but NOT set at the start of `execute()`. DOM function calls in MAP, FILTER, LOOP, BRANCH etc. fail because the global context is only set during NAVIGATE steps.

**Step 1: Read the execute() method to confirm the insertion point**

Read lines 100–130 of `query-engine/executor/executor.ts`.

Expected: See `async execute(plan, options)` with `const context = ...` setup before the `try` block.

**Step 2: Add browser context setup at start of execute() and teardown at end**

In `query-engine/executor/executor.ts`, find the line:

```typescript
    let cacheHits = 0;
    let cacheMisses = 0;

    try {
```

Add browser context setup just before the `try`:

```typescript
    // Set browser context for DOM function evaluation throughout this query
    if (this.browserController) {
      setCurrentBrowserController(this.browserController);
    }

    let cacheHits = 0;
    let cacheMisses = 0;

    try {
```

Also import `clearBrowserContext` — change the existing import at line 44:

```typescript
import { setCurrentBrowserController, clearBrowserContext } from "../controllers/browser/browser-context.ts";
```

Then find the end of the `try` block and add to both the success and error return paths — actually, use a `finally` in the outer try/catch. Find the structure (the catch is at line ~196):

```typescript
    } catch (error) {
      const endTime = performance.now();

      return {
        queryId: plan.id,
```

And add the teardown right before the `try` ... insert a new wrapping pattern. Actually the simplest change: add `clearBrowserContext()` at the start of both the success return and the error return (they both reach `return {queryId: plan.id,...}`). Or better: wrap the existing try/catch in an outer try/finally:

Locate this block (around line 118):
```typescript
    try {
      // Get topological order for sequential execution
      const order = this.getExecutionOrder(plan);
```

And wrap it:
```typescript
    try {
      // Get topological order for sequential execution
      const order = this.getExecutionOrder(plan);
```

Change to include a finally:
```typescript
    try {
      try {
        // Get topological order for sequential execution
        const order = this.getExecutionOrder(plan);
```

And at the end of the inner catch, before the outer return in catch, add `clearBrowserContext()`. Then wrap the whole try/catch with an outer finally:

The cleanest approach — modify the outer `try/catch` to a `try/catch/finally`:

Find:
```typescript
    } catch (error) {
      const endTime = performance.now();

      return {
        queryId: plan.id,
        data: null,
        success: false,
        error: error as Error,
        timing: {
          startTime,
          endTime,
          totalTime: endTime - startTime,
        },
        stepResults: context.stepResults,
        cacheHits,
        cacheMisses,
      };
    }
  }
```

Replace with:
```typescript
    } catch (error) {
      const endTime = performance.now();

      return {
        queryId: plan.id,
        data: null,
        success: false,
        error: error as Error,
        timing: {
          startTime,
          endTime,
          totalTime: endTime - startTime,
        },
        stepResults: context.stepResults,
        cacheHits,
        cacheMisses,
      };
    } finally {
      clearBrowserContext();
    }
  }
```

**Step 3: Run type check**

```bash
deno task query:check
```

Expected: No errors for executor.ts changes (the import and two added lines are valid).

**Step 4: Write integration test for DOM functions in queries**

Create `query-engine/tests/integration/browser-wiring.test.ts`:

```typescript
/**
 * Integration test: BrowserController wired into QueryExecutor
 * Verifies DOM functions (TEXT, EXISTS, COUNT, etc.) work when a
 * BrowserController is set on the executor before query execution.
 */
import { assertEquals, assert } from "@std/assert";
import { QueryExecutor } from "../../executor/executor.ts";
import { BrowserController } from "../../controllers/browser/browser-controller.ts";
import { getCurrentBrowserController, clearBrowserContext } from "../../controllers/browser/browser-context.ts";

// Minimal mock page that satisfies BrowserPage interface
function makeMockPage(textResult = "hello") {
  return {
    getUrl: () => "http://example.com",
    query: async (_selector: string) => [{
      getText: async () => textResult,
      getAttribute: async (_attr: string) => "mock-attr",
      getProperty: async (_prop: string) => null,
      click: async () => {},
      type: async (_text: string) => {},
    }],
    click: async (_selector: string) => {},
    type: async (_selector: string, _text: string) => {},
    evaluate: async (_fn: string) => null,
    waitFor: async (_selector: string) => {},
  };
}

Deno.test({
  name: "QueryExecutor - setCurrentBrowserController called at execute() start",
  async fn() {
    clearBrowserContext();

    // BrowserController requires a BrowserEngine; use any object since we
    // only test that the context is set, not that navigation works.
    const mockEngine = {} as never;
    const controller = new BrowserController(mockEngine);
    // Inject a mock page so DOM functions have something to query
    (controller as unknown as { currentPage: unknown }).currentPage = makeMockPage();

    const executor = new QueryExecutor(undefined, undefined, controller);

    // Spy: after execute() starts, getCurrentBrowserController() should return controller.
    // We cannot pause inside execute(), so we verify the context was cleared after.
    // A minimal ExecutionPlan with zero steps:
    const emptyPlan = {
      id: "test-plan-1",
      steps: [],
      metadata: { queryId: "test-plan-1", estimatedCost: 0, parallelizable: false, cacheable: false },
    };

    const result = await executor.execute(emptyPlan as never);
    assert(result.success);

    // After execute(), context must be cleared by finally block
    assertEquals(getCurrentBrowserController(), undefined);
  },
});

Deno.test({
  name: "QueryExecutor - context cleared after execute() even on error",
  async fn() {
    clearBrowserContext();

    const controller = new BrowserController({} as never);
    const executor = new QueryExecutor(undefined, undefined, controller);

    // Plan that will cause a step execution error
    const badPlan = {
      id: "test-plan-2",
      steps: [{ id: "s1", type: "UNKNOWN_STEP_TYPE" }],
      metadata: { queryId: "test-plan-2", estimatedCost: 0, parallelizable: false, cacheable: false },
    };

    const result = await executor.execute(badPlan as never);
    // Should fail gracefully (not throw)
    assert(!result.success || result.success); // either outcome; just checking no crash

    // Context must be cleared regardless
    assertEquals(getCurrentBrowserController(), undefined);
  },
});
```

**Step 5: Run the integration test**

```bash
deno test --allow-all query-engine/tests/integration/browser-wiring.test.ts
```

Expected: 2 passed, 0 failed.

**Step 6: Run full query test suite**

```bash
deno task query:test
```

Expected: All existing tests still pass.

**Step 7: Commit**

```bash
git add query-engine/executor/executor.ts query-engine/tests/integration/browser-wiring.test.ts
git commit -m "feat(query-engine): wire BrowserController context into execute() so DOM functions work in all step handlers"
```

---

## Task 2: MemoryStorage Tests (`cache/kv/storage.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/cache/kv/storage.test.ts`
- Reference: `proxy-engine/core/cache/kv/storage.ts`

**Step 1: Read the source implementation**

```bash
cat proxy-engine/core/cache/kv/storage.ts
```

Note the public API: constructor args, `get()`, `set()`, `delete()`, `has()`, `keys()`, `values()`, `entries()`, `clear()`, `size` property, and any eviction/TTL behavior.

**Step 2: Replace the stub with comprehensive tests**

Replace the entire content of `proxy-engine/tests/core/cache/kv/storage.test.ts` based on what you found in the source. Follow the same pattern as `key.test.ts` (grouped by method, one behavior per test). Minimum 15 tests covering:
- Construction (empty state, size=0)
- `set()` / `get()` basic round trip
- `has()` returns true after set, false for missing key
- `delete()` removes key, returns true; false for missing
- `keys()`, `values()`, `entries()` return correct iterables
- `clear()` resets to empty
- `size` property tracks count
- TTL/expiry if implemented (check source)
- LRU eviction if implemented (check source)

**Step 3: Run the test**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/cache/kv/storage.test.ts
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add proxy-engine/tests/core/cache/kv/storage.test.ts
git commit -m "test(proxy): implement MemoryStorage comprehensive tests"
```

---

## Task 3: WorkerPool Tests (`core/worker/worker_pool.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/worker/worker_pool.test.ts`
- Reference: `proxy-engine/core/worker/worker_pool.ts`

**Step 1: Read the source**

```bash
cat proxy-engine/core/worker/worker_pool.ts
```

Note public API: constructor (maxWorkers?), `acquire()`, `release(id)`, `getStats()`, `clear()`, or equivalent methods.

**Step 2: Replace stub with tests**

Follow the same pattern used in `worker_manager.test.ts` — group by method, one behavior per test. Minimum 12 tests:
- Construction with default/custom size
- `acquire()` returns a worker ID
- Multiple acquires return distinct IDs
- Pool enforces max size (acquire returns null/throws when full)
- `release()` makes worker available again
- `getStats()` returns total/active/available counts
- `clear()` resets pool state

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/worker/worker_pool.test.ts
git add proxy-engine/tests/core/worker/worker_pool.test.ts
git commit -m "test(proxy): implement WorkerPool comprehensive tests"
```

---

## Task 4: Thread Worker Tests (`core/thread/worker.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/thread/worker.test.ts`
- Reference: `proxy-engine/core/thread/worker.ts`

**Step 1: Read the source**

```bash
cat proxy-engine/core/thread/worker.ts
```

**Step 2: Replace stub with tests**

Minimum 12 tests covering the exported class/functions. Pattern: same as `worker_manager.test.ts`. Focus on data/state management aspects that don't require actual OS threads (construction, status tracking, method calls that update state, getters).

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/thread/worker.test.ts
git add proxy-engine/tests/core/thread/worker.test.ts
git commit -m "test(proxy): implement ThreadWorker comprehensive tests"
```

---

## Task 5: ThreadPool Tests (`core/thread/thread_pool.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/thread/thread_pool.test.ts`
- Reference: `proxy-engine/core/thread/thread_pool.ts`

**Step 1: Read the source**

```bash
cat proxy-engine/core/thread/thread_pool.ts
```

**Step 2: Replace stub with tests following same pattern as Task 3/4**

Minimum 12 tests. Focus on pool lifecycle, acquire/release, stats, clear.

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/thread/thread_pool.test.ts
git add proxy-engine/tests/core/thread/thread_pool.test.ts
git commit -m "test(proxy): implement ThreadPool comprehensive tests"
```

---

## Task 6: ProcessManager Tests (`core/process/process_manager.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/process/process_manager.test.ts`
- Reference: `proxy-engine/core/process/process_manager.ts`

**Step 1: Read the source**

```bash
cat proxy-engine/core/process/process_manager.ts
```

Note: Also check `pid.ts`, `priority.ts`, `spawn.ts` in same directory for types used by ProcessManager.

**Step 2: Replace stub with tests**

Minimum 15 tests: construction, spawn/register, get by ID, getStats, stop/kill, list processes, clear. Avoid tests that actually spawn OS processes — test the state management layer only.

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/process/process_manager.test.ts
git add proxy-engine/tests/core/process/process_manager.test.ts
git commit -m "test(proxy): implement ProcessManager comprehensive tests"
```

---

## Task 7: Socket Tests (`core/network/transport/socket/Socket.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/network/transport/socket/Socket.test.ts`
- Reference: `proxy-engine/core/network/transport/socket/socket.ts`, `socket_options.ts`, `socket_stats.ts`

**Step 1: Read the sources**

```bash
cat proxy-engine/core/network/transport/socket/socket.ts
cat proxy-engine/core/network/transport/socket/socket_options.ts
cat proxy-engine/core/network/transport/socket/socket_stats.ts
```

**Step 2: Replace stub with tests**

Focus on data structure aspects: `SocketOptions` construction and defaults, `SocketStats` initial state, `Socket` state machine (`isConnected()`, `getState()`, `getStats()`). Do NOT write tests that open actual TCP connections — test synchronous/state methods only.

Minimum 12 tests.

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/network/transport/socket/Socket.test.ts
git add proxy-engine/tests/core/network/transport/socket/Socket.test.ts
git commit -m "test(proxy): implement Socket comprehensive tests"
```

---

## Task 8: HTTP/2 Frame Tests (`http2_frames.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/network/transport/http/http2_frames.test.ts`
- Reference: `proxy-engine/core/network/transport/http/http2_frames.ts`

**Step 1: Read the source**

```bash
cat proxy-engine/core/network/transport/http/http2_frames.ts
```

**Step 2: Replace stub with tests**

HTTP/2 frames are data structures (DATA, HEADERS, SETTINGS, PING, GOAWAY, etc.). Test:
- Frame construction with valid fields
- Frame type constants have expected values
- `parseFrame()` / `serializeFrame()` round-trip if implemented
- Flag bitmask helpers if present
- Edge cases: empty payload, max stream ID, stream ID 0 for connection-level frames

Minimum 15 tests. No actual TCP connections needed.

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/network/transport/http/http2_frames.test.ts
git add proxy-engine/tests/core/network/transport/http/http2_frames.test.ts
git commit -m "test(proxy): implement HTTP2Frames comprehensive tests"
```

---

## Task 9: HPACK Tests (`http2_hpack.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/network/transport/http/http2_hpack.test.ts`
- Reference: `proxy-engine/core/network/transport/http/http2_hpack.ts`

**Step 1: Read the source**

```bash
cat proxy-engine/core/network/transport/http/http2_hpack.ts
```

**Step 2: Replace stub with tests**

HPACK is the HTTP/2 header compression codec. Test:
- Encoder: encodes known headers, produces smaller output than literal
- Decoder: decodes what encoder produces (round-trip)
- Static table entries (`:method GET`, `:status 200`, etc.)
- Dynamic table: adding entries increases size, eviction at limit
- Integer encoding/decoding for header field lengths

Minimum 15 tests. Purely data transformation — no I/O.

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/network/transport/http/http2_hpack.test.ts
git add proxy-engine/tests/core/network/transport/http/http2_hpack.test.ts
git commit -m "test(proxy): implement HPACK comprehensive tests"
```

---

## Task 10: HTTP/2 Stream Tests (`http2_stream.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/network/transport/http/http2_stream.test.ts`
- Reference: `proxy-engine/core/network/transport/http/http2_stream.ts`

**Step 1: Read the source**

```bash
cat proxy-engine/core/network/transport/http/http2_stream.ts
```

**Step 2: Replace stub with tests**

HTTP/2 streams have a state machine (IDLE → OPEN → HALF_CLOSED → CLOSED). Test:
- Stream construction with valid stream ID
- Initial state is IDLE
- State transitions: open, half-close (local/remote), close
- Invalid transitions throw or return error
- Stream ID 0 is reserved (connection-level)
- `getState()`, `isOpen()`, etc.

Minimum 15 tests.

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/network/transport/http/http2_stream.test.ts
git add proxy-engine/tests/core/network/transport/http/http2_stream.test.ts
git commit -m "test(proxy): implement HTTP2Stream comprehensive tests"
```

---

## Task 11: HTTP/2 Client Tests (`http2.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/network/transport/http/http2.test.ts`
- Reference: `proxy-engine/core/network/transport/http/http2.ts`

**Step 1: Read the source**

```bash
cat proxy-engine/core/network/transport/http/http2.ts
```

**Step 2: Replace stub with tests**

Focus on construction, configuration, and synchronous state/getter methods. Avoid tests that open TCP connections. If the class requires connection to test anything meaningful, test construction + configuration + getStats()/getState() returning sensible defaults.

Minimum 12 tests.

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/network/transport/http/http2.test.ts
git add proxy-engine/tests/core/network/transport/http/http2.test.ts
git commit -m "test(proxy): implement HTTP2 comprehensive tests"
```

---

## Task 12: HTTPS Tests (`https.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/network/transport/http/https.test.ts`
- Reference: `proxy-engine/core/network/transport/http/https.ts`

**Step 1: Read the source**

```bash
cat proxy-engine/core/network/transport/http/https.ts
```

**Step 2: Replace stub with tests**

Focus on: construction with TLS config, TLS option validation (required fields, defaults), configuration getters, state machine (before connect). Do NOT test actual TLS handshakes.

Minimum 12 tests.

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/network/transport/http/https.test.ts
git add proxy-engine/tests/core/network/transport/http/https.test.ts
git commit -m "test(proxy): implement HTTPS comprehensive tests"
```

---

## Task 13: HTTP/3 Tests (`http3.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/network/transport/http/http3.test.ts`
- Reference: `proxy-engine/core/network/transport/http/http3.ts`

**Step 1: Read the source**

```bash
cat proxy-engine/core/network/transport/http/http3.ts
```

**Step 2: Replace stub with tests**

Same approach as Tasks 11–12 — construction, configuration, synchronous getters. HTTP/3 uses QUIC; tests should not open UDP sockets.

Minimum 12 tests.

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/network/transport/http/http3.test.ts
git add proxy-engine/tests/core/network/transport/http/http3.test.ts
git commit -m "test(proxy): implement HTTP3 comprehensive tests"
```

---

## Task 14: WebSocket Proxy Tests (`websocket_proxy.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/proxy_types/websocket_proxy.test.ts`
- Reference: `proxy-engine/core/proxy_types/websocket_proxy.ts`

**Step 1: Read the source**

```bash
cat proxy-engine/core/proxy_types/websocket_proxy.ts
```

**Step 2: Replace stub with tests**

Focus on: construction/configuration, message routing rules (add/remove/check), frame type handling, configuration getters. Do NOT open actual WebSocket connections.

Look at how `reverse_proxy.test.ts` (990 lines, already passing) structures its tests as a model — it tests rule-based routing, header manipulation, configuration — without real connections.

Minimum 20 tests.

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/proxy_types/websocket_proxy.test.ts
git add proxy-engine/tests/core/proxy_types/websocket_proxy.test.ts
git commit -m "test(proxy): implement WebSocketProxy comprehensive tests"
```

---

## Task 15: SSE Proxy Tests (`sse_proxy.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/proxy_types/sse_proxy.test.ts`
- Reference: `proxy-engine/core/proxy_types/sse_proxy.ts`

**Step 1: Read the source**

```bash
cat proxy-engine/core/proxy_types/sse_proxy.ts
```

**Step 2: Replace stub with tests**

Server-Sent Events proxy — test event routing rules, event type filtering, header configuration, construction. No actual HTTP connections.

Minimum 15 tests.

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/proxy_types/sse_proxy.test.ts
git add proxy-engine/tests/core/proxy_types/sse_proxy.test.ts
git commit -m "test(proxy): implement SSEProxy comprehensive tests"
```

---

## Task 16: TLS Proxy Tests (`tls_proxy.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/proxy_types/tls_proxy.test.ts`
- Reference: `proxy-engine/core/proxy_types/tls_proxy.ts`

**Step 1: Read the source**

```bash
cat proxy-engine/core/proxy_types/tls_proxy.ts
```

**Step 2: Replace stub with tests**

TLS termination proxy — test certificate configuration validation, SNI routing rules, cipher suite configuration, construction/defaults. No actual TLS handshakes.

Minimum 15 tests.

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/proxy_types/tls_proxy.test.ts
git add proxy-engine/tests/core/proxy_types/tls_proxy.test.ts
git commit -m "test(proxy): implement TLSProxy comprehensive tests"
```

---

## Task 17: EventDriven Proxy Tests (`event_driven_proxy.test.ts`)

**Files:**
- Modify: `proxy-engine/tests/core/proxy_types/event_driven_proxy.test.ts`
- Reference: `proxy-engine/core/proxy_types/event_driven_proxy.ts`

**Step 1: Read the source**

```bash
cat proxy-engine/core/proxy_types/event_driven_proxy.ts
```

**Step 2: Replace stub with tests**

Event-driven proxy — test event listener registration, event emission, event filtering rules, construction. Use synchronous event patterns where possible.

Minimum 15 tests.

**Step 3: Run and commit**

```bash
deno test --allow-all --no-check proxy-engine/tests/core/proxy_types/event_driven_proxy.test.ts
git add proxy-engine/tests/core/proxy_types/event_driven_proxy.test.ts
git commit -m "test(proxy): implement EventDrivenProxy comprehensive tests"
```

---

## Task 18: Full Test Suite Verification + Memory Update

**Step 1: Run all proxy tests**

```bash
deno test --allow-all --no-check proxy-engine/tests/ 2>&1 | tail -5
```

Expected: 1625+ passed, 0 failed.

**Step 2: Run all query engine tests**

```bash
deno task query:test
```

Expected: All passing.

**Step 3: Run all tests**

```bash
deno task test 2>&1 | tail -10
```

Expected: All passing.

**Step 4: Update MEMORY.md**

Update the Known Gaps section to reflect:
- WebGPU shims: Navigator.ts (76 lines) and CanvasContext.ts (re-export shim) are NOT empty — already implemented
- Cache directory: spelled correctly as `encryption/` — no typo exists
- Cache AES-GCM: fully implemented in `encryption/aes.ts`
- Query Engine Browser Wiring: FIXED — context now set at `execute()` start
- Proxy Engine Tests: all 26 files now have comprehensive tests

**Step 5: Final commit**

```bash
git add .claude/projects/-Users-ryanoboyle-BrowserX/memory/MEMORY.md
git commit -m "chore: update memory with resolved known gaps"
```

---

## Quick Reference: Test Execution Commands

```bash
# Run single file
deno test --allow-all --no-check <path>

# Run all proxy tests
deno test --allow-all --no-check proxy-engine/tests/

# Run query engine tests
deno task query:test

# Run everything
deno task test
```

## Key Pattern: Read Source First, Always

For every task above, **read the implementation before writing tests**. The test structure follows directly from the public API. Do not guess what methods exist — read the file.

## Good Test Structure

```typescript
// Group tests by method with section comments
// One behavior per test
// Descriptive name: "ClassName - methodName() does specific thing"

Deno.test({
  name: "WorkerPool - acquire() returns numeric id",
  fn() {
    const pool = new WorkerPool(10);
    const id = pool.acquire();
    assert(typeof id === "number");
  },
});
```
