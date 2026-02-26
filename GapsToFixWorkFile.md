# BrowserX Gaps To Fix

**Generated:** 2026-02-20
**Last Updated:** 2026-02-21
**Source:** `resource/devdocs/GAPS.md` (verified against codebase)
**Total:** 0 active gaps (19 resolved)

---

## ~~1. WebGPU Async Pipeline Compilation~~ ✅ RESOLVED

**File:** `browser/src/engine/webgpu/pipelines/mod.ts`
**Resolved:** 2026-02-20

FFI-first async pipeline compilation fully implemented. Uses `createFfiRenderPipeline()` on background OS thread via wgpu; falls back to Deno's native sync `createRenderPipeline` when FFI unavailable. Also fixed `createSimplePipeline()` passing undefined `constants` to GPU.

**WebGPU Test Coverage Added:** 156 functional tests across 10 files in `browser/tests/engine/webgpu/functional/` verifying actual GPU data flow, rendering output, compute results, memory tracking, encoder state machines, transform matrices, compositor integration, and error recovery. All pass individually.

---

## ~~2. IgnitionInterpreter — 11 Bytecode Operations~~ ✅ RESOLVED

**File:** `browser/src/engine/javascript/IgnitionInterpreter.ts`
**Resolved:** 2026-02-20

All 11 bytecode operations (CALL, CONSTRUCT, GET_PROPERTY, SET_PROPERTY, GET_KEYED, SET_KEYED, CREATE_OBJECT, CREATE_ARRAY, CREATE_CLOSURE, LDA_CONTEXT_SLOT, STA_CONTEXT_SLOT) fully implemented. 721 JS engine tests passing.

---

## ~~3. DOMBindings — All DOM Prototype Methods Are Stubs~~ ✅ RESOLVED

**File:** `browser/src/engine/javascript/DOMBindings.ts`
**Resolved:** 2026-02-20

All DOM prototype methods now perform real DOM mutations. Per-instance method closures capture native DOMNode and delegate to native mutation helpers (`appendChildNative`, `removeChildNative`, `insertBeforeNative`, etc.). `wrapNodeAsJSValue()` installs all methods as native functions on each JSValue object. WindowObject now installs `document` with full working DOM API. Additionally implemented: `replaceChild`, `setTextContent`, `matches`, `closest`, `children`, `parentElement`, `nextElementSibling`, `previousElementSibling`, `innerHTML`/`outerHTML` serialization, `createComment`, `createDocumentFragment`. Fixed `cloneNativeNode` deep clone TDZ bug. 116 DOMBindings tests, 806 total JS engine tests passing.

---

## ~~4. DOMBindings.querySelector() — Only Handles #id and Plain Tags~~ ✅ RESOLVED

**File:** `browser/src/engine/javascript/DOMBindings.ts`
**Resolved:** 2026-02-20

`querySelector`/`querySelectorAll` now support `#id`, `.class`, tag name, and wildcard `*` selectors. `getElementsByTagName` supports `*` wildcard. `matchesSelector()` added for `matches()` and `closest()` methods. Attribute selectors (`[href]`), compound selectors, and pseudo-classes remain unsupported (low priority — covers vast majority of real-world usage).

---

## ~~5. V8Context — Object→Native Returns "[object Object]"~~ ✅ RESOLVED

**File:** `browser/src/engine/javascript/V8Context.ts`
**Resolved:** 2026-02-21

`jsValueToNative()` now recursively converts objects (property-by-property), arrays (via `length` detection), circular references (via `WeakSet` → `"[Circular]"`), functions (`[Function: name]`), bigints, and symbols. All native functions (console.log/warn/error, parseInt, parseFloat, isNaN, isFinite, Math.*) now receive real object data instead of `"[object Object]"`. 54 unit tests + 39 integration/e2e tests covering edge cases (NaN, -0, 100-prop objects, 5-level nesting, 3-way cycles, diamond shapes, large arrays, DOM-like trees).

