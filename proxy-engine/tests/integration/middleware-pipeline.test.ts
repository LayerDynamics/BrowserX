/**
 * Integration Tests: Middleware Pipeline
 *
 * Tests the middleware chain with real middleware components wired together:
 * - Request middleware chaining and ordering
 * - Response middleware transformations
 * - Short-circuit (auth failure returns early)
 * - Error propagation
 * - Enable/disable middleware dynamically
 * - Middleware modifying request/response
 */

import { assertEquals, assert, assertStringIncludes } from "@std/assert";
import { MiddlewareChain, createErrorResponse } from "../../gateway/middleware/middleware_chain.ts";
import type {
  RequestMiddleware,
  ResponseMiddleware,
  RequestContext,
  MiddlewareResult,
} from "../../gateway/middleware/types.ts";
import type { HTTPRequest, HTTPResponse } from "../../core/network/transport/http/http.ts";
import { MiddlewareInterceptor } from "../../gateway/middleware/middleware_interceptor.ts";

// Helper: create a request context
function makeContext(): RequestContext {
  return {
    clientIP: "192.168.1.100",
    clientPort: 54321,
    protocol: "http",
    startTime: Date.now(),
    requestId: "test-req-001",
    metadata: {},
  };
}

// Helper: create a basic HTTP request
function makeRequest(method = "GET", uri = "/test", headers: Record<string, string> = {}): HTTPRequest {
  return { method, uri, version: "1.1", headers: { host: "localhost", ...headers } };
}

// Helper: create a basic HTTP response
function makeResponse(status = 200, headers: Record<string, string> = {}, bodyText = "OK"): HTTPResponse {
  const body = new TextEncoder().encode(bodyText);
  return {
    version: "1.1",
    statusCode: status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "content-type": "text/plain", ...headers },
    body,
  };
}

// --- Middleware implementations for testing ---

class LoggingMiddleware implements RequestMiddleware, ResponseMiddleware {
  readonly name = "logging";
  public requestLog: string[] = [];
  public responseLog: string[] = [];

  async processRequest(request: HTTPRequest, context: RequestContext): Promise<MiddlewareResult> {
    this.requestLog.push(`${request.method} ${request.uri} from ${context.clientIP}`);
    context.metadata["logged"] = true;
    return { type: "continue" };
  }

  async processResponse(request: HTTPRequest, response: HTTPResponse, _context: RequestContext): Promise<HTTPResponse> {
    this.responseLog.push(`${request.method} ${request.uri} -> ${response.statusCode}`);
    return {
      ...response,
      headers: { ...response.headers, "x-logged": "true" },
    };
  }
}

class AuthMiddleware implements RequestMiddleware {
  readonly name = "auth";

  constructor(private validTokens: Set<string>) {}

  async processRequest(request: HTTPRequest, context: RequestContext): Promise<MiddlewareResult> {
    const authHeader = request.headers["authorization"];
    if (!authHeader) {
      const body = new TextEncoder().encode(JSON.stringify({ error: "Unauthorized" }));
      return {
        type: "respond",
        response: {
          version: "1.1",
          statusCode: 401,
          statusText: "Unauthorized",
          headers: { "content-type": "application/json", "content-length": body.length.toString() },
          body,
        },
      };
    }

    const token = authHeader.replace("Bearer ", "");
    if (!this.validTokens.has(token)) {
      const body = new TextEncoder().encode(JSON.stringify({ error: "Invalid token" }));
      return {
        type: "respond",
        response: {
          version: "1.1",
          statusCode: 403,
          statusText: "Forbidden",
          headers: { "content-type": "application/json", "content-length": body.length.toString() },
          body,
        },
      };
    }

    context.user = { id: "user-1", username: "testuser", roles: ["admin"], attributes: {} };
    context.metadata["authenticated"] = true;
    return { type: "continue" };
  }
}

