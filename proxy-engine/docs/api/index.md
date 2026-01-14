# Proxy Engine API Reference

API documentation for the BrowserX Proxy Engine.

## Overview

This directory contains detailed API documentation for all public interfaces and classes in the proxy engine.

## Contents

### Core Runtime

- **Runtime** - Main runtime coordinator
- **ConfigBuilder** - Configuration builder with fluent API
- **ProxyConfig** - Configuration types and validation

### Gateway Layer

- **Gateway** - HTTP/HTTPS server
- **RequestRouter** - Request routing and load balancing
- **ResponseRouter** - Response routing and transformation
- **MiddlewareChain** - Middleware execution pipeline

### Connection Management

- **ConnectionPool** - Connection pooling with health checking
- **ConnectionManager** - Connection lifecycle management
- **PooledConnection** - Connection wrapper with metadata
- **HealthChecker** - Health checking strategies (TCP, HTTP, ping)

### Proxy Types

- **ReverseProxy** - Reverse proxy implementation
- **LoadBalancerProxy** - Load balancing with multiple strategies
- **AuthProxy** - Authentication and authorization
- **WebSocketProxy** - WebSocket proxying
- **SSEProxy** - Server-Sent Events proxying

### Network Layer

- **HTTPParser** - HTTP request/response parsing
- **TLSHandler** - TLS/SSL termination and inspection
- **BufferPool** - Pre-allocated buffer management
- **IPAddressPool** - IP rotation and management

### Middleware

- **AuthMiddleware** - Bearer, Basic, OAuth authentication
- **RateLimitMiddleware** - Token bucket, sliding window rate limiting
- **LoggingMiddleware** - Request/response logging
- **CORSMiddleware** - Cross-Origin Resource Sharing
- **CompressionMiddleware** - gzip, deflate compression
- **HeadersMiddleware** - Header transformation

### Cache Layer

- **CacheManager** - HTTP caching with eviction policies
- **CacheControl** - Cache-Control header parsing
- **CacheStorage** - Memory/disk cache storage backends

### Metrics & Observability

- **MetricsCollector** - Metrics collection and aggregation
- **Tracer** - Distributed tracing
- **Logger** - Structured logging

## Usage

Each API document includes:
- Class/interface definition
- Constructor parameters
- Public methods with parameters and return types
- Configuration options
- Usage examples
- Type definitions

## Status

🚧 **In Progress** - API documentation is being written as components are implemented.
