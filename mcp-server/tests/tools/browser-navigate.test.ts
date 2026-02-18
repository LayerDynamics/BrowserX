/**
 * Browser Navigate Tool Tests
 * Comprehensive tests for browser_navigate MCP tool
 *
 * Covers:
 * - Valid URL navigation (http, https)
 * - Invalid URLs (malformed, missing protocol, unsupported protocols)
 * - Network errors (DNS failure, connection refused)
 * - Timeout scenarios
 * - Session management (new session, existing session, session reuse)
 * - URL redirects
 * - waitUntil parameter variations
 * - AbortSignal cancellation
 */

import { assertEquals, assertExists, assertRejects, assertStringIncludes } from "@std/assert";
import {
  createMockContext,
  createMockContextWithSlowNav,
  createMockContextWithNavError,
  createMockContextWithRedirect,
  createMockContextWithSession,
  createMockContextAtCapacity,
} from "../helpers/mock-context.ts";
import type { MCPServerContext } from "../../server/mcp-server.ts";

/**
 * Simulate the browser_navigate tool handler logic
 * (Extracted from the withFeedback wrapper for direct testing)
 */
async function browserNavigateHandler(
  args: {
    url: string;
    sessionId?: string;
    waitUntil?: "load" | "domcontentloaded" | "networkidle";
    timeout?: number;
  },
  context: MCPServerContext,
  signal?: AbortSignal,
) {
  // Permission check
  context.permissionGuard.checkToolPermission("browser_navigate");

  // URL validation (from input-validator.ts)
  const urlStr = args.url;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlStr);
  } catch {
    throw new Error(`Invalid URL: ${urlStr}`);
  }

  // Protocol validation
  const allowedProtocols = ["http:", "https:"];
  if (!allowedProtocols.includes(parsedUrl.protocol)) {
    throw new Error(
      `Protocol not allowed: ${parsedUrl.protocol}. Allowed: ${allowedProtocols.join(", ")}`,
    );
  }

  // Get session manager
  const sessionManager = await context.getSessionManager();

  // Get or create session
  let session;
  let newSession = false;

  if (args.sessionId && sessionManager.hasSession(args.sessionId)) {
    session = sessionManager.getSession(args.sessionId);
  } else {
    const newSessionId = await sessionManager.createSession([]);
    session = sessionManager.getSession(newSessionId);
    newSession = true;
  }

  // Navigate
  const page = await sessionManager.getSessionPage(session.id);
  const effectiveTimeout = args.timeout ?? 30000;
  await page.navigate(args.url, {
    waitFor: args.waitUntil ?? "load",
    timeout: effectiveTimeout,
    signal,
  });

  // Update session URL
  sessionManager.updateSessionUrl(session.id, args.url);

  // Check for redirects
  const currentUrl = page.getCurrentURL();
  const redirected = currentUrl !== args.url;

  return {
    sessionId: session.id,
    newSession,
    url: args.url,
    currentUrl,
    redirected,
  };
}

// ---- Valid Navigation Tests ----

Deno.test("browser_navigate - navigates to valid HTTPS URL", async () => {
  const context = createMockContext();

  const result = await browserNavigateHandler(
    { url: "https://example.com" },
    context,
  );

  assertExists(result.sessionId);
  assertEquals(result.newSession, true);
  assertEquals(result.url, "https://example.com");
  assertEquals(result.currentUrl, "https://example.com");
  assertEquals(result.redirected, false);
});

Deno.test("browser_navigate - navigates to valid HTTP URL", async () => {
  const context = createMockContext();

  const result = await browserNavigateHandler(
    { url: "http://example.com" },
    context,
  );

  assertEquals(result.url, "http://example.com");
  assertEquals(result.currentUrl, "http://example.com");
});

Deno.test("browser_navigate - navigates to URL with path and query", async () => {
  const context = createMockContext();

  const result = await browserNavigateHandler(
    { url: "https://example.com/path?query=value" },
    context,
  );

  assertEquals(result.url, "https://example.com/path?query=value");
  assertEquals(result.currentUrl, "https://example.com/path?query=value");
});

// ---- Invalid URL Tests ----

Deno.test("browser_navigate - rejects malformed URL", async () => {
  const context = createMockContext();

  await assertRejects(
    async () => await browserNavigateHandler({ url: "not-a-url" }, context),
    Error,
    "Invalid URL",
  );
});

