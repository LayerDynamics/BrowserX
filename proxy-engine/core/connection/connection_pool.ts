// connection_pool.ts - Connection pooling for proxy

export interface PooledConnectionInfo {
  id: string;
  conn: Deno.Conn;
  host: string;
  port: number;
  createdAt: number;
  lastUsedAt: number;
  requestCount: number;
  inUse: boolean;
  /** Marked true when an operation on this connection fails, signaling it should be discarded */
  dead: boolean;
}

export type LogLevel = "debug" | "info" | "warn" | "error" | "none";

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  idleTimeout: number; // milliseconds
  maxLifetime: number; // milliseconds
  logLevel?: LogLevel;
}

const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

export class ConnectionPool {
  private pools: Map<string, PooledConnectionInfo[]> = new Map();
  private config: ConnectionPoolConfig;
  private nextId = 1;
  private cleanupIntervalId?: number;

  constructor(config: ConnectionPoolConfig) {
    this.config = config;

    // Start cleanup interval
    this.startCleanupInterval();
  }

  private log(level: LogLevel, ...args: unknown[]): void {
    const configLevel = this.config.logLevel ?? "warn";
    if (LOG_PRIORITY[level] >= LOG_PRIORITY[configLevel]) {
      if (level === "error") {
        console.error(...args);
      } else {
        console.log(...args);
      }
    }
  }

