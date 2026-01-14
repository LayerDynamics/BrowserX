/**
 * Proxy Controller
 * Interfaces with the Proxy Engine to manage traffic and caching
 */

import { CacheLookupStep, CacheStoreStep } from "../../planner/mod.ts";
import { DurationMs, RequestID, URLString } from "../../types/primitives.ts";
import type { Runtime } from "../../../proxy-engine/core/runtime/mod.ts";

/**
 * HTTP request
 */
export interface HTTPRequest {
  readonly id: RequestID;
  method: string;
  url: URLString;
  headers: Record<string, string>;
  body?: Uint8Array;
}

/**
 * HTTP response
 */
export interface HTTPResponse {
  readonly requestId: RequestID;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: Uint8Array;
  fromCache: boolean;
}

/**
 * Cache entry
 */
export interface CacheEntry {
  key: string;
  value: unknown;
  ttl: DurationMs;
  storedAt: number;
  expiresAt: number;
}

/**
 * Proxy configuration
 */
export interface ProxyConfig {
  enabled: boolean;
  cache: {
    enabled: boolean;
    defaultTTL: DurationMs;
    maxSize: number; // in bytes
  };
  rateLimit?: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };
  intercept?: {
    enabled: boolean;
    modifyRequests: boolean;
    modifyResponses: boolean;
  };
}

/**
 * Request interceptor
 */
export interface RequestInterceptor {
  (request: HTTPRequest): Promise<HTTPRequest>;
}

/**
 * Response interceptor
 */
export interface ResponseInterceptor {
  (response: HTTPResponse): Promise<HTTPResponse>;
}

/**
 * Cache lookup result
 */
export interface CacheLookupResult {
  hit: boolean;
  reason?: "cache_disabled" | "not_found" | "expired";
  value: unknown | null;
  metadata?: {
    storedAt?: number;
    expiresAt?: number;
    ttl?: number;
    age?: number;
  };
}

/**
 * Proxy controller
 */
export class ProxyController {
  private runtime?: Runtime; // Reference to actual proxy engine runtime
  private cache: Map<string, CacheEntry>;
  private config: ProxyConfig;
  private requestInterceptors: RequestInterceptor[];
  private responseInterceptors: ResponseInterceptor[];
  private currentCacheSize: number; // Current cache size in bytes
  private cacheHits: number;
  private cacheMisses: number;
  private rateLimitTokens: Map<string, number[]>; // key -> timestamps of requests

  constructor(runtime?: Runtime, config?: Partial<ProxyConfig>) {
    this.runtime = runtime;
    this.cache = new Map();
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.currentCacheSize = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.rateLimitTokens = new Map();

    this.config = {
      enabled: config?.enabled ?? true,
      cache: {
        enabled: config?.cache?.enabled ?? true,
        defaultTTL: config?.cache?.defaultTTL ?? 300000, // 5 minutes
        maxSize: config?.cache?.maxSize ?? 100 * 1024 * 1024, // 100MB
      },
      rateLimit: config?.rateLimit,
      intercept: config?.intercept,
    };
  }

  /**
   * Execute cache lookup step
   */
  async executeCacheLookup(step: CacheLookupStep): Promise<CacheLookupResult> {
    if (!this.config.cache.enabled) {
      return {
        hit: false,
        reason: "cache_disabled",
        value: null,
      };
    }

    const entry = this.cache.get(step.cacheKey);

    if (!entry) {
      this.cacheMisses++;
      return {
        hit: false,
        reason: "not_found",
        value: null,
      };
    }

    // Check if entry is expired
    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(step.cacheKey);
      this.currentCacheSize -= this.calculateEntrySize(entry);
      this.cacheMisses++;
      return {
        hit: false,
        reason: "expired",
        value: null,
        metadata: {
          storedAt: entry.storedAt,
          expiresAt: entry.expiresAt,
          ttl: entry.ttl,
          age: now - entry.storedAt,
        },
      };
    }

