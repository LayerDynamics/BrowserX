/**
 * Proxy controller module exports
 */

export { ProxyController } from "./proxy-controller.ts";

// Re-export types
export type {
  HTTPRequest,
  HTTPResponse,
  CacheEntry,
  ProxyConfig,
  RequestInterceptor,
  ResponseInterceptor,
  CacheLookupResult,
} from "./proxy-controller.ts";
