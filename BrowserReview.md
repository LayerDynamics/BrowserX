# Code Review: BrowserX Browser Engine (`browser/src/`)

## Summary

The browser engine is an ambitious, well-structured codebase implementing a full browser stack from TCP/TLS through rendering and JavaScript execution. The architecture follows clean patterns (pipeline observers, state machines, graceful headless degradation) and has strong type safety. However, the review uncovered **12 critical issues** spanning security vulnerabilities (cookie SameSite bypass, certificate validation weaknesses, XSS in FormAutomation), correctness bugs (timers never firing, string concatenation broken, innerHTML not parsing HTML), and architectural mismatches (TCP header parsing on application-layer data). Many API-layer methods are cosmetic — returning fake data or silently no-op-ing while reporting success.

---

## Findings

### Critical

1. **`setTimeout`/`setInterval` callbacks never fire** (`engine/javascript/WindowObject.ts:178–218`) — Timer implementations schedule native timers but the callback body is `() => {}`. The captured JS callback is stored but never invoked. All timer-dependent JS behavior silently breaks.

2. **ADD instruction does not handle string concatenation** (`engine/javascript/IgnitionInterpreter.ts:396–404`) — `executeADD` always calls `toNumber()` on both operands. `"hello" + " world"` produces `NaN` instead of `"hello world"`. Breaks any JS using `+` for strings.

3. **`innerHTML` setter does not parse HTML** (`engine/javascript/DOMBindings.ts:1011–1023`) — Setting `innerHTML` creates a single text node containing the raw HTML string rather than parsing it into a subtree. Breaks React, templates, and any code injecting HTML via innerHTML.

4. **`isTopLevelNavigation` always returns `true`** (`engine/storage/CookieManager.ts:303–307`) — Makes `SameSite=Lax` cookies equivalent to `SameSite=None`. Cross-site sub-resource requests receive Lax cookies, violating the SameSite spec.

5. **`isPublicSuffix` uses a hardcoded 8-entry list** (`engine/storage/CookieManager.ts:327–331`) — Only `com`, `org`, `net`, `edu`, `gov`, `mil`, `co.uk`, `co.jp`. An attacker can set supercookies covering entire country TLDs like `.uk`, `.io`, `.de`.

6. **OAuth2 flows return hardcoded fake tokens** (`api/AuthenticationManager.ts:483,514,543,595`) — `oauth2ClientCredentials()`, `oauth2Password()`, etc. all return `"simulated_access_token"`. Returns `{ success: true }` with fabricated tokens that fail against any real auth server.

7. **JavaScript injection in FormAutomation file upload** (`api/FormAutomation.ts:917–947`) — `uploadFile()` embeds `fieldSelector` directly into JS strings via concatenation. `escapeSelector()` does not escape backticks, null bytes, or Unicode escapes. Exploitable with crafted selectors or filenames.

8. **`refresh()` calls `oauth2RefreshToken()` with empty `clientId`/`tokenUrl`** (`api/AuthenticationManager.ts:700–706`) — Reconstructs credentials with `clientId: ""` and `tokenUrl: ""`. The stored session's original values are never captured.

9. **`parseTCPSegment` called on application-layer socket data** (`engine/network/primitives/TCPConnection.ts:321`) — `receiveSegment()` reads from an OS TCP socket and attempts to parse TCP headers from the data. OS TCP stacks strip headers before delivering to userspace — this interprets payload bytes as headers, corrupting all sequence/ACK processing.

10. **`serializeTCPSegment` sends segments with zero checksum** (`engine/network/primitives/TCPConnection.ts:293–297`) — `serializeTCPSegmentWithChecksum()` exists but is never called inside `TCPConnection`. Every outgoing TCP segment has checksum zero.

11. **`GPU.composite()` loop body is a no-op** (`os/graphics/GPU.ts:168–186`) — The method creates a render pass, iterates layers, but never issues a draw call. The render pass clears to white and ends immediately. The core compositor entry point produces blank frames.

12. **Timer leak in `DNSCache` — no cleanup on destruction** (`engine/network/resolution/DNSCache.ts:134`) — 60-second `setInterval` started in constructor. No `destroy()`/`dispose()` method, and `RequestPipeline.close()` never calls `stopAutoCleanup()`. Every pipeline instance leaks an interval timer indefinitely.

---

### High

