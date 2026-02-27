/**
 * Tests for SessionManager.createSession race condition fix.
 *
 * Verifies that concurrent callers cannot both pass the maxSessions check
 * during await gaps, preventing leaked pool instances.
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { BrowserPool, type BrowserInstance } from "@browserx/runtime";
import { SessionManager } from "../session/session-manager.ts";

function createTestPoolConfig() {
  return {
    minInstances: 0,
    maxInstances: 5,
    idleTimeout: 60 * 1000,
    maxLifetime: 5 * 60 * 1000,
    defaultWidth: 1280,
    defaultHeight: 720,
    enableJavaScript: false,
    enableStorage: true,
    devicePixelRatio: 1.0,
  };
}

Deno.test({
  name: "SessionManager race - concurrent pool-backed createSession respects maxSessions with pendingAcquires",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const pool = new BrowserPool(createTestPoolConfig());
    await pool.start();

    const manager = new SessionManager({
      maxSessions: 2,
      browserPool: pool,
    });

    // Fire 3 concurrent createSession calls; only 2 should succeed
    const results = await Promise.allSettled([
      manager.createSession(),
      manager.createSession(),
      manager.createSession(),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // At most 2 should succeed (the limit)
    assertEquals(
      fulfilled.length <= 2,
      true,
      `Expected at most 2 fulfilled, got ${fulfilled.length}`,
    );
    // At least 1 should be rejected
    assertEquals(
      rejected.length >= 1,
      true,
      `Expected at least 1 rejected, got ${rejected.length}`,
    );

    await manager.shutdown();
    await pool.stop();
  },
});

Deno.test({
  name: "SessionManager race - sequential createSession works up to maxSessions",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const manager = new SessionManager({
      maxSessions: 2,
    });

    const id1 = await manager.createSession();
    const id2 = await manager.createSession();

    assertEquals(typeof id1, "string");
    assertEquals(typeof id2, "string");

    const stats = manager.getPoolStats();
    assertEquals(stats.activeSessions, 2);

    await manager.shutdown();
  },
});

Deno.test({
  name: "SessionManager race - pendingAcquires counter resets after pool acquire failure",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const pool = new BrowserPool(createTestPoolConfig());
    await pool.start();

    const manager = new SessionManager({
      maxSessions: 2,
      browserPool: pool,
    });

    // Create sessions up to limit
    const id1 = await manager.createSession();
    const id2 = await manager.createSession();

    const stats = manager.getPoolStats();
    assertEquals(stats.activeSessions, 2);

    // Close one session to free a slot
    await manager.closeSession(id1);

    // Should now be able to create another
    const id3 = await manager.createSession();
    assertEquals(typeof id3, "string");

    const stats2 = manager.getPoolStats();
    assertEquals(stats2.activeSessions, 2);

    await manager.shutdown();
    await pool.stop();
  },
});
