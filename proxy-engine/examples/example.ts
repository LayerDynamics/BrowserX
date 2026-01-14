/**
 * Example Usage
 *
 * Demonstrates how to use the proxy engine programmatically
 */

import {
  CombinedLoggingMiddleware,
  CompressionMiddleware,
  ConfigBuilder,
  CORSMiddleware,
  RateLimitMiddleware,
  Runtime,
} from "./mod.ts";

/**
 * Create a simple backend server for testing
 */
async function createBackendServer(port: number): Promise<void> {
  const listener = Deno.listen({ hostname: "localhost", port });
  console.log(`Backend server listening on http://localhost:${port}`);

  for await (const conn of listener) {
    handleBackendConnection(conn, port);
  }
}

/**
 * Handle backend connection
 */
async function handleBackendConnection(conn: Deno.Conn, port: number): Promise<void> {
  try {
    const httpConn = Deno.serveHttp(conn);

    for await (const requestEvent of httpConn) {
      const { request, respondWith } = requestEvent;

      // Simple response
      const body = JSON.stringify({
        message: "Hello from backend server",
        port,
        path: new URL(request.url).pathname,
        method: request.method,
        timestamp: new Date().toISOString(),
      });

      await respondWith(
        new Response(body, {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      );
    }
  } catch (error) {
    console.error("Backend connection error:", error);
  }
}

/**
 * Main example
 */
async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("BrowserX Proxy Engine - Example");
  console.log("=".repeat(60));
  console.log();

  // Start backend servers
  console.log("Starting backend servers...");
  createBackendServer(3000); // Don't await - run in background
  createBackendServer(3001); // Don't await - run in background

  // Wait a bit for backend servers to start
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Build proxy configuration
  console.log("Building proxy configuration...");
  const config = new ConfigBuilder()
    .setEnvironment("development")
    .setLogLevel("info")
    .setGracefulShutdown(true, 30000)
    .setSignalHandling(true)
    .addGateway({
      host: "0.0.0.0",
      port: 8080,
      routes: [
        // API route with load balancing
        {
          id: "api-route",
          pathPattern: "/api/*",
          methods: ["GET", "POST", "PUT", "DELETE"],
          priority: 10,
          upstream: {
            servers: [
              {
                id: "api-server-1",
                host: "localhost",
                port: 3000,
                protocol: "http",
                weight: 1,
              },
              {
                id: "api-server-2",
                host: "localhost",
                port: 3001,
                protocol: "http",
                weight: 1,
              },
            ],
            loadBalancing: "round_robin",
            healthCheck: {
              type: "http",
              path: "/health",
              interval: 30000,
              timeout: 5000,
              unhealthyThreshold: 3,
              healthyThreshold: 2,
            },
            sessionAffinity: {
              type: "cookie",
              cookieName: "session_id",
              ttl: 3600000,
            },
          },
          timeout: 30000,
          retries: 3,
        },
        // Default route
        {
          id: "default-route",
          pathPattern: "/*",
          priority: 100,
          upstream: {
            servers: [
              {
                id: "default-server",
                host: "localhost",
                port: 3000,
                protocol: "http",
              },
            ],
          },
        },
      ],
      // Configure middleware
      middleware: {
        request: [
          {
            middleware: new RateLimitMiddleware({
              algorithm: "token_bucket",
              maxRequests: 100,
              windowMs: 60000,
              headers: {
                limit: true,
                remaining: true,
                reset: true,
              },
            }),
            config: {
              enabled: true,
              priority: 10,
            },
          },
          {
            middleware: new CombinedLoggingMiddleware({
              level: "info",
              format: "json",
              logRequestHeaders: false,
              logResponseHeaders: false,
            }),
            config: {
              enabled: true,
              priority: 100,
            },
          },
        ],
        response: [
          {
            middleware: new CORSMiddleware({
              origin: "*",
              methods: ["GET", "POST", "PUT", "DELETE"],
              credentials: false,
            }),
            config: {
              enabled: true,
              priority: 10,
            },
          },
          {
            middleware: new CompressionMiddleware({
              encodings: ["gzip", "deflate"],
              threshold: 1024,
              level: 6,
            }),
            config: {
              enabled: true,
              priority: 20,
            },
          },
          {
            middleware: new CombinedLoggingMiddleware({
              level: "info",
              format: "json",
            }),
            config: {
              enabled: true,
              priority: 100,
            },
          },
        ],
      },
    })
    .build();

  console.log("Configuration built successfully");
  console.log();

  // Create runtime
  console.log("Creating runtime...");
  const runtime = new Runtime(config);

  // Add event listeners
  runtime.addEventListener((event) => {
    switch (event.type) {
      case "starting":
        console.log("→ Runtime starting...");
        break;
      case "started":
        console.log("✓ Runtime started successfully");
        printStats(runtime);
        printUsageInstructions();
        break;
      case "stopping":
        console.log(`→ Runtime stopping: ${event.reason}`);
        break;
      case "stopped":
        console.log("✓ Runtime stopped");
        break;
      case "error":
        console.error("✗ Runtime error:", event.error);
        break;
      case "gateway_started":
        console.log(`  ✓ Gateway started: ${event.host}:${event.port}`);
        break;
      case "gateway_stopped":
        console.log(`  ✓ Gateway stopped: ${event.host}:${event.port}`);
        break;
    }
  });

  // Start runtime
  console.log();
  await runtime.start();

  // Print stats every 30 seconds
  setInterval(() => {
    console.log();
    console.log("=".repeat(60));
    console.log("Runtime Statistics");
    console.log("=".repeat(60));
    printStats(runtime);
  }, 30000);
}

/**
 * Print runtime statistics
 */
function printStats(runtime: Runtime): void {
  const stats = runtime.getStats();

  console.log();
  console.log("State:", stats.state);
  console.log("Uptime:", formatDuration(stats.uptime));
  console.log("Active Gateways:", stats.activeGateways);
  console.log();

  console.log("Gateways:");
  for (const gateway of stats.gateways) {
    console.log(`  ${gateway.host}:${gateway.port}`);
    console.log(`    Requests: ${gateway.stats.totalRequests}`);
    console.log(`    Errors: ${gateway.stats.totalErrors}`);
    console.log(`    Active Connections: ${gateway.stats.activeConnections}`);
    console.log(`    Bytes Received: ${formatBytes(gateway.stats.bytesReceived)}`);
    console.log(`    Bytes Sent: ${formatBytes(gateway.stats.bytesSent)}`);
    console.log(`    Avg Duration: ${gateway.stats.avgRequestDuration.toFixed(2)}ms`);
    console.log(`    Req/sec: ${gateway.stats.requestsPerSecond.toFixed(2)}`);
  }

  console.log();
  console.log("Memory:");
  console.log(`  Heap Used: ${formatBytes(stats.memory.heapUsed)}`);
  console.log(`  Heap Total: ${formatBytes(stats.memory.heapTotal)}`);
  console.log(`  RSS: ${formatBytes(stats.memory.rss)}`);
  console.log();
}

/**
 * Print usage instructions
 */
function printUsageInstructions(): void {
  console.log();
  console.log("=".repeat(60));
  console.log("Proxy is ready! Try these commands:");
  console.log("=".repeat(60));
  console.log();
  console.log("# Make a request to the API endpoint (load balanced)");
  console.log("curl http://localhost:8080/api/test");
  console.log();
  console.log("# Make multiple requests to see load balancing");
  console.log("for i in {1..5}; do curl http://localhost:8080/api/test; done");
  console.log();
  console.log("# Make a request to default route");
  console.log("curl http://localhost:8080/");
  console.log();
  console.log("# Check rate limiting (after 100 requests in 1 minute)");
  console.log("for i in {1..105}; do curl -i http://localhost:8080/api/test; done");
  console.log();
  console.log("# Stop the proxy with Ctrl+C (graceful shutdown)");
  console.log();
  console.log("=".repeat(60));
  console.log();
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format duration to human-readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// Run example
if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    Deno.exit(1);
  });
}