  /**
   * Pre-warm the pool by creating minConnections connections for a given host:port
   */
  async prewarm(host: string, port: number): Promise<void> {
    const poolKey = `${host}:${port}`;
    const pool = this.pools.get(poolKey) || [];
    this.pools.set(poolKey, pool);

    const toCreate = this.config.minConnections - pool.length;
    this.log("info", `[POOL] Pre-warming ${toCreate} connection(s) for ${poolKey}`);

    for (let i = 0; i < toCreate; i++) {
      try {
        const conn = await Deno.connect({ hostname: host, port });
        const pooledConn: PooledConnectionInfo = {
          id: `conn-${this.nextId++}`,
          conn,
          host,
          port,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
          requestCount: 0,
          inUse: false,
          dead: false,
        };
        pool.push(pooledConn);
        this.log("info", `  ✓ Pre-warmed connection ${pooledConn.id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.log("warn", `  ✗ Failed to pre-warm connection: ${message}`);
      }
    }
  }

  async acquire(host: string, port: number): Promise<PooledConnectionInfo | null> {
    const poolKey = `${host}:${port}`;
    const pool = this.pools.get(poolKey) || [];

    this.log("debug", `[POOL] Acquiring connection to ${poolKey}`);
    this.log("debug", `  Current pool size: ${pool.length}`);
    this.log("debug", `  Available: ${pool.filter((c) => !c.inUse).length}`);
    this.log("debug", `  In use: ${pool.filter((c) => c.inUse).length}`);

    // Find available connection
    const available = pool.find((c) => !c.inUse && this.isConnectionValid(c));

    if (available) {
      available.inUse = true;
      available.lastUsedAt = Date.now();
      available.requestCount++;

      this.log("debug", `  ✓ Reusing connection ${available.id}`);
      this.log("debug", `    Age: ${((Date.now() - available.createdAt) / 1000).toFixed(1)}s`);
      this.log("debug", `    Requests: ${available.requestCount}`);
      return available;
    }

    // Check if we can create new connection
    if (pool.length < this.config.maxConnections) {
      this.log("info", `  → Creating new connection (${pool.length + 1}/${this.config.maxConnections})`);

      try {
        const conn = await Deno.connect({ hostname: host, port });

        const pooledConn: PooledConnectionInfo = {
          id: `conn-${this.nextId++}`,
          conn,
          host,
          port,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
          requestCount: 1,
          inUse: true,
          dead: false,
        };

        pool.push(pooledConn);
        this.pools.set(poolKey, pool);

        this.log("info", `  ✓ New connection ${pooledConn.id} created`);
        return pooledConn;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.log("error", `  ✗ Failed to create connection: ${message}`);
        return null;
      }
    }

    // Pool is full and no connections available
    this.log("warn", `  ✗ Pool exhausted (${pool.length}/${this.config.maxConnections})`);
    this.log("warn", `    All connections are in use`);
    return null;
  }

  release(pooledConn: PooledConnectionInfo): void {
    // Validate the connection is still alive before returning to pool
    if (!this.isConnectionAlive(pooledConn)) {
      this.log("info", `[POOL] Connection ${pooledConn.id} is dead, disposing instead of returning to pool`);
      this.disposeConnection(pooledConn);
      return;
    }

    pooledConn.inUse = false;
    pooledConn.lastUsedAt = Date.now();

    this.log("debug", `[POOL] Released connection ${pooledConn.id}`);
    this.log("debug", `  Returned to pool for ${pooledConn.host}:${pooledConn.port}`);
  }

  /**
   * Check if a connection is still alive
   */
  /**
   * Mark a connection as dead so it will be discarded on release.
   * Call this when an I/O operation on the connection fails.
   */
  markDead(conn: PooledConnectionInfo): void {
    conn.dead = true;
    this.log("info", `[POOL] Connection ${conn.id} marked dead`);
  }

  private isConnectionAlive(conn: PooledConnectionInfo): boolean {
    try {
      // If explicitly marked dead by a failed operation, discard it
      if (conn.dead) {
        return false;
      }

      // Check basic validity (age, idle time)
      if (!this.isConnectionValid(conn)) {
        return false;
      }

      // In newer Deno versions, rid is removed after close().
      // If rid exists as a property but is undefined/null, the connection was closed.
      const rid = (conn.conn as any).rid;
      if ("rid" in (conn.conn as any) && (rid === undefined || rid === null)) {
        return false;
      }

      // Probe: attempt a zero-length write to detect peer-closed connections.
      // A closed connection will throw immediately on write.
      try {
        conn.conn.write(new Uint8Array(0));
      } catch {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Dispose a dead connection and remove it from the pool
   */
  private disposeConnection(conn: PooledConnectionInfo): void {
    try {
      conn.conn.close();
    } catch {
      // Already closed
    }

    // Remove from pool
    const poolKey = `${conn.host}:${conn.port}`;
    const pool = this.pools.get(poolKey);
    if (pool) {
      const index = pool.indexOf(conn);
      if (index !== -1) {
        pool.splice(index, 1);
      }
    }
  }

  private isConnectionValid(conn: PooledConnectionInfo): boolean {
    const now = Date.now();

    // Check if connection is too old
    const age = now - conn.createdAt;
    if (age > this.config.maxLifetime) {
      this.log("debug", `  ✗ Connection ${conn.id} too old (${(age / 1000).toFixed(1)}s)`);
      return false;
    }

    // Check if connection has been idle too long
    const idleTime = now - conn.lastUsedAt;
    if (idleTime > this.config.idleTimeout) {
      this.log("debug", `  ✗ Connection ${conn.id} idle too long (${(idleTime / 1000).toFixed(1)}s)`);
      return false;
    }

    return true;
  }

  private startCleanupInterval(): void {
    // Run cleanup every 10 seconds
    this.cleanupIntervalId = setInterval(() => {
      this.log("debug", "\n[CLEANUP] Running connection pool cleanup...");
      this.cleanup();
    }, 10000) as unknown as number;
  }

  /**
   * Destroy the connection pool and cleanup all resources
   */
  destroy(): void {
    // Clear the cleanup interval to prevent memory leak
    if (this.cleanupIntervalId !== undefined) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }

    // Close all connections in all pools
    for (const [poolKey, pool] of this.pools.entries()) {
      for (const conn of pool) {
        try {
          conn.conn.close();
          this.log("info", `[POOL DESTROY] Closed connection ${conn.id} for ${poolKey}`);
        } catch {
          // Already closed
        }
      }
    }
    this.pools.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    let totalClosed = 0;

    this.pools.forEach((pool, poolKey) => {
      const before = pool.length;

      // Count idle connections to respect minConnections
      let idleKept = 0;
      const idleConns = pool.filter((c) => !c.inUse);
      const minToKeep = this.config.minConnections;
      this.log("debug", `  ${poolKey}: ${idleConns.length} idle, keeping min ${minToKeep}`);

      // Remove invalid connections and idle connections past timeout,
      // but keep at least minConnections idle connections per pool
      const validConnections = pool.filter((conn) => {
        if (conn.inUse) {
          return true; // Keep active connections
        }

        // Check idle timeout using current timestamp
        const idleMs = now - conn.lastUsedAt;
        const isIdle = idleMs > this.config.idleTimeout;
        const isStale = !this.isConnectionValid(conn);

        if (isIdle || isStale) {
          // Keep if we haven't preserved enough idle connections for minConnections
          if (idleKept < minToKeep) {
            // Only keep if not stale (expired maxLifetime)
            const age = now - conn.createdAt;
            if (age <= this.config.maxLifetime) {
              idleKept++;
              return true;
            }
          }

          try {
            conn.conn.close();
            totalClosed++;
            this.log("info", `  ✗ Closed ${isIdle ? "idle" : "stale"} connection ${conn.id} for ${poolKey}`);
          } catch {
            // Already closed
          }
          return false;
        }

        idleKept++;
        return true;
      });

      this.pools.set(poolKey, validConnections);

      if (before !== validConnections.length) {
        this.log("info", `  ${poolKey}: ${before} → ${validConnections.length} connections`);
      }
    });

    if (totalClosed > 0) {
      this.log("info", `[CLEANUP] Closed ${totalClosed} stale connection(s)`);
    } else {
      this.log("debug", `[CLEANUP] No stale connections found`);
    }
  }

  /**
   * Get all connection pools (returns copy)
   */
  getPools(): Map<string, PooledConnectionInfo[]> {
    return new Map(this.pools);
  }

  /**
   * Get configuration
   */
  getConfig(): ConnectionPoolConfig {
    return this.config;
  }

  /**
   * Get next connection ID
   */
  getNextId(): number {
    return this.nextId;
  }

  /**
   * Get pool statistics summary
   */
  getStats() {
    let totalConnections = 0;
    let totalInUse = 0;
    let totalRequests = 0;

    for (const pool of this.pools.values()) {
      for (const conn of pool) {
        totalConnections++;
        if (conn.inUse) totalInUse++;
        totalRequests += conn.requestCount;
      }
    }

    return {
      totalPools: this.pools.size,
      totalConnections,
      inUseConnections: totalInUse,
      availableConnections: totalConnections - totalInUse,
      totalRequests,
      avgRequestsPerConnection: totalConnections > 0 ? totalRequests / totalConnections : 0,
    };
  }

  displayStats(): void {
    console.log(`\n${"=".repeat(70)}`);
    console.log("Connection Pool Statistics");
    console.log("=".repeat(70));

    let totalConnections = 0;
    let totalInUse = 0;
    let totalRequests = 0;

    this.pools.forEach((pool, poolKey) => {
      console.log(`\nPool: ${poolKey}`);
      console.log(`  Total connections: ${pool.length}`);
      console.log(`  In use: ${pool.filter((c) => c.inUse).length}`);
      console.log(`  Available: ${pool.filter((c) => !c.inUse).length}`);

      pool.forEach((conn) => {
        const age = ((Date.now() - conn.createdAt) / 1000).toFixed(1);
        const idle = ((Date.now() - conn.lastUsedAt) / 1000).toFixed(1);
        const status = conn.inUse ? "IN USE" : "IDLE";

        console.log(
          `    ${conn.id}: ${status}, age: ${age}s, idle: ${idle}s, reqs: ${conn.requestCount}`,
        );

        totalConnections++;
        if (conn.inUse) totalInUse++;
        totalRequests += conn.requestCount;
      });
    });

    console.log(`\nOverall:`);
    console.log(`  Total connections: ${totalConnections}`);
    console.log(`  In use: ${totalInUse}`);
    console.log(`  Total requests served: ${totalRequests}`);
    console.log(
      `  Average requests per connection: ${totalConnections > 0 ? (totalRequests / totalConnections).toFixed(2) : "N/A"}`,
    );
    console.log("=".repeat(70) + "\n");
  }
}

// Example usage - only runs when executed directly (prevents memory leak on import)
if (import.meta.main) {
  const config: ConnectionPoolConfig = {
    minConnections: 2,
    maxConnections: 10,
    idleTimeout: 30000, // 30 seconds
    maxLifetime: 300000, // 5 minutes
    logLevel: "info",
  };

  const pool = new ConnectionPool(config);

  console.log("=== Connection Pool Demo ===\n");
  console.log("Simulating multiple requests with connection pooling:\n");

  // Simulate multiple requests
  async function simulateRequests() {
    for (let i = 0; i < 5; i++) {
      console.log(`\n--- Request ${i + 1} ---`);

      const conn = await pool.acquire("example.com", 80);

      if (conn) {
        // Simulate using the connection
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Release back to pool
        pool.release(conn);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    pool.displayStats();
  }

  await simulateRequests();

  console.log("\n=== Key Benefits ===");
  console.log("✓ Connections reused instead of creating new ones");
  console.log("✓ Saves TCP handshake time (~50-100ms)");
  console.log("✓ Saves TLS handshake time (~100-300ms for HTTPS)");
  console.log("✓ Reduces load on backend servers");
  console.log("✓ Better resource utilization");

  // Clean up to prevent memory leak from cleanup interval
  pool.destroy();
}
