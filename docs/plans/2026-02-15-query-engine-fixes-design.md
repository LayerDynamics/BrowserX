# Query Engine Critical Fixes — Design

**Date:** 2026-02-15
**Status:** Approved

## Problem

The query engine pipeline (Lexer → Parser → Analyzer → Optimizer → Planner → Executor → Formatter) is architecturally complete and passes 1,593 tests, but `SELECT title FROM "https://example.com"` fails at execution time. The network layer works (fetches pages, parses HTML/CSS, builds DOM), but the last-mile integration — extracting data from the DOM via queries — is broken.

## Issues (7 total)

### Critical (blocks query execution)

**Issue 1: Field resolution broken — "Undefined identifier: title"**
- `SELECT title FROM "url"` → planner creates `DOMQueryStep{selector:"body", extractFields:[{name:"title", expression:{type:"IDENTIFIER", name:"title"}}]}`
- `BrowserController.executeDOMQuery()` queries `<body>`, creates eval context with only `{text, element, ...attributes}` — no `title` key
- `ExpressionEvaluator.evaluateIdentifier()` throws "Undefined identifier: title"
- **Root cause:** No semantic field mapping. `title` should resolve to `<title>` tag, `description` to `<meta name="description">`, etc.
- **Files:** `query-engine/controllers/browser/browser-controller.ts:199-249`, `browser/src/api/BrowserPage.ts`

**Issue 2: BrowserEngine not shared across steps**
- MCP `browserx_query` tool creates `QueryEngine` without BrowserEngine config
- Executor creates `new BrowserEngine()` on-demand per step (executor.ts:380, 420)
- Each step gets a fresh browser instance — DOM from NAVIGATE is lost before DOM_QUERY runs
- **Root cause:** `QueryEngine.execute()` creates `QueryExecutor(undefined)` with no browser
- **Files:** `query-engine/core/engine.ts:446`, `query-engine/executor/executor.ts:87-95`, `mcp-server/server/service-initializer.ts:312-320`

### Important (limits functionality)

**Issue 3: FROM clause doesn't accept CSS selectors**
- `SELECT name, price FROM ".product-card"` → planner treats `.product-card` as a URL, not a selector
- `extractSelector()` defaults to `"body"` for all queries
- Field-level selectors work (`SELECT .title, .price FROM "url"`) but FROM-level don't
- **Files:** `query-engine/planner/planner.ts:928-976`, specifically `extractSelector()`

**Issue 4: `@webgpu_x` not in workspace**
- 8 files in `browser/src/engine/webgpu/utils/` import `@webgpu_x`
- `crates/webgpu_x` exists but isn't in root `deno.json` workspace array
- Breaks imports from outside workspace (e.g., standalone scripts)
- **File:** `deno.json` line 2-9

**Issue 5: 19 type errors in test suite**
- Tests written against older type definitions:
  - `"buffer"` vs `DataType.BUFFER` (functions.test.ts)
  - Missing `getCurrentURL` on mock BrowserPage (controllers tests)
  - Incomplete switch exhaustiveness (types.execution.test.ts, types.primitives.test.ts)
  - `Error` vs `ExtendedError` (executor.test.ts)
- **Files:** 5-6 test files in `query-engine/tests/unit/`

### Minor

**Issue 6: Missing example file**
- `deno task query:example` runs `example.ts` which doesn't exist
- **File:** New `query-engine/example.ts`

**Issue 7: No E2E tests for SELECT queries**
- E2E tests explicitly avoid SELECT (comment: "SELECT with DOM field extraction requires defined DOM attributes")
- No test verifies full `engine.execute("SELECT ... FROM ...")` end-to-end
- **Files:** `query-engine/tests/e2e/query-engine-e2e.test.ts`, new integration tests needed

## Design

### Fix 1: Page metadata injection (Issue 1)

Add `getMetadata()` to `BrowserPage` that extracts page-level fields from the DOM:

