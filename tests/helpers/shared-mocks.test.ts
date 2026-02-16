/**
 * Shared Mocks Tests
 * Verify test helper utilities work correctly
 */

import { assertEquals, assert } from "@std/assert";
import {
  createTestServer,
  withTestServer,
  createMockHTTPRequest,
  createMockHTTPResponse,
  createMockRoute,
  createMockRouter,
  waitFor,
  createDeferred,
} from "./shared-mocks.ts";

Deno.test("createTestServer - creates server with OS-assigned port", async () => {
  const server = await createTestServer({
    handler: () => new Response("test", { status: 200 }),
  });

  assert(server.port > 0, "Port should be assigned by OS");
  assert(server.url.includes(`http://127.0.0.1:${server.port}`));

  const response = await fetch(`${server.url}/`);
  assertEquals(await response.text(), "test");

  await server.shutdown();
});

Deno.test("withTestServer - auto cleanup", async () => {
  let serverUrl: string | undefined;

  await withTestServer(
    { handler: () => new Response("OK") },
    async (server) => {
      serverUrl = server.url;
      const response = await fetch(server.url);
      assertEquals(response.status, 200);
    }
  );

  // Server should be shut down after callback
  let failed = false;
  try {
    await fetch(serverUrl!);
  } catch {
    failed = true;
  }
  assert(failed, "Server should be shut down");
});

Deno.test("createMockHTTPRequest - creates request with headers", () => {
  const req = createMockHTTPRequest("http://example.com/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  assertEquals(req.method, "POST");
  assertEquals(req.url, "http://example.com/test");
  assertEquals(req.headers.get("Content-Type"), "application/json");
});

Deno.test("createMockHTTPResponse - creates response", () => {
  const res = createMockHTTPResponse("test body", {
    status: 201,
    headers: { "X-Custom": "header" },
  });

  assertEquals(res.status, 201);
  assertEquals(res.headers.get("X-Custom"), "header");
});

Deno.test("createMockRoute - matches pattern", async () => {
  const route = createMockRoute("/api/test", () => new Response("matched"));

  const req1 = createMockHTTPRequest("http://example.com/api/test");
  const req2 = createMockHTTPRequest("http://example.com/other");

  const res1 = await route(req1);
  const res2 = await route(req2);

  assert(res1 !== null);
  assertEquals(await res1.text(), "matched");
  assertEquals(res2, null);
});

Deno.test("createMockRouter - combines routes", async () => {
  const route1 = createMockRoute("/api", () => new Response("api"));
  const route2 = createMockRoute("/health", () => new Response("ok"));
  const router = createMockRouter([route1, route2]);

  const req1 = createMockHTTPRequest("http://example.com/api");
  const req2 = createMockHTTPRequest("http://example.com/health");
  const req3 = createMockHTTPRequest("http://example.com/notfound");

  assertEquals(await (await router(req1)).text(), "api");
  assertEquals(await (await router(req2)).text(), "ok");
  assertEquals((await router(req3)).status, 404);
});

Deno.test("waitFor - waits for condition", async () => {
  let value = 0;
  setTimeout(() => { value = 1; }, 100);

  await waitFor(() => value === 1, { timeout: 500, interval: 50 });
  assertEquals(value, 1);
});

Deno.test("createDeferred - externally resolvable promise", async () => {
  const deferred = createDeferred<number>();

  setTimeout(() => deferred.resolve(42), 50);

  const result = await deferred.promise;
  assertEquals(result, 42);
});
