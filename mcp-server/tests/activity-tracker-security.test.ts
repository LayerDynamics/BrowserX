/**
 * Activity Tracker Security Tests
 *
 * Verifies sessionId sanitization and crypto-based ID generation.
 */

import { assertEquals, assertRejects } from "@std/assert";
import { ActivityTracker } from "../activity/ActivityTracker.ts";

const TEST_BASE_DIR = ".browserx/test_security_data";

async function cleanup() {
  try {
    await Deno.remove(TEST_BASE_DIR, { recursive: true });
  } catch {
    // Directory doesn't exist, that's fine
  }
}

Deno.test({
  name: "ActivityTracker - generateId uses crypto (hex/UUID chars, not base36)",
  async fn() {
    await cleanup();
    const tracker = new ActivityTracker(TEST_BASE_DIR);

    // Track something to generate an ID
    await tracker.trackNavigation("valid-session", "https://example.com", { total: 100 });

    const activities = tracker.getRecentActivities(1);
    assertEquals(activities.length, 1);

    const id = activities[0].id;
    // The ID format is `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
    // UUID chars are hex: [0-9a-f] plus hyphens, sliced to 8 chars
    const parts = id.split("_");
    assertEquals(parts.length >= 2, true, "ID should have timestamp_random format");

    const randomPart = parts[parts.length - 1];
    assertEquals(randomPart.length, 8, "random part should be 8 chars");
    // UUID slice(0,8) yields hex chars and possibly a hyphen (e.g., "a1b2c3d4" or "a1b2c3d-")
    assertEquals(/^[0-9a-f-]+$/.test(randomPart), true, `random part should be hex/UUID chars, got: ${randomPart}`);

    await cleanup();
  },
});

Deno.test({
  name: "ActivityTracker - rejects path traversal ../../../etc/passwd",
  async fn() {
    await cleanup();
    const tracker = new ActivityTracker(TEST_BASE_DIR);

    await assertRejects(
      () => tracker.trackNavigation("../../../etc/passwd", "https://example.com", { total: 100 }),
      Error,
      "Invalid sessionId: contains unsafe characters",
    );

    await assertRejects(
      () => tracker.saveScreenshot("../../../etc/passwd", "https://example.com", "dGVzdA==", 100, 100),
      Error,
      "Invalid sessionId: contains unsafe characters",
    );

    await assertRejects(
      () => tracker.saveSessionMetadata("../../../etc/passwd", { test: true }),
      Error,
      "Invalid sessionId: contains unsafe characters",
    );

    await cleanup();
  },
});

Deno.test({
  name: "ActivityTracker - rejects absolute path /etc/passwd",
  async fn() {
    await cleanup();
    const tracker = new ActivityTracker(TEST_BASE_DIR);

    await assertRejects(
      () => tracker.trackNavigation("/etc/passwd", "https://example.com", { total: 100 }),
      Error,
      "Invalid sessionId: contains unsafe characters",
    );

    await cleanup();
  },
});

Deno.test({
  name: "ActivityTracker - rejects null bytes session\\x00evil",
  async fn() {
    await cleanup();
    const tracker = new ActivityTracker(TEST_BASE_DIR);

    await assertRejects(
      () => tracker.trackNavigation("session\x00evil", "https://example.com", { total: 100 }),
      Error,
      "Invalid sessionId: contains unsafe characters",
    );

    await cleanup();
  },
});

Deno.test({
  name: "ActivityTracker - accepts valid sessionId valid-session_123",
  async fn() {
    await cleanup();
    const tracker = new ActivityTracker(TEST_BASE_DIR);

    // These should all succeed without throwing
    await tracker.trackNavigation("valid-session_123", "https://example.com", { total: 100 });

    const stats = tracker.getStats();
    assertEquals(stats.totalActivities, 1, "should have tracked the activity");

    await tracker.saveSessionMetadata("valid-session_123", { test: true });

    // Verify metadata file exists
    const metaPath = `${TEST_BASE_DIR}/metadata/valid-session_123.json`;
    const info = await Deno.stat(metaPath);
    assertEquals(info.isFile, true, "metadata file should exist");

    await cleanup();
  },
});
