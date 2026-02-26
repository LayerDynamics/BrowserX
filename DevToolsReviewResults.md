# Code Review: BrowserX DevTools

### Summary

The DevTools module implements a well-structured CDP-compatible protocol layer with 14 domain agents, WebSocket server, programmatic client, and EventBus integration. The `BaseDomain` contract is consistently followed across nearly all domains and the layered architecture (protocol → domains → server → client → integration) has clean dependency direction. However, there are critical issues around non-functional JS evaluation, an HTML serialization XSS vector, event lifecycle violations, and resource leaks from unregistered EventBus listeners.

---

### Findings

#### Critical

- **`evaluate()` always returns `undefined` — JS evaluation is non-functional** (`runtime-domain.ts:319-323`) — The fallback path when `scriptExecutor` cannot be located (the lookup chains through `getStats()` → `lastRenderResult` → `scriptExecutor`, a fragile indirect path that almost never yields a result) unconditionally sets `value = undefined` and returns it as a successful result. No error thrown, no `exceptionDetails`. Every `Runtime.evaluate` call silently returns `{ result: { type: "undefined" } }`. The `renderingPipeline.lastRenderResult` should be accessed directly (as `DebuggerDomain` does at line 276), not via `getStats()`.

- **`getElementByNodeId()` uses a synchronous EventBus callback that never resolves** (`css-domain.ts:124-138`) — The method emits `dom:getNode` on the EventBus and captures the result via a synchronous callback. The DOM domain never registers a handler for `dom:getNode`, so `element` is always `null`. This means `getComputedStyleForNode` and `getMatchedStylesForNode` always return empty results silently. The CSS domain should receive a direct reference to the DOM domain or look up nodes through `this.context.renderingPipeline.lastRenderResult`.

- **`serializeToHTML()` does not escape attribute values — stored XSS vector** (`dom-domain.ts:192-196`) — The HTML serializer builds attribute markup with `` `${key}="${value}"` `` without escaping `"`, `<`, or `>` in values. A DOM attribute containing `"` will produce malformed HTML or inject new attributes/tags. Since `getOuterHTML` returns this string to DevTools clients who may render it, attribute values must be HTML-entity-encoded.

- **`PageDomain.navigate` emits events without `enabled` guard** (`page-domain.ts:87-124`) — `emitEvent` is invoked unconditionally for `frameStartedLoading` and all subsequent lifecycle events, even when the domain is disabled. All other domains guard emits with `if (this.enabled)`. CDP clients that haven't called `Page.enable` will receive spurious events.

- **`OverlayDomain` EventBus listeners registered in `setup()` are never unregistered** (`overlay-domain.ts:114-127`) — Two `eventBus.on(...)` calls for `DOM.nodeSelected` and `DOM.documentUpdated` in `setup()` have no corresponding `eventBus.off(...)` in `disable()` or `dispose()`. After disposal, listeners continue firing against a disposed domain, potentially crashing on null context.

#### High

- **WebSocket `Upgrade` header not validated before upgrade** (`devtools-server.ts:104-135`) — `handleWebSocketUpgrade` calls `Deno.upgradeWebSocket(request)` without checking `Upgrade: websocket` header first. A plain HTTP GET to `/devtools/page/*` causes an unhandled exception. Guard with `request.headers.get("upgrade")?.toLowerCase() === "websocket"` and return `426 Upgrade Required` otherwise.

- **`targetId` extracted from URL path without validation** (`devtools-server.ts:131-132`) — `pathParts[pathParts.length - 1]` is taken as-is from the URL. A path like `/devtools/page/../../etc` produces `targetId = ".."` which is output to log lines unescaped — a terminal log-injection vector. Validate that `targetId` matches `[A-Za-z0-9_-]+`.

- **`ConsoleDomain` EventBus listeners never removed in `dispose()`** (`console-domain.ts:36-87`) — `eventBus.on()` handlers for `Runtime.consoleAPICalled` and `Runtime.exceptionThrown` are registered in `setup()` but never removed. The domain instance is kept alive after disposal and handlers continue firing. `dispose()` must call `eventBus.off(...)` for each listener.

