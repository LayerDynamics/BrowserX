/**
 * Browser Screenshot Tool Tests
 * Comprehensive tests for browser_screenshot MCP tool
 */

import "./setup.ts";
import { assertEquals, assertExists, assertRejects, assert } from "@std/assert";
import { encodeBase64 } from "@std/encoding";
import {
  createMockContext,
  createMockContextWithSession,
} from "../helpers/mock-context.ts";
import type { MCPServerContext } from "../../server/mcp-server.ts";
import { validateSelector } from "../../security/input-validator.ts";

/**
 * Simulate the browser_screenshot tool handler logic
 */
async function browserScreenshotHandler(
  args: {
    sessionId: string;
    fullPage?: boolean;
    selector?: string;
    format?: "png" | "jpeg";
    quality?: number;
    timeout?: number;
  },
  context: MCPServerContext,
  signal?: AbortSignal,
) {
  context.permissionGuard.checkToolPermission("browser_screenshot");

  if (args.selector) validateSelector(args.selector);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(args.sessionId);

  const screenshot = await page.screenshot({
    fullPage: args.fullPage,
    selector: args.selector,
    format: args.format ?? "png",
    quality: args.quality,
    signal,
  });

  const base64Image = encodeBase64(screenshot);

  const currentUrl = page.getCurrentURL() ?? "unknown";
  const defaultViewport = context.config.sessionConfig?.defaultViewport ?? { width: 1280, height: 720 };
  const filePath = await context.activityTracker.saveScreenshot(
    args.sessionId,
    currentUrl,
    base64Image,
    defaultViewport.width,
    defaultViewport.height,
  );

  return {
    sessionId: args.sessionId,
    format: args.format ?? "png",
    size: screenshot.length,
    filePath,
    _image: {
      data: base64Image,
      mimeType: args.format === "jpeg" ? "image/jpeg" : "image/png",
    },
  };
}

// ---- Success Path Tests ----

Deno.test("browser_screenshot - takes screenshot with defaults", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserScreenshotHandler(
    { sessionId },
    context,
  );

  assertEquals(result.sessionId, sessionId);
  assertEquals(result.format, "png");
  assert(result.size > 0);
  assertExists(result._image);
  assertEquals(result._image.mimeType, "image/png");
  assertExists(result._image.data);
});

Deno.test("browser_screenshot - takes full page screenshot", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserScreenshotHandler(
    { sessionId, fullPage: true },
    context,
  );

  assertEquals(result.format, "png");
  assert(result.size > 0);
});

Deno.test("browser_screenshot - takes JPEG screenshot", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserScreenshotHandler(
    { sessionId, format: "jpeg" },
    context,
  );

  assertEquals(result.format, "jpeg");
  assertEquals(result._image.mimeType, "image/jpeg");
});

Deno.test("browser_screenshot - takes element screenshot", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserScreenshotHandler(
    { sessionId, selector: "#main-content" },
    context,
  );

  assertExists(result._image.data);
  assertEquals(result.format, "png");
});

Deno.test("browser_screenshot - supports quality parameter for JPEG", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserScreenshotHandler(
    { sessionId, format: "jpeg", quality: 50 },
    context,
  );

  assertEquals(result.format, "jpeg");
  assertEquals(result._image.mimeType, "image/jpeg");
});

// ---- Return Value Structure ----

Deno.test("browser_screenshot - returns correct structure", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserScreenshotHandler({ sessionId }, context);

  assertExists(result.sessionId);
  assertExists(result.format);
  assertExists(result.size);
  assertExists(result.filePath);
  assertExists(result._image);
  assertExists(result._image.data);
  assertExists(result._image.mimeType);
});

// ---- Error: No Active Session ----

Deno.test("browser_screenshot - throws when session not found", async () => {
  const context = createMockContext();

  const sessionManager = await context.getSessionManager();
  const origGetSessionPage = sessionManager.getSessionPage.bind(sessionManager);
  (sessionManager as any).getSessionPage = async (id: string) => {
    sessionManager.getSession(id);
    return origGetSessionPage(id);
  };

  await assertRejects(
    async () =>
      await browserScreenshotHandler(
        { sessionId: "nonexistent" },
        context,
      ),
    Error,
    "Session not found",
  );
});

// ---- Error: Invalid Selector ----

Deno.test("browser_screenshot - rejects invalid element selector", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  // Override screenshot to throw for element not found
  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).screenshot = async (opts: any) => {
    if (opts?.selector === "#nonexistent-element") {
      throw new Error("Element not found: #nonexistent-element");
    }
    return new Uint8Array([1, 2, 3]);
  };

  await assertRejects(
    async () =>
      await browserScreenshotHandler(
        { sessionId, selector: "#nonexistent-element" },
        context,
      ),
    Error,
    "Element not found",
  );
});

// ---- Error: Screenshot Failure ----

Deno.test("browser_screenshot - handles screenshot capture error", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).screenshot = async () => {
    throw new Error("Screenshot capture failed: page not loaded");
  };

  await assertRejects(
    async () =>
      await browserScreenshotHandler({ sessionId }, context),
    Error,
    "Screenshot capture failed",
  );
});

// ---- Permission Check ----

Deno.test("browser_screenshot - enforces permission check", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  (context as any).permissionGuard = {
    checkToolPermission(toolName: string) {
      if (toolName === "browser_screenshot") {
        throw new Error("Permission denied: browser_screenshot not allowed");
      }
    },
  };

  await assertRejects(
    async () =>
      await browserScreenshotHandler({ sessionId }, context),
    Error,
    "Permission denied",
  );
});

// ---- Base64 Encoding ----

Deno.test("browser_screenshot - returns valid base64 data", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserScreenshotHandler({ sessionId }, context);

  // Verify base64 is non-empty and decodable
  assert(result._image.data.length > 0);
  // Should not throw when decoded
  const decoded = Uint8Array.from(atob(result._image.data), (c) => c.charCodeAt(0));
  assert(decoded.length > 0);
});
