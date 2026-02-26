# Code Review: BrowserX Doc Site

## Summary

The doc-site is a well-architected Astro + Starlight documentation site with an ambitious interactive playground (React/Zustand/Monaco) and pipeline visualizer. The design token system and Starlight theme integration are excellent. However, the playground has several critical issues: duplicate API calls on every execution, XSS in HTML export, fake cancellation, IP-spoofable rate limiting, and a non-functional screenshot feature. The API endpoints need hardening around input validation and error disclosure.

## Findings

### Critical

- **Duplicate fetch in `handleExecute`** (`src/components/playground/Playground.tsx:77-128`) — `handleExecute` makes its own `fetch('/api/execute')` call, processes the response, then unconditionally calls `await executeQuery(currentQuery)` which makes a second identical fetch. This doubles network traffic on every run and adds duplicate history entries.

- **XSS in HTML export** (`src/components/playground/Playground.tsx:186`) — Column names and cell values from query results are interpolated directly into HTML via string concatenation without escaping. If data contains `<script>` tags or event handlers, the downloaded `.html` file will execute arbitrary JavaScript.

- **IP spoofing bypasses rate limiter** (`src/pages/api/execute.ts:85-88`) — `getClientIp` blindly trusts `X-Forwarded-For` header, which is fully attacker-controlled. Any caller can spoof a fresh IP and bypass the token-bucket rate limiter entirely.

- **`cancelExecution` is fake** (`src/components/playground/store.ts:411-427`, `Playground.tsx:153-157`) — Cancel sets status to `'cancelling'` then clears after 100ms, but no `AbortController` is wired. The fetch continues running and results still arrive.

- **Internal error messages leaked to callers** (`src/pages/api/execute.ts:391-393`, `validate.ts:238`) — Both endpoints forward `error.message` verbatim to HTTP responses, potentially exposing implementation details.

- **`addScreenshot` uses a `data:text/plain` placeholder** (`src/components/playground/Playground.tsx:125`) — A hardcoded plain-text base64 stub is stored instead of real screenshot data from the API response. The screenshot tab always shows a corrupted image.

- **Dropdown keyboard trap** (`src/components/playground/ControlBar.css:116`) — Export dropdown is revealed via CSS `:hover` only. Keyboard users cannot access it. The React state (`showExportMenu`) already handles show/hide correctly; the CSS `:hover` rule conflicts and should be removed.

### High

- **No query length limit** (`src/pages/api/execute.ts:182`, `validate.ts:148`) — `validateRequestBody` imposes no max length on query strings. A caller can send megabytes of text through regex matching and character iteration.

- **Screenshot data rendered without validation** (`src/components/playground/BrowserPreview.tsx:124-129`) — `latestScreenshot.data` is set directly as `<img src>` without validating it starts with `data:image/*`.

- **`validate.ts` bracket scanner doesn't skip string contents** (`src/pages/api/validate.ts:80-108`) — Brackets inside quoted strings (e.g., URLs with parentheses) produce false positive validation errors.

- **`execute.ts` missing `export const prerender = false`** (`src/pages/api/execute.ts`) — `validate.ts` has this export but `execute.ts` doesn't. If output mode changes to `'hybrid'`, the endpoint would be prerendered.

- **Silent fallback to mock data on upstream failure** (`src/pages/api/execute.ts:372-374`) — When `BROWSERX_API_URL` is set but the upstream call fails, the error is swallowed and mock data returned silently with no logging.

- **Dockerfile runs as root** (`Dockerfile`) — No `USER` instruction exists. The Node.js process runs as root inside the container.

- **Successful queries absent from history** (`src/components/playground/Playground.tsx:128`) — Only the error path adds to `executionHistory`. The successful-path history entry is never added.

- **`Object.values(timing)[i]` assumes stable key order** (`src/components/pipeline/PipelineVisualizer.tsx:489`) — Stage durations extracted by positional index into `Object.values(timing)`. Should use `apiResult.timing[STAGES[i].timingKey]` instead.

- **Export dropdown has no click-outside handler** (`src/components/playground/ControlBar.tsx:96-118`) — The only way to dismiss the export dropdown without selecting an option is to click the Export button again.

- **'DM Sans', 'Syne', 'JetBrains Mono' fonts used but never loaded** (`src/components/playground/Playground.css:12,57,116`) — These fonts are referenced extensively but not in the font loading `<link>` tags in `astro.config.mjs`. They silently fall back to system fonts.

