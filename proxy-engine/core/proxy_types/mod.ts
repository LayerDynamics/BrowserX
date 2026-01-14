/**
 * Proxy Types Module
 *
 * Exports all proxy type implementations
 */

// Reverse Proxy
export { ReverseProxy } from "./reverse_proxy.ts";
export type { ReverseProxyConfig } from "./reverse_proxy.ts";

// Load Balancer Proxy
export { LoadBalancerProxy } from "./loadbalance_proxy.ts";
export type {
  FailoverConfig,
  LoadBalancerProxyConfig,
  SessionAffinityConfig,
} from "./loadbalance_proxy.ts";

// WebSocket Proxy
export { WebSocketProxy } from "./websocket_proxy.ts";
export type {
  WebSocketMessage,
  WebSocketProxyConfig,
  WebSocketProxyStats,
} from "./websocket_proxy.ts";

// Server-Sent Events Proxy
export { SSEProxy } from "./sse_proxy.ts";
export type { SSEEvent, SSEProxyConfig, SSEProxyStats } from "./sse_proxy.ts";

// Authentication & Authorization Proxy
export { AuthProxy, InMemoryUserValidator } from "./auth_proxy.ts";
export type {
  AccessRule,
  AuditLogEntry,
  AuthMethod,
  AuthProxyConfig,
  AuthProxyStats,
  User,
  UserValidator,
} from "./auth_proxy.ts";

// TLS Proxy
export { TLSProxy } from "./tls_proxy.ts";
export type { TLSMode, TLSProxyConfig, TLSProxyStats } from "./tls_proxy.ts";

// Event-Driven Proxy
export { EventDrivenProxy } from "./event_driven_proxy.ts";
export type { EventDrivenProxyConfig } from "./event_driven_proxy.ts";
