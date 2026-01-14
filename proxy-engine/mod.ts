/**
 * BrowserX Proxy Engine
 *
 * A high-performance, multi-layered HTTP/HTTPS proxy engine with:
 * - Load balancing (round-robin, least-connections, weighted, IP-hash, least-response-time, random)
 * - Health checking (TCP, HTTP, ping)
 * - Session affinity (cookie-based, IP-based)
 * - Automatic failover
 * - Request/response middleware (auth, rate limiting, logging, CORS, compression, headers)
 * - Connection pooling
 * - Graceful shutdown
 * - HTTP/1.1, HTTPS support (HTTP/2 planned)
 */

// Runtime
export {
  ConfigBuilder,
  ConfigLoader,
  ConfigValidationError,
  createDefaultConfig,
  Runtime,
  RuntimeState,
} from "./core/runtime/mod.ts";
export type {
  RuntimeConfig,
  RuntimeEvent,
  RuntimeEventListener,
  RuntimeStats,
} from "./core/runtime/mod.ts";

// Gateway Server
export { GatewayServer } from "./gateway/server/mod.ts";
export type { GatewayServerConfig, GatewayServerStats } from "./gateway/server/mod.ts";

// Routing
export { PatternRouter } from "./gateway/router/request_router.ts";
export type {
  HealthCheckConfig,
  IncomingRequest,
  LoadBalancingStrategy,
  RetryPolicy,
  Route,
  RouteMatch,
  Router,
  UpstreamConfig,
  UpstreamServer,
} from "./gateway/router/request_router.ts";

// Response Routing
export { ResponseRouter } from "./gateway/router/response_router.ts";
export type { ResponseRule } from "./gateway/router/response_router.ts";

// Route Matching
export {
  createRouteMatcher,
  extractPathParams,
  RouteMatcher,
  testPathPattern,
} from "./gateway/router/route_matcher.ts";
export type { RouteMatch as RouteMatchResult } from "./gateway/router/route_matcher.ts";

// Router I/O Utilities
export {
  copyHeaders,
  createStreamingResponse,
  getContentLength,
  headersToObject,
  isChunkedEncoding,
  mergeHeaders,
  readRequestBody,
  readRequestBodyJSON,
  readRequestBodyText,
  requestHasBody,
  requestToIncoming,
  streamResponseBody,
  writeErrorResponse,
  writeJSONResponse,
  writeResponse,
} from "./gateway/router/io.ts";

// Load Balancing
export {
  BaseLoadBalancer,
  createLoadBalancer,
  IPHashLoadBalancer,
  LeastConnectionsLoadBalancer,
  LeastResponseTimeLoadBalancer,
  RandomLoadBalancer,
  RoundRobinLoadBalancer,
  WeightedRoundRobinLoadBalancer,
} from "./gateway/router/load_balancer/mod.ts";
export type { LoadBalancer, LoadBalancerServerStats } from "./gateway/router/load_balancer/types.ts";

// Middleware
export {
  AuthenticationError,
  AuthMiddleware,
  CombinedLogFormatter,
  CombinedLoggingMiddleware,
  CommonLogFormatter,
  CompressionMiddleware,
  ConsoleLogger,
  CORSMiddleware,
  createErrorResponse,
  HeaderTransformMiddleware,
  InMemoryTokenValidator,
  InMemoryUserValidator,
  MiddlewareChain,
  RateLimitError,
  RateLimitMiddleware,
  RequestHeaderMiddleware,
  RequestLoggingMiddleware,
  ResponseHeaderMiddleware,
  ResponseLoggingMiddleware,
} from "./gateway/middleware/mod.ts";
export type {
  AuthenticatedUser,
  AuthMethod,
  AuthMiddlewareConfig,
  BasicAuthValidator,
  CompressionConfig,
  CompressionEncoding,
  CORSConfig,
  HeaderOperation,
  HeaderRule,
  HeaderTransformConfig,
  LogFormat,
  Logger,
  LoggingConfig,
  LogLevel,
  MiddlewareChainConfig,
  MiddlewareConfig,
  MiddlewareResult,
  RateLimitAlgorithm,
  RateLimitConfig,
  RequestContext,
  RequestMiddleware,
  ResponseMiddleware,
  TokenValidator,
  UserValidator,
} from "./gateway/middleware/mod.ts";

