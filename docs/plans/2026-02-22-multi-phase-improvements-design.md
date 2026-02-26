# BrowserX Multi-Phase Improvement Plan

**Date:** 2026-02-22
**Scope:** Security hardening, architecture refactor, performance optimization, code quality

## Phase 1 — Security Hardening

### 1a. SSRF Validation (WindowObject.ts:1069-1122)

New file: `browser/src/engine/security/URLValidator.ts`

- Block private IPs: 10.x, 172.16-31.x, 192.168.x, 127.x, ::1, link-local 169.254.x
- Block metadata endpoints (169.254.169.254)
- Block non-HTTP protocols: file://, ftp://, data:// (except data URIs for images)
- Configurable allowlist for testing/internal use
- Integrate into `createFetch()` before request pipeline calls

### 1b. SessionId Sanitization (ActivityTracker.ts:62,112,230)

- Add `sanitizeId()` — alphanumeric + hyphens/underscores only
- Reject path traversal (../, absolute paths, null bytes)
- Apply to all file path construction (screenshots, logs, metadata)
- Replace `Math.random()` with `crypto.randomUUID()`

### 1c. Same-Origin Runtime Checks (StorageManager.ts:48-76)

- Add origin validation in `setItem()`, `removeItem()`, `clear()`
- Verify URL origin matches storage origin at runtime
- Validate origin format on construction

### 1d. crypto.randomUUID() Migration (9 files)

Replace `Math.random().toString(36).slice(2)` in:
- `mcp-server/activity/ActivityTracker.ts:62`
- `runtime/src/resources/BrowserPool.ts:473`
- `browser/src/engine/javascript/V8Isolate.ts:303`
- `browser/src/engine/javascript/JSValue.ts:130`
- `query-engine/core/engine.ts:781`
- `query-engine/planner/planner.ts:1091`
- `proxy-engine/core/thread/worker.ts:56`
- `doc-site/src/pages/api/execute.ts:106,263`
- `doc-site/src/components/playground/store.ts:320,492`

### 1e. Rate Limiting on browser_evaluate (mcp-server/tools/browser-tools.ts:407-460)

- Add `ToolRateLimiter` wrapping sliding window from proxy-engine
- Default: 100 evals/minute per session
- Check before `validateScript()` call

### 1f. CSP Implementation (Full Spec — CSP Level 3)

New file: `browser/src/engine/security/ContentSecurityPolicy.ts`

**Directives:** default-src, script-src, style-src, img-src, connect-src, font-src,
media-src, object-src, frame-src, frame-ancestors, base-uri, form-action, sandbox,
report-uri, report-to, plugin-types, worker-src, manifest-src, navigate-to

**Source expressions:** 'self', 'none', 'unsafe-inline', 'unsafe-eval', 'strict-dynamic',
nonce-*, hash-* (sha256/384/512), scheme-source, host-source

**Enforcement points:**
- ScriptExecutor: inline script nonce/hash check
- RenderingPipeline: stylesheet/image source check
- WindowObject.fetch(): connect-src check
- Report-only mode via Content-Security-Policy-Report-Only header

## Phase 2 — Architecture + Critical Bug

### 2a. RenderingPipeline Decomposition (1,292 lines → 5 classes)

Split `browser/src/engine/RenderingPipeline.ts` into:

| New File | Responsibility | Source Lines |
|----------|---------------|-------------|
| `ResourceFetcher.ts` | HTML/CSS/image fetching | 672-941 |
| `ImageDecoder.ts` | Binary format parsing (PNG/JPEG/GIF/WebP/SVG) | 146-239 |
| `WebGPUManager.ts` | WebGPU init/dispose/screenshot | 330-447, 1058-1082 |
| `RenderingOrchestrator.ts` | render() pipeline + observer | 452-663, 287-297 |
| `RenderingPipeline.ts` | Thin facade, backward compat | New ~100 lines |

### 2b. Query Engine Workspace Imports

- Add `@browserx/browser`, `@browserx/proxy-engine` to `query-engine/deno.json`
- Replace ~20 relative cross-workspace imports with `@browserx/*`
- Internal query-engine imports stay relative

### 2c. LRU Eviction Bug Fix (proxy-engine/core/cache/kv/storage.ts:38-44)

**Bug:** Current code evicts by insertion order (FIFO), not access order (LRU).

**Fix:**
- Add `accessOrder: Map<string, number>` tracking access counter
- Update `get()` to bump counter on access
- Eviction finds entry with minimum access counter

## Phase 3 — Performance

### 3a. Inline Caching for Property Access (IgnitionInterpreter.ts:824-867)

- Add `InlineCache` per bytecode offset for GET_PROPERTY/SET_PROPERTY
- Cache: object shape → property value (fast path)
- Miss: full Map lookup + populate cache (slow path)
- Clear on context switch
- Expected: 2-5x speedup on property-heavy JS

### 3b. CSS Measurement Caching (RenderObject.ts:232-277)

- Add `pixelValueCache: Map<string, Pixels>` per RenderObject
- Cache `getPixelValue()` results per property
- Invalidate on `markNeedsLayout()` / style change
- Expected: 30-50% faster layout for complex DOM trees

## Phase 4 — Quality

### 4a. Indent Standardization

- Change `browser/deno.json` indentWidth: 4 → 2
- Run `deno fmt` on browser workspace
- Single formatting commit

### 4b. Browser-Native Structured Logging

Replace 157 `console.log` calls with browser-spec Console API:

- `console.log/debug/info/warn/error/trace/group/groupEnd/time/timeEnd/table/assert/count/dir`
- Internal `LogSink` abstraction:
  - Browser context → DevTools Console domain events
  - Deno context → stderr with level filtering
- `BROWSERX_LOG_LEVEL` env var (debug/info/warn/error)
- Component tags: `[RenderingPipeline] Layout complete (23ms)`

### 4c. Reduce `as any` (88 → target <20)

- DOMBindings.ts (29 uses): Define proper FFI type interfaces
- PaintLayer/FlexboxLayout: Use `unknown` + type guards
- Keep `as any` only at true FFI boundaries

## Execution Order

Phase 1 → Phase 2 → Phase 3 → Phase 4

Each phase ships independently and can be reviewed/tested in isolation.
