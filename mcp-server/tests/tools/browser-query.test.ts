/**
 * Browser Query DOM Tool Tests
 * Comprehensive tests for browser_query_dom MCP tool
 */

import "./setup.ts";
import { assertEquals, assertExists, assertRejects, assert } from "@std/assert";
import {
  createMockContext,
  createMockContextWithSession,
  type MockElement,
} from "../helpers/mock-context.ts";
import type { MCPServerContext } from "../../server/mcp-server.ts";
import { validateSelector } from "../../security/input-validator.ts";

/**
 * Create mock elements for query results
 */
function createMockElements(data: Array<Record<string, string>>): MockElement[] {
  return data.map((item) => ({
    async getAttribute(name: string): Promise<string | null> {
      return item[`attr:${name}`] ?? null;
    },
    async getProperty(name: string): Promise<unknown> {
      return item[`prop:${name}`] ?? null;
    },
    async getText(): Promise<string> {
      return item["text"] ?? "";
    },
  }));
}

/**
 * Simulate the browser_query_dom tool handler logic
 */
async function browserQueryDomHandler(
  args: {
    sessionId: string;
    selector: string;
    selectorType?: "css" | "xpath";
    extract: Array<{
      name: string;
      attribute?: string;
      property?: string;
      getText?: boolean;
      getHtml?: boolean;
    }>;
    limit?: number;
  },
  context: MCPServerContext,
  signal?: AbortSignal,
) {
  context.permissionGuard.checkToolPermission("browser_query_dom");
  validateSelector(args.selector);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(args.sessionId);
  const elements = await page.query(
    args.selector,
    args.selectorType ?? "css",
    { signal },
  );
  const limitedElements = args.limit
    ? elements.slice(0, args.limit)
    : elements;

  const results = await Promise.all(
    limitedElements.map(async (element) => {
      const data: Record<string, unknown> = {};
      for (const field of args.extract) {
        if (field.attribute) {
          data[field.name] = await element.getAttribute(field.attribute);
        } else if (field.property) {
          data[field.name] = await element.getProperty(field.property);
        } else if (field.getText) {
          data[field.name] = await element.getText();
        } else if (field.getHtml) {
          data[field.name] = await element.getProperty("innerHTML");
        }
      }
      return data;
    }),
  );

  return {
    sessionId: args.sessionId,
    selector: args.selector,
    count: results.length,
    elements: results,
  };
}

// ---- Success Path Tests ----

Deno.test("browser_query_dom - returns empty results when no elements found", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserQueryDomHandler(
    {
      sessionId,
      selector: ".product-card",
      extract: [{ name: "title", getText: true }],
    },
    context,
  );

  assertEquals(result.sessionId, sessionId);
  assertEquals(result.selector, ".product-card");
  assertEquals(result.count, 0);
  assertEquals(result.elements, []);
});

Deno.test("browser_query_dom - extracts text from elements", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  // Override query to return mock elements
  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).query = async () =>
    createMockElements([
      { text: "Product A" },
      { text: "Product B" },
    ]);

  const result = await browserQueryDomHandler(
    {
      sessionId,
      selector: ".product-name",
      extract: [{ name: "title", getText: true }],
    },
    context,
  );

  assertEquals(result.count, 2);
  assertEquals(result.elements[0].title, "Product A");
  assertEquals(result.elements[1].title, "Product B");
});

Deno.test("browser_query_dom - extracts attributes from elements", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).query = async () =>
    createMockElements([
      { "attr:href": "https://example.com/1", text: "Link 1" },
      { "attr:href": "https://example.com/2", text: "Link 2" },
    ]);

  const result = await browserQueryDomHandler(
    {
      sessionId,
      selector: "a",
      extract: [
        { name: "url", attribute: "href" },
        { name: "label", getText: true },
      ],
    },
    context,
  );

  assertEquals(result.count, 2);
  assertEquals(result.elements[0].url, "https://example.com/1");
  assertEquals(result.elements[0].label, "Link 1");
});

