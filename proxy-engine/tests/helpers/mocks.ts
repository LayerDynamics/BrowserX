/**
 * Mock Factories for Proxy Engine Tests
 * Provides reusable mock objects following browser module testing patterns
 */

/**
 * Mock Deno.Conn for testing
 */
export interface MockConn extends Deno.Conn {
  mockReadData?: Uint8Array[];
  mockReadIndex?: number;
  mockClosed?: boolean;
  mockError?: Error;
}

/**
 * Create mock Deno.Conn
 */
export function createMockConn(overrides?: Partial<MockConn>): MockConn {
  const mockConn: MockConn = {
    rid: Math.floor(Math.random() * 1000000),
    localAddr: { transport: "tcp", hostname: "127.0.0.1", port: 8080 },
    remoteAddr: { transport: "tcp", hostname: "192.168.1.1", port: 54321 },
    mockReadData: overrides?.mockReadData || [],
    mockReadIndex: 0,
    mockClosed: false,
    mockError: overrides?.mockError,

    async read(p: Uint8Array): Promise<number | null> {
      if (this.mockClosed) {
        return null;
      }

      if (this.mockError) {
        throw this.mockError;
      }

      const data = this.mockReadData?.[this.mockReadIndex || 0];
      if (!data) {
        return null;
      }

      const bytesToCopy = Math.min(p.length, data.length);
      p.set(data.subarray(0, bytesToCopy), 0);
      this.mockReadIndex = (this.mockReadIndex || 0) + 1;

      return bytesToCopy;
    },

    async write(p: Uint8Array): Promise<number> {
      if (this.mockClosed) {
        throw new Error("Connection closed");
      }

      if (this.mockError) {
        throw this.mockError;
      }

      return p.length;
    },

    close(): void {
      this.mockClosed = true;
    },

    closeWrite(): Promise<void> {
      return Promise.resolve();
    },

    readable: new ReadableStream(),
    writable: new WritableStream(),

    ref(): void {},
    unref(): void {},

    ...overrides,
  };

  return mockConn;
}

/**
 * Pooled connection interface
 */
export interface PooledConnection {
  id: string;
  conn: Deno.Conn;
  host: string;
  port: number;
  createdAt: number;
  lastUsedAt: number;
  requestCount: number;
  inUse: boolean;
}

/**
 * Create mock pooled connection
 */
export function createMockPooledConnection(
  overrides?: Partial<PooledConnection>,
): PooledConnection {
  const now = Date.now();

  return {
    id: overrides?.id || `conn-${Math.floor(Math.random() * 10000)}`,
    conn: overrides?.conn || createMockConn(),
    host: overrides?.host || "example.com",
    port: overrides?.port || 80,
    createdAt: overrides?.createdAt || now,
    lastUsedAt: overrides?.lastUsedAt || now,
    requestCount: overrides?.requestCount || 0,
    inUse: overrides?.inUse ?? false,
  };
}

/**
 * HTTP request interface
 */
export interface IncomingRequest {
  id: string;
  method: string;
  url: string;
  headers: Map<string, string>;
  body?: Uint8Array;
  timestamp: number;
}

/**
 * Create mock HTTP request
 */
export function createMockRequest(overrides?: Partial<IncomingRequest>): IncomingRequest {
  return {
    id: overrides?.id || `req-${Math.floor(Math.random() * 100000)}`,
    method: overrides?.method || "GET",
    url: overrides?.url || "http://example.com/",
    headers: overrides?.headers || new Map([["host", "example.com"]]),
    body: overrides?.body,
    timestamp: overrides?.timestamp || Date.now(),
  };
}

/**
 * HTTP response interface
 */
export interface IncomingResponse {
  id: string;
  statusCode: number;
  statusText: string;
  headers: Map<string, string>;
  body: Uint8Array;
  timestamp: number;
}

/**
 * Create mock HTTP response
 */
export function createMockResponse(overrides?: Partial<IncomingResponse>): IncomingResponse {
  return {
    id: overrides?.id || `res-${Math.floor(Math.random() * 100000)}`,
    statusCode: overrides?.statusCode || 200,
    statusText: overrides?.statusText || "OK",
    headers: overrides?.headers ||
      new Map([
        ["content-type", "text/html"],
        ["content-length", "0"],
      ]),
    body: overrides?.body || new Uint8Array(0),
    timestamp: overrides?.timestamp || Date.now(),
  };
}

/**
 * Buffer pool interface
 */
