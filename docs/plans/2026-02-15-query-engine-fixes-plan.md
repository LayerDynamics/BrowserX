# Query Engine Critical Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `SELECT title FROM "https://example.com"` return actual data by fixing the 7 issues blocking query execution.

**Architecture:** The query pipeline (Lexer → Parser → Analyzer → Optimizer → Planner → Executor → Formatter) is complete and passes 1,593 tests, but the last-mile integration — extracting data from the DOM via queries — is broken. Fix 2 (BrowserEngine sharing) unblocks everything; Fix 1 (metadata injection) makes field resolution work; the remaining fixes are cleanup and verification.

**Tech Stack:** TypeScript, Deno 2.x, BrowserX custom browser engine

**Design doc:** `docs/plans/2026-02-15-query-engine-fixes-design.md`

---

## Task 1: Share BrowserEngine across execution steps (Issue 2)

The executor creates `new BrowserEngine()` on-demand per step, so DOM from NAVIGATE is lost before DOM_QUERY runs. Fix: create a shared `BrowserController` at engine level.

**Files:**
- Modify: `query-engine/core/engine.ts:213-250` (class fields), `engine.ts:446` (execute method)
- Modify: `mcp-server/server/service-initializer.ts:311-320` (QueryEngine creation)

**Step 1: Write the failing test**

Create a test that proves BrowserEngine sharing works — navigate then DOM query in sequence.

File: `query-engine/tests/unit/engine.browser-sharing.test.ts`

```typescript
/**
 * Test: BrowserEngine is shared across execution steps
 * Verifies that NAVIGATE and DOM_QUERY use the same browser instance
 */

import { assertEquals, assertExists } from "@std/assert";
import { QueryEngine } from "../../core/engine.ts";

Deno.test({
  name: "QueryEngine shares BrowserController across NAVIGATE + DOM_QUERY steps",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // This query creates a NAVIGATE step then a DOM_QUERY step.
  // Before the fix, DOM_QUERY gets a fresh BrowserEngine with no DOM.
  // After the fix, both steps share the same BrowserController.
  const result = await engine.execute(
    'SELECT title FROM "https://example.com"',
    { timeout: 15000 },
  );

  assertExists(result, "Result should exist");
  assertExists(result.data, "Data should exist");
  // The query should NOT throw "Undefined identifier: title" or "No page available"
  // (It may still fail on field resolution until Fix 1, but should not crash on missing browser)

  await engine.shutdown();
});
```

**Step 2: Run test to verify it fails**

Run: `deno test --allow-all query-engine/tests/unit/engine.browser-sharing.test.ts`

Expected: FAIL with "No page available for DOM query" or "Undefined identifier: title" (because BrowserController is undefined)

**Step 3: Implement BrowserEngine sharing in engine.ts**

In `query-engine/core/engine.ts`, add a `BrowserController` instance field and use it in `execute()`:

At the top of the file, add the import (after line 11):

```typescript
import { BrowserController } from "../controllers/browser/browser-controller.ts";
import { BrowserEngine } from "../../browser/src/api/mod.ts";
```

In the `QueryEngine` class (after line 220, after `private proxyController?: ProxyController;`), add:

```typescript
private browserController?: BrowserController;
```

Replace line 446:
```typescript
// OLD: const executor = new QueryExecutor(undefined, this.proxyController);
// NEW:
if (!this.browserController) {
  const browserEngine = new BrowserEngine(this.config.browser);
  this.browserController = new BrowserController(browserEngine);
}
const executor = new QueryExecutor(this.browserController, this.proxyController);
```

In the `shutdown()` method, add cleanup for the browser controller:

```typescript
// Close browser controller if it was created
if (this.browserController) {
  await this.browserController.close?.();
  this.browserController = undefined;
}
```

**Step 4: Run test to verify it passes**

Run: `deno test --allow-all query-engine/tests/unit/engine.browser-sharing.test.ts`

Expected: PASS (or fail on "Undefined identifier: title" which is Fix 1's problem, not this fix's)

**Step 5: Commit**

