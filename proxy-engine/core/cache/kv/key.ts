// key.ts - Cache key generation utilities

import { sha256 } from "../encryption/sha.ts";

/**
 * Generate cache key from HTTP request
 */
export class CacheKey {
  /**
   * Generate a cache key from request properties
   */
  static generate(
    method: string,
    url: string,
    varyHeaders?: Record<string, string>
  ): string {
    let key = `${method.toUpperCase()}:${url}`;

    // Include Vary headers in cache key for content negotiation
    if (varyHeaders && Object.keys(varyHeaders).length > 0) {
      const sortedKeys = Object.keys(varyHeaders).sort();
      for (const headerName of sortedKeys) {
        const value = varyHeaders[headerName];
        key += `:${headerName.toLowerCase()}=${value}`;
      }
    }

    return key;
  }

  /**
   * Generate a hash-based cache key (shorter) using SHA-256
   */
  static async generateHash(
    method: string,
    url: string,
    varyHeaders?: Record<string, string>
  ): Promise<string> {
    const fullKey = this.generate(method, url, varyHeaders);
    return await sha256(fullKey);
  }

  /**
   * Parse a cache key back into components
   */
  static parse(key: string): {
    method: string;
    url: string;
    varyHeaders: Record<string, string>;
  } {
    const colonIdx = key.indexOf(':');
    const method = key.slice(0, colonIdx);
    const rest = key.slice(colonIdx + 1); // e.g. "http://example.com/:accept=text/html"

    // Find where vary headers start: first :lowercaseName= after the URL scheme (://)
    const schemeEnd = rest.indexOf('://');
    const searchFrom = schemeEnd === -1 ? 0 : schemeEnd + 3;
    const varyMatch = rest.slice(searchFrom).search(/:([a-z][a-z0-9-]*)=/);

    const varyHeaders: Record<string, string> = {};
    let url: string;

    if (varyMatch === -1) {
      url = rest;
    } else {
      const varyStart = searchFrom + varyMatch;
      url = rest.slice(0, varyStart);
      const varyStr = rest.slice(varyStart + 1); // skip the leading :
      for (const part of varyStr.split(':')) {
        const eqIdx = part.indexOf('=');
        if (eqIdx > -1) {
          varyHeaders[part.slice(0, eqIdx)] = part.slice(eqIdx + 1);
        }
      }
    }

    return { method, url, varyHeaders };
  }

  /**
   * Check if a key matches a URL pattern
   */
  static matches(key: string, urlPattern: string | RegExp): boolean {
    const { url } = this.parse(key);

    if (typeof urlPattern === 'string') {
      return url.includes(urlPattern);
    } else {
      return urlPattern.test(url);
    }
  }
}