class RateLimitMiddleware implements RequestMiddleware {
  readonly name = "rate-limit";
  private requestCounts = new Map<string, number>();

  constructor(private maxRequests: number) {}

  async processRequest(_request: HTTPRequest, context: RequestContext): Promise<MiddlewareResult> {
    const ip = context.clientIP;
    const count = (this.requestCounts.get(ip) || 0) + 1;
    this.requestCounts.set(ip, count);

    if (count > this.maxRequests) {
      const body = new TextEncoder().encode(JSON.stringify({ error: "Rate limit exceeded" }));
      return {
        type: "respond",
        response: {
          version: "1.1",
          statusCode: 429,
          statusText: "Too Many Requests",
          headers: { "content-type": "application/json", "content-length": body.length.toString() },
          body,
        },
      };
    }

    return { type: "continue" };
  }
}

class HeaderInjectionMiddleware implements ResponseMiddleware {
  readonly name = "header-injection";

  constructor(private extraHeaders: Record<string, string>) {}

  async processResponse(_request: HTTPRequest, response: HTTPResponse, _context: RequestContext): Promise<HTTPResponse> {
    return {
      ...response,
      headers: { ...response.headers, ...this.extraHeaders },
    };
  }
}

class ErrorMiddleware implements RequestMiddleware {
  readonly name = "error-thrower";

  async processRequest(_request: HTTPRequest, _context: RequestContext): Promise<MiddlewareResult> {
    throw new Error("Middleware exploded");
  }
}

// --- Tests ---

Deno.test("middleware-pipeline: empty chain continues", async () => {
  const chain = new MiddlewareChain();
  const result = await chain.executeRequest(makeRequest(), makeContext());
  assertEquals(result.type, "continue");
});

Deno.test("middleware-pipeline: single request middleware executes", async () => {
  const chain = new MiddlewareChain();
  const logger = new LoggingMiddleware();
  chain.addRequestMiddleware(logger);

  const result = await chain.executeRequest(makeRequest("GET", "/hello"), makeContext());

  assertEquals(result.type, "continue");
  assertEquals(logger.requestLog.length, 1);
  assertStringIncludes(logger.requestLog[0], "GET /hello");
});

Deno.test("middleware-pipeline: auth middleware short-circuits on missing token", async () => {
  const chain = new MiddlewareChain();
  const logger = new LoggingMiddleware();
  const auth = new AuthMiddleware(new Set(["valid-token"]));

  // Auth first, then logging
  chain.addRequestMiddleware(auth);
  chain.addRequestMiddleware(logger);

  const result = await chain.executeRequest(makeRequest(), makeContext());

  assertEquals(result.type, "respond");
  if (result.type === "respond") {
    assertEquals(result.response.statusCode, 401);
  }
  // Logger should NOT have been called since auth short-circuited
  assertEquals(logger.requestLog.length, 0);
});

Deno.test("middleware-pipeline: auth middleware allows valid token through", async () => {
  const chain = new MiddlewareChain();
  const auth = new AuthMiddleware(new Set(["valid-token"]));
  const logger = new LoggingMiddleware();

  chain.addRequestMiddleware(auth);
  chain.addRequestMiddleware(logger);

  const ctx = makeContext();
  const result = await chain.executeRequest(
    makeRequest("GET", "/protected", { authorization: "Bearer valid-token" }),
    ctx,
  );

  assertEquals(result.type, "continue");
  assertEquals(ctx.metadata["authenticated"], true);
  assertEquals(ctx.user?.username, "testuser");
  assertEquals(logger.requestLog.length, 1);
});

Deno.test("middleware-pipeline: auth rejects invalid token with 403", async () => {
  const chain = new MiddlewareChain();
  const auth = new AuthMiddleware(new Set(["valid-token"]));
  chain.addRequestMiddleware(auth);

  const result = await chain.executeRequest(
    makeRequest("GET", "/protected", { authorization: "Bearer bad-token" }),
    makeContext(),
  );

  assertEquals(result.type, "respond");
  if (result.type === "respond") {
    assertEquals(result.response.statusCode, 403);
  }
});

