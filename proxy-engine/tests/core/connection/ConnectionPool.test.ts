/**
 * ConnectionPool Tests
 * Tests for connection pooling and lifecycle management
 */

import { assertEquals, assertExists, assert } from "@std/assert";

// Note: ConnectionPool uses example code at bottom of file, so we'll test the class directly

interface PooledConnection {
  id: string;
  conn: Deno.Conn;
  host: string;
  port: number;
  createdAt: number;
  lastUsedAt: number;
  requestCount: number;
  inUse: boolean;
}

interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  idleTimeout: number;
  maxLifetime: number;
}

class ConnectionPool {
  private pools: Map<string, PooledConnection[]> = new Map();
  private config: ConnectionPoolConfig;
  private nextId = 1;
  private cleanupInterval?: number;

  constructor(config: ConnectionPoolConfig) {
    this.config = config;
  }

  async acquire(host: string, port: number): Promise<PooledConnection | null> {
    const poolKey = `${host}:${port}`;
    const pool = this.pools.get(poolKey) || [];

    const available = pool.find((c) => !c.inUse && this.isConnectionValid(c));

    if (available) {
      available.inUse = true;
      available.lastUsedAt = Date.now();
      available.requestCount++;
      return available;
    }

    if (pool.length < this.config.maxConnections) {
      try {
        const conn = await Deno.connect({ hostname: host, port });

        const pooledConn: PooledConnection = {
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
        return pooledConn;
      } catch {
        return null;
      }
    }

    return null;
  }

  release(pooledConn: PooledConnection): void {
    pooledConn.inUse = false;
    pooledConn.lastUsedAt = Date.now();
  }

  private isConnectionValid(conn: PooledConnection): boolean {
    const now = Date.now();
    const age = now - conn.createdAt;
    const idleTime = now - conn.lastUsedAt;

    return age <= this.config.maxLifetime && idleTime <= this.config.idleTimeout;
  }

  cleanup(): void {
    this.pools.forEach((pool, poolKey) => {
      const validConnections = pool.filter((conn) => {
        if (conn.inUse) {
          return true;
        }

        if (!this.isConnectionValid(conn)) {
          try {
            conn.conn.close();
          } catch {
            // Already closed
          }
          return false;
        }

        return true;
      });

      this.pools.set(poolKey, validConnections);
    });
  }

  getStats() {
    let totalConnections = 0;
    let totalInUse = 0;
    let totalRequests = 0;

    this.pools.forEach((pool) => {
      totalConnections += pool.length;
      totalInUse += pool.filter((c) => c.inUse).length;
      pool.forEach((c) => {
        totalRequests += c.requestCount;
      });
    });

    return {
      totalConnections,
      totalInUse,
      totalAvailable: totalConnections - totalInUse,
      totalRequests,
      averageRequestsPerConnection: totalConnections > 0
        ? totalRequests / totalConnections
        : 0,
    };
  }

  startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10000);
  }

  stopCleanupInterval(): void {
    if (this.cleanupInterval !== undefined) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  closeAll(): void {
    this.pools.forEach((pool) => {
      pool.forEach((conn) => {
        try {
          conn.conn.close();
        } catch {
          // Already closed
        }
      });
    });
    this.pools.clear();
  }
}

// ============================================================================
// Constructor Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - constructor initializes with config",
  fn() {
    const config: ConnectionPoolConfig = {
      minConnections: 2,
      maxConnections: 10,
      idleTimeout: 30000,
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);

    assertExists(pool);
  },
});

Deno.test({
  name: "ConnectionPool - starts with zero connections",
  fn() {
    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 10,
      idleTimeout: 30000,
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);
    const stats = pool.getStats();

    assertEquals(stats.totalConnections, 0);
    assertEquals(stats.totalInUse, 0);
    assertEquals(stats.totalAvailable, 0);
  },
});

// ============================================================================
// Acquire Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - acquire creates new connection when pool empty",
  async fn() {
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const addr = listener.addr as Deno.NetAddr;

    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 10,
      idleTimeout: 30000,
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);

    try {
      const conn = await pool.acquire(addr.hostname, addr.port);

      assertExists(conn);
      assertEquals(conn.host, addr.hostname);
      assertEquals(conn.port, addr.port);
      assertEquals(conn.inUse, true);
      assertEquals(conn.requestCount, 1);

      pool.closeAll();
    } finally {
      listener.close();
    }
  },
});

