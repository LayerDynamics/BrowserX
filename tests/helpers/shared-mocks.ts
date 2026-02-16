/**
 * Shared Test Mocks
 * Reusable mock utilities for parallel-safe testing
 * Pattern based on dev-tools/tests/helpers/mocks.ts
 */

export interface TestServerOptions {
  port?: number; // Default: 0 (OS-assigned)
  hostname?: string; // Default: "127.0.0.1"
  handler?: (req: Request) => Response | Promise<Response>;
}

export interface TestServer {
  url: string;
  port: number;
  hostname: string;
  server: Deno.HttpServer;
  shutdown: () => Promise<void>;
}

/**
 * Create a test HTTP server with OS-assigned port (parallel-safe)
 */
export async function createTestServer(options: TestServerOptions = {}): Promise<TestServer> {
  const hostname = options.hostname || "127.0.0.1";
  const port = options.port || 0; // 0 = OS assigns available port
  const handler = options.handler || (() => new Response("OK", { status: 200 }));

  const server = Deno.serve({
    hostname,
    port,
    onListen: () => {}, // Suppress log output
  }, handler);

  // Get the actual port assigned by OS
  const addr = server.addr as Deno.NetAddr;
  const actualPort = addr.port;

  return {
    url: `http://${hostname}:${actualPort}`,
    port: actualPort,
    hostname,
    server,
    shutdown: async () => {
      await server.shutdown();
    },
  };
}

/**
 * RAII pattern for test server - automatically cleans up
 *
 * @example
 * await withTestServer({ handler: myHandler }, async (server) => {
 *   const response = await fetch(`${server.url}/test`);
 *   assertEquals(response.status, 200);
 * });
 */
export async function withTestServer<T>(
  options: TestServerOptions,
  fn: (server: TestServer) => Promise<T>
): Promise<T> {
  const server = await createTestServer(options);
  try {
    return await fn(server);
  } finally {
    await server.shutdown();
  }
}

/**
 * Create a mock HTTP request
 */
export function createMockHTTPRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Uint8Array;
  } = {}
): Request {
  const { method = "GET", headers = {}, body } = options;

  return new Request(url, {
    method,
    headers: new Headers(headers),
    body: body as BodyInit | null | undefined,
  });
}

/**
 * Create a mock HTTP response
 */
export function createMockHTTPResponse(
  body: string | Uint8Array,
  options: {
    status?: number;
    headers?: Record<string, string>;
  } = {}
): Response {
  const { status = 200, headers = {} } = options;

  return new Response(body as BodyInit, {
    status,
    headers: new Headers(headers),
  });
}

/**
 * Create a mock route handler
 */
export function createMockRoute(
  pattern: string | RegExp,
  handler: (req: Request) => Response | Promise<Response>
): (req: Request) => Response | Promise<Response> | null {
  return (req: Request) => {
    const url = new URL(req.url);
    const matches = typeof pattern === "string"
      ? url.pathname === pattern
      : pattern.test(url.pathname);

    return matches ? handler(req) : null;
  };
}

/**
 * Create a mock router that combines multiple routes
 */
export function createMockRouter(
  routes: Array<(req: Request) => Response | Promise<Response> | null>,
  fallback?: (req: Request) => Response | Promise<Response>
): (req: Request) => Response | Promise<Response> {
  return async (req: Request) => {
    for (const route of routes) {
      const response = await route(req);
      if (response !== null) {
        return response;
      }
    }

    return fallback
      ? await fallback(req)
      : new Response("Not Found", { status: 404 });
  };
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number; // milliseconds
    interval?: number; // milliseconds
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Sleep for a duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a deferred promise (externally resolvable)
 */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Capture console output
 */
export function captureConsole(): {
  logs: string[];
  errors: string[];
  restore: () => void;
} {
  const logs: string[] = [];
  const errors: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };

  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };

  return {
    logs,
    errors,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
    },
  };
}
