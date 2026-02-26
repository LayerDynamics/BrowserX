// Polyfill HTMLElement for Deno (needed by graphx transitive import from query-engine)
if (typeof globalThis.HTMLElement === "undefined") {
  (globalThis as Record<string, unknown>).HTMLElement = class HTMLElement {} as unknown as typeof HTMLElement;
}