```bash
git add query-engine/core/engine.ts query-engine/tests/unit/engine.browser-sharing.test.ts
git commit -m "fix: share BrowserController across execution steps in QueryEngine

Previously QueryEngine.execute() passed undefined as the browserController
to QueryExecutor, causing each step to create a fresh BrowserEngine. This
meant DOM state from NAVIGATE was lost before DOM_QUERY ran.

Now a single BrowserController is created at engine level and reused across
all execution steps within a query."
```

---

## Task 2: Inject page metadata into eval context (Issue 1)

`SELECT title FROM "url"` fails with "Undefined identifier: title" because the eval context only has `{text, element, ...attributes}` — no semantic fields like `title`, `description`, `url`.

**Files:**
- Modify: `browser/src/api/BrowserPage.ts:155-162` (add `getMetadata()` method)
- Modify: `query-engine/controllers/browser/browser-controller.ts:47-58` (add `getMetadata()` to interface)
- Modify: `query-engine/controllers/browser/browser-controller.ts:199-249` (inject metadata in `executeDOMQuery()`)

**Step 1: Write the failing test**

File: `query-engine/tests/unit/browser-controller.metadata.test.ts`

```typescript
/**
 * Test: Page metadata is available in DOM query eval context
 */

import { assertEquals, assertExists } from "@std/assert";

Deno.test({
  name: "BrowserController.executeDOMQuery includes page metadata in eval context",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  // This is tested indirectly via the engine — a full query that resolves 'title'
  const { QueryEngine } = await import("../../core/engine.ts");
  const engine = new QueryEngine();
  await engine.initialize({});

  const result = await engine.execute(
    'SELECT title FROM "https://example.com"',
    { timeout: 15000 },
  );

  assertExists(result.data, "Should return data");

  // Parse the formatted result (JSON string) to check actual content
  const parsed = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
  assertExists(parsed, "Parsed data should exist");

  // example.com has <title>Example Domain</title>
  const rows = Array.isArray(parsed) ? parsed : parsed.rows || parsed.data || [parsed];
  assertEquals(rows.length > 0, true, "Should have at least one row");
  assertEquals(
    rows[0].title,
    "Example Domain",
    "Should extract title from <title> tag",
  );

  await engine.shutdown();
});
```

**Step 2: Run test to verify it fails**

Run: `deno test --allow-all query-engine/tests/unit/browser-controller.metadata.test.ts`

Expected: FAIL with "Undefined identifier: title"

**Step 3a: Add `getMetadata()` to BrowserPage**

In `browser/src/api/BrowserPage.ts`, add this method to the `BrowserPage` class (after the `navigate()` method, around line 223):

```typescript
/**
 * Get page metadata (title, description, url, etc.)
 * Extracts semantic fields from the DOM that can be referenced by name in queries.
 */
async getMetadata(): Promise<Record<string, unknown>> {
    const renderingPipeline = this.browser.getRenderingPipeline();
    const dom = renderingPipeline.lastRenderResult?.dom;

    const metadata: Record<string, unknown> = {
        url: this.currentURL,
    };

    if (!dom) return metadata;

    // Extract <title> text
    const titleEl = this.findElement(dom, "title");
    if (titleEl) {
        metadata.title = this.getTextContent(titleEl);
    }

    // Extract <meta> tags
    const metaTags = this.findAllElements(dom, "meta");
    for (const meta of metaTags) {
        const name = meta.getAttribute("name") || meta.getAttribute("property");
        const content = meta.getAttribute("content");
        if (name && content) {
            // Support both name="description" and property="og:title"
            const key = name.replace(/^og:/, "").replace(/^twitter:/, "");
            if (!metadata[key]) {
                metadata[key] = content;
            }
        }
    }

    // Extract canonical URL
    const linkTags = this.findAllElements(dom, "link");
    for (const link of linkTags) {
        if (link.getAttribute("rel") === "canonical") {
            metadata.canonical = link.getAttribute("href");
        }
    }

    return metadata;
}

/**
 * Find first element by tag name in DOM tree
 */
private findElement(node: DOMNode, tagName: string): BrowserDOMElement | null {
    if (node.nodeType === 1 && (node as BrowserDOMElement).nodeName?.toLowerCase() === tagName) {
        return node as BrowserDOMElement;
    }
    if (node.childNodes) {
        for (const child of node.childNodes) {
            const found = this.findElement(child, tagName);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Find all elements by tag name in DOM tree
 */
private findAllElements(node: DOMNode, tagName: string): BrowserDOMElement[] {
    const results: BrowserDOMElement[] = [];
    if (node.nodeType === 1 && (node as BrowserDOMElement).nodeName?.toLowerCase() === tagName) {
        results.push(node as BrowserDOMElement);
    }
    if (node.childNodes) {
        for (const child of node.childNodes) {
            results.push(...this.findAllElements(child, tagName));
        }
    }
    return results;
}

/**
 * Get text content from element and its children
 */
private getTextContent(node: DOMNode): string {
    let text = "";
    if (node.nodeType === 3) { // TEXT_NODE
        text += (node as any).nodeValue || "";
    }
    if (node.childNodes) {
        for (const child of node.childNodes) {
            text += this.getTextContent(child);
        }
    }
    return text;
}
```