    this.cacheHits++;
    return {
      hit: true,
      value: entry.value,
      metadata: {
        storedAt: entry.storedAt,
        expiresAt: entry.expiresAt,
        ttl: entry.ttl,
        age: now - entry.storedAt,
      },
    };
  }

  /**
   * Execute cache store step
   */
  async executeCacheStore(step: CacheStoreStep): Promise<void> {
    if (!this.config.cache.enabled) {
      return;
    }

    const ttl = step.ttl || this.config.cache.defaultTTL;
    const now = Date.now();

    const entry: CacheEntry = {
      key: step.cacheKey,
      value: step.value,
      ttl,
      storedAt: now,
      expiresAt: now + ttl,
    };

    const entrySize = this.calculateEntrySize(entry);

    // Check if we need to evict existing entry with same key
    const existingEntry = this.cache.get(step.cacheKey);
    if (existingEntry) {
      this.currentCacheSize -= this.calculateEntrySize(existingEntry);
    }

    // Enforce cache size limit with LRU eviction
    while (this.currentCacheSize + entrySize > this.config.cache.maxSize && this.cache.size > 0) {
      this.evictOldestEntry();
    }

    // Only store if entry fits in cache
    if (entrySize <= this.config.cache.maxSize) {
      this.cache.set(step.cacheKey, entry);
      this.currentCacheSize += entrySize;
    }
  }

  /**
   * Intercept HTTP request
   */
  async interceptRequest(request: HTTPRequest): Promise<HTTPRequest> {
    if (!this.config.intercept?.enabled || !this.config.intercept.modifyRequests) {
      return request;
    }

    let modifiedRequest = request;

    for (const interceptor of this.requestInterceptors) {
      modifiedRequest = await interceptor(modifiedRequest);
    }

    return modifiedRequest;
  }

  /**
   * Intercept HTTP response
   */
  async interceptResponse(response: HTTPResponse): Promise<HTTPResponse> {
    if (!this.config.intercept?.enabled || !this.config.intercept.modifyResponses) {
      return response;
    }

    let modifiedResponse = response;

    for (const interceptor of this.responseInterceptors) {
      modifiedResponse = await interceptor(modifiedResponse);
    }

    return modifiedResponse;
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(key: string = "default"): Promise<boolean> {
    if (!this.config.rateLimit) {
      return true; // No rate limit configured
    }

    const now = Date.now();

    // Get or create request timestamps for this key
    if (!this.rateLimitTokens.has(key)) {
      this.rateLimitTokens.set(key, []);
    }

    const timestamps = this.rateLimitTokens.get(key)!;

    // Remove timestamps older than 1 minute
    const oneMinuteAgo = now - 60000;
    const oneSecondAgo = now - 1000;

    // Filter out old timestamps
    const recentTimestamps = timestamps.filter((ts) => ts > oneMinuteAgo);
    this.rateLimitTokens.set(key, recentTimestamps);

    // Count requests in last second and last minute
    const requestsInLastSecond = recentTimestamps.filter((ts) => ts > oneSecondAgo).length;
    const requestsInLastMinute = recentTimestamps.length;

    // Check if rate limits are exceeded
    if (
      this.config.rateLimit.requestsPerSecond &&
      requestsInLastSecond >= this.config.rateLimit.requestsPerSecond
    ) {
      return false; // Rate limit exceeded (per second)
    }

    if (
      this.config.rateLimit.requestsPerMinute &&
      requestsInLastMinute >= this.config.rateLimit.requestsPerMinute
    ) {
      return false; // Rate limit exceeded (per minute)
    }

    // Add current timestamp
    recentTimestamps.push(now);
    this.rateLimitTokens.set(key, recentTimestamps);

    return true; // Rate limit not exceeded
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.currentCacheSize = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Calculate the size of a cache entry in bytes
   */
  private calculateEntrySize(entry: CacheEntry): number {
    // Estimate size: key + value + metadata
    const keySize = entry.key.length * 2; // UTF-16 characters
    const valueSize = JSON.stringify(entry.value).length * 2;
    const metadataSize = 32; // storedAt, expiresAt, ttl (8 bytes each approx)

    return keySize + valueSize + metadataSize;
  }

  /**
   * Evict the oldest cache entry (LRU)
   */
  private evictOldestEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    // Find the oldest entry by storedAt timestamp
    for (const [key, entry] of this.cache.entries()) {
      if (entry.storedAt < oldestTime) {
        oldestTime = entry.storedAt;
        oldestKey = key;
      }
    }

    // Evict the oldest entry
    if (oldestKey !== null) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        this.currentCacheSize -= this.calculateEntrySize(entry);
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    entries: number;
    size: number;
    hitRate: number;
  } {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    return {
      entries: this.cache.size,
      size: this.currentCacheSize,
      hitRate,
    };
  }

  /**
   * Get proxy configuration
   */
  getConfig(): ProxyConfig {
    return { ...this.config };
  }

  /**
   * Update proxy configuration
   */
  updateConfig(config: Partial<ProxyConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      cache: {
        ...this.config.cache,
        ...config.cache,
      },
    };
  }

  /**
   * Get cache entries (returns copy)
   */
  getCache(): Map<string, CacheEntry> {
    return new Map(this.cache);
  }

  /**
   * Get runtime instance
   */
  getRuntime(): Runtime | undefined {
    return this.runtime;
  }

  /**
   * Get request interceptors (returns copy)
   */
  getRequestInterceptors(): RequestInterceptor[] {
    return [...this.requestInterceptors];
  }

  /**
   * Get response interceptors (returns copy)
   */
  getResponseInterceptors(): ResponseInterceptor[] {
    return [...this.responseInterceptors];
  }

  /**
   * Get cache hit and miss counts
   */
  getCacheMetrics(): { hits: number; misses: number } {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
    };
  }
}
