/**
 * Activity Tracker Bounds Tests
 *
 * Verifies that in-memory arrays are bounded to prevent OOM.
 */

import { assertEquals } from "@std/assert";
import { ActivityTracker } from "../activity/ActivityTracker.ts";

const TEST_BASE_DIR = ".browserx/test_bounds_data";

async function cleanup() {
  try {
    await Deno.remove(TEST_BASE_DIR, { recursive: true });
  } catch {
    // ok
  }
}

Deno.test({
  name: "ActivityTracker - default limits",
  fn() {
    const tracker = new ActivityTracker(TEST_BASE_DIR);
    assertEquals(tracker.getMaxActivities(), 10000);
    assertEquals(tracker.getMaxScreenshots(), 1000);
  },
});

Deno.test({
  name: "ActivityTracker - custom limits via options",
  fn() {
    const tracker = new ActivityTracker({
      baseDir: TEST_BASE_DIR,
      maxActivities: 50,
      maxScreenshots: 10,
    });
    assertEquals(tracker.getMaxActivities(), 50);
    assertEquals(tracker.getMaxScreenshots(), 10);
  },
});

Deno.test({
  name: "ActivityTracker - activities trimmed to max",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await cleanup();
    try {
      const tracker = new ActivityTracker({
        baseDir: TEST_BASE_DIR,
        maxActivities: 5,
        maxScreenshots: 1000,
      });

      // Push 10 activities
      for (let i = 0; i < 10; i++) {
        await tracker.trackActivity("navigate", `session-${i}`, `https://example.com/${i}`, { index: i });
      }

      const stats = tracker.getStats();
      assertEquals(stats.totalActivities, 5);

      // Verify we kept the newest entries (indices 5-9)
      const recent = tracker.getRecentActivities(10);
      assertEquals(recent.length, 5);
      assertEquals((recent[0].data as Record<string, unknown>).index, 5);
      assertEquals((recent[4].data as Record<string, unknown>).index, 9);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "ActivityTracker - trackNavigation also bounded",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await cleanup();
    try {
      const tracker = new ActivityTracker({
        baseDir: TEST_BASE_DIR,
        maxActivities: 3,
      });

      for (let i = 0; i < 6; i++) {
        await tracker.trackNavigation(`session-nav`, `https://example.com/${i}`, { total: i });
      }

      const stats = tracker.getStats();
      assertEquals(stats.totalActivities, 3);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "ActivityTracker - screenshots trimmed to max",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await cleanup();
    try {
      const tracker = new ActivityTracker({
        baseDir: TEST_BASE_DIR,
        maxScreenshots: 2,
        maxActivities: 1000,
      });

      // Minimal valid base64 PNG (1x1 pixel)
      const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

      for (let i = 0; i < 4; i++) {
        await tracker.saveScreenshot(`session-ss`, `https://example.com/${i}`, tinyPng, 1, 1);
      }

      const screenshots = tracker.getRecentScreenshots(10);
      assertEquals(screenshots.length, 2);

      // Newest two kept
      assertEquals(screenshots[0].url, "https://example.com/2");
      assertEquals(screenshots[1].url, "https://example.com/3");
    } finally {
      await cleanup();
    }
  },
});
