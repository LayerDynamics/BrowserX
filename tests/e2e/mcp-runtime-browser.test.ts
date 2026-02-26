// Shim HTMLElement for Deno (GraphXCanvas extends it at top level)
if (typeof globalThis.HTMLElement === "undefined") {
  (globalThis as Record<string, unknown>).HTMLElement = class HTMLElement {};
}

/**
 * E2E Tests: MCP Server → Runtime → Browser
 *
 * Validates the integration path from MCP server context through
 * Runtime lifecycle to Browser instance management.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { BrowserXRuntime } from "../../runtime/src/BrowserXRuntime.ts";
import { BrowserPool } from "../../runtime/src/resources/BrowserPool.ts";
import { SessionManager } from "../../mcp-server/session/session-manager.ts";
import { BrowserEngine } from "../../browser/src/api/BrowserEngine.ts";

// ============================================================================
// Test Helpers
// ============================================================================

function createDataURL(html: string): string {
  return `data:text/html,${encodeURIComponent(html)}`;
}

function createTestPage(title: string): string {
  return `<!DOCTYPE html><html><head><title>${title}</title></head><body><h1>${title}</h1></body></html>`;
}

// ============================================================================
// Runtime → BrowserPool → Browser Instance Tests
// ============================================================================

Deno.test({
  name: "E2E MCP-Runtime-Browser - Runtime creates pool, pool acquires browser instance",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const runtime = new BrowserXRuntime();

    try {
      await runtime.start();
      assertEquals(runtime.getState(), "running");

      // Access the browser pool from runtime
      const pool = runtime.browserPool;
      assertExists(pool);

      // Acquire a browser instance from the pool
      const instance = await pool.acquire();
      assertExists(instance);
      assertExists(instance.id);
      assertEquals(instance.state, "in_use");

      // Pool stats should reflect the acquired instance
      const stats = pool.getStats();
      assert(stats.totalInstances >= 1);
      assert(stats.inUseInstances >= 1);

      // Release the instance back to the pool
      await pool.release(instance.id);
    } finally {
      await runtime.shutdown();
      assertEquals(runtime.getState(), "stopped");
    }
  },
});

Deno.test({
  name: "E2E MCP-Runtime-Browser - SessionManager uses pool to create browser session",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const runtime = new BrowserXRuntime();

    try {
      await runtime.start();

      // Create session manager backed by runtime's browser pool
      const sessionManager = new SessionManager({
        maxSessions: 5,
        browserPool: runtime.browserPool,
      });

      // Create a session — this acquires from the pool
      const sessionId = await sessionManager.createSession();
      assertExists(sessionId);
      assert(typeof sessionId === "string");

      // Session should be active
      const stats = sessionManager.getPoolStats();
      assertEquals(stats.activeSessions, 1);
      assert(stats.totalCreated >= 1);

      // Close the session — this releases back to the pool
      await sessionManager.closeSession(sessionId);

      const statsAfter = sessionManager.getPoolStats();
      assertEquals(statsAfter.activeSessions, 0);
      assert(statsAfter.totalClosed >= 1);

      await sessionManager.shutdown();
    } finally {
      await runtime.shutdown();
    }
  },
});

Deno.test({
  name: "E2E MCP-Runtime-Browser - Session lifecycle: create, use BrowserEngine, close, verify cleanup",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const runtime = new BrowserXRuntime();

    try {
      await runtime.start();

      const sessionManager = new SessionManager({
        maxSessions: 3,
        browserPool: runtime.browserPool,
      });

      // Create session
      const sessionId = await sessionManager.createSession();
      assertExists(sessionId);

      // Get session and verify it has a browser engine
      const session = sessionManager.getSession(sessionId);
      assertExists(session);
      assertExists(session.browserEngine);

      // Create a page and navigate
      const page = await session.browserEngine.newPage();
      assertExists(page);

      const url = createDataURL(createTestPage("Session Test"));
      await page.navigate(url);
      assertEquals(page.getCurrentURL(), url);

      // Close session
      await sessionManager.closeSession(sessionId);

      // Session should be gone
      assertEquals(sessionManager.hasSession(sessionId), false);

      // Pool should have released the instance
      const poolStats = runtime.browserPool.getStats();
      assertEquals(poolStats.inUseInstances, 0);

      await sessionManager.shutdown();
    } finally {
      await runtime.shutdown();
    }
  },
});

Deno.test({
  name: "E2E MCP-Runtime-Browser - Multiple concurrent sessions through pool",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const runtime = new BrowserXRuntime();

    try {
      await runtime.start();

      const sessionManager = new SessionManager({
        maxSessions: 5,
        browserPool: runtime.browserPool,
      });

      // Create multiple sessions
      const sessionIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const id = await sessionManager.createSession();
        sessionIds.push(id);
      }

      assertEquals(sessionManager.getPoolStats().activeSessions, 3);

      // Close all sessions
      for (const id of sessionIds) {
        await sessionManager.closeSession(id);
      }

      assertEquals(sessionManager.getPoolStats().activeSessions, 0);
      assertEquals(sessionManager.getPoolStats().totalClosed, 3);

      await sessionManager.shutdown();
    } finally {
      await runtime.shutdown();
    }
  },
});

Deno.test({
  name: "E2E MCP-Runtime-Browser - Runtime health check reflects pool state",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const runtime = new BrowserXRuntime();

    try {
      await runtime.start();

      // Health checker should be available
      const healthChecker = runtime.healthChecker;
      assertExists(healthChecker);

      // Check overall health
      const healthResult = await healthChecker.getHealthStatus();
      assertExists(healthResult);
      assertExists(healthResult.status);
      assert(
        healthResult.status === "healthy" || healthResult.status === "degraded" || healthResult.status === "unhealthy",
        `Expected a valid health status, got: ${healthResult.status}`,
      );

      // Metrics collector should be available
      const metricsCollector = runtime.metricsCollector;
      assertExists(metricsCollector);
    } finally {
      await runtime.shutdown();
    }
  },
});
