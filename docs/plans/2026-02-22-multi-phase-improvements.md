# BrowserX Multi-Phase Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden security (SSRF, path traversal, CSP, rate limiting, crypto IDs), refactor architecture (RenderingPipeline split, workspace imports, LRU fix), optimize performance (inline caching, CSS measurement cache), and improve quality (indent, logging, type safety).

**Architecture:** Four independent phases ship sequentially. Phase 1 security changes are isolated to individual files. Phase 2 RenderingPipeline decomposition preserves backward compat via facade. Phase 3 performance adds caching layers without changing APIs. Phase 4 quality is formatting + logging + types.

**Tech Stack:** TypeScript/Deno, CSP Level 3 spec, sliding window rate limiter, inline cache pattern

---

## Phase 1: Security Hardening

### Task 1: SSRF Validation for WindowObject.fetch()

**Files:**
- Create: `browser/src/engine/security/URLValidator.ts`
- Create: `browser/tests/engine/security/URLValidator.test.ts`
- Modify: `browser/src/engine/javascript/WindowObject.ts:1059-1122`

**Step 1: Write the failing test**

```typescript
// browser/tests/engine/security/URLValidator.test.ts
import { assertEquals, assertThrows } from "@std/assert";
import { URLValidator, SSRFError } from "../../src/engine/security/URLValidator.ts";

Deno.test("URLValidator - blocks private IPv4 10.x.x.x", () => {
  assertThrows(() => URLValidator.validate("http://10.0.0.1/api"), SSRFError);
});

Deno.test("URLValidator - blocks private IPv4 172.16-31.x.x", () => {
  assertThrows(() => URLValidator.validate("http://172.16.0.1/api"), SSRFError);
  assertThrows(() => URLValidator.validate("http://172.31.255.255/api"), SSRFError);
});

Deno.test("URLValidator - allows 172.15.x.x (not private)", () => {
  URLValidator.validate("http://172.15.0.1/api"); // should not throw
});

Deno.test("URLValidator - blocks private IPv4 192.168.x.x", () => {
  assertThrows(() => URLValidator.validate("http://192.168.1.1/api"), SSRFError);
});

Deno.test("URLValidator - blocks localhost IPv4", () => {
  assertThrows(() => URLValidator.validate("http://127.0.0.1/api"), SSRFError);
  assertThrows(() => URLValidator.validate("http://127.0.0.2/api"), SSRFError);
});

Deno.test("URLValidator - blocks localhost IPv6", () => {
  assertThrows(() => URLValidator.validate("http://[::1]/api"), SSRFError);
});

Deno.test("URLValidator - blocks link-local 169.254.x.x", () => {
  assertThrows(() => URLValidator.validate("http://169.254.169.254/latest/meta-data"), SSRFError);
});

Deno.test("URLValidator - blocks file:// protocol", () => {
  assertThrows(() => URLValidator.validate("file:///etc/passwd"), SSRFError);
});

Deno.test("URLValidator - blocks ftp:// protocol", () => {
  assertThrows(() => URLValidator.validate("ftp://evil.com/file"), SSRFError);
});

Deno.test("URLValidator - allows data: URIs for images", () => {
  URLValidator.validate("data:image/png;base64,iVBOR"); // should not throw
});

Deno.test("URLValidator - blocks non-image data: URIs", () => {
  assertThrows(() => URLValidator.validate("data:text/html,<script>alert(1)</script>"), SSRFError);
});

Deno.test("URLValidator - allows public HTTP URLs", () => {
  URLValidator.validate("https://example.com/api");
  URLValidator.validate("http://api.github.com/repos");
});

Deno.test("URLValidator - allows URLs in allowlist", () => {
  const validator = new URLValidator({ allowlist: ["127.0.0.1"] });
  validator.validateUrl("http://127.0.0.1/api"); // should not throw
});

Deno.test("URLValidator - blocks 0.0.0.0", () => {
  assertThrows(() => URLValidator.validate("http://0.0.0.0/api"), SSRFError);
});

Deno.test("URLValidator - handles invalid URLs gracefully", () => {
  assertThrows(() => URLValidator.validate("not-a-url"), SSRFError);
});
```

**Step 2: Run test to verify it fails**

Run: `deno test --allow-all browser/tests/engine/security/URLValidator.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// browser/src/engine/security/URLValidator.ts

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SSRFError";
  }
}

interface URLValidatorOptions {
  allowlist?: string[];
}

const PRIVATE_RANGES = [
  { start: [10, 0, 0, 0], end: [10, 255, 255, 255] },
  { start: [172, 16, 0, 0], end: [172, 31, 255, 255] },
  { start: [192, 168, 0, 0], end: [192, 168, 255, 255] },
  { start: [127, 0, 0, 0], end: [127, 255, 255, 255] },
  { start: [169, 254, 0, 0], end: [169, 254, 255, 255] },
  { start: [0, 0, 0, 0], end: [0, 0, 0, 0] },
];

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function parseIPv4(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return nums;
}

function isPrivateIP(hostname: string): boolean {
  // IPv6 loopback
  if (hostname === "::1" || hostname === "[::1]") return true;

  const ip = parseIPv4(hostname);
  if (!ip) return false;

  return PRIVATE_RANGES.some(
    (range) =>
      ip.every((octet, i) => octet >= range.start[i]) &&
      ip.every((octet, i) => octet <= range.end[i]),
  );
}

export class URLValidator {
  private allowlist: Set<string>;

  constructor(options: URLValidatorOptions = {}) {
    this.allowlist = new Set(options.allowlist ?? []);
  }

  validateUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new SSRFError(`Invalid URL: ${url}`);
    }

    // Allow data: URIs for images only
    if (parsed.protocol === "data:") {
      if (url.startsWith("data:image/")) return;
      throw new SSRFError(`Blocked non-image data: URI`);
    }

    // Protocol check
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      throw new SSRFError(`Blocked protocol: ${parsed.protocol}`);
    }

    // Allowlist bypass
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
    if (this.allowlist.has(hostname)) return;

    // Private IP check
    if (isPrivateIP(hostname)) {
      throw new SSRFError(`Blocked private/reserved IP: ${hostname}`);
    }
  }

  /** Static convenience for default options */
  static validate(url: string): void {
    new URLValidator().validateUrl(url);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `deno test --allow-all browser/tests/engine/security/URLValidator.test.ts`
Expected: All 15 tests PASS

**Step 5: Integrate into WindowObject.ts**

Add import at top of `WindowObject.ts`:
```typescript
import { URLValidator, SSRFError } from "../security/URLValidator.ts";
```

Add validation after line 1073 (after `fetchUrl` is extracted), before line 1105:
```typescript
            // SSRF validation — block private IPs and dangerous protocols
            try {
                URLValidator.validate(fetchUrl);
            } catch (e) {
                if (e instanceof SSRFError) {
                    console.warn(`[JS] fetch blocked by SSRF validator: ${fetchUrl}`);
                    return createObject(); // Return empty response
                }
                throw e;
            }