export interface BufferPool {
  acquire(size: number): Uint8Array;
  release(buffer: Uint8Array): void;
  clear(): void;
  getStats(): {
    totalAcquired: number;
    totalReleased: number;
    currentInUse: number;
  };
}

/**
 * Create mock buffer pool
 */
export function createMockBufferPool(overrides?: Partial<BufferPool>): BufferPool {
  let acquired = 0;
  let released = 0;

  return {
    acquire(size: number): Uint8Array {
      acquired++;
      return new Uint8Array(size);
    },

    release(_buffer: Uint8Array): void {
      released++;
    },

    clear(): void {
      acquired = 0;
      released = 0;
    },

    getStats() {
      return {
        totalAcquired: acquired,
        totalReleased: released,
        currentInUse: acquired - released,
      };
    },

    ...overrides,
  };
}

/**
 * Socket state enum
 */
export enum SocketState {
  CLOSED = "CLOSED",
  OPENING = "OPENING",
  OPEN = "OPEN",
  CLOSING = "CLOSING",
  ERROR = "ERROR",
}

/**
 * TCP connection state enum
 */
export enum TCPState {
  CLOSED = "CLOSED",
  LISTEN = "LISTEN",
  SYN_SENT = "SYN_SENT",
  SYN_RECEIVED = "SYN_RECEIVED",
  ESTABLISHED = "ESTABLISHED",
  FIN_WAIT_1 = "FIN_WAIT_1",
  FIN_WAIT_2 = "FIN_WAIT_2",
  CLOSE_WAIT = "CLOSE_WAIT",
  CLOSING = "CLOSING",
  LAST_ACK = "LAST_ACK",
  TIME_WAIT = "TIME_WAIT",
}

/**
 * Cache entry interface
 */
export interface CacheEntry {
  key: string;
  response: IncomingResponse;
  timestamp: number;
  maxAge: number;
  etag?: string;
  lastModified?: string;
}

/**
 * Create mock cache entry
 */
export function createMockCacheEntry(overrides?: Partial<CacheEntry>): CacheEntry {
  const now = Date.now();

  return {
    key: overrides?.key || "GET:http://example.com/",
    response: overrides?.response || createMockResponse(),
    timestamp: overrides?.timestamp || now,
    maxAge: overrides?.maxAge || 3600,
    etag: overrides?.etag,
    lastModified: overrides?.lastModified,
  };
}

/**
 * Route definition interface
 */
export interface Route {
  id: string;
  pathPattern: RegExp;
  methods: string[];
  target: string;
  priority: number;
}

/**
 * Create mock route
 */
export function createMockRoute(overrides?: Partial<Route>): Route {
  return {
    id: overrides?.id || `route-${Math.floor(Math.random() * 10000)}`,
    pathPattern: overrides?.pathPattern || /^\//,
    methods: overrides?.methods || ["GET", "POST"],
    target: overrides?.target || "http://backend:8080",
    priority: overrides?.priority || 0,
  };
}

/**
 * Upstream server interface
 */
export interface UpstreamServer {
  host: string;
  port: number;
  weight: number;
  healthy: boolean;
  activeConnections: number;
  totalRequests: number;
  avgResponseTime: number;
  errorRate: number;
}

/**
 * Create mock upstream server
 */
export function createMockUpstreamServer(overrides?: Partial<UpstreamServer>): UpstreamServer {
  return {
    host: overrides?.host || "backend-1",
    port: overrides?.port || 8080,
    weight: overrides?.weight || 1,
    healthy: overrides?.healthy ?? true,
    activeConnections: overrides?.activeConnections || 0,
    totalRequests: overrides?.totalRequests || 0,
    avgResponseTime: overrides?.avgResponseTime || 50,
    errorRate: overrides?.errorRate || 0,
  };
}

/**
 * Middleware function type
 */
export type MiddlewareFunction = (
  request: IncomingRequest,
  next: () => Promise<IncomingResponse>,
) => Promise<IncomingResponse>;

/**
 * Create mock middleware that passes through
 */
export function createMockMiddleware(
  fn?: MiddlewareFunction,
): MiddlewareFunction {
  return fn || ((req: IncomingRequest, next: () => Promise<IncomingResponse>) => next());
}

/**
 * Metrics interface
 */
export interface Metrics {
  counters: Map<string, number>;
  gauges: Map<string, number>;
  histograms: Map<string, number[]>;
}

/**
 * Create mock metrics collector
 */
export function createMockMetrics(overrides?: Partial<Metrics>): Metrics {
  return {
    counters: overrides?.counters || new Map(),
    gauges: overrides?.gauges || new Map(),
    histograms: overrides?.histograms || new Map(),
  };
}