Deno.test("browser_query_dom - extracts properties from elements", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).query = async () =>
    createMockElements([{ "prop:value": "hello@test.com" }]);

  const result = await browserQueryDomHandler(
    {
      sessionId,
      selector: "input#email",
      extract: [{ name: "val", property: "value" }],
    },
    context,
  );

  assertEquals(result.count, 1);
  assertEquals(result.elements[0].val, "hello@test.com");
});

Deno.test("browser_query_dom - extracts innerHTML via getHtml", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).query = async () =>
    createMockElements([{ "prop:innerHTML": "<b>Bold text</b>" }]);

  const result = await browserQueryDomHandler(
    {
      sessionId,
      selector: "div.content",
      extract: [{ name: "html", getHtml: true }],
    },
    context,
  );

  assertEquals(result.count, 1);
  assertEquals(result.elements[0].html, "<b>Bold text</b>");
});

// ---- Limit Parameter ----

Deno.test("browser_query_dom - respects limit parameter", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  (page as any).query = async () =>
    createMockElements([
      { text: "Item 1" },
      { text: "Item 2" },
      { text: "Item 3" },
      { text: "Item 4" },
      { text: "Item 5" },
    ]);

  const result = await browserQueryDomHandler(
    {
      sessionId,
      selector: ".item",
      extract: [{ name: "title", getText: true }],
      limit: 2,
    },
    context,
  );

  assertEquals(result.count, 2);
  assertEquals(result.elements[0].title, "Item 1");
  assertEquals(result.elements[1].title, "Item 2");
});

// ---- Error: No Active Session ----

Deno.test("browser_query_dom - throws when session not found", async () => {
  const context = createMockContext();

  const sessionManager = await context.getSessionManager();
  const origGetSessionPage = sessionManager.getSessionPage.bind(sessionManager);
  (sessionManager as any).getSessionPage = async (id: string) => {
    sessionManager.getSession(id);
    return origGetSessionPage(id);
  };

  await assertRejects(
    async () =>
      await browserQueryDomHandler(
        {
          sessionId: "nonexistent",
          selector: "div",
          extract: [{ name: "text", getText: true }],
        },
        context,
      ),
    Error,
    "Session not found",
  );
});

// ---- Error: Invalid Selector ----

Deno.test("browser_query_dom - rejects empty selector", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  await assertRejects(
    async () =>
      await browserQueryDomHandler(
        {
          sessionId,
          selector: "",
          extract: [{ name: "text", getText: true }],
        },
        context,
      ),
    Error,
  );
});

// ---- Return Value Structure ----

Deno.test("browser_query_dom - returns correct result structure", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const result = await browserQueryDomHandler(
    {
      sessionId,
      selector: "div",
      extract: [{ name: "text", getText: true }],
    },
    context,
  );

  assertExists(result.sessionId);
  assertExists(result.selector);
  assertEquals(typeof result.count, "number");
  assert(Array.isArray(result.elements));
});

// ---- XPath Selector ----

Deno.test("browser_query_dom - supports xpath selector type", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  const sessionManager = await context.getSessionManager();
  const page = await sessionManager.getSessionPage(sessionId);
  let capturedType: string | undefined;
  (page as any).query = async (_sel: string, type: string) => {
    capturedType = type;
    return [];
  };

  await browserQueryDomHandler(
    {
      sessionId,
      selector: "//div[@class='item']",
      selectorType: "xpath",
      extract: [{ name: "text", getText: true }],
    },
    context,
  );

  assertEquals(capturedType, "xpath");
});

// ---- Permission Check ----

Deno.test("browser_query_dom - enforces permission check", async () => {
  const sessionId = "session-1";
  const context = createMockContextWithSession(sessionId);

  (context as any).permissionGuard = {
    checkToolPermission(toolName: string) {
      if (toolName === "browser_query_dom") {
        throw new Error("Permission denied: browser_query_dom not allowed");
      }
    },
  };

  await assertRejects(
    async () =>
      await browserQueryDomHandler(
        {
          sessionId,
          selector: "div",
          extract: [{ name: "text", getText: true }],
        },
        context,
      ),
    Error,
    "Permission denied",
  );
});
