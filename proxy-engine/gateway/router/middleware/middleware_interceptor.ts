// middleware_interceptor.ts - Complete middleware chain implementation

interface Request {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: Uint8Array;
  metadata: Record<string, any>; // For passing data between middleware
}

interface Response {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
  metadata: Record<string, any>;
}

type RequestHandler = (req: Request, next: () => Promise<Response>) => Promise<Response>;

class MiddlewareInterceptor {
  private requestMiddleware: RequestHandler[] = [];
  private responseMiddleware: Array<(req: Request, res: Response) => Promise<Response>> = [];

  /**
   * Add request middleware to the chain
   */
  useRequest(middleware: RequestHandler): void {
    this.requestMiddleware.push(middleware);
  }

  /**
   * Add response middleware to the chain
   */
  useResponse(middleware: (req: Request, res: Response) => Promise<Response>): void {
    this.responseMiddleware.push(middleware);
  }

  /**
   * Execute request middleware chain
   */
  async executeRequest(req: Request, originHandler: () => Promise<Response>): Promise<Response> {
    let index = 0;

    const next = async (): Promise<Response> => {
      if (index < this.requestMiddleware.length) {
        const middleware = this.requestMiddleware[index++];
        return await middleware(req, next);
      } else {
        // All middleware executed, call origin
        return await originHandler();
      }
    };

    let response = await next();

    // Execute response middleware in reverse order
    for (let i = this.responseMiddleware.length - 1; i >= 0; i--) {
      response = await this.responseMiddleware[i](req, response);
    }

    return response;
  }
}

// ============================================================================
// Example Middleware Implementations
// ============================================================================

/**
 * 1. Authentication Middleware
 */
function authenticationMiddleware(req: Request, next: () => Promise<Response>): Promise<Response> {
  console.log(`[AUTH] Checking authentication for ${req.method} ${req.url}`);

  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log(`[AUTH] ❌ Missing or invalid authorization header`);
    return Promise.resolve({
      status: 401,
      headers: { "content-type": "application/json", "www-authenticate": 'Bearer realm="proxy"' },
      body: new TextEncoder().encode(
        JSON.stringify({ error: "Unauthorized", message: "Missing or invalid token" }),
      ),
      metadata: {},
    });
  }

  const token = authHeader.substring(7);

  // Validate token (simplified - in production, verify JWT signature, check expiry, etc.)
  if (token !== "valid-token-12345") {
    console.log(`[AUTH] ❌ Invalid token`);
    return Promise.resolve({
      status: 403,
      headers: { "content-type": "application/json" },
      body: new TextEncoder().encode(
        JSON.stringify({ error: "Forbidden", message: "Invalid token" }),
      ),
      metadata: {},
    });
  }

  console.log(`[AUTH] ✓ Authentication successful`);

  // Store user info in metadata for downstream middleware
  req.metadata.userId = "user-123";
  req.metadata.userRole = "admin";

  return next();
}

/**
 * 2. Rate Limiting Middleware
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimitMiddleware(maxRequests: number, windowMs: number): RequestHandler {
  return async (req: Request, next: () => Promise<Response>): Promise<Response> => {
    const clientId = req.metadata.userId || req.headers["x-forwarded-for"] || "anonymous";
    const now = Date.now();

    let bucket = rateLimitStore.get(clientId);

    if (!bucket || now > bucket.resetAt) {
      // Create new bucket
      bucket = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(clientId, bucket);
    }

    bucket.count++;

    console.log(`[RATE LIMIT] ${clientId}: ${bucket.count}/${maxRequests} requests`);

    if (bucket.count > maxRequests) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      console.log(`[RATE LIMIT] ❌ Limit exceeded for ${clientId}`);

      return {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": retryAfter.toString(),
          "x-ratelimit-limit": maxRequests.toString(),
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": Math.floor(bucket.resetAt / 1000).toString(),
        },
        body: new TextEncoder().encode(JSON.stringify({
          error: "Too Many Requests",
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds`,
        })),
        metadata: {},
      };
    }

    // Add rate limit headers
    req.metadata.rateLimit = {
      limit: maxRequests,
      remaining: maxRequests - bucket.count,
      reset: bucket.resetAt,
    };

    return next();
  };
}

/**
 * 3. Request Logging Middleware
 */
function requestLoggingMiddleware(req: Request, next: () => Promise<Response>): Promise<Response> {
  const startTime = Date.now();

  console.log(`\n${"=".repeat(70)}`);
  console.log(`[REQUEST LOG] ${req.id}`);
  console.log(`  ${req.method} ${req.url}`);
  console.log(`  Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`  User: ${req.metadata.userId || "anonymous"}`);

  return next().then((response) => {
    const duration = Date.now() - startTime;
    console.log(`[RESPONSE LOG] ${req.id}`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Duration: ${duration}ms`);
    console.log("=".repeat(70) + "\n");
    return response;
  });
}

/**
 * 4. Request Transformation Middleware
 */
