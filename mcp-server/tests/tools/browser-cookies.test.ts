/**
 * Browser Cookies Tool Tests
 * Tests for browser cookie management via evaluate-based cookie operations
 *
 * Since BrowserX exposes cookie management through browser_evaluate,
 * these tests verify cookie get/set/clear operations via the evaluate handler.
 */

import "./setup.ts";
import { assertEquals, assertExists, assertRejects, assert } from "@std/assert";
import {
  createMockContext,
  createMockContextWithSession,
} from "../helpers/mock-context.ts";
import type { MCPServerContext } from "../../server/mcp-server.ts";
import { validateScript } from "../../security/input-validator.ts";

/**
 * Simulate cookie operations via browser_evaluate handler
 */
async function browserCookieHandler(
  args: {
    sessionId: string;
    action: "get" | "set" | "clear" | "getAll";
    name?: string;
    value?: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    expires?: number;
  },
  context: MCPServerContext,
) {
  context.permissionGuard.checkToolPermission("browser_evaluate");

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(args.sessionId);

  let script: string;
  switch (args.action) {
    case "get":
      script = `return document.cookie.split('; ').find(c => c.startsWith('${args.name}='))?.split('=')[1] ?? null`;
      break;
    case "getAll":
      script = `return document.cookie`;
      break;
    case "set": {
      const parts = [`${args.name}=${args.value}`];
      if (args.path) parts.push(`path=${args.path}`);
      if (args.domain) parts.push(`domain=${args.domain}`);
      if (args.secure) parts.push("secure");
      if (args.expires) parts.push(`expires=${new Date(args.expires).toUTCString()}`);
      script = `document.cookie = '${parts.join('; ')}'; return true`;
      break;
    }
    case "clear":
      script = `document.cookie = '${args.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${args.path ?? "/"}'; return true`;
      break;
    default:
      throw new Error(`Unknown cookie action: ${args.action}`);
  }

  validateScript(script);
  const result = await page.evaluate(script);

  return {
    sessionId: args.sessionId,
    action: args.action,
    name: args.name,
    result,
  };
}

// ---- Get Cookie Tests ----

Deno.test("browser_cookies - gets a cookie by name", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).evaluate = async () => "session_token_value";

  const result = await browserCookieHandler(
    { sessionId, action: "get", name: "session_token" },
    context,
  );

  assertEquals(result.sessionId, sessionId);
  assertEquals(result.action, "get");
  assertEquals(result.name, "session_token");
  assertEquals(result.result, "session_token_value");
});

Deno.test("browser_cookies - returns null for nonexistent cookie", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).evaluate = async () => null;

  const result = await browserCookieHandler(
    { sessionId, action: "get", name: "nonexistent" },
    context,
  );

  assertEquals(result.result, null);
});

// ---- Get All Cookies ----

Deno.test("browser_cookies - gets all cookies", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).evaluate = async () => "a=1; b=2; c=3";

  const result = await browserCookieHandler(
    { sessionId, action: "getAll" },
    context,
  );

  assertEquals(result.action, "getAll");
  assertEquals(result.result, "a=1; b=2; c=3");
});

Deno.test("browser_cookies - returns empty string when no cookies", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).evaluate = async () => "";

  const result = await browserCookieHandler(
    { sessionId, action: "getAll" },
    context,
  );

  assertEquals(result.result, "");
});

// ---- Set Cookie Tests ----

Deno.test("browser_cookies - sets a cookie", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).evaluate = async () => true;

  const result = await browserCookieHandler(
    { sessionId, action: "set", name: "token", value: "abc123" },
    context,
  );

  assertEquals(result.action, "set");
  assertEquals(result.name, "token");
  assertEquals(result.result, true);
});

Deno.test("browser_cookies - sets a cookie with path and domain", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  let capturedScript = "";
  (page as any).evaluate = async (script: string) => {
    capturedScript = script;
    return true;
  };

  await browserCookieHandler(
    {
      sessionId,
      action: "set",
      name: "pref",
      value: "dark",
      path: "/app",
      domain: ".example.com",
    },
    context,
  );

  assert(capturedScript.includes("path=/app"));
  assert(capturedScript.includes("domain=.example.com"));
});

Deno.test("browser_cookies - sets a secure cookie", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  let capturedScript = "";
  (page as any).evaluate = async (script: string) => {
    capturedScript = script;
    return true;
  };

  await browserCookieHandler(
    {
      sessionId,
      action: "set",
      name: "auth",
      value: "xyz",
      secure: true,
    },
    context,
  );

  assert(capturedScript.includes("secure"));
});

// ---- Clear Cookie Tests ----

Deno.test("browser_cookies - clears a cookie", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).evaluate = async () => true;

  const result = await browserCookieHandler(
    { sessionId, action: "clear", name: "token" },
    context,
  );

  assertEquals(result.action, "clear");
  assertEquals(result.result, true);
});

// ---- Error: No Active Session ----

Deno.test("browser_cookies - throws when session not found", async () => {
  const context = createMockContext();

  const sessionManager = await context.getSessionManager();
  const origGetSessionPage = sessionManager.getSessionPage.bind(sessionManager);
  (sessionManager as any).getSessionPage = async (id: string) => {
    sessionManager.getSession(id);
    return origGetSessionPage(id);
  };

  await assertRejects(
    async () =>
      await browserCookieHandler(
        { sessionId: "nonexistent", action: "getAll" },
        context,
      ),
    Error,
    "Session not found",
  );
});

// ---- Permission Check ----

Deno.test("browser_cookies - enforces permission check", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  (context as any).permissionGuard = {
    checkToolPermission(toolName: string) {
      if (toolName === "browser_evaluate") {
        throw new Error("Permission denied: browser_evaluate not allowed");
      }
    },
  };

  await assertRejects(
    async () =>
      await browserCookieHandler(
        { sessionId, action: "getAll" },
        context,
      ),
    Error,
    "Permission denied",
  );
});

// ---- Return Value Structure ----

Deno.test("browser_cookies - returns correct structure", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserCookieHandler(
    { sessionId, action: "getAll" },
    context,
  );

  assertExists(result.sessionId);
  assertExists(result.action);
  assertEquals(Object.keys(result).sort(), ["action", "name", "result", "sessionId"]);
});
