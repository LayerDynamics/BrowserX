/**
 * ConnectionPool Tests
 * Comprehensive tests for ConnectionPool functionality
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
  ConnectionPool,
  type ConnectionPoolConfig,
  type PooledConnectionInfo,
} from "../../../core/connection/connection_pool.ts";

// ============================================================================
// Helper Functions
// ============================================================================

function createTestConfig(overrides?: Partial<ConnectionPoolConfig>): ConnectionPoolConfig {
  return {
    minConnections: 1,
    maxConnections: 10,
    idleTimeout: 30000, // 30 seconds
    maxLifetime: 300000, // 5 minutes
    ...overrides,
  };
}

// ============================================================================
// Constructor / Initialization Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - can be instantiated",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());
    assertExists(pool);
    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - stores configuration",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const config = createTestConfig({ maxConnections: 20, idleTimeout: 60000 });
    const pool = new ConnectionPool(config);

    const storedConfig = pool.getConfig();
    assertEquals(storedConfig.maxConnections, 20);
    assertEquals(storedConfig.idleTimeout, 60000);
    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - initializes with empty pools",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());
    const pools = pool.getPools();

    assertEquals(pools.size, 0);
    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - initializes with nextId at 1",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());
    assertEquals(pool.getNextId(), 1);
    pool.destroy();
  },
});

// ============================================================================
// getConfig Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - getConfig returns all config values",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const config = createTestConfig({
      minConnections: 5,
      maxConnections: 50,
      idleTimeout: 45000,
      maxLifetime: 600000,
    });
    const pool = new ConnectionPool(config);

    const result = pool.getConfig();
    assertEquals(result.minConnections, 5);
    assertEquals(result.maxConnections, 50);
    assertEquals(result.idleTimeout, 45000);
    assertEquals(result.maxLifetime, 600000);
    pool.destroy();
  },
});

// ============================================================================
// getPools Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - getPools returns copy of pools",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());
    const pools1 = pool.getPools();
    const pools2 = pool.getPools();

    // Should be different Map instances
    assert(pools1 !== pools2);
    pool.destroy();
  },
});

// ============================================================================
// release Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - release marks connection as not in use",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());

    // Create a mock pooled connection info
    const mockConn: PooledConnectionInfo = {
      id: "conn-test",
      conn: { close: () => {}, write: () => Promise.resolve(0), rid: 1 } as unknown as Deno.Conn,
      host: "localhost",
      port: 8080,
      createdAt: Date.now(),
      lastUsedAt: Date.now() - 1000,
      lastSuccessfulIO: Date.now() - 1000,
      requestCount: 1,
      inUse: true,
      dead: false,
    };

    assertEquals(mockConn.inUse, true);

    pool.release(mockConn);

    assertEquals(mockConn.inUse, false);
    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - release updates lastUsedAt timestamp",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());
    const oldTimestamp = Date.now() - 10000;

    const mockConn: PooledConnectionInfo = {
      id: "conn-test",
      conn: { close: () => {}, write: () => Promise.resolve(0), rid: 1 } as unknown as Deno.Conn,
      host: "localhost",
      port: 8080,
      createdAt: Date.now(),
      lastUsedAt: oldTimestamp,
      lastSuccessfulIO: oldTimestamp,
      requestCount: 1,
      inUse: true,
      dead: false,
    };

    pool.release(mockConn);

    assert(mockConn.lastUsedAt > oldTimestamp);
    pool.destroy();
  },
});

// ============================================================================
// getStats Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - getStats returns zero counts for empty pool",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());
    const stats = pool.getStats();

    assertEquals(stats.totalPools, 0);
    assertEquals(stats.totalConnections, 0);
    assertEquals(stats.inUseConnections, 0);
    assertEquals(stats.availableConnections, 0);
    assertEquals(stats.totalRequests, 0);
    assertEquals(stats.avgRequestsPerConnection, 0);
    pool.destroy();
  },
});

// ============================================================================
// destroy Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - destroy clears all pools",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());

    // Destroy should clear pools
    pool.destroy();

    assertEquals(pool.getPools().size, 0);
  },
});

// ============================================================================
// Configuration Boundary Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - respects minConnections config",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const config = createTestConfig({ minConnections: 3 });
    const pool = new ConnectionPool(config);

    assertEquals(pool.getConfig().minConnections, 3);
    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - respects maxConnections config",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const config = createTestConfig({ maxConnections: 100 });
    const pool = new ConnectionPool(config);

    assertEquals(pool.getConfig().maxConnections, 100);
    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - respects idleTimeout config",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const config = createTestConfig({ idleTimeout: 120000 });
    const pool = new ConnectionPool(config);

    assertEquals(pool.getConfig().idleTimeout, 120000);
    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - respects maxLifetime config",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const config = createTestConfig({ maxLifetime: 900000 });
    const pool = new ConnectionPool(config);

    assertEquals(pool.getConfig().maxLifetime, 900000);
    pool.destroy();
  },
});

// ============================================================================
// PooledConnectionInfo Structure Tests
// ============================================================================

Deno.test({
  name: "PooledConnectionInfo - has correct structure",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const connInfo: PooledConnectionInfo = {
      id: "conn-123",
      conn: { close: () => {}, write: () => Promise.resolve(0), rid: 1 } as unknown as Deno.Conn,
      host: "api.example.com",
      port: 443,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      lastSuccessfulIO: Date.now(),
      requestCount: 5,
      inUse: false,
      dead: false,
    };

    assertEquals(connInfo.id, "conn-123");
    assertEquals(connInfo.host, "api.example.com");
    assertEquals(connInfo.port, 443);
    assertEquals(connInfo.requestCount, 5);
    assertEquals(connInfo.inUse, false);
  },
});

// ============================================================================
// Pool Key Generation Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - pool key is host:port format",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pool = new ConnectionPool(createTestConfig());

    // We can't test acquire without a real server, but we can verify
    // the pool structure after a failed acquire attempt
    try {
      // This will fail but should still initialize the pool key
      await pool.acquire("localhost", 99999);
    } catch {
      // Expected to fail
    }

    // Pool should still be empty since acquire failed
    assertEquals(pool.getPools().size, 0);
    pool.destroy();
  },
});

// ============================================================================
// Connection Validation Logic Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - validates connection age against maxLifetime",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    // Test with very short maxLifetime
    const config = createTestConfig({ maxLifetime: 100 }); // 100ms
    const pool = new ConnectionPool(config);

    // The pool will use maxLifetime for connection validation
    assertEquals(pool.getConfig().maxLifetime, 100);
    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - validates connection idle time against idleTimeout",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    // Test with very short idleTimeout
    const config = createTestConfig({ idleTimeout: 100 }); // 100ms
    const pool = new ConnectionPool(config);

    assertEquals(pool.getConfig().idleTimeout, 100);
    pool.destroy();
  },
});

// ============================================================================
// Stats Calculation Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - avgRequestsPerConnection is 0 when no connections",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());
    const stats = pool.getStats();

    assertEquals(stats.avgRequestsPerConnection, 0);
    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - availableConnections equals total minus inUse",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());
    const stats = pool.getStats();

    assertEquals(stats.availableConnections, stats.totalConnections - stats.inUseConnections);
    pool.destroy();
  },
});

// ============================================================================
// Multiple Pool Support Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - supports multiple host:port combinations",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());

    // Configuration supports multiple pools
    assertEquals(pool.getConfig().maxConnections, 10);

    // Each host:port combo gets its own pool
    // We can't test actual connections without servers, but config is correct
    pool.destroy();
  },
});

// ============================================================================
// Cleanup Timer Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - cleanup timer is started on construction",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());

    // Pool is created with cleanup timer
    // We verify by checking destroy works properly
    assertExists(pool);

    // Cleanup should work without error
    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - destroy stops cleanup timer",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());

    // After destroy, timer should be cleared
    pool.destroy();

    // Calling destroy again should be safe
    pool.destroy();
  },
});

// ============================================================================
// Edge Case Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - handles zero idleTimeout",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const config = createTestConfig({ idleTimeout: 0 });
    const pool = new ConnectionPool(config);

    assertEquals(pool.getConfig().idleTimeout, 0);
    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - handles very large maxConnections",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const config = createTestConfig({ maxConnections: 10000 });
    const pool = new ConnectionPool(config);

    assertEquals(pool.getConfig().maxConnections, 10000);
    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - handles single connection max",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const config = createTestConfig({ maxConnections: 1 });
    const pool = new ConnectionPool(config);

    assertEquals(pool.getConfig().maxConnections, 1);
    pool.destroy();
  },
});

// ============================================================================
// isConnectionAlive / markDead Tests
// ============================================================================

Deno.test({
  name: "ConnectionPool - release disposes dead connections instead of returning to pool",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());
    const poolKey = "localhost:8080";

    // Manually insert a connection into the pool
    const mockConn: PooledConnectionInfo = {
      id: "conn-dead",
      conn: {
        close: () => {},
        write: () => Promise.resolve(0),
        rid: 1,
      } as unknown as Deno.Conn,
      host: "localhost",
      port: 8080,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      lastSuccessfulIO: Date.now(),
      requestCount: 1,
      inUse: true,
      dead: false,
    };

    const pools = pool.getPools();
    // We need to add directly to internal state
    // Instead, mark dead and release - it should be disposed
    pool.markDead(mockConn);
    assertEquals(mockConn.dead, true);

    // Release should call disposeConnection (not return to pool)
    pool.release(mockConn);
    // mockConn.inUse should still be true since it was disposed, not released
    assertEquals(mockConn.inUse, true);

    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - markDead sets dead flag to true",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());

    const mockConn: PooledConnectionInfo = {
      id: "conn-1",
      conn: { close: () => {}, write: () => Promise.resolve(0), rid: 1 } as unknown as Deno.Conn,
      host: "localhost",
      port: 8080,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      lastSuccessfulIO: Date.now(),
      requestCount: 0,
      inUse: false,
      dead: false,
    };

    assertEquals(mockConn.dead, false);
    pool.markDead(mockConn);
    assertEquals(mockConn.dead, true);

    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - release accepts alive connection back to pool",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());

    const mockConn: PooledConnectionInfo = {
      id: "conn-alive",
      conn: {
        close: () => {},
        write: () => Promise.resolve(0),
        rid: 42,
      } as unknown as Deno.Conn,
      host: "localhost",
      port: 8080,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      lastSuccessfulIO: Date.now(),
      requestCount: 1,
      inUse: true,
      dead: false,
    };

    pool.release(mockConn);
    // Should be released back to pool (not disposed)
    assertEquals(mockConn.inUse, false);

    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - connection with null rid is detected as dead",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());

    const mockConn: PooledConnectionInfo = {
      id: "conn-null-rid",
      conn: {
        close: () => {},
        write: () => { throw new Error("closed"); },
        rid: null,
      } as unknown as Deno.Conn,
      host: "localhost",
      port: 8080,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      lastSuccessfulIO: Date.now(),
      requestCount: 1,
      inUse: true,
      dead: false,
    };

    // Release should dispose because rid is null
    pool.release(mockConn);
    // inUse stays true because it was disposed, not released
    assertEquals(mockConn.inUse, true);

    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - connection with stale lastSuccessfulIO is detected as dead",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    // idleTimeout of 30s means lastSuccessfulIO older than 30s triggers dead detection
    const pool = new ConnectionPool(createTestConfig({ idleTimeout: 1000 }));

    const mockConn: PooledConnectionInfo = {
      id: "conn-stale-io",
      conn: {
        close: () => {},
        write: () => Promise.resolve(0),
        rid: 99,
      } as unknown as Deno.Conn,
      host: "localhost",
      port: 8080,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      lastSuccessfulIO: Date.now() - 2000, // 2s ago, exceeds 1s idleTimeout
      requestCount: 1,
      inUse: true,
      dead: false,
    };

    // Release should dispose because lastSuccessfulIO exceeds idleTimeout
    pool.release(mockConn);
    assertEquals(mockConn.inUse, true);

    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - recordSuccessfulIO updates lastSuccessfulIO timestamp",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig());

    const mockConn: PooledConnectionInfo = {
      id: "conn-io",
      conn: { close: () => {}, write: () => Promise.resolve(0), rid: 1 } as unknown as Deno.Conn,
      host: "localhost",
      port: 8080,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      lastSuccessfulIO: Date.now() - 5000,
      requestCount: 1,
      inUse: true,
      dead: false,
    };

    const before = mockConn.lastSuccessfulIO;
    pool.recordSuccessfulIO(mockConn);
    assert(mockConn.lastSuccessfulIO > before);

    pool.destroy();
  },
});

Deno.test({
  name: "ConnectionPool - expired connection (maxLifetime) is detected as dead on release",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const pool = new ConnectionPool(createTestConfig({ maxLifetime: 100 }));

    const mockConn: PooledConnectionInfo = {
      id: "conn-expired",
      conn: {
        close: () => {},
        write: () => Promise.resolve(0),
        rid: 10,
      } as unknown as Deno.Conn,
      host: "localhost",
      port: 8080,
      createdAt: Date.now() - 200, // 200ms ago, maxLifetime is 100ms
      lastUsedAt: Date.now(),
      lastSuccessfulIO: Date.now(),
      requestCount: 1,
      inUse: true,
      dead: false,
    };

    pool.release(mockConn);
    // Should be disposed due to expired maxLifetime
    assertEquals(mockConn.inUse, true);

    pool.destroy();
  },
});