- **`setBreakpointByUrl()` overwrites map entry on each matching script** (`debugger-domain.ts:224`) — Inside the loop over `matchingScripts`, each iteration calls `this.breakpoints.set(breakpointId, entry)` with the same key. Only the last script's breakpoint survives. Should store a list value per ID or generate separate IDs.

- **Shared `DomainRegistry` across sessions** (`devtools-server.ts:143-148`, `session.ts:33-37`) — Every WebSocket connection creates a `DevToolsSession` with the same shared `registry`. When session A calls `DOM.enable`, it enables the domain for session B too. When session A closes, `session.dispose()` disposes the shared registry, tearing down domains for all clients. Each session needs its own domain instances.

- **Silent swallow of event handler errors in client** (`devtools-client.ts:415`) — The client's `handleMessage` catches handler exceptions with an empty `catch {}` block. User-supplied `on()` callbacks that throw are silently discarded with no logging. At minimum `console.error` the error.

- **`disconnect()` overwrites `onclose` set during `connect()`** (`devtools-client.ts:307`) — `disconnect()` assigns `socket.onclose = () => resolve()` unconditionally. If `connect()` is still active, the connection-tracking `onclose` is replaced, leaving `this.connected` stale. Use `addEventListener`/`removeEventListener` instead.

- **Synthetic certificate data fabricated without real TLS introspection** (`security-domain.ts:182-197`) — `getCertificate` constructs `CertificateInfo` with hardcoded values (`issuer: "Unknown CA"`, `serialNumber: "00"`). DevTools clients relying on this for security decisions receive silently fabricated data. Return `null` or clearly mark as unavailable.

- **`PerformanceDomain.metricsInterval` leaks on double `enable()`** (`performance-domain.ts:83`) — Calling `enable()` twice starts a second `setInterval` while losing the first handle. `MemoryDomain` has a guard (`if (this.sampling)`) but `PerformanceDomain` does not.

- **JSHeap metrics are fabricated multipliers** (`performance-domain.ts:165-166`) — `JSHeapUsedSize = totalResourceSize * 3`, `JSHeapTotalSize = totalResourceSize * 5`. Not marked as estimates in the payload. Misleading for memory leak detection. Same pattern in `MemoryDomain.buildHeapStatistics`.

- **`SecurityDomain.reportCertificateError` emits contradictory state** (`security-domain.ts:326`) — Sets state to `"insecure"` but hardcodes `schemeIsCryptographic: true`. A client checking the flag to show a padlock icon would show it on a broken HTTPS connection.

- **`clearStorage()` clears both storage types regardless of which was requested** (`storage-domain.ts:255-258`) — Both `local_storage` and `session_storage` cases call the same `clearOrigin` with identical arguments.

- **`DOMDomain.setAttributeValue()` and `removeAttribute()` emit events without `enabled` guard** (`dom-domain.ts:327, 341`) — These two methods call `emitEvent()` unconditionally, unlike all other domain methods.

- **`RuntimeDomain.evaluate()` ignores `returnByValue`, `awaitPromise`, `timeout`** (`runtime-types.ts:106-111`) — These CDP-standard params are declared but not used. `awaitPromise: true` is a critical CDP usage pattern.

#### Medium

- **`DomainRegistry` throws plain objects, not `Error` instances** (`domains.ts:63-74`) — Throws `{ code, message }` rather than `Error` subclasses. Breaks `instanceof Error` checks and loses stack traces.

- **`BrowserDevTools.dispose()` disposes registry twice** (`browser-devtools.ts:226-240`) — `server.stop()` already disposes via sessions, then `this.registry.dispose()` is called again. Safe by accident but latent bug if any domain dispose becomes non-idempotent.

- **`attachDevTools` maps constructors to metadata by array index** (`browser-devtools.ts:286-311`) — Positional coupling means reordering either array silently associates wrong metadata. Key by `DomainName` string instead.

