// key.ts - Cache key generation utilities

import { sha256 } from "../encrpytion/sha.ts";

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
    const parts = key.split(':');
    const method = parts[0];
    const url = parts[1];
    const varyHeaders: Record<string, string> = {};

    // Parse vary headers if present
    for (let i = 2; i < parts.length; i++) {
      const [headerPair] = parts[i].split('=');
      if (headerPair) {
        const [name, value] = parts[i].split('=');
        if (name && value) {
          varyHeaders[name] = value;
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