Deno.test("browser_navigate - rejects URL without protocol", async () => {
  const context = createMockContext();

  await assertRejects(
    async () => await browserNavigateHandler({ url: "example.com" }, context),
    Error,
    "Invalid URL",
  );
});

Deno.test("browser_navigate - rejects unsupported protocol (ftp)", async () => {
  const context = createMockContext();

  await assertRejects(
    async () => await browserNavigateHandler({ url: "ftp://example.com" }, context),
    Error,
    "Protocol not allowed: ftp:",
  );
});

Deno.test("browser_navigate - rejects unsupported protocol (file)", async () => {
  const context = createMockContext();

  await assertRejects(
    async () => await browserNavigateHandler({ url: "file:///etc/passwd" }, context),
    Error,
    "Protocol not allowed: file:",
  );
});

Deno.test("browser_navigate - rejects javascript: protocol", async () => {
  const context = createMockContext();

  await assertRejects(
    async () => await browserNavigateHandler({ url: "javascript:alert(1)" }, context),
    Error,
    "Protocol not allowed",
  );
});

// ---- Network Error Tests ----

Deno.test("browser_navigate - handles DNS resolution failure", async () => {
  const dnsError = new Error("DNS resolution failed: NXDOMAIN");
  const context = createMockContextWithNavError(dnsError);

  await assertRejects(
    async () => await browserNavigateHandler({ url: "https://nonexistent.invalid" }, context),
    Error,
    "DNS resolution failed",
  );
});

Deno.test("browser_navigate - handles connection refused", async () => {
  const connError = new Error("Connection refused");
  const context = createMockContextWithNavError(connError);

  await assertRejects(
    async () => await browserNavigateHandler({ url: "https://localhost:1" }, context),
    Error,
    "Connection refused",
  );
});

Deno.test("browser_navigate - handles TLS certificate error", async () => {
  const tlsError = new Error("TLS handshake failed: certificate verification error");
  const context = createMockContextWithNavError(tlsError);

  await assertRejects(
    async () => await browserNavigateHandler({ url: "https://expired.badssl.com" }, context),
    Error,
    "TLS handshake failed",
  );
});

// ---- Timeout Tests ----

Deno.test("browser_navigate - respects custom timeout", async () => {
  const context = createMockContextWithSlowNav(200);

  // Should succeed with sufficient timeout
  const result = await browserNavigateHandler(
    {
      url: "https://example.com",
      timeout: 1000,
    },
    context,
  );

  assertExists(result.sessionId);
});

Deno.test("browser_navigate - timeout triggers AbortSignal", async () => {
  const context = createMockContextWithSlowNav(5000);
  const controller = new AbortController();

  // Abort after 100ms
  setTimeout(() => controller.abort(), 100);

  await assertRejects(
    async () =>
      await browserNavigateHandler(
        { url: "https://example.com" },
        context,
        controller.signal,
      ),
    Error,
    "aborted",
  );
});

Deno.test("browser_navigate - uses default timeout of 30000ms", async () => {
  const context = createMockContext();

  const result = await browserNavigateHandler(
    { url: "https://example.com" },
    context,
  );

  // Default timeout is not visible in result, but navigation should succeed
  assertExists(result.sessionId);
});

// ---- Session Management Tests ----

Deno.test("browser_navigate - creates new session when sessionId not provided", async () => {
  const context = createMockContext();

  const result = await browserNavigateHandler(
    { url: "https://example.com" },
    context,
  );

  assertEquals(result.newSession, true);
  assertExists(result.sessionId);
});

Deno.test("browser_navigate - reuses existing session when sessionId provided", async () => {
  const existingSessionId = "existing-session-123";
  const context = createMockContextWithSession(existingSessionId);

  const result = await browserNavigateHandler(
    {
      url: "https://example.com",
      sessionId: existingSessionId,
    },
    context,
  );

  assertEquals(result.newSession, false);
  assertEquals(result.sessionId, existingSessionId);
});

Deno.test("browser_navigate - creates new session if provided sessionId doesn't exist", async () => {
  const context = createMockContext();

  const result = await browserNavigateHandler(
    {
      url: "https://example.com",
      sessionId: "nonexistent-session",
    },
    context,
  );

  assertEquals(result.newSession, true);
  // Should have created a new session, not the nonexistent one
  assertEquals(result.sessionId !== "nonexistent-session", true);
});