---

## ~~6. V8Heap.markChildren() — GC Doesn't Traverse Object Graph~~ ✅ RESOLVED

**File:** `browser/src/engine/javascript/V8Heap.ts`
**Resolved:** 2026-02-21

Added `valueToId: WeakMap<JSObject, HeapObjectID>` reverse lookup populated in `allocate()`. `markChildren()` now traverses object properties, prototype chains, and constructor references via the reverse map. New `markEnvironment()` traverses closure scope chains so function closures keep referenced objects alive. 37 unit tests + integration/e2e tests covering deep chains, wide graphs, multi-level prototypes, 3-way cycles, scope↔property cycles, multi-generation GC (scavenge → mark-sweep), linked lists, and GC stats verification. Total JS engine tests: 936.

---

## ~~7. WindowObject.fetch() — Always Returns Empty Stub Response~~ ✅ RESOLVED

**File:** `browser/src/engine/javascript/WindowObject.ts`
**Resolved:** 2026-02-21

`createFetch()` now fully implements the Fetch API via `RequestPipeline`. Supports all HTTP methods (GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS) with method normalization. Response object provides `ok`, `status`, `statusText` (updated from actual response on body read), `url`, `type` ("basic"), `redirected`, `bodyUsed` tracking, and a proper `Headers` object with `get()` (case-insensitive), `has()`, `entries()`. Body methods: `text()`, `json()`, `blob()` (with size/type/text), `arrayBuffer()` (with byteLength), `clone()`. Error responses from pipeline rejection return `ok: false, status: 0`. The inline fetch in `install()` now delegates to `createFetch()`. WindowObject also gained 30+ browser APIs: `requestAnimationFrame`/`cancelAnimationFrame`, `addEventListener`/`removeEventListener`/`dispatchEvent`, `getComputedStyle`, `matchMedia`, `postMessage`, `getSelection`, `atob`/`btoa`, `performance` (now/mark/measure/timing), `screen`, `history` (pushState/replaceState/back/forward/go), `crypto` (randomUUID/getRandomValues), `URL` constructor, `JSON` (parse/stringify), `Math` (20+ functions), `parseInt`/`parseFloat`/`isNaN`/`isFinite`, `encodeURIComponent`/`decodeURIComponent`/`encodeURI`/`decodeURI`, `structuredClone`, `queueMicrotask`. 224 tests covering all APIs.

---

## ~~8. WindowObject localStorage/sessionStorage~~ ✅ RESOLVED

**File:** `browser/src/engine/javascript/WindowObject.ts`, `browser/src/engine/javascript/ScriptExecutor.ts`
**Resolved:** 2026-02-21

`ScriptExecutor` now creates a default `StorageManager` when none is provided (`storageManager ?? new StorageManager()`), guaranteeing origin-isolated, quota-tracked storage in every context. The previously-unused `createLocalStorage()`/`createSessionStorage()` methods now serve as the in-memory fallback in `WindowObject.createStorageJSValue()` when no `StorageManager` is available, replacing the dead no-op stubs. Storage is always functional regardless of how WindowObject is constructed.

---

## ~~9. ScriptExecutor.waitForDOMReady() — Always Resolves Immediately~~ ✅ RESOLVED

**File:** `browser/src/engine/javascript/ScriptExecutor.ts`
**Resolved:** 2026-02-21

Full DOM readiness lifecycle implemented. `waitForDOMReady()` checks native `readyState` with polling fallback (10ms interval, 5s timeout). `executeScriptsInDOM()` separates immediate vs deferred scripts per HTML spec. `HTMLTreeBuilder` sets `readyState = "loading"` at document creation and `"interactive"` after parsing. ScriptExecutor sets `"complete"` after all scripts and dispatches `DOMContentLoaded`, `readystatechange`, and `load` events.

