/**
 * Network Module
 *
 * Complete network layer implementation for proxy-engine
 *
 * Architecture:
 * - Primitive: Low-level buffers, headers, IP handling
 * - Transport: HTTP/1.1, HTTP/2, HTTP/3, TLS, TCP, sockets
 * - Connection: Connection pooling and management
 * - Resolution: DNS resolution and caching
 * - Protocols: HTTP parsing and protocol handling
 * - Utils: Network utilities (URL, headers, cookies, encoding, retry, timeout)
 * - Internal: Coordination layer (registry, events, lifecycle, flow control)
 * - External: External services (upstream client, WebSocket, SSE, DNS forwarder)
 */

// ============================================================================
// PRIMITIVE LAYER - Low-level network primitives
// ============================================================================

export * from "./primitive/mod.ts";

// ============================================================================
// TRANSPORT LAYER - Protocol implementations
// ============================================================================

export * from "./transport/mod.ts";

// ============================================================================
// CONNECTION MANAGEMENT LAYER
// ============================================================================

export * from "./connection/mod.ts";

// ============================================================================
// DNS RESOLUTION LAYER
// ============================================================================

export * from "./resolution/mod.ts";

// ============================================================================
// PROTOCOL PARSING LAYER
// ============================================================================

export * from "./protocols/mod.ts";

// ============================================================================
// UTILITIES LAYER - Network utility functions
// ============================================================================

export * from "./utils/mod.ts";

// ============================================================================
// INTERNAL COORDINATION LAYER
// ============================================================================

// Re-export with renamed ConnectionState to avoid conflict with connection layer
export {
  ConnectionRegistry,
  globalRegistry,
  ConnectionState as InternalConnectionState,
  type RegisteredConnection,
  type ConnectionQuery,
  type ProtocolType,
} from "./internal/connection_registry.ts";

export * from "./internal/resource_tracker.ts";
export * from "./internal/event_bus.ts";
export * from "./internal/lifecycle.ts";
export * from "./internal/coordinator.ts";
export * from "./internal/state_sync.ts";
export * from "./internal/flow_control.ts";
export * from "./internal/backpressure.ts";

// ============================================================================
// EXTERNAL SERVICES LAYER
// ============================================================================

export * from "./external/mod.ts";