Deno.test("middleware-pipeline: middleware order matters - logging before auth", async () => {
  const chain = new MiddlewareChain();
  const logger = new LoggingMiddleware();
  const auth = new AuthMiddleware(new Set(["valid-token"]));

  // Logging first, then auth
  chain.addRequestMiddleware(logger);
  chain.addRequestMiddleware(auth);

  const result = await chain.executeRequest(makeRequest("GET", "/test"), makeContext());

  // Logger runs, then auth short-circuits
  assertEquals(logger.requestLog.length, 1);
  assertEquals(result.type, "respond");
  if (result.type === "respond") {
    assertEquals(result.response.statusCode, 401);
  }
});

Deno.test("middleware-pipeline: response middleware transforms headers", async () => {
  const chain = new MiddlewareChain();
  const logger = new LoggingMiddleware();
  const headerInjector = new HeaderInjectionMiddleware({
    "x-powered-by": "BrowserX",
    "strict-transport-security": "max-age=31536000",
  });

  chain.addResponseMiddleware(logger);
  chain.addResponseMiddleware(headerInjector);

  const response = await chain.executeResponse(
    makeRequest(),
    makeResponse(200),
    makeContext(),
  );

  assertEquals(response.headers["x-logged"], "true");
  assertEquals(response.headers["x-powered-by"], "BrowserX");
  assertEquals(response.headers["strict-transport-security"], "max-age=31536000");
  assertEquals(logger.responseLog.length, 1);
});

Deno.test("middleware-pipeline: error in middleware propagates as error result", async () => {
  const chain = new MiddlewareChain();
  const errorMw = new ErrorMiddleware();
  chain.addRequestMiddleware(errorMw);

  const result = await chain.executeRequest(makeRequest(), makeContext());

  assertEquals(result.type, "error");
  if (result.type === "error") {
    assertStringIncludes(result.error.message, "Middleware exploded");
  }
});

Deno.test("middleware-pipeline: rate limiter blocks after threshold", async () => {
  const chain = new MiddlewareChain();
  const rateLimiter = new RateLimitMiddleware(3);
  chain.addRequestMiddleware(rateLimiter);

  // First 3 requests should pass
  for (let i = 0; i < 3; i++) {
    const result = await chain.executeRequest(makeRequest(), makeContext());
    assertEquals(result.type, "continue");
  }

  // 4th request should be rate-limited
  const result = await chain.executeRequest(makeRequest(), makeContext());
  assertEquals(result.type, "respond");
  if (result.type === "respond") {
    assertEquals(result.response.statusCode, 429);
  }
});

Deno.test("middleware-pipeline: disabled middleware is skipped", async () => {
  const chain = new MiddlewareChain();
  const logger = new LoggingMiddleware();
  chain.addRequestMiddleware(logger, false); // disabled

  const result = await chain.executeRequest(makeRequest(), makeContext());

  assertEquals(result.type, "continue");
  assertEquals(logger.requestLog.length, 0);
});

Deno.test("middleware-pipeline: enable/disable middleware dynamically", async () => {
  const chain = new MiddlewareChain();
  const logger = new LoggingMiddleware();
  chain.addRequestMiddleware(logger, false);

  // Disabled - should not log
  await chain.executeRequest(makeRequest(), makeContext());
  assertEquals(logger.requestLog.length, 0);

  // Enable it
  chain.enableMiddleware("logging", true);
  await chain.executeRequest(makeRequest(), makeContext());
  assertEquals(logger.requestLog.length, 1);

  // Disable again
  chain.disableMiddleware("logging", true);
  await chain.executeRequest(makeRequest(), makeContext());
  assertEquals(logger.requestLog.length, 1); // still 1
});