**Step 3b: Add `getMetadata()` to BrowserPage interface in browser-controller.ts**

In `query-engine/controllers/browser/browser-controller.ts`, add to the `BrowserPage` interface (after line 57, after `getCurrentURL(): string | undefined;`):

```typescript
getMetadata?(): Promise<Record<string, unknown>>;
```

**Step 3c: Inject metadata into eval context in executeDOMQuery()**

In `query-engine/controllers/browser/browser-controller.ts`, modify `executeDOMQuery()` (lines 199-249). Add metadata retrieval before the element loop and merge it into the eval context:

Replace lines 219-236 (the elementData and evalContext creation inside the for loop):

```typescript
    // Get page metadata once before the loop
    const metadata = await this.currentPage.getMetadata?.() ?? {};

    for (const element of elements) {
      this.checkAbort(options);

      const extracted: Record<string, unknown> = {};

      // Create evaluation context with element data
      const elementData: Record<string, unknown> = {
        text: await element.getText(),
        element: element.getInternalElement(),
      };

      // Get all attributes
      const internalElement = element.getInternalElement();
      if (internalElement.attributes) {
        for (const [attrName, attrValue] of internalElement.attributes.entries()) {
          elementData[attrName] = attrValue;
        }
      }

      // Merge page metadata (lower priority) with element data (higher priority)
      const evalContext: EvaluationContext = {
        variables: new Map([
          ...Object.entries(metadata),      // page-level: title, description, url
          ...Object.entries(elementData),   // element-level: text, attributes (overrides)
        ]),
        functions: new Map(),
      };
```

**Step 4: Run test to verify it passes**

Run: `deno test --allow-all query-engine/tests/unit/browser-controller.metadata.test.ts`

Expected: PASS — "Example Domain" extracted from `<title>` tag

**Step 5: Run the original failing command to double-check**

Run: `deno run --allow-all /tmp/test_query.ts`

Expected: `SUCCESS: [{"title": "Example Domain"}]` (or similar)

**Step 6: Commit**

```bash
git add browser/src/api/BrowserPage.ts query-engine/controllers/browser/browser-controller.ts query-engine/tests/unit/browser-controller.metadata.test.ts
git commit -m "feat: inject page metadata into query eval context

Add BrowserPage.getMetadata() that extracts title, description, url,
keywords, author, and og: tags from the DOM. Inject this metadata into
the ExpressionEvaluator context in BrowserController.executeDOMQuery()
so that SELECT title FROM 'url' resolves 'title' to the <title> tag text.

This is the critical fix that makes field resolution work for semantic
page-level identifiers like title, description, url, etc."
```

---

## Task 3: Fix 19 type errors in test suite (Issue 5)

Tests were written against older type definitions. 5-6 test files need updates.