1. **`authenticateCookie()` never sets cookies on the browser** (`api/AuthenticationManager.ts:348–371`) — Stores `CookieConfig` in the session but never calls any cookie-injection API. Returns `{ success: true }`.

2. **`waitForNavigationOrTimeout()` caps wait at 1000ms** (`api/FormAutomation.ts:839–842`) — `Math.min(timeout, 1000)` ignores the caller's configured deadline. Form submissions on slow networks fail spuriously.

3. **`BrowserEngine` defaults `enableJavaScript: false`** (`api/BrowserEngine.ts:31`) — Primary entry point for query engine and MCP server operates in no-JS mode unless explicitly overridden. SPAs and auth flows silently break.

4. **`BrowserEngine.newPage()` never pushes to `this.pages`** (`api/BrowserEngine.ts:41–44`) — The `pages` array is always empty. Tab/page tracking is broken.

5. **`HARRecorder.shouldRecord()` compiles new RegExp on every call** (`api/HARRecorder.ts:659,669`) — Creates thousands of redundant regex compilations in long recording sessions.

6. **`VisualTester.checkVisibility()` reads inline styles, not computed styles** (`api/VisualTester.ts:432–434`) — Elements hidden via stylesheet rules report `visible: true`. False positives in visual test assertions.

7. **`HARPlayer` cookie/auth restoration are no-ops** (`api/HARPlayer.ts:706–712, 726–731`) — `applyCookiesFromHAR()` and `applyAuthFromHAR()` store data but never call any page API.

8. **`IsolateManager` singleton leaks stale isolates** (`engine/javascript/V8Isolate.ts:389–403`) — No cleanup path. Each isolate starts a background GC `setInterval` that fires forever on orphaned isolates.

9. **`CookieManager` cleanup interval leaks without `dispose()`** (`engine/storage/CookieManager.ts:33–35`) — Constructor starts 60-second interval. No `Symbol.dispose` support.

10. **`querySelector`/`querySelectorAll` only support trivial selectors** (`engine/javascript/DOMBindings.ts:1563–1608`) — Only `#id`, `.class`, tagName, `*`. Attribute selectors, combinators, pseudo-classes all return null/empty. Modern frameworks fail silently.

11. **Tree navigation properties are static snapshots** (`engine/javascript/DOMBindings.ts:658–700`) — `parentNode`, `childNodes`, etc. copied at wrap time. DOM mutations don't update already-wrapped nodes. DOM spec requires live references.

12. **`structuredClone` only shallow-copies** (`engine/javascript/WindowObject.ts:334–359`) — Nested objects are shared, not cloned. Post-clone mutations corrupt the "clone".

13. **`dispatchEvent` ignores non-native listeners** (`engine/javascript/DOMBindings.ts:1062–1074`) — Only invokes `nativeImpl` functions. User-registered JS callbacks are silently skipped.

14. **`crypto.getRandomValues` returns empty object** (`engine/javascript/WindowObject.ts:516–522`) — Returns `{ length: 16 }` with no random bytes. Cryptographic operations get all-zero data.

15. **OCSP requests use zero-byte issuer hashes** (`engine/network/security/Certificate.ts:213–214`) — Revocation checking sends 20 zero bytes. Responders can't match certificates; all checks pass silently.

16. **Certificate root validation uses subject+serial only** (`engine/network/security/Certificate.ts:66`) — No public key comparison. Crafted certificates with matching subject strings pass root validation.

17. **`parseOID` returns `"RSA-SHA256"` for unknown OIDs** (`engine/network/security/Certificate.ts:1021`) — Security-critical code silently falls back to wrong algorithm instead of failing.

18. **User-agent leaks "GeoProx-Browser/1.0"** (`engine/RequestPipeline.ts:693`, `engine/javascript/WindowObject.ts:249`, `main.ts:511`) — Internal codename sent to every server and printed on startup. Should be "BrowserX".

19. **Connection not released to pool on error** (`engine/RequestPipeline.ts:530–539`) — Error paths never call `connectionPool.release()`. 6 consecutive errors exhaust the pool permanently.

20. **`systemCACache` race condition** (`engine/network/security/Certificate.ts:558`) — Module-level `let` with no mutex. Concurrent first-time calls produce duplicate reads and non-atomic writes.

21. **`OSSocket.connect()` leaks previous connection** (`os/networking/NetworkStack.ts:46–76`) — Connecting an already-connected socket overwrites `socket.conn` without closing the old one.

