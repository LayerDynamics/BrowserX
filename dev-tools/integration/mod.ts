/**
 * Integration Layer Exports
 *
 * Entry points for attaching DevTools to a BrowserX Browser instance.
 */
export { EventBus, type EventHandler } from "./event-bus.ts";
export {
    attachDevTools,
    BrowserDevTools,
    type BrowserDevToolsConfig,
} from "./browser-devtools.ts";
