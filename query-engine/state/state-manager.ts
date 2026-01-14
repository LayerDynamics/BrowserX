/**
 * State manager orchestrator
 * Central coordinator for all state management components
 */

import type { QueryID, SessionID } from "../types/primitives.ts";
import type { StateManagerConfig } from "./types.ts";
import { ExecutionContextManager } from "./execution-context.ts";
import { QueryCacheManager } from "./cache-manager.ts";
import { SessionStateManager } from "./session-state.ts";
import { BrowserStateTracker } from "./browser-state.ts";

/**
 * State manager - central orchestrator for query engine state
 *
 * Coordinates:
 * - Execution contexts (per-query state with variable scoping)
 * - Query cache (shared across all queries)
 * - Session state (cookies, auth, storage)
 * - Browser state (navigation, viewport per query)
 *
 * Lifecycle:
 * 1. Create StateManager once at engine initialization
 * 2. For each query:
 *    - createExecutionContext(queryId)
 *    - createSession() if needed
 *    - getBrowserState(queryId)
 * 3. Clean up with clearQuery(queryId) after execution
 */
export class StateManager {
  private readonly cacheManager: QueryCacheManager;
  private readonly sessionManager: SessionStateManager;
  private readonly executionContexts: Map<QueryID, ExecutionContextManager>;
  private readonly browserStates: Map<QueryID, BrowserStateTracker>;

  constructor(config: StateManagerConfig = {}) {
    // Initialize cache manager with config
    this.cacheManager = new QueryCacheManager(config.cache);

    // Initialize session manager
    this.sessionManager = new SessionStateManager(config.sessionTimeout);

    // Initialize per-query state maps
    this.executionContexts = new Map();
    this.browserStates = new Map();
  }

  /**
   * Create execution context for a query
   * This should be called at the start of query execution
   */
  createExecutionContext(queryId: QueryID): ExecutionContextManager {
    // Check if context already exists
    if (this.executionContexts.has(queryId)) {
      const existing = this.executionContexts.get(queryId)!;
      existing.reset(); // Reset existing context
      return existing;
    }

    // Create new context
    const context = new ExecutionContextManager(queryId);
    this.executionContexts.set(queryId, context);
    return context;
  }

  /**
   * Get execution context for a query
   * Returns undefined if context doesn't exist
   */
  getExecutionContext(queryId: QueryID): ExecutionContextManager | undefined {
    return this.executionContexts.get(queryId);
  }

  /**
   * Check if execution context exists for query
   */
  hasExecutionContext(queryId: QueryID): boolean {
    return this.executionContexts.has(queryId);
  }

  /**
   * Get cache manager (shared across all queries)
   */
  getCache(): QueryCacheManager {
    return this.cacheManager;
  }

  /**
   * Create new session
   * Returns session ID
   */
  createSession(): SessionID {
    return this.sessionManager.createSession();
  }

  /**
   * Get session manager
   */
  getSessionManager(): SessionStateManager {
    return this.sessionManager;
  }

  /**
   * Get browser state for query
   * Creates new browser state if doesn't exist
   */
  getBrowserState(queryId: QueryID): BrowserStateTracker {
    let browserState = this.browserStates.get(queryId);

    if (!browserState) {
      browserState = new BrowserStateTracker();
      this.browserStates.set(queryId, browserState);
    }

    return browserState;
  }

  /**
   * Clear all state for a query
   * Should be called after query execution completes
   */
  clearQuery(queryId: QueryID): void {
    // Remove execution context
    this.executionContexts.delete(queryId);

    // Remove browser state
    this.browserStates.delete(queryId);

    // Note: Cache and sessions persist across queries
  }

  /**
   * Clear all query state (but keep cache and sessions)
   */
  clearAllQueries(): void {
    this.executionContexts.clear();
    this.browserStates.clear();
  }

  /**
   * Clear all state including cache and sessions
   */
  reset(): void {
    this.clearAllQueries();
    this.cacheManager.clear();
    // Sessions are not cleared by default (they have their own timeout)
  }

  /**
   * Get number of active execution contexts
   */
  getActiveQueryCount(): number {
    return this.executionContexts.size;
  }

  /**
   * Get all active query IDs
   */
  getActiveQueryIds(): QueryID[] {
    return Array.from(this.executionContexts.keys());
  }

  /**
   * Cleanup expired state
   * Removes old execution contexts, browser states, etc.
   */
  cleanup(): void {
    // Cache and sessions have their own cleanup timers
    // Could add logic here to clean up abandoned query state
  }

  /**
   * Destroy state manager and cleanup resources
   */
  destroy(): void {
    this.clearAllQueries();
    this.cacheManager.destroy();
    this.sessionManager.destroy();
  }

  /**
   * Export state for debugging
   */
  toJSON(): object {
    return {
      activeQueries: this.executionContexts.size,
      browserStates: this.browserStates.size,
      cacheStats: this.cacheManager.getStats(),
      sessionCount: this.sessionManager.getSessionCount(),
    };
  }

  /**
   * Get all execution contexts (returns copy)
   */
  getAllExecutionContexts(): Map<QueryID, ExecutionContextManager> {
    return new Map(this.executionContexts);
  }

  /**
   * Get all browser states (returns copy)
   */
  getAllBrowserStates(): Map<QueryID, BrowserStateTracker> {
    return new Map(this.browserStates);
  }
}