```

**Step 6: Commit**

```bash
git add browser/src/engine/security/URLValidator.ts browser/tests/engine/security/URLValidator.test.ts browser/src/engine/javascript/WindowObject.ts
git commit -m "feat(security): add SSRF validation to WindowObject.fetch()"
```

---

### Task 2: SessionId Sanitization in ActivityTracker

**Files:**
- Modify: `mcp-server/activity/ActivityTracker.ts:61-63,108-112,230`
- Create: `mcp-server/tests/activity-tracker-security.test.ts`

**Step 1: Write the failing test**

```typescript
// mcp-server/tests/activity-tracker-security.test.ts
import { assertEquals, assertRejects } from "@std/assert";
import { ActivityTracker } from "../activity/ActivityTracker.ts";

Deno.test("ActivityTracker - generateId uses crypto.randomUUID", async () => {
  const tracker = new ActivityTracker("/tmp/browserx-test-" + crypto.randomUUID());
  tracker.setEnabled(true);
  const id = (tracker as any).generateId();
  // Should be timestamp_uuid format, not Math.random
  const parts = id.split("_");
  assertEquals(parts.length, 2);
  assertEquals(parts[1].length, 8);
  // UUID chars are hex, not base36
  assertEquals(/^[0-9a-f]{8}$/.test(parts[1]), true);
});

Deno.test("ActivityTracker - rejects path traversal in sessionId", async () => {
  const tracker = new ActivityTracker("/tmp/browserx-test-" + crypto.randomUUID());
  tracker.setEnabled(true);
  await assertRejects(
    () => tracker.trackNavigation("../../../etc/passwd", "http://example.com", { total: 100 }),
    Error,
    "Invalid sessionId",
  );
});

Deno.test("ActivityTracker - rejects absolute path in sessionId", async () => {
  const tracker = new ActivityTracker("/tmp/browserx-test-" + crypto.randomUUID());
  tracker.setEnabled(true);
  await assertRejects(
    () => tracker.trackNavigation("/etc/passwd", "http://example.com", { total: 100 }),
    Error,
    "Invalid sessionId",
  );
});

Deno.test("ActivityTracker - rejects null bytes in sessionId", async () => {
  const tracker = new ActivityTracker("/tmp/browserx-test-" + crypto.randomUUID());
  tracker.setEnabled(true);
  await assertRejects(
    () => tracker.trackNavigation("session\x00evil", "http://example.com", { total: 100 }),
    Error,
    "Invalid sessionId",
  );
});

Deno.test("ActivityTracker - accepts valid sessionId", async () => {
  const dir = "/tmp/browserx-test-" + crypto.randomUUID();
  const tracker = new ActivityTracker(dir);
  tracker.setEnabled(true);
  await tracker.trackNavigation("valid-session_123", "http://example.com", { total: 100 });
  // Should not throw
});
```

**Step 2: Run test to verify it fails**

Run: `deno test --allow-all mcp-server/tests/activity-tracker-security.test.ts`
Expected: FAIL — no sanitization exists

**Step 3: Implement sanitization**

In `ActivityTracker.ts`, add sanitization method and update `generateId()`:

```typescript
  private generateId(): string {
    return `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  }

  private sanitizeSessionId(sessionId: string): string {
    if (!sessionId || /[^a-zA-Z0-9_-]/.test(sessionId) || sessionId.startsWith("/") || sessionId.includes("..")) {
      throw new Error(`Invalid sessionId: contains unsafe characters: ${sessionId}`);
    }
    return sessionId;
  }
```

Add `this.sanitizeSessionId(sessionId)` call at the start of:
- `trackNavigation()` (line ~75)
- `saveScreenshot()` (line ~99)
- `trackClick()` (wherever it uses sessionId in paths)
- `saveSessionMetadata()` (line ~230)

**Step 4: Run test to verify it passes**

Run: `deno test --allow-all mcp-server/tests/activity-tracker-security.test.ts`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add mcp-server/activity/ActivityTracker.ts mcp-server/tests/activity-tracker-security.test.ts
git commit -m "feat(security): sanitize sessionId and use crypto.randomUUID in ActivityTracker"
```

---

### Task 3: Same-Origin Runtime Checks in StorageManager

**Files:**
- Modify: `browser/src/engine/storage/StorageManager.ts:48-76`
- Create: `browser/tests/engine/storage/StorageManager-origin.test.ts`

**Step 1: Write the failing test**

```typescript
// browser/tests/engine/storage/StorageManager-origin.test.ts
import { assertThrows } from "@std/assert";
import { StorageManager } from "../../src/engine/storage/StorageManager.ts";

Deno.test("StorageManager - setItem rejects cross-origin URL", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");
  assertThrows(
    () => storage.setItem("key", "value", "https://evil.com/page"),
    Error,
    "Origin mismatch",
  );
});

Deno.test("StorageManager - setItem allows same-origin URL", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");
  storage.setItem("key", "value", "https://example.com/page"); // should not throw
});

Deno.test("StorageManager - removeItem rejects cross-origin URL", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");
  storage.setItem("key", "value", "https://example.com/page");
  assertThrows(
    () => storage.removeItem("key", "https://evil.com/page"),
    Error,
    "Origin mismatch",
  );
});

Deno.test("StorageManager - handles port differences in origin", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com:443");
  assertThrows(
    () => storage.setItem("key", "value", "https://example.com:8080/page"),
    Error,
    "Origin mismatch",
  );
});
```

**Step 2: Run test to verify it fails**

Run: `deno test --allow-all browser/tests/engine/storage/StorageManager-origin.test.ts`
Expected: FAIL — no origin validation in setItem

**Step 3: Add origin validation**

In `OriginStorage` class, add a private helper and calls in `setItem()` and `removeItem()`:

```typescript
    private validateOrigin(url: string): void {
        try {
            const urlOrigin = new URL(url).origin;
            if (urlOrigin !== this.origin) {
                throw new DOMException(
                    `SecurityError: Origin mismatch - storage origin '${this.origin}' does not match URL origin '${urlOrigin}'`,
                    "SecurityError",
                );
            }
        } catch (e) {
            if (e instanceof DOMException) throw e;
            throw new DOMException(`SecurityError: Origin mismatch - invalid URL '${url}'`, "SecurityError");
        }
    }
```

Add `this.validateOrigin(url);` as the first line of `setItem()` and `removeItem()`.

**Step 4: Run test to verify it passes**

Run: `deno test --allow-all browser/tests/engine/storage/StorageManager-origin.test.ts`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add browser/src/engine/storage/StorageManager.ts browser/tests/engine/storage/StorageManager-origin.test.ts
git commit -m "feat(security): add same-origin runtime checks to StorageManager"
```

---

### Task 4: crypto.randomUUID() Migration (9 files)

**Files:**
- Modify: 9 files listed in design doc