22. **`Browser.navigate()` leaves stale URL on failure** (`main.ts:86–88`) — History updated before render; `currentURL` updated after. On failure, `reload()` and `back()`/`forward()` are inconsistent.

23. **Incompatible `LayerID` types in `rendering.ts` vs `webgpu.ts`** — One is plain `string`, other is branded. Both exported from `types/`.

24. **Duplicate `HTMLCanvasElement`/`CanvasRenderingContext2D` definitions** — `dom.ts` (30+ methods) and `webgpu.ts` (5 methods) define different shapes. Callers get different types depending on import source.

---

### Medium

1. **`WebScraper.extractByRule()` queries global document per rule** (`api/WebScraper.ts:306`) — Queries entire page then filters via `root.contains()`. O(n) extra work and breaks for duplicate selectors.

2. **`PDFGenerator.estimatePageCount()` decodes binary PDF as UTF-8** (`api/PDFGenerator.ts:371–374`) — `TextDecoder` corrupts multi-byte sequences; regex matches may be wrong.

3. **`PerformanceProfiler.getMemoryInfo()` returns fabricated data** (`api/PerformanceProfiler.ts:555–565`) — `usedJSHeapSize: totalResourceSize * 3`. DOM node and CSS rule counts always 0.

4. **`FormAutomation.fillSelectField()` always fails** (`api/FormAutomation.ts:694–700`) — Clicks `<option>` elements directly instead of setting `.value`. Catch block swallows errors.

5. **`VisualTester.screenshot()` restore bug** (`api/VisualTester.ts:190–201`) — Only restores first matching hidden element per selector. Others permanently hidden.

6. **`HARRecorder.extractSetCookies()` fragile regex** (`api/HARRecorder.ts:701`) — Split regex fails on commas inside cookie dates.

7. **`PerformanceProfiler.getNavigationTiming()` hardcoded values** (`api/PerformanceProfiler.ts:382–384`) — DNS=5ms, TCP=15ms, TLS=10ms. Completely synthetic.

8. **`parseUrl` fallback sets `hostname = url`** (`engine/storage/CookieManager.ts:336–352`) — Invalid URLs cause domain matching against full URL strings.

9. **`getRegistrableDomain` naive two-part heuristic** (`engine/storage/CookieManager.ts:312–321`) — `mail.example.co.uk` returns `co.uk` instead of `example.co.uk`.

10. **`StorageManager.import()` bypasses quota tracking** (`engine/storage/StorageManager.ts:384–401`) — Quota manager usage stays stale after import.

11. **`strokeRect` mutates `fillStyle`** (`types/dom.ts:737–748`) — Canvas shim permanently overwrites fill color when stroking a rectangle.

12. **`getImageData()` ignores x/y/width/height** (`types/dom.ts:773–779`) — Always returns full canvas buffer regardless of parameters.

13. **`requestAnimationFrame` uses `queueMicrotask`** (`types/dom.ts:835–847`) — Fires synchronously in microtask queue instead of frame-rate scheduling. Starves I/O in headless mode.

14. **`Browser.clearData()` doesn't clear localStorage** (`main.ts:244–251`) — Only clears sessionStorage.

15. **`paint` reads only `border-top-*` for all four borders** (`engine/rendering/RenderingOrchestrator.ts:395–402`) — Non-uniform borders rendered incorrectly.

16. **`parseTime` returns `new Date()` for unknown tags** (`engine/network/security/Certificate.ts:1162`) — Malformed validity fields appear valid.

17. **`RequestPipeline.request` timeout leaks `setTimeout`** (`engine/RequestPipeline.ts:169–180`) — Timer never cleared after successful request. Keeps event loop alive.

18. **`serializeNode` does not escape text content** (`engine/javascript/DOMBindings.ts:1795–1797`) — `<`, `>`, `&` in text nodes produce invalid HTML via `innerHTML`.

19. **`transformToMatrix` adds `originX` twice** (`engine/webgpu/compositor/WebGPUCompositorThread.ts:786–787`) — Incorrect rendering with non-zero transform origins.

20. **`findElementSibling` called twice per install** (`engine/javascript/DOMBindings.ts:994–1006`) — Doubles tree traversal; should use `const`.