**Files:**
- Modify: `query-engine/tests/unit/functions.test.ts:963,978` — `"buffer"` → `DataType.BUFFER`
- Modify: `query-engine/tests/unit/controllers.browser.browser-controller.test.ts:82-101` — add `getCurrentURL`
- Modify: `query-engine/tests/unit/types.execution.test.ts:53-72` — fix switch exhaustiveness
- Modify: `query-engine/tests/unit/types.primitives.test.ts:408-424` — fix switch exhaustiveness
- Modify: `query-engine/tests/unit/executor.executor.test.ts` — fix Error types

**Step 1: Fix functions.test.ts — DataType.BUFFER**

In `query-engine/tests/unit/functions.test.ts`:

Add import at top of file (with existing imports):

```typescript
import { DataType } from "../../schema/types.ts";
```

Replace line 963:
```typescript
// OLD: assertEquals(SCREENSHOT.signature.returnType, "buffer");
// NEW:
assertEquals(SCREENSHOT.signature.returnType, DataType.BUFFER);
```

Replace line 978:
```typescript
// OLD: assertEquals(PDF.signature.returnType, "buffer");
// NEW:
assertEquals(PDF.signature.returnType, DataType.BUFFER);
```

**Step 2: Fix browser-controller.test.ts — add getCurrentURL**

In `query-engine/tests/unit/controllers.browser.browser-controller.test.ts`, in the `createMockBrowserPage` function (around line 82-101), add `getCurrentURL` to the returned mock object:

```typescript
// Add after: close: async () => {},
getCurrentURL: () => undefined,
```

**Step 3: Fix types.execution.test.ts — switch exhaustiveness**

In `query-engine/tests/unit/types.execution.test.ts` (lines 53-72), the switch test needs to handle all `QueryExecutionState` values or remove the exhaustiveness expectation. Replace the switch test body with:

```typescript
Deno.test("QueryExecutionState - can be used in switch statements", () => {
  const state = QueryExecutionState.EXECUTING;
  let result = "";

  switch (state) {
    case QueryExecutionState.PENDING:
      result = "waiting";
      break;
    case QueryExecutionState.EXECUTING:
      result = "running";
      break;
    case QueryExecutionState.COMPLETED:
      result = "done";
      break;
    case QueryExecutionState.FAILED:
    case QueryExecutionState.CANCELLED:
    case QueryExecutionState.TIMEOUT:
    case QueryExecutionState.PAUSED:
    case QueryExecutionState.QUEUED:
    case QueryExecutionState.RETRYING:
    case QueryExecutionState.PARTIAL:
    case QueryExecutionState.STREAMING:
    case QueryExecutionState.FINALIZING:
      result = "other";
      break;
  }

  assertEquals(result, "running");
});
```

Note: Read the actual enum values from the source first — the above list is based on the test saying there are 12 states. Verify by checking the enum definition.

**Step 4: Fix types.primitives.test.ts — switch exhaustiveness**

In `query-engine/tests/unit/types.primitives.test.ts` (lines 408-424), add all missing DataType cases. The enum has 21 values. Add all remaining cases to the default group:

```typescript
Deno.test("DataType can be used in switch statements", () => {
  const dt = DataType.STRING;
  let result = "";

  switch (dt) {
    case DataType.STRING:
      result = "string";
      break;
    case DataType.NUMBER:
      result = "number";
      break;
    case DataType.BOOLEAN:
    case DataType.NULL:
    case DataType.URL:
    case DataType.ARRAY:
    case DataType.OBJECT:
    case DataType.SET:
    case DataType.ELEMENT:
    case DataType.NODE_LIST:
    case DataType.DOCUMENT:
    case DataType.REQUEST:
    case DataType.RESPONSE:
    case DataType.HEADERS:
    case DataType.COOKIE:
    case DataType.SELECTOR:
    case DataType.XPATH:
    case DataType.REGEX:
    case DataType.DURATION:
    case DataType.BYTES:
    case DataType.UNKNOWN:
      result = "other";
      break;
  }

  assertEquals(result, "string");
});
```

**Step 5: Fix executor.executor.test.ts — Error types**