**Step 1: Find and replace all Math.random ID patterns**

In each file, replace `Math.random().toString(36).slice(2, N)` with `crypto.randomUUID().slice(0, N)` or just `crypto.randomUUID()`.

Files and exact replacements:
1. `mcp-server/activity/ActivityTracker.ts:62` — already done in Task 2
2. `runtime/src/resources/BrowserPool.ts:473` — `Math.random().toString(36).slice(2)` → `crypto.randomUUID()`
3. `browser/src/engine/javascript/V8Isolate.ts:303` — same pattern
4. `browser/src/engine/javascript/JSValue.ts:130` — same pattern
5. `query-engine/core/engine.ts:781` — same pattern
6. `query-engine/planner/planner.ts:1091` — same pattern
7. `proxy-engine/core/thread/worker.ts:56` — same pattern
8. `doc-site/src/pages/api/execute.ts:106,263` — same pattern (2 locations)
9. `doc-site/src/components/playground/store.ts:320,492` — same pattern (2 locations)

**Step 2: Run existing tests to verify nothing breaks**

Run: `deno task test`
Expected: All existing tests pass (IDs are still strings, just more secure)

**Step 3: Commit**

```bash
git add runtime/src/resources/BrowserPool.ts browser/src/engine/javascript/V8Isolate.ts browser/src/engine/javascript/JSValue.ts query-engine/core/engine.ts query-engine/planner/planner.ts proxy-engine/core/thread/worker.ts doc-site/src/pages/api/execute.ts doc-site/src/components/playground/store.ts
git commit -m "feat(security): migrate Math.random() to crypto.randomUUID() for all ID generation"
```

---

### Task 5: Rate Limiting on browser_evaluate

**Files:**
- Create: `mcp-server/tools/ToolRateLimiter.ts`
- Create: `mcp-server/tests/tools/tool-rate-limiter.test.ts`
- Modify: `mcp-server/tools/browser-tools.ts:407-460`

**Step 1: Write the failing test**

```typescript
// mcp-server/tests/tools/tool-rate-limiter.test.ts
import { assertEquals, assertRejects } from "@std/assert";
import { ToolRateLimiter, RateLimitError } from "../tools/ToolRateLimiter.ts";

Deno.test("ToolRateLimiter - allows requests under limit", () => {
  const limiter = new ToolRateLimiter({ maxRequests: 5, windowMs: 60000 });
  for (let i = 0; i < 5; i++) {
    limiter.check("session-1"); // should not throw
  }
});

Deno.test("ToolRateLimiter - blocks requests over limit", () => {
  const limiter = new ToolRateLimiter({ maxRequests: 3, windowMs: 60000 });
  limiter.check("session-1");
  limiter.check("session-1");
  limiter.check("session-1");
  try {
    limiter.check("session-1");
    throw new Error("should have thrown");
  } catch (e) {
    assertEquals(e instanceof RateLimitError, true);
  }
});

Deno.test("ToolRateLimiter - isolates sessions", () => {
  const limiter = new ToolRateLimiter({ maxRequests: 2, windowMs: 60000 });
  limiter.check("session-1");
  limiter.check("session-1");
  limiter.check("session-2"); // different session, should not throw
});

Deno.test("ToolRateLimiter - resets after window expires", async () => {
  const limiter = new ToolRateLimiter({ maxRequests: 1, windowMs: 50 });
  limiter.check("session-1");
  await new Promise((r) => setTimeout(r, 60));
  limiter.check("session-1"); // should not throw after window expires
});
```

**Step 2: Run test to verify it fails**

Run: `deno test --allow-all mcp-server/tests/tools/tool-rate-limiter.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// mcp-server/tools/ToolRateLimiter.ts

export class RateLimitError extends Error {
  constructor(sessionId: string, limit: number, windowMs: number) {
    super(`Rate limit exceeded for session ${sessionId}: ${limit} requests per ${windowMs}ms`);
    this.name = "RateLimitError";
  }
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

export class ToolRateLimiter {
  private windows = new Map<string, WindowEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(sessionId: string): void {
    const now = Date.now();
    let entry = this.windows.get(sessionId);

    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      entry = { count: 0, windowStart: now };
      this.windows.set(sessionId, entry);
    }

    entry.count++;
    if (entry.count > this.config.maxRequests) {
      throw new RateLimitError(sessionId, this.config.maxRequests, this.config.windowMs);
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `deno test --allow-all mcp-server/tests/tools/tool-rate-limiter.test.ts`
Expected: All 4 tests PASS

**Step 5: Integrate into browser-tools.ts**

Add import and create limiter instance in the tool registration module:
```typescript
import { ToolRateLimiter, RateLimitError } from "./ToolRateLimiter.ts";

const evaluateRateLimiter = new ToolRateLimiter({ maxRequests: 100, windowMs: 60000 });
```

Add check before `validateScript()` at line 438:
```typescript
        evaluateRateLimiter.check(sessionId as string);
```

**Step 6: Commit**

```bash
git add mcp-server/tools/ToolRateLimiter.ts mcp-server/tests/tools/tool-rate-limiter.test.ts mcp-server/tools/browser-tools.ts
git commit -m "feat(security): add rate limiting to browser_evaluate tool"
```

---

### Task 6: CSP Implementation (Full Spec — CSP Level 3)

**Files:**
- Create: `browser/src/engine/security/ContentSecurityPolicy.ts`
- Create: `browser/tests/engine/security/ContentSecurityPolicy.test.ts`
- Modify: `browser/src/engine/javascript/ScriptExecutor.ts` (inline script check)
- Modify: `browser/src/engine/javascript/WindowObject.ts` (connect-src check)

**Step 1: Write the failing tests**

```typescript
// browser/tests/engine/security/ContentSecurityPolicy.test.ts
import { assertEquals } from "@std/assert";
import { ContentSecurityPolicy } from "../../src/engine/security/ContentSecurityPolicy.ts";

// --- Parsing ---

Deno.test("CSP - parses default-src directive", () => {
  const csp = new ContentSecurityPolicy("default-src 'self'");
  assertEquals(csp.getDirective("default-src"), ["'self'"]);
});

Deno.test("CSP - parses multiple directives", () => {
  const csp = new ContentSecurityPolicy("default-src 'none'; script-src 'self' https://cdn.example.com; style-src 'unsafe-inline'");
  assertEquals(csp.getDirective("default-src"), ["'none'"]);
  assertEquals(csp.getDirective("script-src"), ["'self'", "https://cdn.example.com"]);
  assertEquals(csp.getDirective("style-src"), ["'unsafe-inline'"]);
});