Deno.test({
  name: "ConnectionPool - acquire increments request count",
  async fn() {
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const addr = listener.addr as Deno.NetAddr;

    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 10,
      idleTimeout: 30000,
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);

    try {
      const conn = await pool.acquire(addr.hostname, addr.port);
      assertExists(conn);

      const stats = pool.getStats();
      assertEquals(stats.totalConnections, 1);
      assertEquals(stats.totalInUse, 1);

      pool.closeAll();
    } finally {
      listener.close();
    }
  },
});

Deno.test({
  name: "ConnectionPool - acquire reuses released connection",
  async fn() {
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const addr = listener.addr as Deno.NetAddr;

    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 10,
      idleTimeout: 30000,
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);

    try {
      const conn1 = await pool.acquire(addr.hostname, addr.port);
      assertExists(conn1);
      const id1 = conn1.id;

      pool.release(conn1);

      const conn2 = await pool.acquire(addr.hostname, addr.port);
      assertExists(conn2);

      // Should reuse same connection
      assertEquals(conn2.id, id1);
      assertEquals(conn2.requestCount, 2);

      pool.closeAll();
    } finally {
      listener.close();
    }
  },
});

Deno.test({
  name: "ConnectionPool - acquire respects maxConnections limit",
  async fn() {
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const addr = listener.addr as Deno.NetAddr;

    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 2,
      idleTimeout: 30000,
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);

    try {
      const conn1 = await pool.acquire(addr.hostname, addr.port);
      const conn2 = await pool.acquire(addr.hostname, addr.port);

      assertExists(conn1);
      assertExists(conn2);

      // Third acquire should fail (pool exhausted)
      const conn3 = await pool.acquire(addr.hostname, addr.port);
      assertEquals(conn3, null);

      pool.closeAll();
    } finally {
      listener.close();
    }
  },
});

Deno.test({
  name: "ConnectionPool - acquire returns null on connection failure",
  async fn() {
    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 10,
      idleTimeout: 30000,
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);

    // Try to connect to non-existent host
    const conn = await pool.acquire("invalid-host-12345.nonexistent", 9999);

    assertEquals(conn, null);
  },
});

// ============================================================================
// Release Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - release marks connection as not in use",
  async fn() {
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const addr = listener.addr as Deno.NetAddr;

    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 10,
      idleTimeout: 30000,
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);

    try {
      const conn = await pool.acquire(addr.hostname, addr.port);
      assertExists(conn);
      assertEquals(conn.inUse, true);

      pool.release(conn);
      assertEquals(conn.inUse, false);

      pool.closeAll();
    } finally {
      listener.close();
    }
  },
});

Deno.test({
  name: "ConnectionPool - release updates lastUsedAt",
  async fn() {
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const addr = listener.addr as Deno.NetAddr;

    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 10,
      idleTimeout: 30000,
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);

    try {
      const conn = await pool.acquire(addr.hostname, addr.port);
      assertExists(conn);

      const before = conn.lastUsedAt;
      await new Promise((resolve) => setTimeout(resolve, 10));
      pool.release(conn);

      assert(conn.lastUsedAt > before);

      pool.closeAll();
    } finally {
      listener.close();
    }
  },
});

// ============================================================================
// Cleanup Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - cleanup removes stale connections",
  async fn() {
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const addr = listener.addr as Deno.NetAddr;

    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 10,
      idleTimeout: 50, // Very short timeout
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);

    try {
      const conn = await pool.acquire(addr.hostname, addr.port);
      assertExists(conn);

      pool.release(conn);

      // Wait for idle timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      pool.cleanup();

      const stats = pool.getStats();
      assertEquals(stats.totalConnections, 0);
    } finally {
      listener.close();
    }
  },
});