// Proxy Types
export { ReverseProxy } from "./core/proxy_types/reverse_proxy.ts";
export { LoadBalancerProxy } from "./core/proxy_types/loadbalance_proxy.ts";
export {
  AuthProxy,
  EventDrivenProxy,
  SSEProxy,
  TLSProxy,
  WebSocketProxy,
} from "./core/proxy_types/mod.ts";
export type {
  AccessRule,
  AuditLogEntry,
  AuthProxyConfig,
  AuthProxyStats,
  EventDrivenProxyConfig,
  SSEEvent,
  SSEProxyConfig,
  SSEProxyStats,
  TLSMode,
  TLSProxyConfig,
  TLSProxyStats,
  User,
  WebSocketMessage,
  WebSocketProxyConfig,
  WebSocketProxyStats,
} from "./core/proxy_types/mod.ts";

// Connection Management
export { UpstreamConnectionManager } from "./core/connection/connection_manager.ts";
export {
  HealthMonitor,
  HTTPHealthChecker,
  TCPHealthChecker,
} from "./core/connection/health_check.ts";
export { ConnectionPool } from "./core/connection/connection_pool.ts";
export type {
  ConnectionPoolConfig as UpstreamConnectionPoolConfig,
  ConnectionPoolStats,
  ConnectionState,
  PooledConnection,
  UpstreamConnectionStats,
} from "./core/connection/connection_manager.ts";
export type {
  ConnectionPoolConfig,
  PooledConnectionInfo,
} from "./core/connection/connection_pool.ts";
export type {
  HealthChecker,
  HealthCheckResult,
  ServerHealthState,
} from "./core/connection/health_check.ts";

// HTTP Protocol
export { HTTP11Client, HTTP11Server, makeHTTPRequest } from "./core/network/transport/http/http.ts";
export {
  HTTPSClient,
  makeRequest as makeHTTPSRequest,
} from "./core/network/transport/http/https.ts";
export type {
  HTTPClientConfig,
  HTTPMethod,
  HTTPRequest,
  HTTPResponse,
  HTTPServerConfig,
  HTTPStatusCode,
  HTTPVersion,
} from "./core/network/transport/http/http.ts";
export type { HTTPSClientConfig } from "./core/network/transport/http/https.ts";

// HTTP Protocol Parsers
export { HTTPRequestParser, HTTPResponseParser } from "./core/network/protocols/http_parser.ts";
export type { HTTPParserConfig } from "./core/network/protocols/http_parser.ts";

// HTTP/2 Protocol
export {
  createHTTP2Client,
  createHTTP2Server,
  HPACKCodec,
  HTTP2_DEFAULT_SETTINGS,
  HTTP2_PREFACE,
  HTTP2Client,
  HTTP2Connection,
  HTTP2ErrorCode,
  HTTP2FrameFlags,
  HTTP2FrameParser,
  HTTP2FrameType,
  HTTP2Server,
  HTTP2SettingsParameter,
  HTTP2Stream,
  HTTP2StreamState,
} from "./core/network/transport/http/mod.ts";
export type {
  HTTP2ConnectionConfig,
  HTTP2ConnectionStats,
  HTTP2DataFrame,
  HTTP2Frame,
  HTTP2FrameHeader,
  HTTP2GoAwayFrame,
  HTTP2HeadersFrame,
  HTTP2PingFrame,
  HTTP2PriorityFrame,
  HTTP2PushPromiseFrame,
  HTTP2RstStreamFrame,
  HTTP2SettingsFrame,
  HTTP2StreamPriority,
  HTTP2WindowUpdateFrame,
} from "./core/network/transport/http/mod.ts";

