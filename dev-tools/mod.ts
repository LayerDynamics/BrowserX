/**
 * BrowserX DevTools
 *
 * Complete DevTools system for BrowserX, inspired by Chrome DevTools Protocol (CDP).
 * Provides 14 domain agents, a WebSocket server, a programmatic client,
 * and a CDP-compatible JSON-RPC protocol layer.
 *
 * Quick start:
 * ```ts
 * import { Browser } from "../browser/src/main.ts";
 * import { attachDevTools } from "../dev-tools/mod.ts";
 *
 * const browser = new Browser();
 * const devtools = attachDevTools(browser, { port: 9222 });
 * // DevTools now listening on ws://127.0.0.1:9222
 * ```
 */

// Protocol layer (types, registry, session)
export * from "./protocol/mod.ts";

// Domain agents (all 14 domains + base)
export * from "./domains/mod.ts";

// Server layer (WebSocket server, router, connection)
export * from "./server/mod.ts";

// Client layer (programmatic client, typed domain clients)
export * from "./client/mod.ts";

// Integration layer (attachDevTools entry point, event bus)
export * from "./integration/mod.ts";
