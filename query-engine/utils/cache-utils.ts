/**
 * Cache utility functions
 * Cache key generation, hash computation, TTL calculation
 */

import type { DurationMs } from "../types/primitives.ts";

/**
 * Generate cache key from method, URL, and parameters
 */
export function generateCacheKey(
  method: string,
  url: string,
  params?: Record<string, unknown>,
): string {
  const parts = [method.toUpperCase(), url];

  if (params) {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${JSON.stringify(params[key])}`)
      .join("&");
    parts.push(sortedParams);
  }

  return parts.join(":");
}

/**
 * Generate cache key with vary headers
 */
export function generateCacheKeyWithVary(
  method: string,
  url: string,
  varyHeaders: Record<string, string>,
): string {
  const parts = [method.toUpperCase(), url];

  const sortedHeaders = Object.keys(varyHeaders)
    .sort()
    .map((key) => `${key.toLowerCase()}=${varyHeaders[key]}`)
    .join("&");

  if (sortedHeaders) {
    parts.push(sortedHeaders);
  }

  return parts.join(":");
}

/**
 * Hash object to deterministic string
 */
export function hashObject(obj: unknown): string {
  const str = JSON.stringify(obj, Object.keys(obj as any).sort());
  return hashString(str);
}

/**
 * Simple string hash function (djb2)
 */
export function hashString(str: string): string {
  let hash = 5381;

  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }

  return (hash >>> 0).toString(36);
}

/**
 * SHA-256 hash (async, uses Web Crypto API)
 */
export async function sha256(data: string | Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = typeof data === "string" ? encoder.encode(data) : data;
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Cache control directives
 */
export interface CacheControlDirectives {
  public?: boolean;
  private?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  maxAge?: number;
  sMaxAge?: number;
  mustRevalidate?: boolean;
  proxyRevalidate?: boolean;
  immutable?: boolean;
  staleWhileRevalidate?: number;
  staleIfError?: number;
}

/**
 * Parse Cache-Control header
 */
export function parseCacheControl(header: string): CacheControlDirectives {
  const directives: CacheControlDirectives = {};

  const parts = header.split(",").map((p) => p.trim());

  for (const part of parts) {
    const [key, value] = part.split("=").map((s) => s.trim());

    switch (key.toLowerCase()) {
      case "public":
        directives.public = true;
        break;
      case "private":
        directives.private = true;
        break;
      case "no-cache":
        directives.noCache = true;
        break;
      case "no-store":
        directives.noStore = true;
        break;
      case "max-age":
        directives.maxAge = parseInt(value, 10);
        break;
      case "s-maxage":
        directives.sMaxAge = parseInt(value, 10);
        break;
      case "must-revalidate":
        directives.mustRevalidate = true;
        break;
      case "proxy-revalidate":
        directives.proxyRevalidate = true;
        break;
      case "immutable":
        directives.immutable = true;
        break;
      case "stale-while-revalidate":
        directives.staleWhileRevalidate = parseInt(value, 10);
        break;
      case "stale-if-error":
        directives.staleIfError = parseInt(value, 10);
        break;
    }
  }

  return directives;
}

/**
 * Calculate TTL from Cache-Control and Expires headers
 */
export function calculateTTL(
  cacheControl?: string,
  expires?: string,
  defaultTTL: DurationMs = 300000, // 5 minutes
  maxTTL: DurationMs = 3600000, // 1 hour
): DurationMs {
  // Parse cache-control
  if (cacheControl) {
    const directives = parseCacheControl(cacheControl);

    // no-store means not cacheable
    if (directives.noStore) {
      return 0;
    }

    // Use s-maxage for shared caches, or max-age
    const maxAge = directives.sMaxAge ?? directives.maxAge;
    if (maxAge !== undefined) {
      return Math.min(maxAge * 1000, maxTTL);
    }
  }

  // Parse Expires header
  if (expires) {
    const expiresDate = new Date(expires);
    if (!isNaN(expiresDate.getTime())) {
      const ttl = expiresDate.getTime() - Date.now();
      return Math.min(Math.max(ttl, 0), maxTTL);
    }
  }

  // Use default TTL
  return defaultTTL;
}

/**
 * Check if response is cacheable
 */
export function isCacheable(
  method: string,
  statusCode: number,
  cacheControl?: string,
): boolean {
  // Only GET and HEAD are cacheable
  if (!["GET", "HEAD"].includes(method.toUpperCase())) {
    return false;
  }

  // Check cache-control
  if (cacheControl) {
    const directives = parseCacheControl(cacheControl);

    // Explicitly not cacheable
    if (directives.noStore || directives.private) {
      return false;
    }

    // Explicitly cacheable
    if (directives.public || directives.maxAge !== undefined || directives.sMaxAge !== undefined) {
      return true;
    }
  }

  // Cacheable status codes
  const cacheableStatuses = [200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501];
  return cacheableStatuses.includes(statusCode);
}

/**
 * Check if cached response is fresh
 */
export function isFresh(
  cachedAt: number,
  ttl: DurationMs,
  age?: number,
): boolean {
  const now = Date.now();
  const responseAge = age !== undefined ? age * 1000 : 0;
  const cacheAge = now - cachedAt;
  const totalAge = responseAge + cacheAge;

  return totalAge < ttl;
}

/**
 * Parse Vary header
 */
export function parseVary(header: string): string[] {
  if (header === "*") {
    return ["*"];
  }

  return header
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
}

/**
 * Check if request matches cached response based on Vary headers
 */
export function matchesVary(
  requestHeaders: Record<string, string>,
  cachedVaryHeaders: string[],
  cachedRequestHeaders: Record<string, string>,
): boolean {
  // If Vary: *, nothing matches
  if (cachedVaryHeaders.includes("*")) {
    return false;
  }

  // Check each vary header
  for (const varyHeader of cachedVaryHeaders) {
    const requestValue = requestHeaders[varyHeader.toLowerCase()] || "";
    const cachedValue = cachedRequestHeaders[varyHeader.toLowerCase()] || "";

    if (requestValue !== cachedValue) {
      return false;
    }
  }

  return true;
}

/**
 * Build cache key with vary headers
 */
export function buildVaryKey(
  baseKey: string,
  varyHeaders: string[],
  requestHeaders: Record<string, string>,
): string {
  if (varyHeaders.length === 0) {
    return baseKey;
  }

  const varyParts = varyHeaders
    .sort()
    .map((header) => {
      const value = requestHeaders[header.toLowerCase()] || "";
      return `${header}=${value}`;
    })
    .join("&");

  return `${baseKey}:vary:${varyParts}`;
}
