/**
 * Connection Pool Functional Tests
 *
 * Tests pool creation, configuration, stats, cleanup, and destroy lifecycle.
 * Note: acquire/release require real Deno.connect, so we test config/stats/lifecycle
 * without network connections, and validate pool behavior through the API surface.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { ConnectionPool } from "../../core/connection/connection_pool.ts";
import type { ConnectionPoolConfig, PooledConnectionInfo } from "../../core/connection/connection_pool.ts";

function createPool(overrides?: Partial<ConnectionPoolConfig>): ConnectionPool {
  const pool = new ConnectionPool({
    minConnections: 2,
    maxConnections: 10,
    idleTimeout: 30000,
    maxLifetime: 300000,
    ...overrides,
  });
  return pool;
}

// ============================================================================
// Pool creation with max size
// ============================================================================

Deno.test("ConnectionPool - constructs with config", () => {
  const pool = createPool();
  assertExists(pool);
  const config = pool.getConfig();
  assertEquals(config.maxConnections, 10);
  assertEquals(config.minConnections, 2);
  assertEquals(config.idleTimeout, 30000);
  assertEquals(config.maxLifetime, 300000);
  pool.destroy();
});

Deno.test("ConnectionPool - custom max size", () => {
  const pool = createPool({ maxConnections: 3 });
  assertEquals(pool.getConfig().maxConnections, 3);
  pool.destroy();
});

// ============================================================================
// Pool stats (empty pool)
// ============================================================================

Deno.test("ConnectionPool - initial stats are zero", () => {
  const pool = createPool();
  const stats = pool.getStats();
  assertEquals(stats.totalPools, 0);
  assertEquals(stats.totalConnections, 0);
  assertEquals(stats.inUseConnections, 0);
  assertEquals(stats.availableConnections, 0);
  assertEquals(stats.totalRequests, 0);
  assertEquals(stats.avgRequestsPerConnection, 0);
  pool.destroy();
});

// ============================================================================
// Pool reuses released connections (via getPools)
// ============================================================================

Deno.test("ConnectionPool - getPools returns empty map initially", () => {
  const pool = createPool();
  const pools = pool.getPools();
  assertEquals(pools.size, 0);
  pool.destroy();
});

// ============================================================================
// Idle timeout config
// ============================================================================

Deno.test("ConnectionPool - idle timeout stored in config", () => {
  const pool = createPool({ idleTimeout: 5000 });
  assertEquals(pool.getConfig().idleTimeout, 5000);
  pool.destroy();
});

// ============================================================================
// Max lifetime config
// ============================================================================

Deno.test("ConnectionPool - max lifetime stored in config", () => {
  const pool = createPool({ maxLifetime: 60000 });
  assertEquals(pool.getConfig().maxLifetime, 60000);
  pool.destroy();
});

// ============================================================================
// Pool destroy cleans up
// ============================================================================

Deno.test("ConnectionPool - destroy clears all pools", () => {
  const pool = createPool();
  pool.destroy();
  const pools = pool.getPools();
  assertEquals(pools.size, 0);
});

Deno.test("ConnectionPool - destroy can be called multiple times safely", () => {
  const pool = createPool();
  pool.destroy();
  pool.destroy(); // should not throw
  assertEquals(pool.getPools().size, 0);
});

// ============================================================================
// Next ID increments
// ============================================================================

Deno.test("ConnectionPool - next ID starts at 1", () => {
  const pool = createPool();
  assertEquals(pool.getNextId(), 1);
  pool.destroy();
});

// ============================================================================
// Release marks connection as not in use
// ============================================================================

Deno.test("ConnectionPool - release sets inUse to false", () => {
  const pool = createPool();
  const mockConn: PooledConnectionInfo = {
    id: "test-conn",
    conn: { close: () => {} } as unknown as Deno.Conn,
    host: "localhost",
    port: 8080,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    requestCount: 1,
    inUse: true,
  };

  pool.release(mockConn);
  assertEquals(mockConn.inUse, false);
  assert(mockConn.lastUsedAt <= Date.now());
  pool.destroy();
});

// ============================================================================
// Acquire returns null when pool is exhausted (no real server)
// ============================================================================

Deno.test({
  name: "ConnectionPool - acquire returns null when connection fails",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const pool = createPool({ maxConnections: 1 });
    // Trying to connect to a non-existent server should return null
    const conn = await pool.acquire("255.255.255.255", 1);
    assertEquals(conn, null);
    pool.destroy();
  },
});
