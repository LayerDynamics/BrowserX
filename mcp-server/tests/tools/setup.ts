// Polyfill HTMLElement for Deno (needed by graphx transitive import from runtime)
if (typeof globalThis.HTMLElement === "undefined") {
  (globalThis as Record<string, unknown>).HTMLElement = class HTMLElement {} as unknown as typeof HTMLElement;
}