In `query-engine/tests/unit/executor.executor.test.ts`, check what `ExtendedError` type the executor expects. If `ExecutionResult.error` is typed as `Error`, the tests may need to construct errors that match the executor's internal error handling. Read the file and fix the specific type mismatches (likely `new Error(...)` needs to be wrapped or the type annotation on the test mock needs updating).

**Step 6: Run all unit tests with type checking**

Run: `deno test --allow-all --check query-engine/tests/unit/`

Expected: All 19 type errors resolved, tests pass with `--check` (no `--no-check` needed)

**Step 7: Commit**

```bash
git add query-engine/tests/unit/functions.test.ts query-engine/tests/unit/controllers.browser.browser-controller.test.ts query-engine/tests/unit/types.execution.test.ts query-engine/tests/unit/types.primitives.test.ts query-engine/tests/unit/executor.executor.test.ts
git commit -m "fix: resolve 19 type errors in query engine test suite

- functions.test.ts: use DataType.BUFFER enum instead of string literal
- browser-controller.test.ts: add getCurrentURL() to mock BrowserPage
- types.execution.test.ts: handle all QueryExecutionState enum values
- types.primitives.test.ts: handle all DataType enum values
- executor.executor.test.ts: fix Error type compatibility"
```

---

## Task 4: Add `@webgpu_x` to workspace (Issue 4)

The `crates/webgpu_x` directory exists but isn't in the root `deno.json` workspace array.

**Files:**
- Modify: `deno.json:2-9` (workspace array)

**Step 1: Verify crate exists**

Run: `ls /Users/ryanoboyle/BrowserX/crates/webgpu_x/deno.json`

Expected: File exists

**Step 2: Add to workspace**

In `deno.json`, add `"./crates/webgpu_x"` to the workspace array:

```json
{
  "workspace": [
    "./browser",
    "./dev-tools",
    "./proxy-engine",
    "./query-engine",
    "./mcp-server",
    "./runtime",
    "./crates/webgpu_x"
  ],
```

**Step 3: Verify imports work**

Run: `deno check browser/src/engine/webgpu/utils/`

Expected: No import errors for `@webgpu_x`

**Step 4: Commit**

```bash
git add deno.json
git commit -m "fix: add @webgpu_x crate to workspace

The crates/webgpu_x directory exists but wasn't listed in the root
deno.json workspace array, causing import failures from outside the
workspace."
```

---

## Task 5: Add E2E SELECT tests (Issue 7)

The existing E2E tests explicitly avoid SELECT. Add tests that verify the full pipeline.

**Files:**
- Modify: `query-engine/tests/e2e/query-engine-e2e.test.ts` (add new test cases)

**Step 1: Write E2E SELECT tests**

Add the following test cases to `query-engine/tests/e2e/query-engine-e2e.test.ts`:

```typescript
Deno.test({
  name: "E2E: SELECT title FROM URL extracts page title",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const result = await engine.execute(
    'SELECT title FROM "https://example.com"',
    { timeout: 15000 },
  );

  assertExists(result);
  assertExists(result.data);

  // Parse JSON result
  const parsed = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
  const rows = Array.isArray(parsed) ? parsed : parsed.rows || parsed.data || [parsed];

  assertEquals(rows.length > 0, true, "Should return at least one row");
  assertEquals(rows[0].title, "Example Domain", "Should extract page title");

  await engine.shutdown();
});

Deno.test({
  name: "E2E: SELECT title, description FROM URL extracts multiple fields",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const result = await engine.execute(
    'SELECT title, url FROM "https://example.com"',
    { timeout: 15000 },
  );

  assertExists(result);
  assertExists(result.data);

  const parsed = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
  const rows = Array.isArray(parsed) ? parsed : parsed.rows || parsed.data || [parsed];

  assertEquals(rows.length > 0, true, "Should return at least one row");
  assertExists(rows[0].title, "Should have title field");
  assertExists(rows[0].url, "Should have url field");

  await engine.shutdown();
});
```

**Step 2: Run E2E tests**

Run: `deno test --allow-all query-engine/tests/e2e/query-engine-e2e.test.ts`

