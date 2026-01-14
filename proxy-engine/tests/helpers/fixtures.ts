/**
 * Test Fixtures for Proxy Engine Tests
 * Provides sample data for HTTP requests, responses, and network operations
 */

/**
 * Sample HTTP request strings
 */
export const HTTP_REQUESTS = {
  simple_get: `GET / HTTP/1.1\r\nHost: example.com\r\n\r\n`,

  get_with_headers: `GET /api/users HTTP/1.1\r
Host: api.example.com\r
User-Agent: BrowserX/1.0\r
Accept: application/json\r
Authorization: Bearer test-token\r
\r
`,

  post_with_body: `POST /api/users HTTP/1.1\r
Host: api.example.com\r
Content-Type: application/json\r
Content-Length: 27\r
\r
{"name":"John","age":30}`,

  chunked_encoding: `POST /upload HTTP/1.1\r
Host: example.com\r
Transfer-Encoding: chunked\r
\r
7\r
Mozilla\r
9\r
Developer\r
0\r
\r
`,

  with_query_params: `GET /search?q=test&page=1 HTTP/1.1\r
Host: example.com\r
\r
`,

  http2_request: `:method: GET\r
:path: /index.html\r
:scheme: https\r
:authority: www.example.com\r
user-agent: BrowserX/1.0\r
\r
`,
};

/**
 * Sample HTTP response strings
 */
export const HTTP_RESPONSES = {
  ok_200: `HTTP/1.1 200 OK\r
Content-Type: text/html\r
Content-Length: 13\r
\r
Hello, World!`,

  not_found_404: `HTTP/1.1 404 Not Found\r
Content-Type: text/plain\r
Content-Length: 9\r
\r
Not Found`,

  redirect_301: `HTTP/1.1 301 Moved Permanently\r
Location: https://example.com/new-page\r
Content-Length: 0\r
\r
`,

  with_cache_headers: `HTTP/1.1 200 OK\r
Content-Type: application/json\r
Cache-Control: max-age=3600, public\r
ETag: "abc123"\r
Last-Modified: Mon, 01 Jan 2024 00:00:00 GMT\r
Content-Length: 17\r
\r
{"status":"ok"}`,

  chunked_response: `HTTP/1.1 200 OK\r
Transfer-Encoding: chunked\r
Content-Type: text/plain\r
\r
7\r
Mozilla\r
9\r
Developer\r
0\r
\r
`,

  server_error_500: `HTTP/1.1 500 Internal Server Error\r
Content-Type: text/plain\r
Content-Length: 21\r
\r
Internal Server Error`,

  no_content_204: `HTTP/1.1 204 No Content\r
Date: Mon, 01 Jan 2024 00:00:00 GMT\r
\r
`,
};

/**
 * Sample TLS ClientHello message
 */
export const TLS_CLIENT_HELLO = new Uint8Array([
  // Record header
  0x16, // Content Type: Handshake
  0x03, 0x01, // Version: TLS 1.0
  0x00, 0x05, // Length: 5 bytes (placeholder)
  // Handshake header
  0x01, // Handshake Type: ClientHello
  0x00, 0x00, 0x01, // Length: 1 byte (placeholder)
  0x03, // Version
]);

/**
 * Sample DNS responses
 */
export const DNS_RECORDS = {
  a_record: {
    name: "example.com",
    type: "A",
    ttl: 3600,
    data: "93.184.216.34",
  },

  aaaa_record: {
    name: "example.com",
    type: "AAAA",
    ttl: 3600,
    data: "2606:2800:220:1:248:1893:25c8:1946",
  },

  cname_record: {
    name: "www.example.com",
    type: "CNAME",
    ttl: 3600,
    data: "example.com",
  },

  mx_record: {
    name: "example.com",
    type: "MX",
    ttl: 3600,
    priority: 10,
    data: "mail.example.com",
  },
};

/**
 * Sample URLs for testing
 */
export const TEST_URLS = {
  simple: "http://example.com",
  with_path: "http://example.com/api/users",
  with_query: "http://example.com/search?q=test",
  with_fragment: "http://example.com/page#section",
  https: "https://secure.example.com",
  with_port: "http://example.com:8080",
  with_auth: "http://user:pass@example.com",
  ipv4: "http://192.168.1.1",
  ipv6: "http://[2001:db8::1]",
  localhost: "http://localhost:3000",
};

/**
 * Sample cache control directives
 */