Deno.test("CSP - parses all Level 3 directives", () => {
  const policy = [
    "default-src 'self'",
    "script-src 'nonce-abc123'",
    "style-src https://fonts.googleapis.com",
    "img-src data: https:",
    "connect-src https://api.example.com",
    "font-src https://fonts.gstatic.com",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src https://youtube.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "sandbox allow-scripts",
    "report-uri /csp-report",
    "report-to csp-endpoint",
    "worker-src 'self'",
    "manifest-src 'self'",
    "navigate-to 'self'",
  ].join("; ");
  const csp = new ContentSecurityPolicy(policy);
  assertEquals(csp.getDirective("script-src"), ["'nonce-abc123'"]);
  assertEquals(csp.getDirective("frame-ancestors"), ["'self'"]);
  assertEquals(csp.getDirective("sandbox"), ["allow-scripts"]);
  assertEquals(csp.getDirective("report-uri"), ["/csp-report"]);
  assertEquals(csp.getDirective("navigate-to"), ["'self'"]);
});

// --- Source Matching ---

Deno.test("CSP - 'self' matches same origin", () => {
  const csp = new ContentSecurityPolicy("script-src 'self'");
  assertEquals(csp.allows("script-src", "https://example.com/app.js", "https://example.com"), true);
  assertEquals(csp.allows("script-src", "https://evil.com/app.js", "https://example.com"), false);
});

Deno.test("CSP - 'none' blocks everything", () => {
  const csp = new ContentSecurityPolicy("script-src 'none'");
  assertEquals(csp.allows("script-src", "https://example.com/app.js", "https://example.com"), false);
});

Deno.test("CSP - scheme-source matches", () => {
  const csp = new ContentSecurityPolicy("img-src https: data:");
  assertEquals(csp.allows("img-src", "https://cdn.example.com/img.png", "https://example.com"), true);
  assertEquals(csp.allows("img-src", "data:image/png;base64,abc", "https://example.com"), true);
  assertEquals(csp.allows("img-src", "http://cdn.example.com/img.png", "https://example.com"), false);
});

Deno.test("CSP - host-source matches exact host", () => {
  const csp = new ContentSecurityPolicy("script-src https://cdn.example.com");
  assertEquals(csp.allows("script-src", "https://cdn.example.com/app.js", "https://example.com"), true);
  assertEquals(csp.allows("script-src", "https://other.example.com/app.js", "https://example.com"), false);
});

Deno.test("CSP - host-source with wildcard subdomain", () => {
  const csp = new ContentSecurityPolicy("script-src *.example.com");
  assertEquals(csp.allows("script-src", "https://cdn.example.com/app.js", "https://example.com"), true);
  assertEquals(csp.allows("script-src", "https://evil.com/app.js", "https://example.com"), false);
});

Deno.test("CSP - nonce matching for inline scripts", () => {
  const csp = new ContentSecurityPolicy("script-src 'nonce-abc123'");
  assertEquals(csp.allowsInline("script-src", "abc123"), true);
  assertEquals(csp.allowsInline("script-src", "wrong-nonce"), false);
});

Deno.test("CSP - hash matching for inline scripts", () => {
  const csp = new ContentSecurityPolicy("script-src 'sha256-abc123def456'");
  assertEquals(csp.allowsHash("script-src", "sha256", "abc123def456"), true);
  assertEquals(csp.allowsHash("script-src", "sha256", "wrong-hash"), false);
});

Deno.test("CSP - 'unsafe-inline' allows inline", () => {
  const csp = new ContentSecurityPolicy("script-src 'unsafe-inline'");
  assertEquals(csp.allowsInline("script-src"), true);
});

Deno.test("CSP - 'unsafe-eval' allows eval", () => {
  const csp = new ContentSecurityPolicy("script-src 'unsafe-eval'");
  assertEquals(csp.allowsEval(), true);
});

Deno.test("CSP - default-src fallback for missing directives", () => {
  const csp = new ContentSecurityPolicy("default-src 'self'");
  assertEquals(csp.allows("img-src", "https://example.com/img.png", "https://example.com"), true);
  assertEquals(csp.allows("img-src", "https://evil.com/img.png", "https://example.com"), false);
});

Deno.test("CSP - specific directive overrides default-src", () => {
  const csp = new ContentSecurityPolicy("default-src 'none'; img-src https://cdn.example.com");
  assertEquals(csp.allows("img-src", "https://cdn.example.com/img.png", "https://example.com"), true);
  assertEquals(csp.allows("script-src", "https://cdn.example.com/app.js", "https://example.com"), false);
});

Deno.test("CSP - report-only mode", () => {
  const csp = new ContentSecurityPolicy("script-src 'self'", { reportOnly: true });
  assertEquals(csp.isReportOnly(), true);
  // Report-only should still evaluate but not block
  assertEquals(csp.allows("script-src", "https://evil.com/app.js", "https://example.com"), false);
});

Deno.test("CSP - empty policy allows everything", () => {
  const csp = new ContentSecurityPolicy("");
  assertEquals(csp.allows("script-src", "https://evil.com/app.js", "https://example.com"), true);
});

Deno.test("CSP - 'strict-dynamic' with nonce", () => {
  const csp = new ContentSecurityPolicy("script-src 'strict-dynamic' 'nonce-abc123'");
  assertEquals(csp.allowsInline("script-src", "abc123"), true);
  assertEquals(csp.hasStrictDynamic("script-src"), true);
});

Deno.test("CSP - sandbox directive", () => {
  const csp = new ContentSecurityPolicy("sandbox allow-scripts allow-same-origin");
  assertEquals(csp.getSandboxFlags(), ["allow-scripts", "allow-same-origin"]);
});

Deno.test("CSP - getViolationReport returns structured report", () => {
  const csp = new ContentSecurityPolicy("script-src 'self'");
  const report = csp.getViolationReport(
    "script-src",
    "https://evil.com/app.js",
    "https://example.com",
  );
  assertEquals(report.violatedDirective, "script-src");
  assertEquals(report.blockedURI, "https://evil.com/app.js");
  assertEquals(report.documentURI, "https://example.com");
});
```

**Step 2: Run test to verify it fails**

Run: `deno test --allow-all browser/tests/engine/security/ContentSecurityPolicy.test.ts`
Expected: FAIL — module not found

**Step 3: Write full implementation**

```typescript
// browser/src/engine/security/ContentSecurityPolicy.ts

export interface CSPViolationReport {
  violatedDirective: string;
  effectiveDirective: string;
  blockedURI: string;
  documentURI: string;
  originalPolicy: string;
  disposition: "enforce" | "report";
  timestamp: number;
}

interface CSPOptions {
  reportOnly?: boolean;
}

const FETCH_DIRECTIVES = new Set([
  "default-src", "script-src", "style-src", "img-src", "connect-src",
  "font-src", "media-src", "object-src", "frame-src", "worker-src",
  "manifest-src",
]);

const ALL_DIRECTIVES = new Set([
  ...FETCH_DIRECTIVES,
  "frame-ancestors", "base-uri", "form-action", "sandbox",
  "report-uri", "report-to", "plugin-types", "navigate-to",
]);

export class ContentSecurityPolicy {
  private directives = new Map<string, string[]>();
  private reportOnly: boolean;
  private originalPolicy: string;