21. **`cloneNativeNode` produces non-functional `classList`** (`engine/javascript/DOMBindings.ts:1874–1883`) — Stub `add`/`remove` that don't mutate attributes.

22. **`matches()` always returns `false`** (`engine/javascript/DOMBindings.ts:617`) — Real `matchesSelector` exists but is never wired to created/cloned elements.

23. **CSP `'none'` handling edge case** (`engine/security/ContentSecurityPolicy.ts:76–87`) — `'none'` among other sources doesn't invalidate the directive as spec requires.

24. **`document` export is minimal shim** (`types/dom.ts:825–827`) — Exports `{ createElement }` only. Missing `getElementById`, `querySelector`, `body`, etc.

25. **`DNSResolver.queryDoH` spread operator on large arrays** (`engine/network/resolution/DNSResolver.ts:226`) — `btoa(String.fromCharCode(...query))` risks stack overflow on large DNS packets.

---

### Low

1. **`DOMElement.click()` only logs to console** (`api/BrowserPage.ts:134–138`) — No DOM event dispatched.
2. **`VisualTester.decodePNGToRGBA()` uses wrong decompression** (`api/VisualTester.ts:806`) — `"deflate"` instead of zlib wrapper handling.
3. **`PDFTemplate.build()` injects `<style>` into header template** (`api/PDFGenerator.ts:478–481`) — No effect on main content.
4. **`HARPlayer.calculateThrottleDelay()` unnecessarily async** (`api/HARPlayer.ts:451`) — No `await`; adds microtask overhead.
5. **`FormAutomation.executeMultiStepForm()` uses `:contains()` selector** (`api/FormAutomation.ts:1219`) — jQuery-only pseudo-selector; not standard CSS.
6. **`navigator.userAgent` leaks "GeoProx-Browser"** (`engine/javascript/WindowObject.ts:249`) — Internal name in UA string.
7. **`BrowserConsole.log()` maps to `"info"` level** (`engine/logging/BrowserConsole.ts:27–29`) — Can't distinguish `log()` from `info()`.
8. **Duplicate event listener code for elements vs documents** (`engine/javascript/DOMBindings.ts:1029–1075, 1115–1160`) — Nearly identical implementations.
9. **`IDBTransaction.abort()` sets `FINISHED` not `ABORTED`** (`engine/storage/IDBDatabase.ts:77`) — Can't distinguish committed from aborted.
10. **`StorageManager.clear()` emits `key: ""` not `null`** (`engine/storage/StorageManager.ts:147–153`) — Spec requires `null` for clear events.
11. **`DEBUGGER` opcode logs to console unconditionally** (`engine/javascript/IgnitionInterpreter.ts:337–341`) — Should notify debugger, not stdout.
12. **`WebGPUError.ts` is effectively empty** (`engine/WebGPUError.ts`) — One line, no exports.
13. **`deno.json` disables `noUnusedLocals`/`noUnusedParameters` and lint `no-unused-vars`** (`deno.json:11–12,26`) — All dead code detection disabled simultaneously.
14. **Magic hex cipher suite values without named constants** (`engine/network/connection/ConnectionPool.ts:384–399`) — `CipherSuite` enum exists but isn't used.
15. **`loadSystemCAs` logs success to `console.error`** (`engine/network/security/Certificate.ts:583`) — Info message on stderr.
16. **`parseDERCertificate` is 400+ lines with no helpers** (`engine/network/security/Certificate.ts:652–961`) — Difficult to test individual parsing stages.
17. **`FileSystem.readDir()` discards entry type metadata** (`os/filesystem/FileSystem.ts:125–131`) — Returns only names, not `isFile`/`isDirectory`.
18. **`GraphicsContext.renderBitmapChar()` renders all chars as identical blocks** (`os/graphics/GraphicsContext.ts:395–443`) — Text is indistinguishable per-character.
19. **`Window.open()` fragile pixpane detection** (`os/window/Window.ts:52–60`) — Any `globalThis.pixpane` object triggers non-headless mode.
20. **`Browser` constructor logs full config unconditionally** (`main.ts:67–73`) — Noisy in tests and library consumers.
21. **`deno.json` test glob includes `src/**/*_test.ts`** (`deno.json:47`) — No such files exist in `src/`.

---

## Strengths

1. **Robust SSRF protection** — `URLValidator` covers all IPv4/IPv6 private ranges, non-HTTP protocols, and dangerous data URIs. Allowlist bypass is clearly scoped and off by default.