- **Editor mode tabs lack ARIA semantics** (`src/components/playground/Playground.tsx:237-254`) — Code/Builder/Generator buttons act as tabs but have no `role="tab"`, `role="tablist"`, or `aria-selected`.

- **`StageCard` keyboard handler only handles Enter, not Space** (`src/components/pipeline/StageCard.tsx:42`) — ARIA button contract requires both keys.

- **`astData` passed to recursive renderer without validation** (`src/components/playground/visualizer/ASTTree.tsx:94`) — `astData` is `unknown` in the store. If the API returns unexpected shapes, the renderer crashes.

### Medium

- **In-memory rate-limit map never evicted** (`src/pages/api/execute.ts:29`) — `rateLimitBuckets` grows unboundedly. Needs LRU cap or TTL cleanup.

- **`validate.ts` uses `as ValidationRequest` cast without runtime validation** (`src/pages/api/validate.ts:145`) — Should mirror the `validateRequestBody` pattern from `execute.ts`.

- **`BROWSERX_API_URL` baked into Docker image at build time** (`Dockerfile:13-14`) — Cannot be overridden at `docker run` time. For SSR, inject at runtime only.

- **`node_modules` copied wholesale into production image** (`Dockerfile:24`) — Includes dev dependencies (vitest, testing-library, happy-dom) in production.

- **`timeout` option not bounds-checked** (`src/pages/api/execute.ts:356`) — Can be negative or arbitrarily large.

- **`window.prompt()` for save-query naming** (`src/components/playground/Playground.tsx:203`) — Blocking native modal, blocked in cross-origin iframes.

- **Share URL `?q=` never read on mount** (`src/components/playground/Playground.tsx:211`) — `handleShare` generates share URLs but no code reads the `?q=` parameter to restore state.

- **Store state not persisted across reloads** (`src/components/playground/store.ts:289`) — Saved queries and history lost on page refresh.

- **Stale `currentQuery` in `handleExecute` closure** (`src/components/playground/Playground.tsx:48-151`) — If user edits query during pipeline animation, stale value is sent.

- **`QueryEditor` debounce timer not cleaned on unmount** (`src/components/playground/QueryEditor.tsx:136-143`) — Timer fires after unmount, updating torn-down state.

- **CSV export uses JSON quoting instead of RFC 4180** (`src/components/playground/Playground.tsx:178`) — `JSON.stringify` escaping differs from CSV standards.

- **No `prefers-reduced-motion` support** (`src/components/pipeline/PipelineVisualizer.css`) — Multiple animations with no reduced-motion override.

- **`SiteTitle.astro` no null guard on `starlightRoute`** (`src/components/SiteTitle.astro:2`) — Crashes if used outside Starlight routes.

- **Three near-identical tab CSS patterns duplicated** (`Playground.css:51-73, 509-529`, `global.css:408-431`) — ~60 lines of duplication across `.visualizer-tab`, `.tab`, `.editor-mode-tab`.

- **Canvas `getContext('2d')` called every frame** (`src/components/pipeline/PipelineCanvas.tsx:51`) — Should cache in a ref.

- **Monaco language registered on every mount without guard** (`src/components/pipeline/PipelineVisualizer.tsx:289-333`) — Causes warnings on hot reload.

- **`color-mix()` used without fallback** (`src/components/playground/Playground.css:627,701`) — ~93% browser support; no fallback for older browsers.

- **Focus outline removed without visible alternative** (`src/styles/global.css:254-257`) — `outline: none` with imperceptible border change fails WCAG 2.4.7.

- **Unused `wsRef`** (`src/components/playground/Playground.tsx:40-45`) — WebSocket ref created and cleaned up but never assigned a connection.

- **Magic number `7` for stage count** (`src/components/pipeline/PipelineVisualizer.tsx:427,485`) — Should use `STAGES.length`.

- **`PipelineStatus` type duplicated** (`PipelineVisualizer.tsx:412`, `PipelineTimeline.tsx:7`) — Same union declared in two files.

### Low

- **Google Fonts loaded without SRI** (`astro.config.mjs:27-37`) — External CDN resources without integrity hashes.

- **`STAGE_COLORS` object recreated on every render** (`src/components/pipeline/StageCard.tsx:19-27`) — Should be module-level constant.