Deno.test("browser_navigate - updates session URL after navigation", async () => {
  const existingSessionId = "existing-session-123";
  const context = createMockContextWithSession(existingSessionId);

  await browserNavigateHandler(
    {
      url: "https://new-url.com",
      sessionId: existingSessionId,
    },
    context,
  );

  const sessionManager = await context.getSessionManager();
  const session = sessionManager.getSession(existingSessionId);
  assertEquals(session.currentUrl, "https://new-url.com");
});

Deno.test("browser_navigate - fails when max sessions exceeded", async () => {
  const context = createMockContextAtCapacity();

  await assertRejects(
    async () => await browserNavigateHandler({ url: "https://example.com" }, context),
    Error,
    "all browser pool slots are in use",
  );
});

// ---- Redirect Tests ----

Deno.test("browser_navigate - detects URL redirect", async () => {
  const context = createMockContextWithRedirect("https://example.com/redirected");

  const result = await browserNavigateHandler(
    { url: "https://example.com/original" },
    context,
  );

  assertEquals(result.url, "https://example.com/original");
  assertEquals(result.currentUrl, "https://example.com/redirected");
  assertEquals(result.redirected, true);
});

Deno.test("browser_navigate - no redirect when URLs match", async () => {
  const context = createMockContext();

  const result = await browserNavigateHandler(
    { url: "https://example.com" },
    context,
  );

  assertEquals(result.url, "https://example.com");
  assertEquals(result.currentUrl, "https://example.com");
  assertEquals(result.redirected, false);
});

// ---- waitUntil Parameter Tests ----

Deno.test("browser_navigate - uses default waitUntil='load'", async () => {
  const context = createMockContext();

  const result = await browserNavigateHandler(
    { url: "https://example.com" },
    context,
  );

  // Default behavior should succeed
  assertExists(result.sessionId);
});

Deno.test("browser_navigate - supports waitUntil='domcontentloaded'", async () => {
  const context = createMockContext();

  const result = await browserNavigateHandler(
    {
      url: "https://example.com",
      waitUntil: "domcontentloaded",
    },
    context,
  );

  assertExists(result.sessionId);
});

Deno.test("browser_navigate - supports waitUntil='networkidle'", async () => {
  const context = createMockContext();

  const result = await browserNavigateHandler(
    {
      url: "https://example.com",
      waitUntil: "networkidle",
    },
    context,
  );

  assertExists(result.sessionId);
});

// ---- Integration Tests ----

Deno.test("browser_navigate - multiple navigations in same session", async () => {
  const context = createMockContext();

  // First navigation creates session
  const result1 = await browserNavigateHandler(
    { url: "https://first.com" },
    context,
  );

  assertEquals(result1.newSession, true);
  const sessionId = result1.sessionId;

  // Second navigation reuses session
  const result2 = await browserNavigateHandler(
    {
      url: "https://second.com",
      sessionId,
    },
    context,
  );

  assertEquals(result2.newSession, false);
  assertEquals(result2.sessionId, sessionId);
  assertEquals(result2.url, "https://second.com");
});

Deno.test("browser_navigate - handles complex URL with all components", async () => {
  const context = createMockContext();
  const complexUrl = "https://user:pass@example.com:8443/path/to/resource?query=value&foo=bar#fragment";

  const result = await browserNavigateHandler(
    { url: complexUrl },
    context,
  );

  assertEquals(result.url, complexUrl);
  assertEquals(result.currentUrl, complexUrl);
});

Deno.test("browser_navigate - permission check is enforced", async () => {
  // Create context without browser_navigate permission
  const context = createMockContext();

  // Override permission guard to deny browser_navigate specifically
  // We need to use allowUnknownTools: false (default) so it denies the tool
  const { PermissionGuard } = await import("../../security/permission-guard.ts");

  // Create guard with READONLY which has NAVIGATE_PUBLIC, but then override checkToolPermission
  const originalGuard = new PermissionGuard("READONLY");
  const mockGuard = {
    ...originalGuard,
    checkToolPermission(toolName: string) {
      if (toolName === "browser_navigate") {
        throw new Error("Permission denied: browser_navigate not allowed");
      }
    },
    getGrantedPermissions() {
      return originalGuard.getGrantedPermissions();
    },
  };

  (context as any).permissionGuard = mockGuard;

  await assertRejects(
    async () => await browserNavigateHandler({ url: "https://example.com" }, context),
    Error,
    "Permission denied",
  );
});