  constructor(policy: string, options: CSPOptions = {}) {
    this.originalPolicy = policy;
    this.reportOnly = options.reportOnly ?? false;
    this.parse(policy);
  }

  private parse(policy: string): void {
    if (!policy.trim()) return;

    const parts = policy.split(";").map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      const tokens = part.split(/\s+/);
      const directive = tokens[0].toLowerCase();
      const values = tokens.slice(1);
      if (ALL_DIRECTIVES.has(directive) || directive.startsWith("plugin-")) {
        this.directives.set(directive, values);
      }
    }
  }

  getDirective(name: string): string[] | undefined {
    return this.directives.get(name);
  }

  isReportOnly(): boolean {
    return this.reportOnly;
  }

  /**
   * Check if a resource URL is allowed by a fetch directive.
   * Falls back to default-src if the specific directive is not set.
   */
  allows(directive: string, resourceUrl: string, documentOrigin: string): boolean {
    // No policy = allow everything
    if (this.directives.size === 0) return true;

    const sources = this.directives.get(directive) ?? this.directives.get("default-src");
    if (!sources) return true; // No applicable directive

    return this.matchesSources(sources, resourceUrl, documentOrigin);
  }

  /**
   * Check if inline content (scripts/styles) is allowed.
   * Checks for 'unsafe-inline', nonce, or hash.
   */
  allowsInline(directive: string, nonce?: string): boolean {
    if (this.directives.size === 0) return true;

    const sources = this.directives.get(directive) ?? this.directives.get("default-src");
    if (!sources) return true;

    // Check 'unsafe-inline'
    if (sources.includes("'unsafe-inline'")) return true;

    // Check nonce
    if (nonce) {
      for (const source of sources) {
        if (source === `'nonce-${nonce}'`) return true;
      }
    }

    return false;
  }

  /**
   * Check if a hash matches for inline content.
   */
  allowsHash(directive: string, algorithm: string, hash: string): boolean {
    if (this.directives.size === 0) return true;

    const sources = this.directives.get(directive) ?? this.directives.get("default-src");
    if (!sources) return true;

    const expected = `'${algorithm}-${hash}'`;
    return sources.includes(expected);
  }

  /**
   * Check if eval() is allowed by script-src.
   */
  allowsEval(): boolean {
    if (this.directives.size === 0) return true;

    const sources = this.directives.get("script-src") ?? this.directives.get("default-src");
    if (!sources) return true;

    return sources.includes("'unsafe-eval'");
  }

  /**
   * Check if 'strict-dynamic' is present.
   */
  hasStrictDynamic(directive: string): boolean {
    const sources = this.directives.get(directive);
    return sources?.includes("'strict-dynamic'") ?? false;
  }

  /**
   * Get sandbox flags.
   */
  getSandboxFlags(): string[] {
    return this.directives.get("sandbox") ?? [];
  }

  /**
   * Generate a violation report.
   */
  getViolationReport(
    directive: string,
    blockedURI: string,
    documentURI: string,
  ): CSPViolationReport {
    return {
      violatedDirective: directive,
      effectiveDirective: this.directives.has(directive) ? directive : "default-src",
      blockedURI,
      documentURI,
      originalPolicy: this.originalPolicy,
      disposition: this.reportOnly ? "report" : "enforce",
      timestamp: Date.now(),
    };
  }

  private matchesSources(sources: string[], resourceUrl: string, documentOrigin: string): boolean {
    // 'none' blocks everything
    if (sources.length === 1 && sources[0] === "'none'") return false;

    let parsed: URL;
    try {
      parsed = new URL(resourceUrl);
    } catch {
      return false;
    }

    for (const source of sources) {
      if (this.matchesSource(source, parsed, documentOrigin)) return true;
    }
    return false;
  }

  private matchesSource(source: string, resourceUrl: URL, documentOrigin: string): boolean {
    // 'self' — same origin
    if (source === "'self'") {
      try {
        const docOrigin = new URL(documentOrigin).origin;
        return resourceUrl.origin === docOrigin;
      } catch {
        return false;
      }
    }

    // Scheme source (e.g., "https:", "data:")
    if (source.endsWith(":") && !source.includes("/")) {
      return resourceUrl.protocol === source || resourceUrl.protocol === source.replace(/:$/, ":");
    }

    // Wildcard subdomain (e.g., "*.example.com")
    if (source.startsWith("*.")) {
      const domain = source.slice(2);
      return resourceUrl.hostname.endsWith(`.${domain}`) || resourceUrl.hostname === domain;
    }

    // Host source — could be full URL or just hostname
    try {
      const sourceUrl = new URL(source.includes("://") ? source : `https://${source}`);
      if (source.includes("://")) {
        return resourceUrl.origin === sourceUrl.origin;
      }
      return resourceUrl.hostname === sourceUrl.hostname;
    } catch {
      return false;
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `deno test --allow-all browser/tests/engine/security/ContentSecurityPolicy.test.ts`
Expected: All 19 tests PASS

**Step 5: Integrate into ScriptExecutor and WindowObject**

In `ScriptExecutor.ts`, before executing inline scripts, check CSP:
```typescript
import { ContentSecurityPolicy } from "../security/ContentSecurityPolicy.ts";

// In execute method, if page has CSP header:
if (this.csp && !this.csp.allowsInline("script-src", scriptNonce)) {
  const report = this.csp.getViolationReport("script-src", "inline", this.documentOrigin);
  console.warn("[CSP] Blocked inline script:", report);
  if (!this.csp.isReportOnly()) return;
}
```

In `WindowObject.ts` `createFetch()`, add connect-src check after SSRF validation:
```typescript
if (this.csp && !this.csp.allows("connect-src", fetchUrl, this.documentOrigin)) {
  console.warn(`[CSP] Blocked fetch to ${fetchUrl}: violates connect-src`);
  if (!this.csp.isReportOnly()) {
    return createObject();
  }
}
```

**Step 6: Commit**

```bash
git add browser/src/engine/security/ContentSecurityPolicy.ts browser/tests/engine/security/ContentSecurityPolicy.test.ts browser/src/engine/javascript/ScriptExecutor.ts browser/src/engine/javascript/WindowObject.ts
git commit -m "feat(security): implement CSP Level 3 parsing and enforcement"
```

---

## Phase 2: Architecture + Critical Bug

### Task 7: LRU Eviction Bug Fix

**Files:**
- Modify: `proxy-engine/core/cache/kv/storage.ts:28-48`
- Modify: `proxy-engine/tests/core/cache/kv/storage.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to existing storage.test.ts
Deno.test("MemoryStorage - LRU evicts least recently accessed, not oldest inserted", async () => {
  const storage = new MemoryStorage(100); // 100 bytes max
  // Insert three 40-byte entries (total 120 > 100, so eviction will happen)
  await storage.set("first", new Uint8Array(40));
  await storage.set("second", new Uint8Array(40));

  // Access "first" to make it recently used
  await storage.get("first");

  // Insert third entry — should evict "second" (least recently accessed), not "first"
  await storage.set("third", new Uint8Array(40));

  assertEquals(await storage.has("first"), true, "first should survive — it was recently accessed");
  assertEquals(await storage.has("second"), false, "second should be evicted — least recently accessed");
  assertEquals(await storage.has("third"), true, "third should exist — just inserted");
});
```

**Step 2: Run test to verify it fails**

Run: `deno test --allow-all --no-check proxy-engine/tests/core/cache/kv/storage.test.ts --filter "LRU evicts"`
Expected: FAIL — "first" gets evicted because current code is FIFO

**Step 3: Fix the LRU implementation**

Replace the `MemoryStorage` class internals:

```typescript
export class MemoryStorage {
  private store = new Map<string, Uint8Array>();
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;
  private maxBytes: number;
  private byteSize = 0;

  constructor(maxBytes: number) {
    this.maxBytes = maxBytes;
  }

  async get(key: string): Promise<Uint8Array | null> {
    const value = this.store.get(key);
    if (value) {
      this.accessOrder.set(key, ++this.accessCounter);
    }
    return value ?? null;
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    const existingSize = this.store.has(key) ? this.store.get(key)!.length : 0;
    const newSize = value.length;
    const sizeChange = newSize - existingSize;

    // Evict LRU entries until there's room
    while (this.byteSize + sizeChange > this.maxBytes && this.store.size > 0) {
      let lruKey: string | null = null;
      let minAccess = Infinity;
      for (const [k, accessTime] of this.accessOrder) {
        if (k !== key && accessTime < minAccess) {
          minAccess = accessTime;
          lruKey = k;
        }
      }
      if (lruKey) {
        await this.delete(lruKey);
      } else {
        break;
      }
    }

    this.store.set(key, value);
    this.accessOrder.set(key, ++this.accessCounter);
    this.byteSize += sizeChange;
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async delete(key: string): Promise<void> {
    const value = this.store.get(key);
    if (value) {
      this.byteSize -= value.length;
      this.store.delete(key);
      this.accessOrder.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.accessOrder.clear();
    this.byteSize = 0;
  }

  get size(): number {
    return this.store.size;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `deno test --allow-all --no-check proxy-engine/tests/core/cache/kv/storage.test.ts`
Expected: All tests PASS including new LRU test

**Step 5: Commit**

```bash
git add proxy-engine/core/cache/kv/storage.ts proxy-engine/tests/core/cache/kv/storage.test.ts
git commit -m "fix(cache): implement true LRU eviction with access order tracking"
```

---

### Task 8: RenderingPipeline Decomposition

**Files:**
- Create: `browser/src/engine/rendering/ResourceFetcher.ts`
- Create: `browser/src/engine/rendering/ImageDecoder.ts`
- Create: `browser/src/engine/rendering/WebGPUManager.ts`
- Create: `browser/src/engine/rendering/RenderingOrchestrator.ts`
- Modify: `browser/src/engine/RenderingPipeline.ts` (thin facade)
- Create: `browser/tests/engine/rendering/ResourceFetcher.test.ts`
- Create: `browser/tests/engine/rendering/ImageDecoder.test.ts`

**Step 1: Extract ResourceFetcher**

Extract lines 672-941 from `RenderingPipeline.ts` into `ResourceFetcher.ts`:
- `fetchHTML(url)` → fetch and return raw HTML
- `fetchStylesheets(dom, baseUrl)` → discover and fetch all CSS
- `findStyleElements(dom)` → extract inline `<style>` content
- `handleSpecialURL(url)` → about:blank, data: URI handling

**Step 2: Extract ImageDecoder**

Extract lines 146-239 into `ImageDecoder.ts`:
- `parseImageDimensions(data, mimeType)` → parse PNG/JPEG/GIF/WebP/SVG headers for width/height
- Static utility, no instance state needed

**Step 3: Extract WebGPUManager**

Extract lines 330-447, 1058-1082 into `WebGPUManager.ts`:
- `initializeWebGPU()` — device/adapter setup
- `disposeWebGPU()` — cleanup
- `getPixels()` — readback
- `screenshot()` — capture to PNG
- `isHeadless()` — mode check

**Step 4: Extract RenderingOrchestrator**

Extract lines 452-663, 287-297 into `RenderingOrchestrator.ts`:
- `render(url)` — main pipeline: fetch → parse → style → layout → paint → composite
- `emitStage()` / `setObserver()` — observer pattern
- Delegates to ResourceFetcher, ImageDecoder, WebGPUManager

**Step 5: Rewrite RenderingPipeline as thin facade**

```typescript
// browser/src/engine/RenderingPipeline.ts (~100 lines)
import { ResourceFetcher } from "./rendering/ResourceFetcher.ts";
import { ImageDecoder } from "./rendering/ImageDecoder.ts";
import { WebGPUManager } from "./rendering/WebGPUManager.ts";
import { RenderingOrchestrator } from "./rendering/RenderingOrchestrator.ts";

export class RenderingPipeline {
  private orchestrator: RenderingOrchestrator;
  private webgpu: WebGPUManager;

  constructor(config: RenderingPipelineConfig) {
    const fetcher = new ResourceFetcher(config.requestPipeline);
    const webgpu = new WebGPUManager(config);
    this.webgpu = webgpu;
    this.orchestrator = new RenderingOrchestrator(fetcher, ImageDecoder, webgpu, config);
  }

  async render(url: string) { return this.orchestrator.render(url); }
  setObserver(obs: PipelineObserver) { this.orchestrator.setObserver(obs); }
  async getPixels() { return this.webgpu.getPixels(); }
  async screenshot() { return this.webgpu.screenshot(); }
  isHeadless() { return this.webgpu.isHeadless(); }
  getStats() { return this.orchestrator.getStats(); }
  async dispose() { await this.webgpu.dispose(); }
}
```

**Step 6: Write tests for extracted modules**

Test `ResourceFetcher` and `ImageDecoder` independently with mocked inputs.

**Step 7: Run all existing RenderingPipeline tests**

Run: `deno test --allow-all --no-check browser/tests/integration/rendering_pipeline.test.ts browser/tests/engine/rendering/`
Expected: All existing tests PASS (facade preserves API)

**Step 8: Commit**

```bash
git add browser/src/engine/rendering/ResourceFetcher.ts browser/src/engine/rendering/ImageDecoder.ts browser/src/engine/rendering/WebGPUManager.ts browser/src/engine/rendering/RenderingOrchestrator.ts browser/src/engine/RenderingPipeline.ts browser/tests/engine/rendering/ResourceFetcher.test.ts browser/tests/engine/rendering/ImageDecoder.test.ts
git commit -m "refactor: decompose RenderingPipeline into focused classes"
```

---

### Task 9: Query Engine Workspace Imports

**Files:**
- Modify: `query-engine/deno.json` (add imports)
- Modify: ~20 files with relative cross-workspace imports

**Step 1: Add workspace imports to deno.json**

Add to `query-engine/deno.json` imports section:
```json
"@browserx/browser": "../browser/src/mod.ts",
"@browserx/proxy-engine": "../proxy-engine/mod.ts"
```

**Step 2: Find and replace relative cross-workspace imports**

Replace patterns like:
- `from "../../browser/src/..."` → `from "@browserx/browser"`
- `from "../../proxy-engine/..."` → `from "@browserx/proxy-engine"`

Only replace cross-workspace imports. Internal query-engine imports stay relative.

**Step 3: Run query engine tests**

Run: `deno task query:test`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add query-engine/deno.json query-engine/
git commit -m "refactor: migrate query-engine to workspace imports (@browserx/*)"
```

---

## Phase 3: Performance

### Task 10: Inline Caching for Property Access

**Files:**
- Modify: `browser/src/engine/javascript/IgnitionInterpreter.ts:824-867`
- Create: `browser/tests/engine/javascript/inline-cache.test.ts`

**Step 1: Write the failing test**

```typescript
// browser/tests/engine/javascript/inline-cache.test.ts
import { assertEquals } from "@std/assert";
import { V8Compiler } from "../../src/engine/javascript/V8Compiler.ts";
import { IgnitionInterpreter } from "../../src/engine/javascript/IgnitionInterpreter.ts";

Deno.test("InlineCache - property access uses cache on repeated access", () => {
  const compiler = new V8Compiler();
  const compiled = compiler.compile(`
    var obj = { x: 42 };
    var sum = 0;
    for (var i = 0; i < 100; i++) {
      sum = sum + obj.x;
    }
    sum;
  `);
  const interp = new IgnitionInterpreter(compiled.bytecode, compiled.constantPool);
  const result = interp.run();
  assertEquals(result.value, 4200);

  // Verify cache was populated (check interpreter stats)
  const stats = interp.getCacheStats?.();
  if (stats) {
    assertEquals(stats.hits > 0, true, "Should have cache hits after repeated access");
  }
});
```

**Step 2: Implement inline cache**

Add to `IgnitionInterpreter`:

```typescript
private propertyCache = new Map<number, { objectRef: WeakRef<any>; name: string; value: JSValue }>();
private cacheHits = 0;
private cacheMisses = 0;

private executeGET_PROPERTY(bytecode: Uint8Array): void {
    const pc = this.programCounter - 1; // PC of this instruction
    const nameIndex = this.readOperand(bytecode);
    const name = this.constantPool[nameIndex] as string;
    const obj = this.accumulator;

    // Check inline cache
    const cached = this.propertyCache.get(pc);
    if (cached && cached.name === name && cached.objectRef.deref() === obj.value) {
        this.accumulator = cached.value;
        this.cacheHits++;
        return;
    }
    this.cacheMisses++;

    // Slow path: full prototype chain walk
    if (obj.type === JSValueType.OBJECT || obj.type === JSValueType.FUNCTION) {
        let current: any = obj.value;
        while (current) {
            if (current.getters?.has(name)) {
                this.accumulator = current.getters.get(name)!();
                return; // Don't cache getter results
            }
            if (current.properties.has(name)) {
                const value = current.properties.get(name)!;
                this.accumulator = value;
                // Populate cache
                this.propertyCache.set(pc, {
                    objectRef: new WeakRef(obj.value),
                    name,
                    value,
                });
                return;
            }
            current = current.prototype;
        }
    }
    this.accumulator = createUndefined();
}

getCacheStats(): { hits: number; misses: number } {
    return { hits: this.cacheHits, misses: this.cacheMisses };
}
```

**Step 3: Run tests**

Run: `deno test --allow-all --no-check browser/tests/engine/javascript/`
Expected: All JS engine tests PASS including new inline cache test

**Step 4: Commit**

```bash
git add browser/src/engine/javascript/IgnitionInterpreter.ts browser/tests/engine/javascript/inline-cache.test.ts
git commit -m "perf: add inline caching for GET_PROPERTY bytecode operation"
```

---

### Task 11: CSS Measurement Caching

**Files:**
- Modify: `browser/src/engine/rendering/rendering/RenderObject.ts:232-280`
- Create: `browser/tests/engine/rendering/rendering/RenderObject-cache.test.ts`

**Step 1: Write the failing test**

```typescript
Deno.test("RenderObject - getPixelValue caches results", () => {
  // Create render object with style "width: 100px"
  const obj = createTestRenderObject({ width: "100px" });
  const v1 = obj.getPixelValue("width");
  const v2 = obj.getPixelValue("width");
  assertEquals(v1, 100);
  assertEquals(v2, 100);
  // Both calls should return same result; second from cache
});

Deno.test("RenderObject - cache invalidates on markNeedsLayout", () => {
  const obj = createTestRenderObject({ width: "100px" });
  obj.getPixelValue("width"); // populate cache
  obj.markNeedsLayout();
  // Cache should be cleared — next call re-computes
});
```

**Step 2: Add caching to getPixelValue**

```typescript
private pixelValueCache = new Map<string, Pixels>();

public getPixelValue(property: string, defaultValue: Pixels = 0 as Pixels): Pixels {
    const cached = this.pixelValueCache.get(property);
    if (cached !== undefined) return cached;

    // ... existing parsing logic ...
    const result = /* computed value */;
    this.pixelValueCache.set(property, result);
    return result;
}

public markNeedsLayout(): void {
    this.pixelValueCache.clear();
    // ... existing logic ...
}
```

**Step 3: Run tests**

Run: `deno test --allow-all --no-check browser/tests/engine/rendering/`
Expected: All rendering tests PASS

**Step 4: Commit**

```bash
git add browser/src/engine/rendering/rendering/RenderObject.ts browser/tests/engine/rendering/rendering/RenderObject-cache.test.ts
git commit -m "perf: add pixel value caching to RenderObject.getPixelValue()"
```

---

## Phase 4: Quality

### Task 12: Indent Standardization

**Files:**
- Modify: `browser/deno.json` (indentWidth: 4 → 2)

**Step 1: Update config**

Change `browser/deno.json` line 30: `"indentWidth": 4` → `"indentWidth": 2`

**Step 2: Run formatter**

Run: `deno fmt browser/`

**Step 3: Commit (formatting only)**

```bash
git add browser/
git commit -m "chore: standardize browser workspace indent to 2 spaces"
```

---

### Task 13: Browser-Native Structured Logging

**Files:**
- Create: `browser/src/engine/logging/BrowserConsole.ts`
- Create: `browser/src/engine/logging/LogSink.ts`
- Create: `browser/tests/engine/logging/BrowserConsole.test.ts`
- Modify: ~30 files (replace console.log with structured calls)

**Step 1: Write LogSink and BrowserConsole**

```typescript
// browser/src/engine/logging/LogSink.ts
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
  timestamp: number;
}

export interface LogSink {
  write(entry: LogEntry): void;
}

export class StderrSink implements LogSink {
  private minLevel: LogLevel;
  private static LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

  constructor(minLevel?: LogLevel) {
    const envLevel = (typeof Deno !== "undefined" ? Deno.env.get("BROWSERX_LOG_LEVEL") : undefined) as LogLevel | undefined;
    this.minLevel = minLevel ?? envLevel ?? "info";
  }

  write(entry: LogEntry): void {
    if (StderrSink.LEVELS[entry.level] < StderrSink.LEVELS[this.minLevel]) return;
    const prefix = `[${entry.component}]`;
    const method = entry.level === "error" ? "error" : entry.level === "warn" ? "warn" : "log";
    (console as any)[method](prefix, entry.message, entry.data ?? "");
  }
}
```

```typescript
// browser/src/engine/logging/BrowserConsole.ts
// Implements browser Console API spec
import type { LogSink, LogEntry, LogLevel } from "./LogSink.ts";
import { StderrSink } from "./LogSink.ts";

export class BrowserConsole {
  private sink: LogSink;
  private component: string;
  private timers = new Map<string, number>();
  private counters = new Map<string, number>();
  private groupDepth = 0;

  constructor(component: string, sink?: LogSink) {
    this.component = component;
    this.sink = sink ?? new StderrSink();
  }

  log(...args: unknown[]): void { this.emit("info", args); }
  debug(...args: unknown[]): void { this.emit("debug", args); }
  info(...args: unknown[]): void { this.emit("info", args); }
  warn(...args: unknown[]): void { this.emit("warn", args); }
  error(...args: unknown[]): void { this.emit("error", args); }

  trace(...args: unknown[]): void {
    this.emit("debug", [...args, new Error().stack]);
  }

  assert(condition: boolean, ...args: unknown[]): void {
    if (!condition) this.emit("error", ["Assertion failed:", ...args]);
  }

  count(label = "default"): void {
    const c = (this.counters.get(label) ?? 0) + 1;
    this.counters.set(label, c);
    this.emit("info", [`${label}: ${c}`]);
  }

  countReset(label = "default"): void {
    this.counters.set(label, 0);
  }

  time(label = "default"): void {
    this.timers.set(label, performance.now());
  }

  timeEnd(label = "default"): void {
    const start = this.timers.get(label);
    if (start !== undefined) {
      const duration = performance.now() - start;
      this.timers.delete(label);
      this.emit("info", [`${label}: ${duration.toFixed(2)}ms`]);
    }
  }

  timeLog(label = "default", ...args: unknown[]): void {
    const start = this.timers.get(label);
    if (start !== undefined) {
      const duration = performance.now() - start;
      this.emit("info", [`${label}: ${duration.toFixed(2)}ms`, ...args]);
    }
  }

  group(...args: unknown[]): void {
    this.emit("info", args);
    this.groupDepth++;
  }

  groupEnd(): void {
    if (this.groupDepth > 0) this.groupDepth--;
  }

  dir(obj: unknown): void {
    this.emit("info", [obj]);
  }

  table(data: unknown): void {
    this.emit("info", ["[table]", data]);
  }

  clear(): void {
    // No-op in non-browser context
  }

  private emit(level: LogLevel, args: unknown[]): void {
    const indent = "  ".repeat(this.groupDepth);
    const message = indent + args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
    this.sink.write({
      level,
      component: this.component,
      message,
      data: args.length === 1 ? args[0] : args,
      timestamp: Date.now(),
    });
  }
}
```

**Step 2: Write tests**

Test all Console API methods: log, debug, info, warn, error, trace, assert, count, time/timeEnd, group/groupEnd, dir, table.

**Step 3: Replace console.log calls incrementally**

Start with highest-traffic files:
- `RenderingPipeline.ts` → `new BrowserConsole("RenderingPipeline")`
- `CompositorThread.ts` → `new BrowserConsole("Compositor")`
- `ScriptExecutor.ts` → `new BrowserConsole("ScriptExecutor")`
- Continue through remaining 27+ files

**Step 4: Run all tests**

Run: `deno task test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add browser/src/engine/logging/ browser/tests/engine/logging/ browser/src/engine/
git commit -m "feat: add browser-native Console API with structured logging"
```

---

### Task 14: Reduce `as any` Usage

**Files:**
- Modify: `browser/src/engine/javascript/DOMBindings.ts` (29 uses → proper types)
- Modify: `browser/src/engine/rendering/paint/PaintLayer.ts` (8 uses)
- Modify: `browser/src/engine/rendering/layout/FlexboxLayout.ts` (6 uses)
- Modify: ~5 other files

**Step 1: Define FFI type interfaces for DOMBindings**

Create proper type interfaces for the DOM ↔ JS boundary instead of `as any`.

**Step 2: Replace `as any` with `as unknown` + type guards**

For each file, replace:
```typescript
// Before
const result = externalAPI() as any;
// After
const result: unknown = externalAPI();
if (isExpectedType(result)) { /* use typed result */ }
```

**Step 3: Run type checker**

Run: `deno task browser:check`
Expected: No new type errors (may have fewer than before)

**Step 4: Commit**

```bash
git add browser/src/
git commit -m "refactor: replace as any with proper types and type guards"
```

---

## Summary

| Task | Phase | Description | Commit Message |
|------|-------|-------------|----------------|
| 1 | Security | SSRF validation | `feat(security): add SSRF validation to WindowObject.fetch()` |
| 2 | Security | SessionId sanitization | `feat(security): sanitize sessionId and use crypto.randomUUID in ActivityTracker` |
| 3 | Security | Same-origin checks | `feat(security): add same-origin runtime checks to StorageManager` |
| 4 | Security | crypto.randomUUID migration | `feat(security): migrate Math.random() to crypto.randomUUID()` |
| 5 | Security | Rate limiting | `feat(security): add rate limiting to browser_evaluate tool` |
| 6 | Security | CSP Level 3 | `feat(security): implement CSP Level 3 parsing and enforcement` |
| 7 | Arch | LRU bug fix | `fix(cache): implement true LRU eviction with access order tracking` |
| 8 | Arch | RenderingPipeline split | `refactor: decompose RenderingPipeline into focused classes` |
| 9 | Arch | Workspace imports | `refactor: migrate query-engine to workspace imports` |
| 10 | Perf | Inline caching | `perf: add inline caching for GET_PROPERTY bytecode operation` |
| 11 | Perf | CSS measurement cache | `perf: add pixel value caching to RenderObject.getPixelValue()` |
| 12 | Quality | Indent standardization | `chore: standardize browser workspace indent to 2 spaces` |
| 13 | Quality | Structured logging | `feat: add browser-native Console API with structured logging` |
| 14 | Quality | Reduce as any | `refactor: replace as any with proper types and type guards` |