```typescript
// browser/src/api/BrowserPage.ts
async getMetadata(): Promise<Record<string, unknown>> {
  const dom = this.currentRenderingResult?.dom;
  return {
    title: this.extractTitle(dom),      // <title> text
    description: this.extractMeta(dom, "description"),  // <meta name="description">
    url: this.currentURL,
    keywords: this.extractMeta(dom, "keywords"),
    author: this.extractMeta(dom, "author"),
    // og: tags, etc.
  };
}
```

In `BrowserController.executeDOMQuery()`, inject metadata into eval context:

```typescript
// Before the element loop
const metadata = await this.currentPage.getMetadata?.() || {};
// In the eval context creation:
const evalContext = {
  variables: new Map([
    ...Object.entries(metadata),     // page-level fields: title, description, url
    ...Object.entries(elementData),  // element-level: text, attributes
  ]),
  functions: new Map(),
};
```

### Fix 2: Share BrowserEngine across execution (Issue 2)

The executor already accepts a `BrowserController` in its constructor. The problem is `QueryEngine.execute()` passes `undefined`:

```typescript
// engine.ts line 446 (current)
const executor = new QueryExecutor(undefined, this.proxyController);
```

Fix: Create a single `BrowserController` at engine initialization and reuse it:

```typescript
// engine.ts — add instance field
private browserController?: BrowserController;

// In execute():
if (!this.browserController) {
  const browserEngine = new BrowserEngine(this.config.browser);
  this.browserController = new BrowserController(browserEngine);
}
const executor = new QueryExecutor(this.browserController, this.proxyController);
```

This ensures NAVIGATE and DOM_QUERY steps share the same browser instance, so DOM state persists between steps.

### Fix 3: CSS selector support in FROM clause (Issue 3)

When the FROM source looks like a CSS selector (starts with `.`, `#`, `[`, or is a tag name without `://`), use it as the query selector instead of the URL:

In `planner.ts`, update `planSelectStatement()`:
- If source is a URL → NAVIGATE + DOM_QUERY with `extractSelector()`
- If source is a CSS selector → DOM_QUERY only (uses existing page), with source as the selector

Detection: If `stmt.source` doesn't contain `://` and matches CSS selector patterns, treat as selector.

### Fix 4: Add `@webgpu_x` to workspace (Issue 4)

One line in `deno.json`: add `"./crates/webgpu_x"` to the workspace array.

### Fix 5: Fix test type errors (Issue 5)

- Import `DataType` from `schema/types.ts` in `functions.test.ts`, use enum values
- Add `getCurrentURL: () => undefined` to all mock BrowserPage objects
- Add missing switch cases in `types.execution.test.ts` and `types.primitives.test.ts`
- Fix `ExtendedError` type in `executor.executor.test.ts`

### Fix 6: Create example file (Issue 6)

Simple `query-engine/example.ts` that demonstrates:
- `SELECT title, description FROM "https://example.com"`
- `SET timeout = 10000`
- A simple extraction query

### Fix 7: Add E2E SELECT tests (Issue 7)

Add tests that run full `engine.execute("SELECT title FROM ...")` through the QueryEngine and verify actual data extraction. Test against a local HTML fixture or a known stable URL.

## Priority Order

1. **Fix 2** (BrowserEngine sharing) — unblocks everything else
2. **Fix 1** (metadata injection) — makes SELECT actually return data
3. **Fix 5** (type errors) — tests must pass clean
4. **Fix 4** (workspace) — one line, easy
5. **Fix 7** (E2E tests) — verify fixes work
6. **Fix 3** (CSS selectors in FROM) — nice to have
7. **Fix 6** (example) — polish

## Success Criteria

- `SELECT title FROM "https://example.com"` returns the page title
- `deno task query:test:unit` passes with type-checking (no `--no-check` needed)
- `deno task query:check` passes
- New E2E test proves full SELECT pipeline works
