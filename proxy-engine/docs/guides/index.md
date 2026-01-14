# Proxy Engine Guides

Comprehensive guides for understanding and working with the BrowserX Proxy Engine.

## Overview

This directory contains detailed technical guides covering the architecture, implementation, and usage patterns of the proxy engine.

## Architecture Guides

### Overview

- **ProxyEngineAbstraction.md** - Complete architecture reference (184KB, ~6000 lines)
- **LayeredArchitecture.md** - Understanding the 7-layer design
- **DataFlow.md** - Request flow through all layers (18 steps)

### Core Layers

- **RuntimeLayer.md** - Runtime coordinator, lifecycle management, signal handling
- **GatewayLayer.md** - Request/response routing, middleware execution
- **ProxyTypeLayer.md** - Reverse proxy, load balancer, auth proxy implementations
- **ConnectionPoolLayer.md** - Connection reuse, health checking, lifecycle management
- **TransportProtocolLayer.md** - HTTP/1.1, HTTP/2, HTTP/3, WebSocket, TLS
- **NetworkPrimitivesLayer.md** - TCP, sockets, buffers, header parsing

### Connection Management

- **ConnectionPooling.md** - Efficient connection reuse patterns
- **HealthChecking.md** - TCP, HTTP, and ping-based health monitoring
- **FailoverStrategies.md** - Automatic failover and circuit breakers

### Load Balancing

- **LoadBalancingAlgorithms.md** - Round-robin, least connections, weighted, IP hash, response time
- **SessionAffinity.md** - Cookie-based and IP-based sticky sessions
- **ServerSelection.md** - Server selection and weighting strategies

### Middleware System

- **MiddlewareArchitecture.md** - Request and response middleware pipeline
- **BuiltInMiddleware.md** - Auth, rate limiting, logging, CORS, compression
- **CustomMiddleware.md** - Writing your own middleware

### Cache Layer

- **HTTPCaching.md** - Cache-Control parsing and cacheability rules
- **CacheStorage.md** - Memory and disk storage backends
- **EvictionPolicies.md** - LRU, LFU, FIFO eviction strategies

### Security

- **TLSSecurity.md** - TLS 1.2/1.3 termination and inspection
- **Authentication.md** - Bearer, Basic, OAuth authentication
- **Authorization.md** - Permission and access control

### Metrics & Observability

- **MetricsCollection.md** - Request, connection, cache, and error metrics
- **DistributedTracing.md** - Trace propagation and span management
- **Logging.md** - Structured logging and log levels

## Implementation Guides

### Getting Started

- **QuickStart.md** - Setting up and running the proxy
- **Configuration.md** - Configuration file format and options
- **CLIUsage.md** - Command-line interface

### Common Patterns

- **ReverseProxyPattern.md** - Setting up a reverse proxy
- **APIGatewayPattern.md** - Building an API gateway
- **LoadBalancerPattern.md** - Configuring load balancing
- **CachingProxyPattern.md** - Implementing caching strategies

### Advanced Topics

- **GracefulShutdown.md** - Draining connections safely
- **HotReload.md** - Configuration reloading without downtime
- **MultiGateway.md** - Running multiple gateways
- **PerformanceTuning.md** - Optimization and tuning

### Protocol Support

- **HTTP1.md** - HTTP/1.1 implementation details
- **HTTP2.md** - HTTP/2 multiplexing and server push
- **HTTP3.md** - HTTP/3 over QUIC
- **WebSocketProxying.md** - WebSocket upgrade and bidirectional streaming
- **SSEProxying.md** - Server-Sent Events streaming

## How to Use These Guides

1. **New to the proxy?** Start with `LayeredArchitecture.md` and `DataFlow.md`
2. **Need to configure something?** Check the implementation guides
3. **Working on a specific layer?** Read the relevant architecture guide
4. **Contributing?** Read `ProxyEngineAbstraction.md` for complete details

## Status

🚧 **In Progress** - Guides are being written and refined as the proxy engine evolves.

## Contributing

Found an error or want to improve a guide? See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for guidelines.
