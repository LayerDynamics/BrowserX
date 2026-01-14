/**
 * Cache Value Utilities
 *
 * Serialization and deserialization of cache values
 */

/**
 * Cache value metadata
 */
export interface CacheValueMetadata {
  storedAt: number;
  expiresAt?: number;
  accessCount: number;
  lastAccessedAt: number;
  size: number;
  contentType?: string;
  etag?: string;
  tags?: string[];
}

/**
 * Wrapped cache value with metadata
 */
export interface CacheValue<T = unknown> {
  data: T;
  metadata: CacheValueMetadata;
}

/**
 * Serialize cache value to bytes
 */
export function serializeCacheValue<T>(
  data: T,
  metadata?: Partial<CacheValueMetadata>,
): Uint8Array {
  const now = Date.now();

  const fullMetadata: CacheValueMetadata = {
    storedAt: now,
    accessCount: 0,
    lastAccessedAt: now,
    size: 0,
    ...metadata,
  };

  const value: CacheValue<T> = {
    data,
    metadata: fullMetadata,
  };

  const json = JSON.stringify(value);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(json);

  // Update size in metadata
  fullMetadata.size = bytes.length;

  return bytes;
}

/**
 * Deserialize cache value from bytes
 */
export function deserializeCacheValue<T>(bytes: Uint8Array): CacheValue<T> {
  const decoder = new TextDecoder();
  const json = decoder.decode(bytes);
  return JSON.parse(json) as CacheValue<T>;
}

/**
 * Check if cache value is expired
 */
export function isCacheValueExpired(value: CacheValue): boolean {
  if (!value.metadata.expiresAt) {
    return false;
  }

  return Date.now() > value.metadata.expiresAt;
}

/**
 * Get TTL (time to live) for cache value in milliseconds
 */
export function getCacheValueTTL(value: CacheValue): number | null {
  if (!value.metadata.expiresAt) {
    return null;
  }

  const ttl = value.metadata.expiresAt - Date.now();
  return ttl > 0 ? ttl : 0;
}

/**
 * Update access metadata
 */
export function updateAccessMetadata(value: CacheValue): void {
  value.metadata.accessCount++;
  value.metadata.lastAccessedAt = Date.now();
}

/**
 * Create cache value metadata
 */
export function createCacheValueMetadata(
  options: {
    ttl?: number;
    contentType?: string;
    etag?: string;
    tags?: string[];
  } = {},
): CacheValueMetadata {
  const now = Date.now();

  return {
    storedAt: now,
    expiresAt: options.ttl ? now + options.ttl : undefined,
    accessCount: 0,
    lastAccessedAt: now,
    size: 0,
    contentType: options.contentType,
    etag: options.etag,
    tags: options.tags,
  };
}

/**
 * Clone cache value
 */
export function cloneCacheValue<T>(value: CacheValue<T>): CacheValue<T> {
  return {
    data: structuredClone(value.data),
    metadata: { ...value.metadata },
  };
}

/**
 * Calculate cache value size
 */
export function calculateCacheValueSize<T>(value: T): number {
  const json = JSON.stringify(value);
  return new TextEncoder().encode(json).length;
}

/**
 * Compress cache value (simple implementation)
 */
export async function compressCacheValue(bytes: Uint8Array): Promise<Uint8Array> {
  // Use CompressionStream for gzip compression
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  }).pipeThrough(new CompressionStream("gzip"));

  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // Concatenate chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Decompress cache value
 */
export async function decompressCacheValue(bytes: Uint8Array): Promise<Uint8Array> {
  // Use DecompressionStream for gzip decompression
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  }).pipeThrough(new DecompressionStream("gzip"));

  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // Concatenate chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}