Expected: New SELECT tests PASS (requires Tasks 1 and 2 to be complete first)

**Step 3: Commit**

```bash
git add query-engine/tests/e2e/query-engine-e2e.test.ts
git commit -m "test: add E2E tests for SELECT query field extraction

Verify full pipeline: SELECT title FROM URL navigates, extracts DOM
metadata, and returns actual page data. Previously E2E tests explicitly
avoided SELECT due to missing field resolution."
```

---

## Task 6: CSS selector support in FROM clause (Issue 3)

`SELECT name, price FROM ".product-card"` should use `.product-card` as the DOM query selector, not treat it as a URL.

**Files:**
- Modify: `query-engine/planner/planner.ts:257-279` (`generateSelectSteps()`)

**Step 1: Write the failing test**

File: `query-engine/tests/unit/planner.css-selector.test.ts`

```typescript
/**
 * Test: FROM clause accepts CSS selectors
 */

import { assertEquals, assertExists } from "@std/assert";
import { ExecutionPlanner } from "../../planner/mod.ts";
import { ExecutionStepType } from "../../planner/mod.ts";

Deno.test("Planner: FROM with CSS selector creates DOM_QUERY without NAVIGATE", () => {
  const planner = new ExecutionPlanner();

  // Create a minimal SELECT AST with a CSS selector source
  const ast = {
    type: "SELECT" as const,
    fields: [
      { name: "name", expression: { type: "IDENTIFIER" as const, name: "name" } },
    ],
    source: { type: "URL" as const, value: ".product-card" },
  };

  const plan = planner.plan(ast, {});

  // Should NOT have a NAVIGATE step (it's a selector, not a URL)
  const navSteps = plan.steps.filter((s: any) => s.type === ExecutionStepType.NAVIGATE);
  assertEquals(navSteps.length, 0, "Should not navigate for CSS selector source");

  // Should have a DOM_QUERY step with the CSS selector
  const domSteps = plan.steps.filter((s: any) => s.type === ExecutionStepType.DOM_QUERY);
  assertEquals(domSteps.length, 1, "Should have one DOM_QUERY step");
  assertEquals((domSteps[0] as any).selector, ".product-card", "Should use CSS selector from FROM clause");
});
```

**Step 2: Run test to verify it fails**

Run: `deno test --allow-all query-engine/tests/unit/planner.css-selector.test.ts`

Expected: FAIL — planner creates NAVIGATE step for `.product-card` (treats it as URL)

**Step 3: Implement CSS selector detection in planner**

In `query-engine/planner/planner.ts`, modify `generateSelectSteps()` (around line 257-279).

Add a helper function to detect CSS selectors:

```typescript
/**
 * Check if a string looks like a CSS selector rather than a URL
 */
private isCSSSelector(value: string): boolean {
  // CSS selectors start with ., #, [, or are bare tag names without ://
  if (value.includes("://")) return false;
  if (value.startsWith(".") || value.startsWith("#") || value.startsWith("[")) return true;
  // Common HTML tag names (used as selectors)
  const tagNames = ["div", "span", "p", "a", "ul", "ol", "li", "table", "tr", "td", "th",
    "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "nav", "header", "footer",
    "main", "form", "input", "button", "select", "textarea", "img", "body"];
  const firstToken = value.split(/[\s>+~]/, 1)[0].toLowerCase();
  return tagNames.includes(firstToken);
}
```

Then modify `generateSelectSteps()` to check for CSS selectors:

```typescript
private generateSelectSteps(stmt: SelectStatement, dependencies: string[]): string {
    const steps: string[] = [...dependencies];

    // If source is a URL, check if it's actually a CSS selector
    if (stmt.source.type === "URL") {
      const sourceValue = stmt.source.value as string;
      if (this.isCSSSelector(sourceValue)) {
        // CSS selector source — skip NAVIGATE, use selector directly in DOM_QUERY
        const domQueryStep: DOMQueryStep = {
          id: this.generateStepId(),
          type: ExecutionStepType.DOM_QUERY,
          selector: sourceValue,
          selectorType: "css",
          extractFields: stmt.fields.map((f) => ({
            name: f.alias || f.name,
            expression: f.expression || {
              type: "IDENTIFIER",
              name: f.name,
            },
          })),
          filter: stmt.where,
          estimatedCost: 10,
          dependencies: [...steps],
          cacheable: false,
        };
        this.currentSteps.push(domQueryStep);
        steps.push(domQueryStep.id);
      } else {
        // URL source — navigate first
        const navStep: NavigateStep = {
          // ... existing NAVIGATE code (lines 262-272)
```