- **Message size not bounded in `handleMessage`** (`connection.ts:84`) — No size limit before `JSON.parse`. A multi-MB JSON payload blocks the event loop. Add a length guard (e.g., 1 MB).

- **`PageDomain.captureScreenshot` ignores all `ScreenshotParams`** (`page-domain.ts:180`) — `format`, `quality`, and `clip` are declared but ignored. Always returns full uncompressed PNG.

- **`collectStyleSheets()` resets `styleSheetCounter` to 0 on every call** (`css-domain.ts:87`) — Previously returned `StyleSheetID`s are invalidated silently.

- **`DebuggerDomain.serializeValue()` generates non-stable `objectId`s** (`debugger-domain.ts:728-741`) — Uses `Date.now()` for IDs, never stores them. `getProperties` always returns `[]`.

- **`dom-graph.ts` accesses `node.childNodes` without null-guard** (`dom-graph.ts:39`) — Will throw if `childNodes` is undefined. The DOM domain itself guards this.

- **`NetworkDomain.trackFailure()` reads `Date.now()` twice** (`network-domain.ts:183-197`) — `endTime` and emitted `timestamp` can disagree by a millisecond. Capture once in a `const now`.

- **`PerformanceDomain.startProfiling` stores `_samplingInterval` but never uses it** (`performance-domain.ts:214`) — No periodic sampling occurs despite the parameter.

- **`MemoryDomain.takeHeapSnapshot` `reportProgress` branch is empty** (`memory-domain.ts:398-401`) — Clients setting `reportProgress: true` expecting `reportHeapSnapshotProgress` events will hang.

- **`LayoutTreeNode` IDs are synthetic and disconnected from DOM node IDs** (`rendering-domain.ts:334`) — Computed as `nodeId * 1000 + index + 1`, preventing standard CDP DOM-layout correlation.

- **`RenderingDomain.extractTimingInfo` duplicates `styleResolution` for `renderTreeBuild`** (`rendering-domain.ts:401`) — Same value for both fields misrepresents the timing breakdown.

- **`SecurityDomain.getCertificate` ignores the `origin` parameter** (`security-domain.ts:170-171`) — Always returns the cached main-page certificate regardless of requested origin.

- **Search result cache in `DOMDomain` grows unbounded** (`dom-domain.ts:46`) — `searchResults` map only cleared in `dispose()`. No `discardSearchResults` method, no TTL.

- **`RuntimeDomain.getProperties()` ignores `ownProperties` and `accessorPropertiesOnly`** (`runtime-domain.ts:343-366`) — Always uses `Object.keys()` regardless of params.

- **`EmulationDomain` methods are all `async` but none await anything** (`emulation-domain.ts:164-395`) — Every call allocates an unnecessary Promise.

#### Low

- **`connectionCounter` overflow / ID collision** (`devtools-server.ts:45`) — Unbounded integer counter. Theoretical but UUID would be safer and remove sequential-ID information leak.

- **`DomainAccessor` instances created on every property access** (`devtools-client.ts:332-371`) — `client.dom`, `client.network`, etc. create new objects each time. Should be lazily cached.

- **`isRequest` type guard is ambiguous** (`types.ts:112-114`) — Relies on absence of `method` in responses, which is fragile for future extensions.

- **`TargetInfo.title` set to URL instead of page title** (`session.ts:65-70`) — Should read document title when available.

- **Hardcoded `"V8-Version": "0.0.0"` in `/json/version`** (`devtools-server.ts:249-250`) — May disable DevTools front-end features.

- **`BaseDomain.context` uses `!` assertion without initialization guard** (`base-domain.ts:50`) — Access before `initialize()` gives cryptic error instead of clear "not initialized" message.

- **Unused `startTime` in `PageDomain.navigate`** (`page-domain.ts:89`) — Assigned but never read.

- **Unused `params` in registered method lambdas across multiple domains** — Should use `_params` or `()`.

- **`dom-graph.ts` uses 2-space indentation** while all domain files use 4-space. `deno task fmt` would normalize.

