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
}

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  idleTimeout: number; // milliseconds
  maxLifetime: number; // milliseconds
}

export class ConnectionPool {
  private pools: Map<string, PooledConnectionInfo[]> = new Map();
  private config: ConnectionPoolConfig;
  private nextId = 1;

  constructor(config: ConnectionPoolConfig) {
    this.config = config;

    // Start cleanup interval
    this.startCleanupInterval();
  }

  async acquire(host: string, port: number): Promise<PooledConnectionInfo | null> {
    const poolKey = `${host}:${port}`;
    const pool = this.pools.get(poolKey) || [];

    console.log(`[POOL] Acquiring connection to ${poolKey}`);
    console.log(`  Current pool size: ${pool.length}`);
    console.log(`  Available: ${pool.filter((c) => !c.inUse).length}`);
    console.log(`  In use: ${pool.filter((c) => c.inUse).length}`);

    // Find available connection
    const available = pool.find((c) => !c.inUse && this.isConnectionValid(c));

    if (available) {
      available.inUse = true;
      available.lastUsedAt = Date.now();
      available.requestCount++;

      console.log(`  ✓ Reusing connection ${available.id}`);
      console.log(`    Age: ${((Date.now() - available.createdAt) / 1000).toFixed(1)}s`);
      console.log(`    Requests: ${available.requestCount}`);
      return available;
    }

    // Check if we can create new connection
    if (pool.length < this.config.maxConnections) {
      console.log(`  → Creating new connection (${pool.length + 1}/${this.config.maxConnections})`);

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
        };

        pool.push(pooledConn);
        this.pools.set(poolKey, pool);

        console.log(`  ✓ New connection ${pooledConn.id} created`);
        return pooledConn;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ Failed to create connection: ${message}`);
        return null;
      }
    }

    // Pool is full and no connections available
    console.log(`  ✗ Pool exhausted (${pool.length}/${this.config.maxConnections})`);
    console.log(`    All connections are in use`);
    return null;
  }

  release(pooledConn: PooledConnectionInfo): void {
    pooledConn.inUse = false;
    pooledConn.lastUsedAt = Date.now();

    console.log(`[POOL] Released connection ${pooledConn.id}`);
    console.log(`  Returned to pool for ${pooledConn.host}:${pooledConn.port}`);
  }

  private isConnectionValid(conn: PooledConnectionInfo): boolean {
    const now = Date.now();

    // Check if connection is too old
    const age = now - conn.createdAt;
    if (age > this.config.maxLifetime) {
      console.log(`  ✗ Connection ${conn.id} too old (${(age / 1000).toFixed(1)}s)`);
      return false;
    }

    // Check if connection has been idle too long
    const idleTime = now - conn.lastUsedAt;
    if (idleTime > this.config.idleTimeout) {
      console.log(`  ✗ Connection ${conn.id} idle too long (${(idleTime / 1000).toFixed(1)}s)`);
      return false;
    }

    return true;
  }

  private startCleanupInterval(): void {
    // Run cleanup every 10 seconds
    setInterval(() => {
      console.log("\n[CLEANUP] Running connection pool cleanup...");
      this.cleanup();
    }, 10000);
  }

  private cleanup(): void {
    const now = Date.now();
    let totalClosed = 0;

    this.pools.forEach((pool, poolKey) => {
      const before = pool.length;

      // Remove invalid connections
      const validConnections = pool.filter((conn) => {
        if (conn.inUse) {
          return true; // Keep active connections
        }

        if (!this.isConnectionValid(conn)) {
          try {
            conn.conn.close();
            totalClosed++;
            console.log(`  ✗ Closed stale connection ${conn.id} for ${poolKey}`);
          } catch {
            // Already closed
          }
          return false;
        }

        return true;
      });

      this.pools.set(poolKey, validConnections);

      if (before !== validConnections.length) {
        console.log(`  ${poolKey}: ${before} → ${validConnections.length} connections`);
      }
    });

    if (totalClosed > 0) {
      console.log(`[CLEANUP] Closed ${totalClosed} stale connection(s)`);
    } else {
      console.log(`[CLEANUP] No stale connections found`);
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
      `  Average requests per connection: ${(totalRequests / totalConnections).toFixed(2)}`,
    );
    console.log("=".repeat(70) + "\n");
  }
}

// Example usage
const config: ConnectionPoolConfig = {
  minConnections: 2,
  maxConnections: 10,
  idleTimeout: 30000, // 30 seconds
  maxLifetime: 300000, // 5 minutes
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
