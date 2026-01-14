/**
 * State module exports
 * Provides execution state management, caching, sessions, and browser state tracking
 */

// Core classes
export { StateManager } from "./state-manager.ts";
export { ExecutionContextManager } from "./execution-context.ts";
export { VariableScope } from "./variable-scope.ts";
export { QueryCacheManager } from "./cache-manager.ts";
export { SessionStateManager } from "./session-state.ts";
export { BrowserStateTracker } from "./browser-state.ts";

// Types
export type {
  AuthCredentials,
  BrowserStateSnapshot,
  CacheConfig,
  CacheEntryMetadata,
  CacheStats,
  CookieData,
  EvictionPolicy,
  ScopeID,
  SessionData,
  StateManagerConfig,
} from "./types.ts";