- **`MemoryDomain.samplingData` not cleared between `startSampling` calls** — Profile may mix data from separate sessions.

---

### Strengths

- **Clean layered architecture** — Protocol types → domain registry → router → server → connection → integration. Each file has a single responsibility. No circular imports. Dependency graph flows in one direction.

- **Consistent `BaseDomain` contract** — All 14 domains correctly call `super.enable()` / `super.disable()` / `super.dispose()`, use `registerMethod()` and `registerEvent()` exclusively in `setup()`. The pattern is well understood and consistently applied.

- **Thorough input validation in `Router.parseMessage`** (`router.ts:65-127`) — Every field individually validated with type checks and meaningful error messages before trust.

- **Event listener lifecycle in `DevToolsConnection`** (`connection.ts:160-181`) — `subscribedDomains` set tracks registrations, cleanup iterates with correct function identity for removal.

- **`EventBus.emit` isolates handler exceptions** (`event-bus.ts:46-53`) — Each handler in try/catch so a throwing handler doesn't prevent subsequent handlers. Error is logged, not swallowed.

- **Default host binding to `127.0.0.1`** (`devtools-server.ts:54`) — Correct security posture for a debugging server; prevents inadvertent network exposure.

- **`RuntimeDomain` value serialization** — `serializeValue()` correctly handles all JS primitives, `NaN`/`Infinity`, `Date`, `RegExp`, `Map`, `Set`, `Promise`, `Error`, `bigint`. Array preview clips at 5 entries with `overflow` flag, matching CDP spec.

- **`ConsoleDomain` cross-domain decoupling** — Subscribes to `Runtime.consoleAPICalled` via EventBus rather than direct domain reference. Message buffer with 1000-entry cap and trim-from-front eviction.

- **`StorageDomain` cookie deduplication** (`storage-domain.ts:82-91`) — Uses composite `name:domain:path` key to deduplicate across multiple URLs per CDP spec.

- **`OverlayDomain` box-model quad math** — Four compute methods correctly layer the CSS box model using the eight-point clockwise quad convention. Chrome-matched default highlight colors.

- **`SecurityDomain` state machine** — Correctly degrades HTTPS to `insecure` on active mixed content and `neutral` on passive mixed content. Clean integration hooks for browser engine updates.

- **Comprehensive type files** — Every interface has JSDoc with units, optionality rationale, and example values. `*Params` / `*Result` separation keeps domain implementations clean.

- **Typed domain clients with full method signatures** (`domain-clients.ts`) — All 14 clients carry strongly-typed signatures. `createDomainClients` factory gives consumers a single structured object.

- **`dom-graph.ts` clean separation** — Pure function over `DOMNode` with no coupling to the domain class. Independently testable GraphX integration.

---

### Recommendations

1. **Fix `Runtime.evaluate` to access `scriptExecutor` directly** — This is the highest-impact fix; JS evaluation being non-functional makes the entire Runtime domain unusable for its primary purpose.

2. **Fix CSS→DOM node lookup** — Replace the EventBus callback pattern with a direct reference or shared node map so `getComputedStyleForNode` actually works.

3. **Escape HTML attribute values in `serializeToHTML()`** — Security fix, straightforward to implement.

4. **Add `enabled` guards to all `emitEvent` calls** in `PageDomain.navigate`, `DOMDomain.setAttributeValue`, and `DOMDomain.removeAttribute`.

5. **Unregister EventBus listeners in `dispose()`** for `ConsoleDomain` and `OverlayDomain` — store handler references at setup time.

6. **Create per-session `DomainRegistry` instances** — The shared registry is the most architecturally significant issue; it makes multi-client debugging fundamentally broken.

7. **Validate WebSocket upgrade requests** and sanitize `targetId` from URL paths.

8. **Guard `PerformanceDomain.enable()` against double-start** of the metrics interval.

9. **Replace fabricated metrics** (JSHeap, certificates) with either real data or clearly-marked unavailable responses.

10. **Add message size bounds** in `DevToolsConnection.handleMessage`.