Deno.test({
  name: "ConnectionPool - cleanup keeps connections in use",
  async fn() {
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const addr = listener.addr as Deno.NetAddr;

    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 10,
      idleTimeout: 50,
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);

    try {
      const conn = await pool.acquire(addr.hostname, addr.port);
      assertExists(conn);

      // Don't release - keep in use
      await new Promise((resolve) => setTimeout(resolve, 100));

      pool.cleanup();

      const stats = pool.getStats();
      assertEquals(stats.totalConnections, 1);
      assertEquals(stats.totalInUse, 1);

      pool.closeAll();
    } finally {
      listener.close();
    }
  },
});

Deno.test({
  name: "ConnectionPool - cleanup respects maxLifetime",
  async fn() {
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const addr = listener.addr as Deno.NetAddr;

    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 10,
      idleTimeout: 300000,
      maxLifetime: 50, // Very short lifetime
    };

    const pool = new ConnectionPool(config);

    try {
      const conn = await pool.acquire(addr.hostname, addr.port);
      assertExists(conn);

      pool.release(conn);

      // Wait for max lifetime
      await new Promise((resolve) => setTimeout(resolve, 100));

      pool.cleanup();

      const stats = pool.getStats();
      assertEquals(stats.totalConnections, 0);
    } finally {
      listener.close();
    }
  },
});

// ============================================================================
// Statistics Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - getStats returns accurate counts",
  async fn() {
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const addr = listener.addr as Deno.NetAddr;

    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 10,
      idleTimeout: 30000,
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);

    try {
      const conn1 = await pool.acquire(addr.hostname, addr.port);
      const conn2 = await pool.acquire(addr.hostname, addr.port);

      assertExists(conn1);
      assertExists(conn2);

      const stats = pool.getStats();

      assertEquals(stats.totalConnections, 2);
      assertEquals(stats.totalInUse, 2);
      assertEquals(stats.totalAvailable, 0);

      pool.closeAll();
    } finally {
      listener.close();
    }
  },
});

Deno.test({
  name: "ConnectionPool - getStats calculates average requests",
  async fn() {
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const addr = listener.addr as Deno.NetAddr;

    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 10,
      idleTimeout: 30000,
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);

    try {
      const conn = await pool.acquire(addr.hostname, addr.port);
      assertExists(conn);

      pool.release(conn);

      await pool.acquire(addr.hostname, addr.port);

      const stats = pool.getStats();

      assertEquals(stats.totalRequests, 2);
      assertEquals(stats.averageRequestsPerConnection, 2);

      pool.closeAll();
    } finally {
      listener.close();
    }
  },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - complete lifecycle",
  async fn() {
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const addr = listener.addr as Deno.NetAddr;

    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 5,
      idleTimeout: 30000,
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);

    try {
      // Acquire multiple connections
      const conn1 = await pool.acquire(addr.hostname, addr.port);
      const conn2 = await pool.acquire(addr.hostname, addr.port);

      assertExists(conn1);
      assertExists(conn2);

      let stats = pool.getStats();
      assertEquals(stats.totalConnections, 2);
      assertEquals(stats.totalInUse, 2);

      // Release first connection
      pool.release(conn1);

      stats = pool.getStats();
      assertEquals(stats.totalInUse, 1);
      assertEquals(stats.totalAvailable, 1);

      // Acquire again - should reuse
      const conn3 = await pool.acquire(addr.hostname, addr.port);
      assertExists(conn3);
      assertEquals(conn3.id, conn1.id);

      stats = pool.getStats();
      assertEquals(stats.totalConnections, 2);
      assertEquals(stats.totalInUse, 2);

      pool.closeAll();
    } finally {
      listener.close();
    }
  },
});

Deno.test({
  name: "ConnectionPool - closeAll closes all connections",
  async fn() {
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const addr = listener.addr as Deno.NetAddr;

    const config: ConnectionPoolConfig = {
      minConnections: 0,
      maxConnections: 10,
      idleTimeout: 30000,
      maxLifetime: 300000,
    };

    const pool = new ConnectionPool(config);

    try {
      await pool.acquire(addr.hostname, addr.port);
      await pool.acquire(addr.hostname, addr.port);

      let stats = pool.getStats();
      assertEquals(stats.totalConnections, 2);

      pool.closeAll();

      stats = pool.getStats();
      assertEquals(stats.totalConnections, 0);
    } finally {
      listener.close();
    }
  },
});
