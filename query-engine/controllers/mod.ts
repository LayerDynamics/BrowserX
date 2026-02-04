/**
 * Controllers Module
 * Exports browser and proxy controllers
 */

// Browser controller (exclude NavigateOptions and ScreenshotOptions which are in types/)
export {
  BrowserController,
  type BrowserPage,
  type DOMElement,
  type PDFOptions,
  type TypeOptions,
  type WaitOptions,
} from "./browser/browser-controller.ts";

// Re-export controller-specific ScreenshotOptions with a different name to avoid conflict
export { type ScreenshotOptions as BrowserScreenshotOptions } from "./browser/browser-controller.ts";

// Proxy controller (exclude ProxyConfig which is in types/)
export {
  type CacheEntry,
  type HTTPRequest,
  type HTTPResponse,
  ProxyController,
  type RequestInterceptor,
  type ResponseInterceptor,
} from "./proxy/proxy-controller.ts";