- **Mixed `px`/`rem` units in ControlBar** (`src/components/playground/ControlBar.css:10-22`) — Inconsistent with rest of design system.

- **Non-round font sizes** (`src/components/playground/Playground.css:58,188`) — `0.72rem`, `0.775rem` outside the consistent type scale.

- **`DOMNode` key uses index** (`src/components/playground/visualizer/DOMTree.tsx:44`) — Anti-pattern for React reconciliation.

- **`generateExecutionId` collision risk** (`src/pages/api/execute.ts:106`) — `Date.now()` + 9-char UUID prefix not unique under high concurrency.

- **Hover row contrast imperceptible** (`src/components/pipeline/PipelineVisualizer.css:519-522`) — `#000` to `#070707` difference invisible on most displays.

- **`gap: 0` declared explicitly** (`src/components/playground/Playground.css:45,502`) — Redundant; it's the default.

- **Logo link depends on wordmark visibility** (`src/components/SiteTitle.astro:5-6`) — If wordmark hidden on mobile, link becomes unlabelled.

- **Google Fonts via CSS `@import`** (`src/components/pipeline/PipelineVisualizer.css:6`) — Render-blocking; should use `<link>` in head.

## Strengths

- **Excellent design token system** — `global.css` defines a complete, well-named set of CSS custom properties with semantic intent (`--bx-ok`, `--bx-warn`, `--bx-err` with RGB channel variants). All downstream CSS consumes tokens faithfully.

- **Surgical Starlight theme override** — Overrides Starlight's own CSS custom properties (`--sl-color-*`, `--sl-font`) rather than fighting specificity. The forced black theme propagates cleanly through framework components.

- **Well-structured Zustand store** — Types, initial state, and actions documented with JSDoc. Bounded collection limits (50 history, 20 screenshots, 100 logs) with FIFO semantics applied consistently.

- **Thorough Monaco editor integration** — Custom language registration, Monarch tokenizer, dark theme, inline error markers from validation API, and debounced validation all wired correctly.

- **Correct canvas animation pattern** — `PipelineCanvas` uses `useRef` mirrors for animation loop values, preventing stale closures. AbortController properly wired for fetch cancellation in `PipelineVisualizer`.

- **Token-bucket rate limiter is algorithmically correct** — Continuous-time token refill, burst capacity, and per-IP bucketing properly implemented.

- **Robust input validation pattern** — `validateRequestBody` in `execute.ts` is a thorough type-narrowing guard checking each field individually.

- **BEM naming discipline** — CSS follows consistent BEM structure throughout, keeping specificity low and selectors predictable.

- **Responsive breakpoints are well-chosen** — Playground stacks vertically at 768px, visualizer hides at 960px, control bar wraps. Sensible and differentiated.

- **AbortSignal.timeout on upstream calls** — Both API endpoints correctly apply request timeouts to upstream fetch calls, preventing indefinite hangs.

## Recommendations

1. **Fix the duplicate fetch** — Remove either the inline `fetch` in `handleExecute` or the `executeQuery` store action call. Pick one canonical path.
2. **Escape HTML exports** — Add an `escapeHtml()` utility that replaces `<>&"` with entities. Apply to CSV export values too.
3. **Fix rate limiter IP extraction** — Read IP from the socket-level remote address or a trusted proxy header (e.g., `CF-Connecting-IP` behind Cloudflare). Add LRU eviction to the bucket map.
4. **Wire real cancellation** — Create an `AbortController` in `handleExecute`, pass its signal to `fetch`, and abort it in `handleCancel`.
5. **Add Dockerfile security** — Add non-root user, use `npm ci --omit=dev` for production deps, make `BROWSERX_API_URL` a runtime-only env var.
6. **Fix keyboard accessibility** — Remove CSS `:hover` dropdown reveal, add click-outside handler, add Space key to StageCard, add ARIA tab semantics, fix focus outline.
7. **Validate API response shapes** — Add runtime schema validation (e.g., Zod) between API responses and store state.
8. **Add query length limit** — Reject queries over 10KB with HTTP 413.
9. **Load missing fonts** — Either add DM Sans/Syne/JetBrains Mono to the font `<link>` tags or switch declarations to the loaded fonts.
10. **Persist playground state** — Use Zustand's `persist` middleware with localStorage for saved queries and history.
