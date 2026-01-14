/**
 * Socket statistics tracking
 *
 * Tracks metrics for socket operations including bytes transferred,
 * operation counts, errors, and timing information.
 */

import type { Timestamp } from "../../../types/identifiers.ts";

export interface SocketStats {
    bytesRead: number;
    bytesWritten: number;
    readOperations: number;
    writeOperations: number;
    errors: number;
    createdAt: Timestamp;
    lastActiveAt: Timestamp;
}

/**
 * Create initial socket statistics
 */
export function createSocketStats(): SocketStats {
    const now = Date.now();
    return {
        bytesRead: 0,
        bytesWritten: 0,
        readOperations: 0,
        writeOperations: 0,
        errors: 0,
        createdAt: now,
        lastActiveAt: now,
    };
}

/**
 * Update socket statistics after read operation
 */
export function recordReadOperation(stats: SocketStats, bytesRead: number): void {
    stats.bytesRead += bytesRead;
    stats.readOperations++;
    // Ensure lastActiveAt always advances (either with current time or at least +1)
    stats.lastActiveAt = Math.max(Date.now(), stats.lastActiveAt + 1);
}

/**
 * Update socket statistics after write operation
 */
export function recordWriteOperation(stats: SocketStats, bytesWritten: number): void {
    stats.bytesWritten += bytesWritten;
    stats.writeOperations++;
    // Ensure lastActiveAt always advances (either with current time or at least +1)
    stats.lastActiveAt = Math.max(Date.now(), stats.lastActiveAt + 1);
}

/**
 * Record error in socket statistics
 */
export function recordError(stats: SocketStats): void {
    stats.errors++;
    // Ensure lastActiveAt always advances (either with current time or at least +1)
    stats.lastActiveAt = Math.max(Date.now(), stats.lastActiveAt + 1);
}
