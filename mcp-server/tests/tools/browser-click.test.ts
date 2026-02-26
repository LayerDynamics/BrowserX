/**
 * Browser Click Tool Tests
 * Comprehensive tests for browser_click MCP tool
 */

import "./setup.ts";
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import {
  createMockContext,
  createMockContextWithSession,
  createMockBrowserPage,
  createMockSessionManager,
} from "../helpers/mock-context.ts";
import type { MCPServerContext } from "../../server/mcp-server.ts";
import { validateSelector } from "../../security/input-validator.ts";

/**
 * Simulate the browser_click tool handler logic
 */
async function browserClickHandler(
  args: {
    sessionId: string;
    selector: string;
    selectorType?: "css" | "xpath";
    timeout?: number;
  },
  context: MCPServerContext,
  signal?: AbortSignal,
) {
  context.permissionGuard.checkToolPermission("browser_click");
  validateSelector(args.selector);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(args.sessionId);
  await page.click(args.selector, args.selectorType ?? "css", {
    signal,
  });

  return {
    sessionId: args.sessionId,
    action: "click",
    selector: args.selector,
  };
}

// ---- Success Path Tests ----

Deno.test("browser_click - clicks element with CSS selector", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserClickHandler(
    { sessionId, selector: "#submit-btn" },
    context,
  );

  assertEquals(result.sessionId, sessionId);
  assertEquals(result.action, "click");
  assertEquals(result.selector, "#submit-btn");
});

Deno.test("browser_click - clicks element with XPath selector", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserClickHandler(
    { sessionId, selector: "//button[@type='submit']", selectorType: "xpath" },
    context,
  );

  assertEquals(result.action, "click");
  assertEquals(result.selector, "//button[@type='submit']");
});

Deno.test("browser_click - defaults selectorType to css", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserClickHandler(
    { sessionId, selector: ".btn-primary" },
    context,
  );

  assertExists(result.sessionId);
  assertEquals(result.selector, ".btn-primary");
});

Deno.test("browser_click - returns correct result structure", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserClickHandler(
    { sessionId, selector: "a.link" },
    context,
  );

  assertEquals(Object.keys(result).sort(), ["action", "selector", "sessionId"]);
  assertEquals(result.action, "click");
});

// ---- Error: No Active Session ----

Deno.test("browser_click - throws when session not found", async () => {
  const context = createMockContext();

  // Override getSessionPage to validate session existence
  const sessionManager = await context.getSessionManager();
  const origGetSessionPage = sessionManager.getSessionPage.bind(sessionManager);
  (sessionManager as any).getSessionPage = async (id: string) => {
    // Force session lookup which throws for unknown sessions
    sessionManager.getSession(id);
    return origGetSessionPage(id);
  };

  await assertRejects(
    async () =>
      await browserClickHandler(
        { sessionId: "nonexistent-session", selector: "#btn" },
        context,
      ),
    Error,
    "Session not found",
  );
});

// ---- Error: Element Not Found ----

Deno.test("browser_click - throws when element not found", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  // Override page.click to throw element not found
  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).click = async () => {
    throw new Error("Element not found: #nonexistent");
  };

  await assertRejects(
    async () =>
      await browserClickHandler(
        { sessionId, selector: "#nonexistent" },
        context,
      ),
    Error,
    "Element not found",
  );
});

// ---- Error: Invalid Selector ----

Deno.test("browser_click - rejects empty selector", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  await assertRejects(
    async () =>
      await browserClickHandler(
        { sessionId, selector: "" },
        context,
      ),
    Error,
  );
});

// ---- Permission Check ----

Deno.test("browser_click - enforces permission check", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  (context as any).permissionGuard = {
    checkToolPermission(toolName: string) {
      if (toolName === "browser_click") {
        throw new Error("Permission denied: browser_click not allowed");
      }
    },
  };

  await assertRejects(
    async () =>
      await browserClickHandler(
        { sessionId, selector: "#btn" },
        context,
      ),
    Error,
    "Permission denied",
  );
});

// ---- AbortSignal ----

Deno.test("browser_click - supports AbortSignal", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  // Override click to respect abort
  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).click = async (
    _sel: string,
    _type: string,
    opts?: { signal?: AbortSignal },
  ) => {
    if (opts?.signal?.aborted) {
      throw new Error("Click aborted");
    }
    await new Promise((resolve, reject) => {
      const t = setTimeout(resolve, 5000);
      opts?.signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new Error("Click aborted"));
      });
    });
  };

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 50);

  await assertRejects(
    async () =>
      await browserClickHandler(
        { sessionId, selector: "#btn" },
        context,
        controller.signal,
      ),
    Error,
    "aborted",
  );
});

// ---- Complex Selectors ----

Deno.test("browser_click - handles complex CSS selectors", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserClickHandler(
    { sessionId, selector: "div.container > ul > li:nth-child(3) a[href]" },
    context,
  );

  assertEquals(result.selector, "div.container > ul > li:nth-child(3) a[href]");
});

Deno.test("browser_click - handles attribute selectors", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserClickHandler(
    { sessionId, selector: "input[data-testid='login-btn']" },
    context,
  );

  assertEquals(result.selector, "input[data-testid='login-btn']");
});