function requestTransformMiddleware(
  req: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  console.log(`[TRANSFORM] Modifying request headers`);

  // Add custom headers
  req.headers["x-proxy-version"] = "1.0.0";
  req.headers["x-request-id"] = req.id;

  // Remove identifying headers for anonymity
  delete req.headers["x-forwarded-for"];
  delete req.headers["via"];

  // Modify URL (e.g., rewrite paths)
  if (req.url.includes("/api/v1/")) {
    req.url = req.url.replace("/api/v1/", "/api/v2/");
    console.log(`[TRANSFORM] Rewrote URL to ${req.url}`);
  }

  return next();
}

/**
 * 5. Response Transformation Middleware (CORS)
 */
async function corsMiddleware(req: Request, res: Response): Promise<Response> {
  console.log(`[CORS] Adding CORS headers`);

  // Add CORS headers
  res.headers["access-control-allow-origin"] = "*";
  res.headers["access-control-allow-methods"] = "GET, POST, PUT, DELETE, OPTIONS";
  res.headers["access-control-allow-headers"] = "Content-Type, Authorization";
  res.headers["access-control-max-age"] = "86400";

  return res;
}

/**
 * 6. Response Security Headers Middleware
 */
async function securityHeadersMiddleware(req: Request, res: Response): Promise<Response> {
  console.log(`[SECURITY] Adding security headers`);

  res.headers["strict-transport-security"] = "max-age=31536000; includeSubDomains";
  res.headers["x-content-type-options"] = "nosniff";
  res.headers["x-frame-options"] = "DENY";
  res.headers["x-xss-protection"] = "1; mode=block";
  res.headers["content-security-policy"] = "default-src 'self'";

  return res;
}

/**
 * 7. Response Compression Middleware (simulated)
 */
async function compressionMiddleware(req: Request, res: Response): Promise<Response> {
  const acceptEncoding = req.headers["accept-encoding"] || "";

  if (acceptEncoding.includes("gzip") && res.body.length > 1024) {
    console.log(`[COMPRESSION] Compressing response (${res.body.length} bytes → simulated gzip)`);

    // In real implementation, use CompressionStream
    // const compressed = await compressGzip(res.body);
    // res.body = compressed;
    res.headers["content-encoding"] = "gzip";
    res.headers["vary"] = "Accept-Encoding";

    // Simulate compression (just log, don't actually compress in this example)
    console.log(`[COMPRESSION] Response would be compressed`);
  }

  return res;
}

/**
 * 8. Response Caching Info Middleware
 */
async function cacheInfoMiddleware(req: Request, res: Response): Promise<Response> {
  if (req.metadata.cacheHit) {
    res.headers["x-cache"] = "HIT";
    res.headers["x-cache-age"] = req.metadata.cacheAge?.toString() || "0";
    console.log(`[CACHE INFO] Response served from cache`);
  } else {
    res.headers["x-cache"] = "MISS";
    console.log(`[CACHE INFO] Response served from origin`);
  }

  return res;
}

// ============================================================================
// Usage Example
// ============================================================================

const interceptor = new MiddlewareInterceptor();

// Add request middleware (executes in order)
interceptor.useRequest(requestLoggingMiddleware);
interceptor.useRequest(authenticationMiddleware);
interceptor.useRequest(rateLimitMiddleware(10, 60000)); // 10 requests per minute
interceptor.useRequest(requestTransformMiddleware);

// Add response middleware (executes in reverse order)
interceptor.useResponse(cacheInfoMiddleware);
interceptor.useResponse(compressionMiddleware);
interceptor.useResponse(corsMiddleware);
interceptor.useResponse(securityHeadersMiddleware);

// Simulate origin handler
async function originHandler(): Promise<Response> {
  console.log(`[ORIGIN] Processing request at origin server`);

  // Simulate origin processing
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
    body: new TextEncoder().encode(JSON.stringify({
      message: "Hello from origin",
      timestamp: new Date().toISOString(),
    })),
    metadata: {},
  };
}

// Example requests
console.log("=== Middleware Interceptor Demo ===\n");

const request1: Request = {
  id: "req-001",
  method: "GET",
  url: "http://api.example.com/api/v1/users",
  headers: {
    "authorization": "Bearer valid-token-12345",
    "accept-encoding": "gzip, deflate",
  },
  metadata: {},
};

console.log("--- Request 1: Valid authentication ---");
const response1 = await interceptor.executeRequest(request1, originHandler);
console.log(`Final response status: ${response1.status}`);
console.log(`Response headers:`, JSON.stringify(response1.headers, null, 2));

// Simulate second request without auth
console.log("\n--- Request 2: Missing authentication ---");
const request2: Request = {
  id: "req-002",
  method: "GET",
  url: "http://api.example.com/users",
  headers: {},
  metadata: {},
};

const response2 = await interceptor.executeRequest(request2, originHandler);
console.log(`Final response status: ${response2.status}`);

console.log("\n=== Key Benefits ===");
console.log("✓ Modular and composable architecture");
console.log("✓ Easy to add/remove/reorder middleware");
console.log("✓ Separation of concerns (auth, logging, rate limiting, etc.)");
console.log("✓ Reusable middleware across different proxies");
console.log("✓ Can short-circuit request processing for efficiency");
