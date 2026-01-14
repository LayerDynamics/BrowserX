// event_driven_proxy.ts - Event loop based proxy

export interface EventDrivenProxyConfig {
  listenPort: number;
  targetHost: string;
  targetPort: number;
  maxConnections: number;
}

export class EventDrivenProxy {
  private config: EventDrivenProxyConfig;
  private activeConnections: number = 0;
  private stats: {
    totalConnections: number;
    activeConnections: number;
    bytesProxied: number;
    requestsServed: number;
  };

  constructor(config: EventDrivenProxyConfig) {
    this.config = config;
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      bytesProxied: 0,
      requestsServed: 0,
    };
  }

  async start(): Promise<void> {
    const listener = Deno.listen({ port: this.config.listenPort });
    console.log(`[PROXY] Listening on port ${this.config.listenPort}`);
    console.log(`[PROXY] Forwarding to ${this.config.targetHost}:${this.config.targetPort}`);
    console.log(`[PROXY] Max connections: ${this.config.maxConnections}\n`);

    // Event loop: accept connections and handle them asynchronously
    for await (const clientConn of listener) {
      // Check connection limit
      if (this.activeConnections >= this.config.maxConnections) {
        console.log(`[PROXY] ❌ Connection limit reached, rejecting connection`);
        clientConn.close();
        continue;
      }

      // Handle connection asynchronously (non-blocking)
      this.handleConnection(clientConn).catch((err) => {
        console.error(`[PROXY] Error handling connection:`, err.message);
      });
    }
  }

  private async handleConnection(clientConn: Deno.Conn): Promise<void> {
    this.activeConnections++;
    this.stats.totalConnections++;
    this.stats.activeConnections = this.activeConnections;

    const connId = `conn-${this.stats.totalConnections}`;
    console.log(`[${connId}] New connection established (active: ${this.activeConnections})`);

    try {
      // Connect to origin server (non-blocking)
      const originConn = await Deno.connect({
        hostname: this.config.targetHost,
        port: this.config.targetPort,
      });

      console.log(
        `[${connId}] Connected to origin ${this.config.targetHost}:${this.config.targetPort}`,
      );

      // Bidirectional proxy: pipe data in both directions concurrently
      await Promise.all([
        this.pipe(clientConn, originConn, `${connId} C→O`),
        this.pipe(originConn, clientConn, `${connId} O→C`),
      ]);

      this.stats.requestsServed++;
    } catch (error) {
      console.error(`[${connId}] Error:`, (error as Error).message);
    } finally {
      // Cleanup
      try {
        clientConn.close();
      } catch (_) { /* ignore */ }

      this.activeConnections--;
      console.log(`[${connId}] Connection closed (active: ${this.activeConnections})`);
    }
  }

  /**
   * Pipe data from source to destination (non-blocking)
   */
  private async pipe(source: Deno.Conn, dest: Deno.Conn, label: string): Promise<void> {
    const buffer = new Uint8Array(8192); // 8KB buffer

    try {
      while (true) {
        // Non-blocking read (waits for data in event loop)
        const bytesRead = await source.read(buffer);

        if (bytesRead === null) {
          // EOF reached
          console.log(`[${label}] EOF reached`);
          break;
        }

        // Non-blocking write (waits for write ready in event loop)
        await dest.write(buffer.subarray(0, bytesRead));

        this.stats.bytesProxied += bytesRead;
      }
    } catch (error) {
      console.error(`[${label}] Pipe error:`, (error as Error).message);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): EventDrivenProxyConfig {
    return this.config;
  }

  /**
   * Get active connections count
   */
  getActiveConnections(): number {
    return this.activeConnections;
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    return {
      totalConnections: this.stats.totalConnections,
      activeConnections: this.stats.activeConnections,
      bytesProxied: this.stats.bytesProxied,
      requestsServed: this.stats.requestsServed,
    };
  }

  displayStats(): void {
    console.log(`\n${"=".repeat(70)}`);
    console.log("Proxy Statistics");
    console.log("=".repeat(70));
    console.log(`Total connections: ${this.stats.totalConnections}`);
    console.log(`Active connections: ${this.stats.activeConnections}`);
    console.log(`Requests served: ${this.stats.requestsServed}`);
    console.log(`Bytes proxied: ${(this.stats.bytesProxied / 1024 / 1024).toFixed(2)} MB`);
    console.log("=".repeat(70) + "\n");
  }
}

// Example usage
const proxy = new EventDrivenProxy({
  listenPort: 8080,
  targetHost: "example.com",
  targetPort: 80,
  maxConnections: 1000,
});

console.log("=== Event-Driven Proxy Demo ===\n");
console.log("This proxy uses non-blocking I/O and the event loop to handle");
console.log("multiple connections concurrently with a single thread.\n");

// Start proxy (non-blocking event loop)
// await proxy.start();

// In production, you'd start the proxy and periodically display stats
console.log("Proxy would start and handle connections via event loop.");
console.log("\nKey characteristics:");
console.log("✓ Non-blocking I/O (await on socket operations)");
console.log("✓ Single-threaded event loop");
console.log("✓ Handles thousands of connections concurrently");
console.log("✓ Low memory footprint (no thread per connection)");
console.log("✓ Efficient CPU utilization for I/O-bound workload");
