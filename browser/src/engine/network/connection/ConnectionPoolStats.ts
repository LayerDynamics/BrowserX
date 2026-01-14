/**
 * Connection Pool Statistics
 *
 * Tracks metrics for connection pool performance including
 * connection reuse rates, wait times, and error rates.
 */

import type { Timestamp } from "../../../types/identifiers.ts";

export interface ConnectionPoolStats {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    reuseCount: number;
    missCount: number;
    errorCount: number;
    averageWaitTime: number;
    lastUpdated: Timestamp;
}

/**
 * Create initial connection pool statistics
 */
export function createConnectionPoolStats(): ConnectionPoolStats {
    return {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        reuseCount: 0,
        missCount: 0,
        errorCount: 0,
        averageWaitTime: 0,
        lastUpdated: Date.now(),
    };
}
