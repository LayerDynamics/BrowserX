/**
 * State module type definitions
 * Core types for execution state management, caching, sessions, and browser state
 */

import type {
  Bytes,
  DurationMs,
  QueryID,
  SessionID,
  Timestamp,
  URLString,
} from "../types/primitives.ts";

/**
 * Variable scope identifier
 */
export type ScopeID = string;

/**
 * Cache entry metadata
 */
export interface CacheEntryMetadata {
  readonly createdAt: Timestamp;
  accessedAt: Timestamp;
  accessCount: number;
  size: Bytes;
  ttl: DurationMs;
  expiresAt: Timestamp;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  currentSize: Bytes;
  maxSize: Bytes;
  entryCount: number;
  hitRate: number;
}

/**
 * Cache eviction policy
 */
export type EvictionPolicy = "LRU" | "LFU" | "FIFO";

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize: Bytes; // Maximum total cache size in bytes
  maxEntries: number; // Maximum number of cache entries
  defaultTTL: DurationMs; // Default time-to-live for cache entries
  maxTTL: DurationMs; // Maximum allowed TTL
  evictionPolicy: EvictionPolicy;
  cleanupInterval: DurationMs; // Interval for cleaning expired entries
}

/**
 * Session state data
 */
export interface SessionData {
  readonly sessionId: SessionID;
  cookies: Map<string, CookieData>;
  localStorage: Map<string, unknown>;
  sessionStorage: Map<string, unknown>;
  auth: Map<string, AuthCredentials>;
  readonly createdAt: Timestamp;
  lastAccessedAt: Timestamp;
}

/**
 * Cookie data structure
 */
export interface CookieData {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: Timestamp;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

/**
 * Authentication credentials
 */
export interface AuthCredentials {
  type: "basic" | "bearer" | "oauth" | "custom";
  username?: string;
  password?: string;
  token?: string;
  headers?: Record<string, string>;
}

/**
 * Browser state snapshot
 */
export interface BrowserStateSnapshot {
  currentURL?: URLString;
  title?: string;
  navigationHistory: URLString[];
  historyIndex: number;
  viewport?: {
    width: number;
    height: number;
  };
  scrollPosition?: {
    x: number;
    y: number;
  };
  userAgent?: string;
}

/**
 * State manager configuration
 */
export interface StateManagerConfig {
  cache?: Partial<CacheConfig>;
  sessionTimeout?: DurationMs;
}
