# Proxy Engine Examples

Practical examples demonstrating how to use the BrowserX Proxy Engine.

## Overview

This directory contains runnable code examples showing real-world usage of the proxy engine.

## Available Examples

### Basic Proxy Setups

- **01-simple-reverse-proxy.ts** - Basic reverse proxy configuration
- **02-load-balancer.ts** - Load balancing across multiple backends
- **03-tls-termination.ts** - HTTPS proxy with TLS termination
- **04-health-checking.ts** - Health checking and automatic failover

### Middleware

- **05-authentication.ts** - Adding authentication middleware
- **06-rate-limiting.ts** - Rate limiting requests
- **07-logging.ts** - Request/response logging
- **08-cors.ts** - CORS configuration
- **09-compression.ts** - Response compression

### Advanced Features

- **10-session-affinity.ts** - Sticky sessions with cookies or IP hash
- **11-caching.ts** - HTTP caching with cache control
- **12-custom-middleware.ts** - Writing custom middleware
- **13-websocket-proxy.ts** - WebSocket proxying
- **14-sse-proxy.ts** - Server-Sent Events proxying

### Load Balancing Strategies

- **15-round-robin.ts** - Round-robin load balancing
- **16-least-connections.ts** - Least connections strategy
- **17-ip-hash.ts** - IP-based sticky sessions
- **18-weighted.ts** - Weighted load balancing
- **19-least-response-time.ts** - Response time-based routing

### Production Patterns

- **20-graceful-shutdown.ts** - Graceful shutdown with connection draining
- **21-configuration-reload.ts** - Hot configuration reloading
- **22-monitoring.ts** - Metrics and monitoring
- **23-multi-gateway.ts** - Multiple gateways on different ports

## Running Examples

```bash
cd proxy-engine

# Basic example
deno run --allow-net docs/examples/01-simple-reverse-proxy.ts

# Example with configuration file
deno run --allow-net --allow-read docs/examples/02-load-balancer.ts

# Full permissions for advanced examples
deno run --allow-all docs/examples/23-multi-gateway.ts
```

## Example Structure

Each example follows this pattern:

```typescript
/**
 * Example: [Name]
 *
 * Description of what this example demonstrates.
 */

import { ConfigBuilder, Runtime } from "../../mod.ts";

// Configuration
const config = new ConfigBuilder()
  // ... configuration ...
  .build();

// Create and start runtime
async function main() {
  const runtime = new Runtime(config);
  await runtime.start();
  console.log(`Proxy running on port ${config.gateways[0].port}`);
}

if (import.meta.main) {
  await main();
}
```

## Status

🚧 **In Progress** - Examples are being added as components are implemented.