Deno.test("middleware-pipeline: createErrorResponse maps error names to status codes", () => {
  const authError = new Error("authentication failed");
  authError.name = "AuthenticationError";
  const authResp = createErrorResponse(authError);
  assertEquals(authResp.statusCode, 401);

  const rateLimitError = new Error("too many requests");
  rateLimitError.name = "RateLimitError";
  const rlResp = createErrorResponse(rateLimitError);
  assertEquals(rlResp.statusCode, 429);

  const genericError = new Error("something went wrong");
  const genericResp = createErrorResponse(genericError);
  assertEquals(genericResp.statusCode, 500);
});

Deno.test("middleware-pipeline: MiddlewareInterceptor executes chain in order", async () => {
  const interceptor = new MiddlewareInterceptor<{ log: string[] }>();
  const executionOrder: string[] = [];

  interceptor.use(async (ctx, next) => {
    executionOrder.push("first-before");
    ctx.log.push("first");
    await next();
    executionOrder.push("first-after");
  });

  interceptor.use(async (ctx, next) => {
    executionOrder.push("second-before");
    ctx.log.push("second");
    await next();
    executionOrder.push("second-after");
  });

  interceptor.use(async (ctx, next) => {
    executionOrder.push("third-before");
    ctx.log.push("third");
    await next();
    executionOrder.push("third-after");
  });

  const context = { log: [] as string[] };
  await interceptor.execute(context);

  assertEquals(context.log, ["first", "second", "third"]);
  assertEquals(executionOrder, [
    "first-before", "second-before", "third-before",
    "third-after", "second-after", "first-after",
  ]);
});

Deno.test("middleware-pipeline: MiddlewareInterceptor short-circuits when next is not called", async () => {
  const interceptor = new MiddlewareInterceptor<{ result: string }>();

  interceptor.use(async (ctx, _next) => {
    ctx.result = "blocked";
    // Do not call next() - short-circuit
    return ctx;
  });

  interceptor.use(async (ctx, next) => {
    ctx.result = "should-not-reach";
    await next();
  });

  const context = { result: "" };
  await interceptor.execute(context);

  assertEquals(context.result, "blocked");
});

Deno.test("middleware-pipeline: full request+response pipeline with auth and logging", async () => {
  const chain = new MiddlewareChain();
  const logger = new LoggingMiddleware();
  const auth = new AuthMiddleware(new Set(["secret-token"]));
  const headerInjector = new HeaderInjectionMiddleware({ "x-server": "proxy-1" });

  chain.addRequestMiddleware(logger);
  chain.addRequestMiddleware(auth);
  chain.addResponseMiddleware(logger);
  chain.addResponseMiddleware(headerInjector);

  const ctx = makeContext();
  const request = makeRequest("POST", "/api/data", { authorization: "Bearer secret-token" });

  // Execute request phase
  const requestResult = await chain.executeRequest(request, ctx);
  assertEquals(requestResult.type, "continue");
  assertEquals(ctx.metadata["authenticated"], true);
  assertEquals(ctx.metadata["logged"], true);

  // Execute response phase
  const response = await chain.executeResponse(request, makeResponse(201), ctx);
  assertEquals(response.headers["x-logged"], "true");
  assertEquals(response.headers["x-server"], "proxy-1");
  assertEquals(logger.responseLog.length, 1);
});

Deno.test("middleware-pipeline: getStats reports middleware state", () => {
  const chain = new MiddlewareChain();
  const logger = new LoggingMiddleware();
  const auth = new AuthMiddleware(new Set());

  chain.addRequestMiddleware(logger, true);
  chain.addRequestMiddleware(auth, false);
  chain.addResponseMiddleware(logger, true);

  const stats = chain.getStats();
  assertEquals(stats.request.total, 2);
  assertEquals(stats.request.enabled, 1);
  assertEquals(stats.response.total, 1);
  assertEquals(stats.response.enabled, 1);
});
