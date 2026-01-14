# BrowserX Proxy Engine

A high-performance, multi-layered HTTP/HTTPS proxy engine built with TypeScript and Deno.

## Features

- **Load Balancing**: Multiple strategies (round-robin, least-connections, weighted, IP-hash, least-response-time, random)
- **Health Checking**: TCP, HTTP, and ping-based health monitoring
- **Session Affinity**: Cookie-based and IP-based sticky sessions
- **Automatic Failover**: Intelligent failure detection and recovery
- **Middleware System**: Extensible request/response processing pipeline
- **Connection Pooling**: Efficient connection reuse with configurable limits
- **Graceful Shutdown**: Safe termination with connection draining
- **Protocol Support**: HTTP/1.1, HTTPS (HTTP/2 planned)

## Architecture

The proxy engine follows a layered architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Runtime Layer                              │
│  (Coordinates all layers, manages lifecycle, handles signals)   │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Gateway Layer                              │
│  (Request routing, response routing, middleware execution)      │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Proxy Type Layer                              │
│  (Reverse proxy, load balancer proxy)                          │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Connection Pool Layer                         │
│  (Connection reuse, lifecycle management, health checking)      │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Transport Protocol Layer                      │
│  (HTTP/1.1, HTTPS, WebSocket, TLS)                             │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Network Primitives Layer                      │
│  (Socket, buffer, header parsing)                              │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Using CLI

```bash
# Start with default configuration (port 8080)
deno run --allow-all core/runtime/cli.ts

# Start with custom configuration file
deno run --allow-all core/runtime/cli.ts --config config.json

# Start on custom port with debug logging
deno run --allow-all core/runtime/cli.ts --port 3000 --log-level debug

# Enable metrics server
deno run --allow-all core/runtime/cli.ts --metrics-port 9090
```

### Programmatic Usage

```typescript
import { ConfigBuilder, Runtime } from "./mod.ts";

// Build configuration
const config = new ConfigBuilder()
  .setEnvironment("production")
  .setLogLevel("info")
  .setGracefulShutdown(true, 30000)
  .addGateway({
    host: "0.0.0.0",
    port: 8080,
    routes: [
      {
        id: "api-route",
        pathPattern: "/api/*",
        upstream: {
          servers: [
            { id: "server-1", host: "localhost", port: 3000, protocol: "http" },
            { id: "server-2", host: "localhost", port: 3001, protocol: "http" },
          ],
          loadBalancing: "round_robin",
          healthCheck: {
            type: "http",
            path: "/health",
            interval: 30000,
            timeout: 5000,
          },
        },
      },
    ],
  })
  .build();

// Create and start runtime
const runtime = new Runtime(config);
await runtime.start();
```

## Configuration

### Configuration File Format

See `config.example.json` for a complete example.

```json
{
  "environment": "production",
  "logLevel": "info",
  "gracefulShutdown": true,
  "gracefulShutdownTimeout": 30000,
  "gateways": [
    {
      "host": "0.0.0.0",
      "port": 8080,
      "routes": [
        {
          "id": "api-route",
          "pathPattern": "/api/*",
          "methods": ["GET", "POST", "PUT", "DELETE"],
          "upstream": {
            "servers": [
              {
                "id": "api-server-1",
                "host": "localhost",
                "port": 3000,
                "protocol": "http",
                "weight": 1
              }
            ],
            "loadBalancing": "round_robin",
            "healthCheck": {
              "type": "http",
              "path": "/health",
              "interval": 30000,
              "timeout": 5000
            }
          }
        }
      ]
    }
  ]
}
```

### Load Balancing Strategies

- **round_robin**: Distribute requests evenly across servers
- **least_connections**: Route to server with fewest active connections
- **weighted_round_robin**: Weighted distribution based on server capacity
- **ip_hash**: Consistent routing based on client IP (sticky sessions)
- **least_response_time**: Route to server with lowest average response time
- **random**: Random server selection

### Health Check Types

- **tcp**: Simple TCP connection test
- **http**: HTTP GET request to health endpoint
- **ping**: WebSocket/HTTP2 ping frames (planned)

## Middleware

### Available Middleware

