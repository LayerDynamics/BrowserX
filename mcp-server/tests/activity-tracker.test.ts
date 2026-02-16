/**
 * Activity Tracker Tests
 *
 * Verifies that screenshots and activity data are saved to the correct folders.
 */

import { assertEquals, assertExists } from "@std/assert";
import { ActivityTracker } from "../activity/ActivityTracker.ts";

const TEST_BASE_DIR = ".browserx/test_usage_data";

Deno.test({
  name: "ActivityTracker - creates correct directory structure",
  async fn() {
    // Clean up test directory if it exists
    try {
      await Deno.remove(TEST_BASE_DIR, { recursive: true });
    } catch {
      // Directory doesn't exist, that's fine
    }

    const tracker = new ActivityTracker(TEST_BASE_DIR);
    await tracker.initialize();

    // Verify directories were created
    const screenshotsDir = await Deno.stat(`${TEST_BASE_DIR}/screenshots`);
    const logsDir = await Deno.stat(`${TEST_BASE_DIR}/logs`);
    const metadataDir = await Deno.stat(`${TEST_BASE_DIR}/metadata`);

    assertEquals(screenshotsDir.isDirectory, true, "screenshots should be a directory");
    assertEquals(logsDir.isDirectory, true, "logs should be a directory");
    assertEquals(metadataDir.isDirectory, true, "metadata should be a directory");

    // Cleanup
    await Deno.remove(TEST_BASE_DIR, { recursive: true });
  },
});

Deno.test({
  name: "ActivityTracker - saveScreenshot saves to correct path",
  async fn() {
    // Clean up test directory if it exists
    try {
      await Deno.remove(TEST_BASE_DIR, { recursive: true });
    } catch {
      // Directory doesn't exist, that's fine
    }

    const tracker = new ActivityTracker(TEST_BASE_DIR);

    // Create a small test image (1x1 red pixel PNG)
    // Base64 encoded 1x1 red PNG
    const testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

    // Save the screenshot
    const filePath = await tracker.saveScreenshot(
      "test-session-123",
      "https://example.com",
      testImageBase64,
      1920,
      1080
    );

    // Verify the file exists
    assertExists(filePath, "filePath should be returned");
    assertEquals(filePath.startsWith(TEST_BASE_DIR), true, `filePath should start with ${TEST_BASE_DIR}`);
    assertEquals(filePath.includes("/screenshots/"), true, "filePath should include /screenshots/");
    assertEquals(filePath.endsWith(".png"), true, "filePath should end with .png");

    // Verify the file can be read
    const fileInfo = await Deno.stat(filePath);
    assertEquals(fileInfo.isFile, true, "saved screenshot should be a file");
    assertEquals(fileInfo.size > 0, true, "saved screenshot should have content");

    // Verify the activity was tracked
    const stats = tracker.getStats();
    assertEquals(stats.totalScreenshots, 1, "should have 1 screenshot tracked");
    assertEquals(stats.activitiesByType["screenshot"], 1, "should have 1 screenshot activity");

    // Cleanup
    await Deno.remove(TEST_BASE_DIR, { recursive: true });
  },
});

Deno.test({
  name: "ActivityTracker - trackNavigation creates log entry",
  async fn() {
    // Clean up test directory if it exists
    try {
      await Deno.remove(TEST_BASE_DIR, { recursive: true });
    } catch {
      // Directory doesn't exist, that's fine
    }

    const tracker = new ActivityTracker(TEST_BASE_DIR);

    // Track a navigation
    await tracker.trackNavigation(
      "test-session-456",
      "https://example.com/page",
      { total: 1500, breakdown: { fetch: 500, parse: 300, render: 700 } }
    );

    // Verify activity was tracked
    const stats = tracker.getStats();
    assertEquals(stats.totalActivities, 1, "should have 1 activity");
    assertEquals(stats.activitiesByType["navigate"], 1, "should have 1 navigate activity");

    // Verify log file was created
    const today = new Date();
    const datePath = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const logPath = `${TEST_BASE_DIR}/logs/${datePath}.jsonl`;

    const logContent = await Deno.readTextFile(logPath);
    const logEntry = JSON.parse(logContent.trim());

    assertEquals(logEntry.type, "navigate", "log entry should be navigate type");
    assertEquals(logEntry.url, "https://example.com/page", "log entry should have correct URL");
    assertEquals(logEntry.sessionId, "test-session-456", "log entry should have correct sessionId");

    // Cleanup
    await Deno.remove(TEST_BASE_DIR, { recursive: true });
  },
});

Deno.test({
  name: "ActivityTracker - getRecentScreenshots returns saved screenshots",
  async fn() {
    // Clean up test directory if it exists
    try {
      await Deno.remove(TEST_BASE_DIR, { recursive: true });
    } catch {
      // Directory doesn't exist, that's fine
    }

    const tracker = new ActivityTracker(TEST_BASE_DIR);

    // Create test image
    const testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

    // Save multiple screenshots
    await tracker.saveScreenshot("session-1", "https://example.com/1", testImageBase64, 800, 600);
    await tracker.saveScreenshot("session-2", "https://example.com/2", testImageBase64, 1024, 768);
    await tracker.saveScreenshot("session-3", "https://example.com/3", testImageBase64, 1920, 1080);

    // Get recent screenshots
    const screenshots = tracker.getRecentScreenshots(10);

    assertEquals(screenshots.length, 3, "should have 3 screenshots");
    assertEquals(screenshots[0].sessionId, "session-1", "first screenshot should be session-1");
    assertEquals(screenshots[0].url, "https://example.com/1", "first screenshot should have correct URL");
    assertEquals(screenshots[0].width, 800, "first screenshot should have correct width");
    assertEquals(screenshots[0].height, 600, "first screenshot should have correct height");

    // Cleanup
    await Deno.remove(TEST_BASE_DIR, { recursive: true });
  },
});

Deno.test({
  name: "ActivityTracker - setEnabled controls tracking",
  async fn() {
    // Clean up test directory if it exists
    try {
      await Deno.remove(TEST_BASE_DIR, { recursive: true });
    } catch {
      // Directory doesn't exist, that's fine
    }

    const tracker = new ActivityTracker(TEST_BASE_DIR);

    // Disable tracking
    tracker.setEnabled(false);
    assertEquals(tracker.isEnabled(), false, "tracker should be disabled");

    // Try to track - should not save
    const testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
    const filePath = await tracker.saveScreenshot("session-disabled", "https://example.com", testImageBase64, 100, 100);

    assertEquals(filePath, "", "should return empty string when disabled");
    assertEquals(tracker.getStats().totalScreenshots, 0, "should have 0 screenshots when disabled");

    // Re-enable tracking
    tracker.setEnabled(true);
    assertEquals(tracker.isEnabled(), true, "tracker should be enabled");

    // Now it should save
    const filePath2 = await tracker.saveScreenshot("session-enabled", "https://example.com", testImageBase64, 100, 100);
    assertEquals(filePath2 !== "", true, "should return file path when enabled");
    assertEquals(tracker.getStats().totalScreenshots, 1, "should have 1 screenshot when enabled");

    // Cleanup
    await Deno.remove(TEST_BASE_DIR, { recursive: true });
  },
});