2. **Complete CSP implementation** — Handles `'self'`, wildcard subdomains, scheme sources, nonces, hashes, `'unsafe-eval'`, and report-only mode with full violation context.

3. **Inline cache for property access** — `GET_PROPERTY` uses `WeakRef`-based monomorphic IC, correctly skips getter results, invalidates on writes, and is keyed by bytecode offset.

4. **Observable pipeline architecture** — `PipelineObserver`/`emitStage` provides consistent external observability across rendering and request pipelines, directly powering the doc-site visualizer.

5. **Graceful headless degradation** — Every GPU-adjacent class (`GPU`, `Window`, `GraphicsContext`, `RenderingPipeline`) has explicit headless fallback with `isHeadless()`. Never throws in headless mode.

6. **Full PNG decoder from scratch** — `VisualTester` implements complete chunk parsing, all 5 filter types, and 6 color type conversions to RGBA without native dependencies.

7. **Complete X.509 DER parser with OCSP** — Full DER parsing, SAN extraction, AIA/OCSP, ECDSA signature conversion. Substantial cryptographic plumbing.

8. **HTTP desync protection** — `doRequest` rejects multiple `Content-Length` headers as potential desync attacks. Non-obvious security threat that many implementations miss.

9. **Cryptographically secure random values** — `generateISN()` and `buildQuery()` use `crypto.getRandomValues()`, preventing sequence number and DNS query ID prediction.

10. **Promise-based connection pool waiters** — No busy-polling. Waiters correctly removed on timeout and notified on release.

11. **Comprehensive test structure** — Test directories mirror source structure precisely. Dedicated test files for Certificate, DNS, ConnectionPool, TCP, FileSystem, GPU, GraphicsContext, and all 14 DevTools domains.

12. **Strong type safety** — Strict TypeScript config enabled. Branded type identifiers prevent mixing semantically different IDs. Discriminated unions for credentials with exhaustive switches.

13. **Well-documented public API** — `Browser` accessors have complete JSDoc with `@returns`, `@example`, and descriptions.

14. **AbortSignal cancellation on all async ops** — Every async method on `BrowserPage` accepts `signal?: AbortSignal` and checks it before and after operations.

15. **Robust headless software renderer** — Implements alpha blending, Bresenham lines, scanline polygon fill, affine transforms, clip bounds, and save/restore state stack.

---

## Recommendations

### Immediate (Critical fixes)

1. **Fix JS engine timer callbacks** — Wire the stored callback `JSValue` into the native timer's fire function in `WindowObject.ts`
2. **Implement string concatenation in ADD** — Check operand types before defaulting to numeric addition in `IgnitionInterpreter.ts`
3. **Parse HTML in innerHTML setter** — Invoke the HTML tokenizer/tree builder for fragment parsing in `DOMBindings.ts`
4. **Fix TCP architectural mismatch** — Either use raw sockets (if available) or remove the TCP header parsing layer that operates on application-layer data
5. **Implement real OAuth2 token exchange** — Replace fake tokens with actual `fetch` calls to token URLs

### Short-term (High-priority)

6. **Add `dispose()`/`Symbol.dispose` to all timer-owning classes** — `DNSCache`, `CookieManager`, `V8Isolate`, `ConnectionPool` all leak intervals
7. **Implement Public Suffix List** — Replace the 8-entry hardcoded list to prevent supercookie attacks
8. **Fix `isTopLevelNavigation`** — Implement proper navigation detection for SameSite cookie enforcement
9. **Release connections on error paths** — Add `finally` block in `doRequest` to release pool connections
10. **Enable JavaScript by default** in `BrowserEngine` config
11. **Rename "GeoProx-Browser" to "BrowserX"** across all user-agent strings and startup messages

### Medium-term

12. **Consolidate duplicate type definitions** — Merge `HTMLCanvasElement`, `CanvasRenderingContext2D`, `LayerID`, `Blob` into single authoritative definitions
13. **Make DOM tree navigation live** — Use getters instead of static property copies
14. **Implement complex CSS selectors** — At minimum compound selectors and attribute selectors for framework compatibility
15. **Wire `GPU.composite()` draw calls** — Connect the layer iteration loop to actual render pipeline draw commands
16. **Add certificate public key comparison** — Root validation should check key material, not just subject strings
