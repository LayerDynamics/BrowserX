/**
 * Proxy Test Server Utilities
 * Mock backend servers for proxy testing
 */

import { createTestServer, type TestServer } from "../../../tests/helpers/shared-mocks.ts";

export interface BackendResponse {
  status: number;
  headers?: Record<string, string>;
  body: string;
  delay?: number; // ms
}

/**
 * Create mock backend server with configurable responses
 */
export async function createMockBackendServer(
  responses: Record<string, BackendResponse>
): Promise<TestServer> {
  return await createTestServer({
    handler: async (req) => {
      const url = new URL(req.url);
      const response = responses[url.pathname];

      if (!response) {
        return new Response("Not Found", { status: 404 });
      }

      if (response.delay) {
        await new Promise((resolve) => setTimeout(resolve, response.delay));
      }

      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    },
  });
}

/**
 * Create health check server
 */
export async function createHealthCheckServer(
  healthy: boolean = true
): Promise<TestServer> {
  return await createTestServer({
    handler: () => {
      return healthy
        ? new Response(JSON.stringify({ status: "healthy" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
        : new Response(JSON.stringify({ status: "unhealthy" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
    },
  });
}

/**
 * Create delayed response server (simulates slow backend)
 */
export async function createDelayedResponseServer(
  delayMs: number
): Promise<TestServer> {
  return await createTestServer({
    handler: async () => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return new Response("OK", { status: 200 });
    },
  });
}

/**
 * Create failing server (simulates intermittent errors)
 */
export async function createFailingServer(
  errorRate: number = 0.5 // 0.0 to 1.0
): Promise<TestServer> {
  return await createTestServer({
    handler: () => {
      const shouldFail = Math.random() < errorRate;
      return shouldFail
        ? new Response("Internal Server Error", { status: 500 })
        : new Response("OK", { status: 200 });
    },
  });
}

/**
 * Create echo server (returns request details)
 */
export async function createEchoServer(): Promise<TestServer> {
  return await createTestServer({
    handler: async (req) => {
      const body = req.body ? await req.text() : "";
      const echo = {
        method: req.method,
        url: req.url,
        headers: Object.fromEntries(req.headers.entries()),
        body,
      };

      return new Response(JSON.stringify(echo, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
}

/**
 * Create round-robin server pool (for load balancer testing)
 */
export async function createServerPool(
  count: number,
  responsePrefix: string = "server"
): Promise<TestServer[]> {
  const servers: TestServer[] = [];

  for (let i = 0; i < count; i++) {
    const server = await createTestServer({
      handler: () => new Response(`${responsePrefix}-${i}`, { status: 200 }),
    });
    servers.push(server);
  }

  return servers;
}

/**
 * Shutdown server pool
 */
export async function shutdownServerPool(servers: TestServer[]): Promise<void> {
  await Promise.all(servers.map((s) => s.shutdown()));
}

/**
 * Create WebSocket echo server
 */
export async function createWebSocketEchoServer(): Promise<TestServer> {
  return await createTestServer({
    handler: (req) => {
      if (req.headers.get("upgrade") !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }

      const { socket, response } = Deno.upgradeWebSocket(req);

      socket.onmessage = (event) => {
        socket.send(`echo: ${event.data}`);
      };

      return response;
    },
  });
}