// Socket Layer
export { Socket, SocketState } from "./core/network/transport/socket/socket.ts";
export type { SocketOptions, SocketStats } from "./core/network/transport/socket/socket.ts";
export { DEFAULT_SOCKET_OPTIONS, mergeSocketOptions } from "./core/network/transport/socket/socket_options.ts";
export {
  createSocketStats,
  formatSocketStats,
  getAge,
  getAvgBytesPerRead,
  getAvgBytesPerWrite,
  getIdleTime,
} from "./core/network/transport/socket/socket_stats.ts";

// TCP Layer
export { TCPConnection, TCPState, TCPStateMachine } from "./core/network/transport/tcp/mod.ts";
export type {
  TCPConnectionConfig,
  TCPConnectionStats,
  TCPEvent,
  TCPFlags,
  TCPSegment,
} from "./core/network/transport/tcp/mod.ts";

// TLS Layer
export {
  createTLSConnection,
  TLS12_CIPHER_SUITES,
  TLS13_CIPHER_SUITES,
  TLSConnection,
  TLSHandshake,
  TLSHandshakeState,
  TLSVersion,
  wrapWithTLS,
} from "./core/network/transport/tls/mod.ts";
export type {
  CipherSuite,
  TLSCertificate,
  TLSConnectionConfig,
  TLSConnectionInfo,
  TLSConnectionStats,
  TLSHandshakeConfig,
} from "./core/network/transport/tls/mod.ts";

// Network Primitives
export { BufferPool, getGlobalBufferPool } from "./core/network/primitive/buffer/buffer_pool.ts";
export { StreamReader } from "./core/network/primitive/buffer/stream_reader.ts";
export { StreamWriter } from "./core/network/primitive/buffer/stream_writer.ts";
export { HeaderParser } from "./core/network/primitive/header/header_parser.ts";
export { RequestLineParser } from "./core/network/primitive/header/request_line_parser.ts";
export { StatusLineParser } from "./core/network/primitive/header/status_line_parser.ts";
export type { RequestLine } from "./core/network/primitive/header/request_line_parser.ts";
export type { StatusLine } from "./core/network/primitive/header/status_line_parser.ts";

// =============================================================================
// Cache System - HTTP Caching
// =============================================================================
export * from "./core/cache/mod.ts";

// =============================================================================
// Metrics & Observability - Monitoring
// =============================================================================
export * from "./core/metrics/mod.ts";

// =============================================================================
// Event System - Event-Driven Architecture
// =============================================================================
export * from "./core/event/mod.ts";

// =============================================================================
// Worker & Thread Management - Parallel Processing
// =============================================================================
export * from "./core/worker/mod.ts";
export * from "./core/thread/mod.ts";

// =============================================================================
// Process Management - Multi-Process Architecture
// =============================================================================
// Export specific items from process module to avoid Task conflict with event module
export type { Task as ProcessTask, TaskResult } from "./core/process/dispatch.ts";
export * from "./core/process/pid.ts";
export * from "./core/process/spawn.ts";
export * from "./core/process/priority.ts";

// =============================================================================
// Port Management - Port Binding
// =============================================================================
export * from "./core/port/mod.ts";

// =============================================================================
// Memory Management - Memory Tracking
// =============================================================================
export * from "./core/memory/mod.ts";

// =============================================================================
// IP Handling - IP Address Utilities
// =============================================================================
export { IPv4Address } from "./core/network/primitive/ip/ip_handling.ts";
export { IPAddressPool } from "./core/network/primitive/ip/pool.ts";

// =============================================================================
// DNS Resolution - DNS Resolver
// =============================================================================
export {
  DNSRecordType,
  DNSResolver,
} from "./core/network/resolution/dns_resolver.ts";
export type {
  DNSRecord,
  DNSQueryOptions,
  DNSResolverConfig,
} from "./core/network/resolution/dns_resolver.ts";
