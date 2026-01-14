/**
 * Controllers Module
 * Exports browser and proxy controllers
 */

// Browser controller (exclude NavigateOptions which is in types/)
export {
  BrowserController,
  type BrowserPage,
  type DOMElement,
  type PDFOptions,
  type ScreenshotOptions,
  type TypeOptions,
  type WaitOptions,
} from "./browser/browser-controller.ts";

// Proxy controller (exclude ProxyConfig which is in types/)
export {
  type CacheEntry,
  type HTTPRequest,
  type HTTPResponse,
  ProxyController,
  type RequestInterceptor,
  type ResponseInterceptor,
} from "./proxy/proxy-controller.ts";
