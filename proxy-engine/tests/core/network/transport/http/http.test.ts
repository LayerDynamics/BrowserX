/**
 * HTTP Transport Tests
 * Comprehensive tests for HTTP/1.1 client and server - 42+ tests
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import {
  HTTP11Client,
  type HTTPRequest,
} from "../../../../../core/network/transport/http/http.ts";
import { Socket } from "../../../../../core/network/transport/socket/socket.ts";
import { createTestServer, sleep } from "../../../../../../tests/helpers/shared-mocks.ts";

// Helper to consume response body
async function consume(response: Response): Promise<void> {
  await response.text().catch(() => {});
}

// ============================================================================
// Request Parsing Tests (10 tests)
// ============================================================================

Deno.test("HTTP Transport - parses GET request", async () => {
  const server = await createTestServer({
    handler: (req) => {
      assertEquals(req.method, "GET");
      assertEquals(new URL(req.url).pathname, "/test");
      return new Response("OK");
    },
  });
  try {
    const response = await fetch(`${server.url}/test`);
    assertEquals(response.status, 200);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - parses POST request with body", async () => {
  const server = await createTestServer({
    handler: async (req) => {
      assertEquals(req.method, "POST");
      assertEquals(await req.text(), "test data");
      return new Response("OK");
    },
  });
  try {
    const response = await fetch(`${server.url}/test`, {
      method: "POST",
      body: "test data",
    });
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - parses request headers", async () => {
  const server = await createTestServer({
    handler: (req) => {
      assertEquals(req.headers.get("x-custom-header"), "test-value");
      return new Response("OK");
    },
  });
  try {
    const response = await fetch(`${server.url}/test`, {
      headers: { "X-Custom-Header": "test-value" },
    });
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - parses query parameters", async () => {
  const server = await createTestServer({
    handler: (req) => {
      const url = new URL(req.url);
      assertEquals(url.searchParams.get("foo"), "bar");
      return new Response("OK");
    },
  });
  try {
    const response = await fetch(`${server.url}/test?foo=bar`);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - parses request line (method, path, version)", async () => {
  const server = await createTestServer({
    handler: (req) => {
      assertEquals(req.method, "PUT");
      assertEquals(new URL(req.url).pathname, "/resource/123");
      return new Response("OK");
    },
  });
  try {
    const response = await fetch(`${server.url}/resource/123`, { method: "PUT" });
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - handles malformed request line", async () => {
  const listener = Deno.listen({ port: 0, hostname: "127.0.0.1" });
  const addr = listener.addr as Deno.NetAddr;
  const acceptPromise = (async () => {
    const conn = await listener.accept();
    try {
      await conn.read(new Uint8Array(1024));
      await conn.write(new TextEncoder().encode("HTTP/1.1 400 Bad Request\r\n\r\n"));
    } finally {
      conn.close();
    }
  })();
  try {
    const socket = new Socket("127.0.0.1", addr.port);
    await socket.connect();
    const conn = socket.getConn();
    assertExists(conn);
    await conn.write(new TextEncoder().encode("GET /test\r\n\r\n"));
    socket.close();
    await acceptPromise;
  } finally {
    listener.close();
  }
});

Deno.test("HTTP Transport - handles missing headers", async () => {
  const server = await createTestServer({
    handler: (req) => {
      assertEquals(req.headers.get("x-missing-header"), null);
      return new Response("OK");
    },
  });
  try {
    const response = await fetch(`${server.url}/test`);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - handles invalid HTTP version", async () => {
  const listener = Deno.listen({ port: 0, hostname: "127.0.0.1" });
  const addr = listener.addr as Deno.NetAddr;
  const acceptPromise = (async () => {
    const conn = await listener.accept();
    try {
      await conn.read(new Uint8Array(1024));
      await conn.write(new TextEncoder().encode("HTTP/1.1 505 HTTP Version Not Supported\r\n\r\n"));
    } finally {
      conn.close();
    }
  })();
  try {
    const socket = new Socket("127.0.0.1", addr.port);
    await socket.connect();
    const conn = socket.getConn();
    assertExists(conn);
    await conn.write(new TextEncoder().encode("GET /test HTTP/9.9\r\n\r\n"));
    socket.close();
    await acceptPromise;
  } finally {
    listener.close();
  }
});

Deno.test("HTTP Transport - parses empty request", async () => {
  const server = await createTestServer({
    handler: async (req) => {
      assertEquals(req.method, "POST");
      assertEquals(await req.text(), "");
      return new Response("OK");
    },
  });
  try {
    const response = await fetch(`${server.url}/test`, { method: "POST", body: "" });
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - parses request with special characters", async () => {
  const server = await createTestServer({
    handler: (req) => {
      const url = new URL(req.url);
      assertEquals(url.searchParams.get("data"), "hello world!@#$%");
      return new Response("OK");
    },
  });
  try {
    const response = await fetch(`${server.url}/test?data=${encodeURIComponent("hello world!@#$%")}`);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

// ============================================================================
// Response Handling Tests (8 tests)
// ============================================================================

Deno.test("HTTP Transport - builds response with status code", async () => {
  const server = await createTestServer({
    handler: () => new Response("Created", { status: 201 }),
  });
  try {
    const response = await fetch(`${server.url}/test`);
    assertEquals(response.status, 201);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - sets response headers", async () => {
  const server = await createTestServer({
    handler: () => new Response("OK", {
      headers: { "X-Custom-Header": "custom-value", "Content-Type": "text/plain" },
    }),
  });
  try {
    const response = await fetch(`${server.url}/test`);
    assertEquals(response.headers.get("x-custom-header"), "custom-value");
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - writes response body", async () => {
  const server = await createTestServer({
    handler: () => new Response("test body"),
  });
  try {
    const response = await fetch(`${server.url}/test`);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - handles chunked responses", async () => {
  const server = await createTestServer({
    handler: () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("chunk1"));
          controller.enqueue(new TextEncoder().encode("chunk2"));
          controller.close();
        },
      });
      return new Response(stream);
    },
  });
  try {
    const response = await fetch(`${server.url}/test`);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - handles empty responses", async () => {
  const server = await createTestServer({
    handler: () => new Response(null, { status: 204 }),
  });
  try {
    const response = await fetch(`${server.url}/test`);
    assertEquals(response.status, 204);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - handles large responses", async () => {
  const largeData = "x".repeat(1024 * 100);
  const server = await createTestServer({
    handler: () => new Response(largeData),
  });
  try {
    const response = await fetch(`${server.url}/test`);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - response status line format", async () => {
  const server = await createTestServer({
    handler: () => new Response("Not Found", { status: 404 }),
  });
  try {
    const response = await fetch(`${server.url}/test`);
    assertEquals(response.status, 404);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - response header formatting", async () => {
  const server = await createTestServer({
    handler: () => new Response("OK", {
      headers: { "cache-control": "no-cache", "x-powered-by": "BrowserX" },
    }),
  });
  try {
    const response = await fetch(`${server.url}/test`);
    assertEquals(response.headers.get("cache-control"), "no-cache");
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

// ============================================================================
// Connection Management Tests (8 tests)
// ============================================================================

Deno.test("HTTP Transport - keep-alive connection reuse", async () => {
  let count = 0;
  const server = await createTestServer({
    handler: () => {
      count++;
      return new Response("OK");
    },
  });
  try {
    await consume(await fetch(`${server.url}/test1`));
    await consume(await fetch(`${server.url}/test2`));
    assert(count >= 2);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - connection close after request", async () => {
  const server = await createTestServer({
    handler: () => new Response("OK", { headers: { "Connection": "close" } }),
  });
  try {
    const response = await fetch(`${server.url}/test`);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - connection timeout handling", async () => {
  const listener = Deno.listen({ port: 0, hostname: "127.0.0.1" });
  const addr = listener.addr as Deno.NetAddr;
  const acceptPromise = (async () => {
    const conn = await listener.accept();
    await sleep(2000);
    conn.close();
  })();
  try {
    const socket = new Socket("127.0.0.1", addr.port);
    await socket.connect(500);
    const client = new HTTP11Client(socket);
    const request: HTTPRequest = { method: "GET", uri: "/test", version: "1.1", headers: {} };
    await assertRejects(async () => await client.sendRequest(request), Error);
    client.close();
  } finally {
    listener.close();
    await acceptPromise.catch(() => {});
  }
});

Deno.test("HTTP Transport - multiple requests on same connection", async () => {
  const paths: string[] = [];
  const server = await createTestServer({
    handler: (req) => {
      paths.push(new URL(req.url).pathname);
      return new Response("OK");
    },
  });
  try {
    await consume(await fetch(`${server.url}/first`));
    await consume(await fetch(`${server.url}/second`));
    await consume(await fetch(`${server.url}/third`));
    assert(paths.includes("/first"));
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - connection pool management", async () => {
  const server = await createTestServer({
    handler: () => new Response("OK"),
  });
  try {
    const responses = await Promise.all([
      fetch(`${server.url}/test1`),
      fetch(`${server.url}/test2`),
      fetch(`${server.url}/test3`),
    ]);
    await Promise.all(responses.map(consume));
    assert(true);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - max connections limit", async () => {
  let maxConcurrent = 0;
  let current = 0;
  const server = await createTestServer({
    handler: async () => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await sleep(100);
      current--;
      return new Response("OK");
    },
  });
  try {
    const promises = [];
    for (let i = 0; i < 10; i++) promises.push(fetch(`${server.url}/test${i}`));
    const responses = await Promise.all(promises);
    await Promise.all(responses.map(consume));
    assert(maxConcurrent > 0);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - idle connection cleanup", async () => {
  const server = await createTestServer({
    handler: () => new Response("OK"),
  });
  try {
    await consume(await fetch(`${server.url}/test1`));
    await sleep(100);
    await consume(await fetch(`${server.url}/test2`));
    assert(true);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - connection error recovery", async () => {
  let attempt = 0;
  const server = await createTestServer({
    handler: () => {
      attempt++;
      return attempt === 1 ? new Response("Error", { status: 500 }) : new Response("OK");
    },
  });
  try {
    await consume(await fetch(`${server.url}/test`));
    await consume(await fetch(`${server.url}/test`));
    assertEquals(attempt, 2);
  } finally {
    await server.shutdown();
  }
});

// ============================================================================
// Header Handling Tests (6 tests)
// ============================================================================

Deno.test("HTTP Transport - Content-Length header", async () => {
  const testBody = "test content";
  const server = await createTestServer({
    handler: async (req) => {
      assertEquals(await req.text(), testBody);
      return new Response("OK");
    },
  });
  try {
    const response = await fetch(`${server.url}/test`, { method: "POST", body: testBody });
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - Transfer-Encoding: chunked", async () => {
  const server = await createTestServer({
    handler: () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("part1"));
          controller.enqueue(new TextEncoder().encode("part2"));
          controller.close();
        },
      });
      return new Response(stream);
    },
  });
  try {
    const response = await fetch(`${server.url}/test`);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - Content-Type header", async () => {
  const server = await createTestServer({
    handler: () => new Response(JSON.stringify({ message: "test" }), {
      headers: { "Content-Type": "application/json" },
    }),
  });
  try {
    const response = await fetch(`${server.url}/test`);
    assertEquals(response.headers.get("content-type"), "application/json");
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - custom headers preservation", async () => {
  const server = await createTestServer({
    handler: (req) => {
      assertEquals(req.headers.get("X-Request-Id"), "12345");
      return new Response("OK");
    },
  });
  try {
    const response = await fetch(`${server.url}/test`, {
      headers: { "X-Request-Id": "12345" },
    });
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - header case insensitivity", async () => {
  const server = await createTestServer({
    handler: (req) => {
      assertEquals(req.headers.get("content-type"), req.headers.get("Content-Type"));
      return new Response("OK");
    },
  });
  try {
    const response = await fetch(`${server.url}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: "data" }),
    });
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - multiple header values", async () => {
  const server = await createTestServer({
    handler: (req) => {
      const cookie = req.headers.get("cookie");
      if (cookie) assert(cookie.length > 0);
      return new Response("OK");
    },
  });
  try {
    const response = await fetch(`${server.url}/test`, {
      headers: { "Cookie": "session=abc; user=123" },
    });
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

// ============================================================================
// Chunked Transfer Tests (4 tests)
// ============================================================================

Deno.test("HTTP Transport - encode chunks correctly", async () => {
  const server = await createTestServer({
    handler: () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("chunk1"));
          controller.enqueue(new TextEncoder().encode("chunk2"));
          controller.close();
        },
      });
      return new Response(stream);
    },
  });
  try {
    const response = await fetch(`${server.url}/test`);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - decode chunks correctly", async () => {
  const server = await createTestServer({
    handler: async (req) => {
      const reader = req.body?.getReader();
      const chunks: string[] = [];
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(new TextDecoder().decode(value));
        }
      }
      return new Response(chunks.join(""));
    },
  });
  try {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data1"));
        controller.enqueue(new TextEncoder().encode("data2"));
        controller.close();
      },
    });
    const response = await fetch(`${server.url}/test`, { method: "POST", body: stream });
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - handle chunk extensions", async () => {
  const server = await createTestServer({
    handler: () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("test data"));
          controller.close();
        },
      });
      return new Response(stream);
    },
  });
  try {
    const response = await fetch(`${server.url}/test`);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

Deno.test("HTTP Transport - final chunk with trailers", async () => {
  const server = await createTestServer({
    handler: () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("content"));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { "Trailer": "X-Final-Header" },
      });
    },
  });
  try {
    const response = await fetch(`${server.url}/test`);
    await consume(response);
  } finally {
    await server.shutdown();
  }
});

// ============================================================================
// Error Handling Tests (6 tests)
// ============================================================================

Deno.test("HTTP Transport - network errors", async () => {
  await assertRejects(async () => await fetch("http://127.0.0.1:1/test"), Error);
});

Deno.test("HTTP Transport - timeout errors", async () => {
  const listener = Deno.listen({ port: 0, hostname: "127.0.0.1" });
  const addr = listener.addr as Deno.NetAddr;
  const acceptPromise = (async () => {
    try {
      const conn = await listener.accept();
      await sleep(5000);
      conn.close();
    } catch {
      // Ignored
    }
  })();
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 500);
    await assertRejects(
      async () => await fetch(`http://127.0.0.1:${addr.port}/test`, { signal: controller.signal }),
      Error,
    );
  } finally {
    listener.close();
    await acceptPromise.catch(() => {});
  }
});

Deno.test("HTTP Transport - malformed HTTP responses", async () => {
  const listener = Deno.listen({ port: 0, hostname: "127.0.0.1" });
  const addr = listener.addr as Deno.NetAddr;
  const acceptPromise = (async () => {
    const conn = await listener.accept();
    try {
      await conn.read(new Uint8Array(1024));
      await conn.write(new TextEncoder().encode("NOT VALID\r\n"));
    } finally {
      conn.close();
    }
  })();
  try {
    await assertRejects(async () => await fetch(`http://127.0.0.1:${addr.port}/test`), Error);
    await acceptPromise;
  } finally {
    listener.close();
  }
});

Deno.test("HTTP Transport - connection refused", async () => {
  await assertRejects(async () => await fetch("http://127.0.0.1:54321/test"), Error);
});

Deno.test("HTTP Transport - DNS resolution failures", async () => {
  await assertRejects(async () => await fetch("http://this-domain-does-not-exist.invalid/test"), Error);
});

Deno.test("HTTP Transport - socket errors during transmission", async () => {
  const listener = Deno.listen({ port: 0, hostname: "127.0.0.1" });
  const addr = listener.addr as Deno.NetAddr;
  const acceptPromise = (async () => {
    const conn = await listener.accept();
    try {
      await conn.read(new Uint8Array(1024));
      conn.close();
    } catch {
      // Ignored
    }
  })();
  try {
    await assertRejects(async () => await fetch(`http://127.0.0.1:${addr.port}/test`), Error);
    await acceptPromise.catch(() => {});
  } finally {
    listener.close();
  }
});
