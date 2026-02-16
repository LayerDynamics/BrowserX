/**
 * Operation Tracker
 * Tracks active operations with minimal memory footprint
 *
 * Uses sliding windows for metrics to avoid unbounded memory growth.
 * Provides real-time statistics about server operations.
 */

import {
  type ActiveOperation,
  type OperationType,
  type OperationTrackerStats,
} from "./types.ts";

/**
 * Operation tracker configuration
 */
export interface OperationTrackerConfig {
  /** Maximum age for completed timestamps (default: 60000ms = 1 minute) */
  completedWindowMs?: number;
  /** Maximum age for error timestamps (default: 3600000ms = 1 hour) */
  errorWindowMs?: number;
  /** Maximum age for request timestamps (default: 1000ms = 1 second) */
  requestWindowMs?: number;
}

/**
 * Internal operation data
 */
interface InternalOperation {
  id: string;
  type: OperationType;
  sessionId?: string;
  startedAt: number;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Operation tracker
 *
 * Tracks active operations and provides statistics.
 * Uses fixed-size sliding windows for metrics.
 */
export class OperationTracker {
  private operations: Map<string, InternalOperation> = new Map();
  private completedTimestamps: number[] = [];
  private requestTimestamps: number[] = [];
  private errorTimestamps: number[] = [];

  private readonly completedWindowMs: number;
  private readonly errorWindowMs: number;
  private readonly requestWindowMs: number;

  constructor(config: OperationTrackerConfig = {}) {
    this.completedWindowMs = config.completedWindowMs ?? 60000; // 1 minute
    this.errorWindowMs = config.errorWindowMs ?? 3600000; // 1 hour
    this.requestWindowMs = config.requestWindowMs ?? 1000; // 1 second
  }

  /**
   * Start tracking an operation
   *
   * @returns Operation ID for completing the operation
   */
  startOperation(
    type: OperationType,
    description: string,
    sessionId?: string,
    metadata?: Record<string, unknown>,
  ): string {
    const id = this.generateOperationId(type);

    this.operations.set(id, {
      id,
      type,
      sessionId,
      startedAt: Date.now(),
      description,
      metadata,
    });

    // Track request
    this.requestTimestamps.push(Date.now());
    this.pruneTimestamps();

    return id;
  }

  /**
   * Complete an operation
   *
   * @param id - Operation ID from startOperation
   * @param error - Error if operation failed
   */
  completeOperation(id: string, error?: Error): void {
    if (this.operations.has(id)) {
      this.operations.delete(id);
      this.completedTimestamps.push(Date.now());

      if (error) {
        this.errorTimestamps.push(Date.now());
      }

      this.pruneTimestamps();
    }
  }

  /**
   * Get all active operations with current elapsed time
   */
  getActiveOperations(): ActiveOperation[] {
    const now = Date.now();
    return Array.from(this.operations.values()).map((op) => ({
      id: op.id,
      type: op.type,
      sessionId: op.sessionId,
      startedAt: op.startedAt,
      elapsedMs: now - op.startedAt,
      description: op.description,
      metadata: op.metadata,
    }));
  }

  /**
   * Get operations for a specific session
   */
  getSessionOperations(sessionId: string): ActiveOperation[] {
    return this.getActiveOperations().filter(
      (op) => op.sessionId === sessionId,
    );
  }

  /**
   * Get count of active operations
   */
  getActiveCount(): number {
    return this.operations.size;
  }

  /**
   * Get count of pending operations for a session
   */
  getSessionOperationCount(sessionId: string): number {
    let count = 0;
    for (const op of this.operations.values()) {
      if (op.sessionId === sessionId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get operation statistics
   */
  getStats(): OperationTrackerStats {
    this.pruneTimestamps();

    const now = Date.now();
    const oneMinuteAgo = now - this.completedWindowMs;
    const oneHourAgo = now - this.errorWindowMs;
    const oneSecondAgo = now - this.requestWindowMs;

    const completedLastMin = this.completedTimestamps.filter(
      (t) => t > oneMinuteAgo,
    ).length;
    const errorsLastHour = this.errorTimestamps.filter(
      (t) => t > oneHourAgo,
    ).length;
    const requestsLastSecond = this.requestTimestamps.filter(
      (t) => t > oneSecondAgo,
    ).length;

    return {
      active: this.operations.size,
      completedLastMinute: completedLastMin,
      requestsPerSecond: requestsLastSecond,
      errorsLastHour,
      errorRate: completedLastMin > 0 ? errorsLastHour / 60 : 0,
    };
  }

  /**
   * Check if an operation exists
   */
  hasOperation(id: string): boolean {
    return this.operations.has(id);
  }

  /**
   * Get a specific operation
   */
  getOperation(id: string): ActiveOperation | undefined {
    const op = this.operations.get(id);
    if (!op) return undefined;

    return {
      id: op.id,
      type: op.type,
      sessionId: op.sessionId,
      startedAt: op.startedAt,
      elapsedMs: Date.now() - op.startedAt,
      description: op.description,
      metadata: op.metadata,
    };
  }

  /**
   * Cancel an operation (remove without marking as error)
   */
  cancelOperation(id: string): boolean {
    return this.operations.delete(id);
  }

  /**
   * Clear all operations (for cleanup)
   */
  clear(): void {
    this.operations.clear();
    this.completedTimestamps = [];
    this.requestTimestamps = [];
    this.errorTimestamps = [];
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(type: OperationType): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `op_${type}_${timestamp}_${random}`;
  }

  /**
   * Prune old timestamps to prevent memory growth
   */
  private pruneTimestamps(): void {
    const now = Date.now();
    const oneMinuteAgo = now - this.completedWindowMs;
    const oneHourAgo = now - this.errorWindowMs;
    const oneSecondAgo = now - this.requestWindowMs;

    this.completedTimestamps = this.completedTimestamps.filter(
      (t) => t > oneMinuteAgo,
    );
    this.requestTimestamps = this.requestTimestamps.filter(
      (t) => t > oneSecondAgo,
    );
    this.errorTimestamps = this.errorTimestamps.filter((t) => t > oneHourAgo);
  }
}

/**
 * Create a new operation tracker with default configuration
 */
export function createOperationTracker(
  config?: OperationTrackerConfig,
): OperationTracker {
  return new OperationTracker(config);
}