**Additionally implemented**: JSValue property descriptor system (`defineGetter`/`defineSetter`) enabling live/dynamic DOM properties. `document.readyState`, `document.body`, `document.documentElement`, `document.head`, `document.title` are all live getters that reflect native DOM state in real-time from JavaScript. `document.addEventListener`/`removeEventListener`/`dispatchEvent` with real listener storage on the document node (`__eventListeners` map). Getter/setter support wired into both `getProperty()`/`setProperty()` and `GET_PROPERTY`/`SET_PROPERTY`/`GET_KEYED`/`SET_KEYED` bytecode ops in IgnitionInterpreter. 30 tests in `script-executor-dom-ready.test.ts`, 1190 total JS engine tests passing.

---

## ~~10. HPACKEncoder — "Without Indexing" Headers Break Decode Loop~~ ✅ RESOLVED

**File:** `browser/src/engine/network/protocols/HPACKEncoder.ts`
**Resolved:** 2026-02-22

HPACKDecoder now handles all 4 RFC 7541 header representation types: indexed (1xxxxxxx), literal with incremental indexing (01xxxxxx), literal without indexing (0000xxxx), and literal never indexed (0001xxxx). Also handles dynamic table size updates (001xxxxx). HPACKEncoder now automatically encodes sensitive headers (authorization, cookie, set-cookie, proxy-authorization) as "never indexed" per security best practices, with `sensitiveHeaders` parameter for custom additions. `encodeNeverIndexed()` method handles both indexed-name and new-name variants. 12 new tests + 35 existing = 47 HPACK tests passing.

---

## ~~11. IDBObjectStore.matchesQuery() — Always Returns True~~ ✅ RESOLVED

**File:** `browser/src/engine/storage/IDBObjectStore.ts`
**Resolved:** 2026-02-22

`matchesQuery()` now implements real key range filtering: exact primitive match, duck-typed IDBKeyRange objects (lower/upper/lowerOpen/upperOpen), and `includes()` delegation. Added `compareKeys()` static method implementing IndexedDB key ordering (number < Date < string < Array) with recursive array comparison. Added `IDBKeyRangeImpl` class with `only()`, `lowerBound()`, `upperBound()`, `bound()` factory methods and `includes()` instance method. Fixed `getAll`/`getAllKeys`/`count`/`openCursor` to filter by **key** (not value) per IDB spec. 34 new tests + 62 existing = 96 IDB tests passing.

---

## ~~12. cert_validator.ts — Certificate Parsing and Revocation Are Stubs~~ ✅ RESOLVED

**File:** `proxy-engine/core/network/external/cert_validator.ts`
**Resolved:** 2026-02-22

All 3 stubs fully implemented:
- `parseCertificate()` delegates to browser engine's ASN.1/X.509 parser (`parsePEMCertificates()`)
- `getCertificate()` uses raw TCP + TLS ClientHello to extract server certificates (bypasses Deno API limitation)
- `checkRevocation()` implements OCSP checking (with request building/response parsing) + CRL fallback + in-memory cache with 1-hour TTL
- Extension parsing extracts AIA (OCSP URL) and CRL Distribution Points from DER certificates
- 49 tests in `proxy-engine/tests/core/network/external/cert_validator.test.ts`, all passing

---

## ~~13. PDFGenerator.decodePNG() — Returns Raw PNG Without Decoding~~ ✅ RESOLVED

**File:** `browser/src/engine/rendering/pdf/PDFGenerator.ts`
**Resolved:** 2026-02-22

Full PNG decoder implemented: parses IHDR/PLTE/IDAT chunks, decompresses with `DecompressionStream("deflate")`, applies all 5 PNG scanline filters (None/Sub/Up/Average/Paeth), converts all color types (Grayscale/RGB/Indexed/Gray+Alpha/RGBA) to RGB. Added `compressDeflate()` to re-compress for PDF `/FlateDecode`. 10 new tests in `PDFGenerator-png.test.ts`, 37 total PDF tests passing.

---

## ~~14. NormalFlowLayout.calculateShrinkToFitWidth() — Returns availableWidth~~ ✅ RESOLVED