export const CACHE_CONTROL_HEADERS = {
  max_age: "max-age=3600",
  no_cache: "no-cache",
  no_store: "no-store",
  public: "public, max-age=86400",
  private: "private, max-age=3600",
  must_revalidate: "max-age=3600, must-revalidate",
  stale_while_revalidate: "max-age=3600, stale-while-revalidate=86400",
  stale_if_error: "max-age=3600, stale-if-error=86400",
  immutable: "max-age=31536000, immutable",
};

/**
 * Sample middleware configurations
 */
export const MIDDLEWARE_CONFIGS = {
  rate_limit: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    identifier: "ip",
  },

  auth_basic: {
    type: "basic",
    username: "admin",
    password: "secret",
  },

  auth_bearer: {
    type: "bearer",
    token: "test-token-123",
  },

  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },

  compression: {
    threshold: 1024,
    algorithms: ["gzip", "br", "deflate"],
  },
};

/**
 * Sample load balancer configurations
 */
export const LOAD_BALANCER_CONFIGS = {
  round_robin: {
    algorithm: "round_robin",
    servers: [
      { host: "backend-1", port: 8080, weight: 1 },
      { host: "backend-2", port: 8080, weight: 1 },
      { host: "backend-3", port: 8080, weight: 1 },
    ],
  },

  weighted: {
    algorithm: "weighted_round_robin",
    servers: [
      { host: "backend-1", port: 8080, weight: 3 },
      { host: "backend-2", port: 8080, weight: 2 },
      { host: "backend-3", port: 8080, weight: 1 },
    ],
  },

  ip_hash: {
    algorithm: "ip_hash",
    servers: [
      { host: "backend-1", port: 8080, weight: 1 },
      { host: "backend-2", port: 8080, weight: 1 },
    ],
  },
};

/**
 * Sample WebSocket frames
 */
export const WEBSOCKET_FRAMES = {
  text_frame: new Uint8Array([
    0x81, // FIN=1, opcode=1 (text)
    0x05, // MASK=0, length=5
    0x48, 0x65, 0x6c, 0x6c, 0x6f, // "Hello"
  ]),

  binary_frame: new Uint8Array([
    0x82, // FIN=1, opcode=2 (binary)
    0x04, // MASK=0, length=4
    0x01, 0x02, 0x03, 0x04,
  ]),

  ping_frame: new Uint8Array([
    0x89, // FIN=1, opcode=9 (ping)
    0x00, // MASK=0, length=0
  ]),

  pong_frame: new Uint8Array([
    0x8a, // FIN=1, opcode=10 (pong)
    0x00, // MASK=0, length=0
  ]),

  close_frame: new Uint8Array([
    0x88, // FIN=1, opcode=8 (close)
    0x02, // MASK=0, length=2
    0x03, 0xe8, // Status code: 1000 (normal closure)
  ]),
};

/**
 * Sample SSE (Server-Sent Events) messages
 */
export const SSE_MESSAGES = {
  simple: "data: Hello, World!\n\n",

  with_id: "id: 123\ndata: Message text\n\n",

  with_event: "event: update\ndata: {\"status\":\"ok\"}\n\n",

  multiline: "data: Line 1\ndata: Line 2\ndata: Line 3\n\n",

  with_retry: "retry: 5000\ndata: Retry after 5 seconds\n\n",
};

/**
 * Sample metrics data
 */
export const METRICS_SAMPLES = {
  request_duration_ms: [10, 25, 30, 15, 20, 50, 100, 75, 40, 30],
  response_sizes_bytes: [1024, 2048, 512, 4096, 1536, 3072, 768, 2560],
  error_rates: [0, 0, 0, 1, 0, 0, 0, 2, 0, 0],
  connection_counts: [5, 10, 15, 20, 18, 12, 8, 5, 3, 2],
};

/**
 * Helper to convert string to Uint8Array
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Helper to convert Uint8Array to string
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Helper to create HTTP request bytes
 */
export function createHTTPRequestBytes(method: string, path: string, headers: Record<string, string>, body?: string): Uint8Array {
  let request = `${method} ${path} HTTP/1.1\r\n`;

  for (const [key, value] of Object.entries(headers)) {
    request += `${key}: ${value}\r\n`;
  }

  request += "\r\n";

  if (body) {
    request += body;
  }

  return stringToBytes(request);
}

/**
 * Helper to create HTTP response bytes
 */
export function createHTTPResponseBytes(statusCode: number, statusText: string, headers: Record<string, string>, body?: string): Uint8Array {
  let response = `HTTP/1.1 ${statusCode} ${statusText}\r\n`;

  for (const [key, value] of Object.entries(headers)) {
    response += `${key}: ${value}\r\n`;
  }

  response += "\r\n";

  if (body) {
    response += body;
  }

  return stringToBytes(response);
}
