/**
 * Hash Utilities
 *
 * High-level hash utilities for cache keys and data integrity
 */

import { sha256, sha256Hmac } from "./sha.ts";

/**
 * Hash data with salt
 */
export async function hashWithSalt(data: string, salt: string): Promise<string> {
  const combined = data + salt;
  return await sha256(combined);
}

/**
 * Verify hash matches data with salt
 */
export async function verifyHash(
  data: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  const computed = await hashWithSalt(data, salt);
  return computed === hash;
}

/**
 * Hash a cache key with method, URL, and vary headers
 */
export async function hashCacheKey(
  method: string,
  url: string,
  varyHeaders?: Record<string, string>,
): Promise<string> {
  const varyPart = varyHeaders
    ? Object.entries(varyHeaders)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join(":")
    : "";
  const canonical = `${method}:${url}${varyPart ? ":" + varyPart : ""}`;
  return await sha256(canonical);
}

/**
 * Context for cache key generation
 */
export interface CacheKeyContext {
  method: string;
  url: string;
  varyHeaders?: Record<string, string>;
}

/**
 * Canonicalize context and hash
 */
export async function canonicalizeAndHash(
  context: CacheKeyContext,
): Promise<string> {
  return await hashCacheKey(context.method, context.url, context.varyHeaders);
}

/**
 * Hash request for cache lookup
 */
export async function hashRequest(
  method: string,
  url: string,
  headers?: Record<string, string>,
  varyOn?: string[],
): Promise<string> {
  // Extract only headers that we vary on
  const varyHeaders: Record<string, string> = {};
  if (varyOn && headers) {
    for (const headerName of varyOn) {
      const lowerName = headerName.toLowerCase();
      const value = headers[lowerName];
      if (value !== undefined) {
        varyHeaders[lowerName] = value;
      }
    }
  }

  return await hashCacheKey(method, url, varyHeaders);
}

/**
 * Hash data with HMAC for data integrity
 */
export async function hashWithHmac(
  data: string,
  key: string,
): Promise<string> {
  return await sha256Hmac(key, data);
}

/**
 * Verify HMAC hash
 */
export async function verifyHmac(
  data: string,
  hash: string,
  key: string,
): Promise<boolean> {
  const computed = await hashWithHmac(data, key);
  return computed === hash;
}

/**
 * Hash object to stable string
 */
export async function hashObject(obj: unknown): Promise<string> {
  // Sort keys for stable serialization
  const sortedJson = JSON.stringify(obj, Object.keys(obj as object).sort());
  return await sha256(sortedJson);
}

/**
 * Hash file contents
 */
export async function hashFile(contents: Uint8Array): Promise<string> {
  return await sha256(contents);
}

/**
 * Create content fingerprint
 */
export async function fingerprint(content: string | Uint8Array): Promise<string> {
  const hash = await sha256(content);
  // Return first 16 characters for shorter fingerprint
  return hash.slice(0, 16);
}
