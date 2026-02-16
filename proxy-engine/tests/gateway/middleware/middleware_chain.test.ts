/**
 * MiddlewareChain Unit Tests
 *
 * Tests for middleware chain execution, removal, enable/disable, and stats.
 */

import { assertEquals } from "@std/assert";
import { MiddlewareChain } from "../../../gateway/middleware/middleware_chain.ts";
import type {
  RequestMiddleware,
  ResponseMiddleware,
  RequestContext,
} from "../../../gateway/middleware/types.ts";
import type { HTTPRequest, HTTPResponse } from "../../../core/network/transport/http/http.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRequestMiddleware(name: string): RequestMiddleware {
  return {
    name,
    processRequest: async (_request: HTTPRequest, _context: RequestContext) => {
      return { type: "continue" as const };
    },
  };
}

function createMockResponseMiddleware(name: string): ResponseMiddleware {
  return {
    name,
    processResponse: async (
      _request: HTTPRequest,
      response: HTTPResponse,
      _context: RequestContext,
    ) => {
      return response;
    },
  };
}

// ---------------------------------------------------------------------------
// removeRequestMiddleware()
// ---------------------------------------------------------------------------

Deno.test("MiddlewareChain - removeRequestMiddleware removes existing middleware", () => {
  const chain = new MiddlewareChain();
  chain.addRequestMiddleware(createMockRequestMiddleware("auth"));
  chain.addRequestMiddleware(createMockRequestMiddleware("logging"));

  const result = chain.removeRequestMiddleware("auth");

  assertEquals(result, true);
  assertEquals(chain.getStats().request.total, 1);
  assertEquals(chain.getStats().request.middleware[0].name, "logging");
});

Deno.test("MiddlewareChain - removeRequestMiddleware returns false for non-existent middleware", () => {
  const chain = new MiddlewareChain();
  chain.addRequestMiddleware(createMockRequestMiddleware("auth"));

  const result = chain.removeRequestMiddleware("nonexistent");

  assertEquals(result, false);
  assertEquals(chain.getStats().request.total, 1);
});

Deno.test("MiddlewareChain - removeRequestMiddleware on empty chain returns false", () => {
  const chain = new MiddlewareChain();

  const result = chain.removeRequestMiddleware("any");

  assertEquals(result, false);
});

Deno.test("MiddlewareChain - removeRequestMiddleware removes only matching middleware", () => {
  const chain = new MiddlewareChain();
  chain.addRequestMiddleware(createMockRequestMiddleware("first"));
  chain.addRequestMiddleware(createMockRequestMiddleware("second"));
  chain.addRequestMiddleware(createMockRequestMiddleware("third"));

  chain.removeRequestMiddleware("second");

  const stats = chain.getStats();
  assertEquals(stats.request.total, 2);
  assertEquals(stats.request.middleware[0].name, "first");
  assertEquals(stats.request.middleware[1].name, "third");
});

// ---------------------------------------------------------------------------
// removeResponseMiddleware()
// ---------------------------------------------------------------------------

Deno.test("MiddlewareChain - removeResponseMiddleware removes existing middleware", () => {
  const chain = new MiddlewareChain();
  chain.addResponseMiddleware(createMockResponseMiddleware("compress"));
  chain.addResponseMiddleware(createMockResponseMiddleware("cors"));

  const result = chain.removeResponseMiddleware("compress");

  assertEquals(result, true);
  assertEquals(chain.getStats().response.total, 1);
  assertEquals(chain.getStats().response.middleware[0].name, "cors");
});

Deno.test("MiddlewareChain - removeResponseMiddleware returns false for non-existent middleware", () => {
  const chain = new MiddlewareChain();
  chain.addResponseMiddleware(createMockResponseMiddleware("cors"));

  const result = chain.removeResponseMiddleware("nonexistent");

  assertEquals(result, false);
  assertEquals(chain.getStats().response.total, 1);
});

Deno.test("MiddlewareChain - removeResponseMiddleware on empty chain returns false", () => {
  const chain = new MiddlewareChain();

  const result = chain.removeResponseMiddleware("any");

  assertEquals(result, false);
});

Deno.test("MiddlewareChain - removeResponseMiddleware removes only matching middleware", () => {
  const chain = new MiddlewareChain();
  chain.addResponseMiddleware(createMockResponseMiddleware("a"));
  chain.addResponseMiddleware(createMockResponseMiddleware("b"));
  chain.addResponseMiddleware(createMockResponseMiddleware("c"));

  chain.removeResponseMiddleware("b");

  const stats = chain.getStats();
  assertEquals(stats.response.total, 2);
  assertEquals(stats.response.middleware[0].name, "a");
  assertEquals(stats.response.middleware[1].name, "c");
});

// ---------------------------------------------------------------------------
// Integration: add, remove, verify chain execution
// ---------------------------------------------------------------------------

Deno.test({
  name: "MiddlewareChain - removed middleware does not execute in request chain",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const chain = new MiddlewareChain();
    const executed: string[] = [];

    const mw1: RequestMiddleware = {
      name: "mw1",
      processRequest: async () => {
        executed.push("mw1");
        return { type: "continue" as const };
      },
    };

    const mw2: RequestMiddleware = {
      name: "mw2",
      processRequest: async () => {
        executed.push("mw2");
        return { type: "continue" as const };
      },
    };

    chain.addRequestMiddleware(mw1);
    chain.addRequestMiddleware(mw2);

    // Remove mw1
    chain.removeRequestMiddleware("mw1");

    const mockRequest = {
      method: "GET",
      uri: "/test",
      version: "1.1",
      headers: {},
    } as unknown as HTTPRequest;
    const mockContext: RequestContext = {
      clientIP: "127.0.0.1",
      clientPort: 8080,
      protocol: "http",
      startTime: Date.now(),
      requestId: "test-1",
      metadata: {},
    };

    await chain.executeRequest(mockRequest, mockContext);

    assertEquals(executed, ["mw2"]);
  },
});

Deno.test({
  name: "MiddlewareChain - removed middleware does not execute in response chain",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const chain = new MiddlewareChain();
    const executed: string[] = [];

    const mw1: ResponseMiddleware = {
      name: "resp1",
      processResponse: async (_req, resp) => {
        executed.push("resp1");
        return resp;
      },
    };

    const mw2: ResponseMiddleware = {
      name: "resp2",
      processResponse: async (_req, resp) => {
        executed.push("resp2");
        return resp;
      },
    };

    chain.addResponseMiddleware(mw1);
    chain.addResponseMiddleware(mw2);

    // Remove resp1
    chain.removeResponseMiddleware("resp1");

    const mockRequest = {
      method: "GET",
      uri: "/test",
      version: "1.1",
      headers: {},
    } as unknown as HTTPRequest;
    const mockResponse = {
      version: "1.1",
      statusCode: 200,
      statusText: "OK",
      headers: {},
    } as unknown as HTTPResponse;
    const mockContext: RequestContext = {
      clientIP: "127.0.0.1",
      clientPort: 8080,
      protocol: "http",
      startTime: Date.now(),
      requestId: "test-2",
      metadata: {},
    };

    await chain.executeResponse(mockRequest, mockResponse, mockContext);

    assertEquals(executed, ["resp2"]);
  },
});