1. **Authentication**: Bearer, Basic, OAuth support
2. **Rate Limiting**: Token bucket, sliding window, fixed window algorithms
3. **Logging**: Request/response logging with Common/Combined Log Format
4. **CORS**: Cross-Origin Resource Sharing support
5. **Compression**: gzip, deflate compression
6. **Headers**: Request/response header transformation

### Custom Middleware

```typescript
import type { MiddlewareResult, RequestContext, RequestMiddleware } from "./mod.ts";
import type { HTTPRequest } from "./mod.ts";

class CustomMiddleware implements RequestMiddleware {
  readonly name = "custom";

  async processRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<MiddlewareResult> {
    // Process request
    console.log(`Processing request: ${request.method} ${request.uri}`);

    // Continue to next middleware
    return { type: "continue" };
  }
}
```

## Session Affinity

### Cookie-Based

```json
{
  "sessionAffinity": {
    "type": "cookie",
    "cookieName": "session_id",
    "ttl": 3600000
  }
}
```

### IP-Based

```json
{
  "sessionAffinity": {
    "type": "ip_hash"
  }
}
```

## Automatic Failover

```json
{
  "failover": {
    "enabled": true,
    "maxFailures": 5,
    "failureWindow": 60000,
    "cooldownPeriod": 30000
  }
}
```

## TLS/HTTPS

```json
{
  "host": "0.0.0.0",
  "port": 8443,
  "tls": {
    "certFile": "./certs/server.crt",
    "keyFile": "./certs/server.key",
    "alpnProtocols": ["h2", "http/1.1"]
  }
}
```

## Monitoring

### Runtime Statistics

```typescript
const stats = runtime.getStats();
console.log(stats);
// {
//   state: "running",
//   uptime: 12345,
//   activeGateways: 1,
//   gateways: [...],
//   memory: { heapUsed: 123456, ... }
// }
```

### Gateway Statistics

```typescript
const gatewayStats = gateway.getStats();
console.log(gatewayStats);
// {
//   totalRequests: 1000,
//   totalErrors: 5,
//   activeConnections: 10,
//   bytesReceived: 123456,
//   bytesSent: 654321,
//   avgRequestDuration: 25.5,
//   requestsPerSecond: 50.0,
//   uptime: 60000
// }
```

## Development

### Project Structure

```
proxy-engine/
├── core/
│   ├── runtime/          # Runtime coordinator
│   ├── network/          # Network layers
│   │   ├── primitive/    # Buffers, streams, headers
│   │   └── transport/    # HTTP, HTTPS, sockets
│   ├── connection/       # Connection pooling, health checks
│   └── proxy_types/      # Reverse proxy, load balancer
├── gateway/
│   ├── server/           # Gateway HTTP server
│   ├── router/           # Request routing, load balancing
│   └── middleware/       # Middleware system
├── mod.ts                # Main module exports
├── config.example.json   # Example configuration
└── README.md             # This file
```

### Running Tests

```bash
# Run all tests
deno test --allow-all

# Run specific test file
deno test --allow-all core/network/transport/http/http_test.ts
```

### Type Checking

```bash
# Check types
deno check mod.ts
```

## Performance

- **Connection Pooling**: Reduces TCP handshake overhead by ~80%
- **Buffer Pooling**: Minimizes GC pressure with pre-allocated buffers
- **Zero-Copy**: Stream-based I/O with minimal data copying
- **Async I/O**: Non-blocking operations throughout

## Roadmap

- [x] HTTP/1.1 support
- [x] HTTPS support
- [x] Load balancing (6 strategies)
- [x] Health checking
- [x] Session affinity
- [x] Middleware system
- [x] Connection pooling
- [x] Graceful shutdown
- [ ] HTTP/2 support
- [ ] HTTP/3 support
- [ ] WebSocket proxying
- [ ] Server-Sent Events proxying
- [ ] Metrics server (Prometheus format)
- [ ] Admin API
- [ ] Configuration hot-reload
- [ ] Plugin system

## License

BrowserX Proxy Engine is part of the BrowserX project and is licensed under the [MIT License](../LICENSE).

## Documentation

See the following documentation files for detailed information:

- `/ProxyEngineAbstraction.md`: Complete architecture and implementation reference
- `/ProxyEngine.md`: High-level architecture overview
- `/CLAUDE.md`: Development guidelines for Claude Code
