/**
 * Browser Extract (Evaluate) Tool Tests
 * Comprehensive tests for browser_evaluate MCP tool
 */

import "./setup.ts";
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import {
  createMockContext,
  createMockContextWithSession,
} from "../helpers/mock-context.ts";
import type { MCPServerContext } from "../../server/mcp-server.ts";
import { validateScript } from "../../security/input-validator.ts";

/**
 * Simulate the browser_evaluate tool handler logic
 */
async function browserEvaluateHandler(
  args: {
    sessionId: string;
    script: string;
    args?: unknown[];
    timeout?: number;
  },
  context: MCPServerContext,
  signal?: AbortSignal,
) {
  context.permissionGuard.checkToolPermission("browser_evaluate");
  validateScript(args.script);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(args.sessionId);
  const result = await page.evaluate(args.script, args.args, { signal });

  return {
    sessionId: args.sessionId,
    result,
  };
}

// ---- Success Path Tests ----

Deno.test("browser_evaluate - executes script and returns result", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).evaluate = async () => "Hello World";

  const result = await browserEvaluateHandler(
    { sessionId, script: "return document.title" },
    context,
  );

  assertEquals(result.sessionId, sessionId);
  assertEquals(result.result, "Hello World");
});

Deno.test("browser_evaluate - returns null by default from mock", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserEvaluateHandler(
    { sessionId, script: "return null" },
    context,
  );

  assertEquals(result.result, null);
});

Deno.test("browser_evaluate - passes arguments to script", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  let capturedArgs: unknown[] | undefined;
  (page as any).evaluate = async (_script: string, args?: unknown[]) => {
    capturedArgs = args;
    return (args?.[0] as number) + (args?.[1] as number);
  };

  const result = await browserEvaluateHandler(
    { sessionId, script: "return arguments[0] + arguments[1]", args: [1, 2] },
    context,
  );

  assertEquals(result.result, 3);
  assertEquals(capturedArgs, [1, 2]);
});

Deno.test("browser_evaluate - returns complex objects", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).evaluate = async () => ({ title: "Test", links: 5 });

  const result = await browserEvaluateHandler(
    { sessionId, script: "return {title: document.title, links: document.links.length}" },
    context,
  );

  assertEquals((result.result as any).title, "Test");
  assertEquals((result.result as any).links, 5);
});

Deno.test("browser_evaluate - returns arrays", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).evaluate = async () => ["a", "b", "c"];

  const result = await browserEvaluateHandler(
    { sessionId, script: "return ['a','b','c']" },
    context,
  );

  assertEquals(result.result, ["a", "b", "c"]);
});

// ---- Error: No Active Session ----

Deno.test("browser_evaluate - throws when session not found", async () => {
  const context = createMockContext();

  const sessionManager = await context.getSessionManager();
  const origGetSessionPage = sessionManager.getSessionPage.bind(sessionManager);
  (sessionManager as any).getSessionPage = async (id: string) => {
    sessionManager.getSession(id);
    return origGetSessionPage(id);
  };

  await assertRejects(
    async () =>
      await browserEvaluateHandler(
        { sessionId: "nonexistent", script: "return 1" },
        context,
      ),
    Error,
    "Session not found",
  );
});

// ---- Error: Script Execution Error ----

Deno.test("browser_evaluate - handles script execution error", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).evaluate = async () => {
    throw new Error("ReferenceError: undefinedVar is not defined");
  };

  await assertRejects(
    async () =>
      await browserEvaluateHandler(
        { sessionId, script: "return undefinedVar" },
        context,
      ),
    Error,
    "ReferenceError",
  );
});

// ---- Return Value Structure ----

Deno.test("browser_evaluate - returns correct structure", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserEvaluateHandler(
    { sessionId, script: "return 42" },
    context,
  );

  assertExists(result.sessionId);
  assertEquals(Object.keys(result).sort(), ["result", "sessionId"]);
});

// ---- Permission Check ----

Deno.test("browser_evaluate - enforces permission check", async () => {
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
      await browserEvaluateHandler(
        { sessionId, script: "return 1" },
        context,
      ),
    Error,
    "Permission denied",
  );
});

// ---- AbortSignal ----

Deno.test("browser_evaluate - supports AbortSignal", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).evaluate = async (
    _script: string,
    _args?: unknown[],
    opts?: { signal?: AbortSignal },
  ) => {
    await new Promise((resolve, reject) => {
      const t = setTimeout(resolve, 5000);
      opts?.signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new Error("Script execution aborted"));
      });
    });
  };

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 50);

  await assertRejects(
    async () =>
      await browserEvaluateHandler(
        { sessionId, script: "return slowOperation()" },
        context,
        controller.signal,
      ),
    Error,
    "aborted",
  );
});

// ---- Edge Cases ----

Deno.test("browser_evaluate - handles undefined return", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).evaluate = async () => undefined;

  const result = await browserEvaluateHandler(
    { sessionId, script: "console.log('no return')" },
    context,
  );

  assertEquals(result.result, undefined);
});
