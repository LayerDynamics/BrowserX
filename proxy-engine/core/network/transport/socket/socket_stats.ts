/**
 * Socket statistics
 *
 * Tracks metrics for socket operations
 */

/**
 * Socket statistics interface
 */
export interface SocketStats {
  /**
   * Total bytes read from socket
   */
  bytesRead: number;

  /**
   * Total bytes written to socket
   */
  bytesWritten: number;

  /**
   * Total number of read operations
   */
  readsCount: number;

  /**
   * Total number of write operations
   */
  writesCount: number;

  /**
   * Total number of errors encountered
   */
  errorsCount: number;

  /**
   * Timestamp when socket was created
   */
  createdAt: number;

  /**
   * Timestamp of last read or write activity
   */
  lastActivityAt: number;
}

/**
 * Create empty socket stats
 */
export function createSocketStats(): SocketStats {
  const now = Date.now();
  return {
    bytesRead: 0,
    bytesWritten: 0,
    readsCount: 0,
    writesCount: 0,
    errorsCount: 0,
    createdAt: now,
    lastActivityAt: now,
  };
}

/**
 * Calculate average bytes per read
 */
export function getAvgBytesPerRead(stats: SocketStats): number {
  return stats.readsCount > 0 ? stats.bytesRead / stats.readsCount : 0;
}

/**
 * Calculate average bytes per write
 */
export function getAvgBytesPerWrite(stats: SocketStats): number {
  return stats.writesCount > 0 ? stats.bytesWritten / stats.writesCount : 0;
}

/**
 * Calculate idle time in milliseconds
 */
export function getIdleTime(stats: SocketStats): number {
  return Date.now() - stats.lastActivityAt;
}

/**
 * Calculate socket age in milliseconds
 */
export function getAge(stats: SocketStats): number {
  return Date.now() - stats.createdAt;
}

/**
 * Format socket stats for display
 */
export function formatSocketStats(stats: SocketStats): string {
  const lines = [
    `Bytes Read: ${stats.bytesRead.toLocaleString()}`,
    `Bytes Written: ${stats.bytesWritten.toLocaleString()}`,
    `Reads: ${stats.readsCount.toLocaleString()}`,
    `Writes: ${stats.writesCount.toLocaleString()}`,
    `Errors: ${stats.errorsCount.toLocaleString()}`,
    `Avg Bytes/Read: ${getAvgBytesPerRead(stats).toFixed(2)}`,
    `Avg Bytes/Write: ${getAvgBytesPerWrite(stats).toFixed(2)}`,
    `Age: ${(getAge(stats) / 1000).toFixed(2)}s`,
    `Idle: ${(getIdleTime(stats) / 1000).toFixed(2)}s`,
  ];

  return lines.join("\n");
}