**Step 4: Run test to verify it passes**

Run: `deno test --allow-all query-engine/tests/unit/planner.css-selector.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add query-engine/planner/planner.ts query-engine/tests/unit/planner.css-selector.test.ts
git commit -m "feat: support CSS selectors in FROM clause

SELECT name, price FROM '.product-card' now uses .product-card as the
DOM query selector instead of treating it as a URL. Detection: strings
starting with ., #, [ or matching HTML tag names without :// are treated
as CSS selectors."
```

---

## Task 7: Create example file (Issue 6)

`deno task query:example` runs `example.ts` which doesn't exist.

**Files:**
- Create: `query-engine/example.ts`

**Step 1: Create example file**

File: `query-engine/example.ts`

```typescript
/**
 * BrowserX Query Engine — Example Usage
 *
 * Run: deno task query:example
 */

import { QueryEngine } from "./core/engine.ts";

async function main() {
  const engine = new QueryEngine();
  await engine.initialize({});

  console.log("=== BrowserX Query Engine Examples ===\n");

  // Example 1: Extract page title
  console.log("1. SELECT title FROM URL:");
  try {
    const result = await engine.execute(
      'SELECT title FROM "https://example.com"',
      { timeout: 15000 },
    );
    console.log("   Result:", result.data);
    console.log("   Time:", Math.round(result.timing.totalTime), "ms\n");
  } catch (e) {
    console.error("   Error:", (e as Error).message, "\n");
  }

  // Example 2: SET configuration
  console.log("2. SET timeout:");
  try {
    const result = await engine.execute("SET timeout = 10000");
    console.log("   Result:", result.data);
    console.log("   Time:", Math.round(result.timing.totalTime), "ms\n");
  } catch (e) {
    console.error("   Error:", (e as Error).message, "\n");
  }

  // Example 3: NAVIGATE with capture
  console.log("3. NAVIGATE TO URL:");
  try {
    const result = await engine.execute(
      'NAVIGATE TO "https://example.com"',
      { timeout: 15000 },
    );
    console.log("   Result:", result.data);
    console.log("   Time:", Math.round(result.timing.totalTime), "ms\n");
  } catch (e) {
    console.error("   Error:", (e as Error).message, "\n");
  }

  await engine.shutdown();
  console.log("=== Done ===");
}

main();
```

**Step 2: Verify it runs**

Run: `deno task query:example`

Expected: Output showing query results (requires Tasks 1-2 to be complete for SELECT to work)

**Step 3: Commit**

```bash
git add query-engine/example.ts
git commit -m "feat: add query engine example file

Creates query-engine/example.ts for deno task query:example.
Demonstrates SELECT, SET, and NAVIGATE queries."
```

---

## Verification Checklist

After all tasks are complete, run these commands to verify everything works:

1. **Full unit tests with type checking:**
   ```bash
   deno test --allow-all --check query-engine/tests/unit/
   ```
   Expected: All tests pass, no type errors

2. **Type check the query engine:**
   ```bash
   deno task query:check
   ```
   Expected: Clean pass

3. **E2E tests:**
   ```bash
   deno test --allow-all query-engine/tests/e2e/query-engine-e2e.test.ts
   ```
   Expected: All tests pass, including new SELECT tests

4. **The original failing query:**
   ```bash
   deno run --allow-all /tmp/test_query.ts
   ```
   Expected: `SUCCESS: [{"title": "Example Domain"}]`

5. **Example file:**
   ```bash
   deno task query:example
   ```
   Expected: Runs without errors, shows query results