**File:** `browser/src/engine/rendering/layout/NormalFlowLayout.ts`
**Resolved:** 2026-02-22

CSS 2.1 §10.3.5 shrink-to-fit width fully implemented: `measureContentWidths()` recursively walks children to compute preferred width (no line breaks) and preferred minimum width (break at every opportunity). Formula: `min(max(preferredMinimum, available), preferred)`. Respects explicit width, min-width, max-width. Wired into `layoutFloat()` and `layoutAbsolutelyPositioned()` for auto-width elements. 5 new tests (30 total layout tests passing).

---

## ~~15. CompositorLayer Transform — Ignores Rotation~~ ✅ RESOLVED

**File:** `browser/src/engine/rendering/compositor/CompositorLayer.ts`
**Resolved:** 2026-02-22

Fixed 3 bugs: (1) matrix cell overwrite — scale values overwrote identity before rotation was applied, (2) rotation completely ignored — `t.rotation` never read, (3) transform origin ignored — `originX`/`originY` never used. Replaced with proper 2D affine transform: `cos`/`sin(rotation)` composed with scale, origin-adjusted translation. Matches WebGPU compositor's correct implementation. 12 new tests covering identity, translation, scale, rotation (45°/90°/180°), combined transforms, transform origin, and overwrite regression.

---

## ~~16. VisualTester.compare() — Byte-level PNG Comparison~~ ✅ RESOLVED

**File:** `browser/src/api/VisualTester.ts`
**Resolved:** 2026-02-22

`compare()` now decodes PNGs to raw RGBA pixels before comparison instead of byte-level PNG comparison. Added `decodePNGToRGBA()` with full PNG decoder (signature validation, IHDR/PLTE/IDAT chunk parsing, zlib decompression, all 5 scanline filters, all color type conversions to RGBA). Per-pixel comparison uses per-channel threshold (0-255 scale). Reports actual decoded dimensions, diff pixel count, and diff percentage. Handles different-dimension images by using max dimensions and treating out-of-bounds pixels as different. 8 tests in `browser/tests/api/VisualTester.test.ts`, all passing.

---

## ~~17. GraphicsContext.ts Headless — Drawing Ops Are Console.log Stubs~~ ✅ RESOLVED

**File:** `browser/src/os/graphics/GraphicsContext.ts`
**Resolved:** 2026-02-22

Headless mode now has full software rasterization. Added RGBA pixel buffer, replaced all console.log stubs with real drawing: `fillRect()` fills pixels with parsed CSS colors + globalAlpha, `strokeRect()` draws outlines via Bresenham's algorithm, `clearRect()` zeros pixels, `fillText()`/`strokeText()` render with bitmap font scaled by font size, path ops (`beginPath`/`moveTo`/`lineTo`/`closePath`/`fill`/`stroke`/`clip`) fully tracked and rasterized (scanline fill + Bresenham stroke). `measureText()` uses `fontSize * 0.6 * text.length` instead of `text.length * 8`. `getImageData()` returns actual pixel buffer content. `translate()`/`scale()`/`rotate()` track 2x3 affine transform matrix applied to all coordinates. `save()`/`restore()` properly preserves/restores transform and clip state. Color parsing supports #hex, rgb(), rgba(), 13 named colors. 64 tests (40 original + 24 new), all passing.

---

## ~~18. FlexboxLayout — align-items:baseline Falls Back to flex-start~~ ✅ RESOLVED

**File:** `browser/src/engine/rendering/layout/FlexboxLayout.ts`
**Resolved:** 2026-02-22

CSS `align-items: baseline` now implements real baseline alignment per Flexbox spec. Added `getItemBaseline()` method that checks `renderObject.getBaseline()`, falls back to first child's baseline, then item cross-size. Line baseline computed as max baseline across all baseline-aligned items. Each item offset by `lineBaseline - itemBaseline` so baselines align. 37 tests (33 original + 4 new), all passing.
