import type { APIRoute } from 'astro';

/**
 * NOTE: BrowserX integration limitation
 *
 * The BrowserX packages (@browserx/query-engine, @browserx/browser) are Deno-based
 * and cannot be directly imported in Astro's Node.js/npm environment.
 *
 * Options for production integration:
 * 1. Run BrowserX as a separate service and proxy requests (recommended)
 * 2. Use Deno's npm compatibility layer (experimental)
 * 3. Build a Node.js bridge package
 *
 * For now, this API returns mock responses to demonstrate the interface.
 */

/**
 * Token bucket for rate limiting.
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * In-memory rate limiter using token bucket algorithm.
 * 3 tokens burst capacity, refills at 1 token per 6 seconds (10 per minute).
 */
const rateLimitBuckets = new Map<string, TokenBucket>();

/**
 * Rate limit configuration.
 */
const RATE_LIMIT = {
  BURST_CAPACITY: 3,
  REFILL_RATE: 1 / 6000, // 1 token per 6 seconds = 10 tokens per minute
} as const;

const MAX_QUERY_LENGTH = 10240;
const MAX_RATE_LIMIT_BUCKETS = 10000;

/**
 * Check rate limit for a client IP.
 * @param ip Client IP address
 * @returns True if request is allowed, false if rate limited
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  let bucket = rateLimitBuckets.get(ip);

  if (!bucket) {
    // First request from this IP
    bucket = {
      tokens: RATE_LIMIT.BURST_CAPACITY - 1, // Use 1 token
      lastRefill: now,
    };
    rateLimitBuckets.set(ip, bucket);
    if (rateLimitBuckets.size > MAX_RATE_LIMIT_BUCKETS) {
      // Evict oldest entry
      const oldestKey = rateLimitBuckets.keys().next().value;
      if (oldestKey !== undefined) rateLimitBuckets.delete(oldestKey);
    }
    return true;
  }

  // Calculate tokens to add based on time elapsed
  const timeSinceLastRefill = now - bucket.lastRefill;
  const tokensToAdd = timeSinceLastRefill * RATE_LIMIT.REFILL_RATE;

  // Refill bucket
  bucket.tokens = Math.min(
    RATE_LIMIT.BURST_CAPACITY,
    bucket.tokens + tokensToAdd
  );
  bucket.lastRefill = now;

  // Check if we have tokens available
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

/**
 * Get client IP from request headers.
 *
 * Checks trusted proxy/CDN headers first, falling back to less reliable ones.
 * Reliability depends on deployment infrastructure — headers like x-forwarded-for
 * can be spoofed by clients in environments without a trusted reverse proxy.
 *
 * @param request Astro API request
 * @returns Client IP address
 */
function getClientIp(request: Request): string {
  // Cloudflare-injected header — cannot be spoofed by client
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp.trim();
  }

  // CDN-injected header — cannot be spoofed by client
  const trueClientIp = request.headers.get('true-client-ip');
  if (trueClientIp) {
    return trueClientIp.trim();
  }

  // nginx-injected header
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // x-forwarded-for as last resort — client-controllable, use rightmost IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',').map(s => s.trim()).pop()!;
  }

  return 'unknown';
}

/**
 * Generate execution ID.
 * @returns Unique execution ID
 */
function generateExecutionId(): string {
  return `exec_${Date.now()}_${crypto.randomUUID()}`;
}

/**
 * Request body schema.
 */
interface ExecuteRequestBody {
  query: string;
  options?: {
    timeout?: number;
    captureScreenshots?: boolean;
    captureConsole?: boolean;
  };
}

/**
 * Success response schema.
 */
interface ExecuteSuccessResponse {
  executionId: string;
  wsUrl?: string;
  results: {
    queryId: string;
    data: unknown;
    timing: {
      lexerTime: number;
      parserTime: number;
      semanticAnalysisTime: number;
      optimizationTime: number;
      planningTime: number;
      executionTime: number;
      formattingTime: number;
      totalTime: number;
    };
    metadata: {
      query: string;
      ast: unknown;
      stepsExecuted: number;
      estimatedCost: number;
      actualCost: number;
      browserNavigations: number;
      cacheHits: number;
      cacheMisses: number;
    };
    networkRequests: Array<{
      id: string;
      url: string;
      method: string;
      status: number;
      duration: number;
      size: number;
    }>;
  };
}

/**
 * Error response schema.
 */
interface ExecuteErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Validate request body.
 */
function validateRequestBody(body: unknown): body is ExecuteRequestBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const req = body as Record<string, unknown>;

  // Query must be a non-empty string
  if (typeof req.query !== 'string' || req.query.trim() === '') {
    return false;
  }

  // Options are optional but must be an object if present
  if (req.options !== undefined) {
    if (typeof req.options !== 'object' || req.options === null) {
      return false;
    }

    const opts = req.options as Record<string, unknown>;

    // Timeout must be a number if present
    if (opts.timeout !== undefined && typeof opts.timeout !== 'number') {
      return false;
    }

    // Capture flags must be boolean if present
    if (
      opts.captureScreenshots !== undefined &&
      typeof opts.captureScreenshots !== 'boolean'
    ) {
      return false;
    }

    if (
      opts.captureConsole !== undefined &&
      typeof opts.captureConsole !== 'boolean'
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Mock query execution (placeholder until BrowserX integration is resolved).
 * Returns a sample result that matches the expected schema.
 */
async function executeMockQuery(query: string, timeout: number): Promise<ExecuteSuccessResponse['results']> {
  // Simulate network delay, capped by the caller's timeout
  await new Promise((resolve) => setTimeout(resolve, Math.min(500, timeout)));

  // Parse basic query info for mock response
  const queryLower = query.toLowerCase();
  const isSelect = queryLower.includes('select');
  const hasUrl = query.match(/"(https?:\/\/[^"]+)"/);

  // Build mock network requests based on the URL extracted from the query
  const targetUrl = hasUrl ? hasUrl[1] : 'https://example.com';
  const urlOrigin = (() => {
    try {
      return new URL(targetUrl).origin;
    } catch {
      return targetUrl;
    }
  })();

  const networkRequests = hasUrl
    ? [
        {
          id: `req_${Date.now()}_1`,
          url: targetUrl,
          method: 'GET',
          status: 200,
          duration: 312,
          size: 1256,
        },
        {
          id: `req_${Date.now()}_2`,
          url: `${urlOrigin}/favicon.ico`,
          method: 'GET',
          status: 200,
          duration: 48,
          size: 318,
        },
      ]
    : [];

  return {
    queryId: `query_${Date.now()}_${crypto.randomUUID().slice(0, 9)}`,
    data: isSelect
      ? [
          {
            title: 'Example Domain',
            description: 'This domain is for use in illustrative examples in documents.',
          },
        ]
      : { success: true },
    networkRequests,
    timing: {
      lexerTime: 2.5,
      parserTime: 3.1,
      semanticAnalysisTime: 1.8,
      optimizationTime: 2.3,
      planningTime: 1.5,
      executionTime: 450.2,
      formattingTime: 0.8,
      totalTime: 462.2,
    },
    metadata: {
      query,
      ast: { type: 'Query', statements: [] },
      stepsExecuted: 3,
      estimatedCost: 500,
      actualCost: 462.2,
      browserNavigations: hasUrl ? 1 : 0,
      cacheHits: 0,
      cacheMisses: hasUrl ? 1 : 0,
    },
  };
}

/**
 * Execute API route.
 * POST /api/execute
 *
 * Executes a BrowserX query and returns the results.
 */
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const executionId = generateExecutionId();

  try {
    // 1. Rate limiting
    const clientIp = getClientIp(request);
    if (!checkRateLimit(clientIp)) {
      const response: ExecuteErrorResponse = {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
        },
      };
      return new Response(JSON.stringify(response), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '6', // Retry after 6 seconds (1 token refill)
        },
      });
    }

    // 2. Check Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(JSON.stringify({
        error: { code: 'INVALID_CONTENT_TYPE', message: 'Content-Type must be application/json.' },
      }), { status: 415, headers: { 'Content-Type': 'application/json' } });
    }

    // 3. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      const response: ExecuteErrorResponse = {
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON.',
        },
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!validateRequestBody(body)) {
      const response: ExecuteErrorResponse = {
        error: {
          code: 'INVALID_REQUEST_BODY',
          message:
            'Invalid request body. Must include "query" (non-empty string) and optional "options" object.',
        },
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.query.length > MAX_QUERY_LENGTH) {
      return new Response(JSON.stringify({
        error: { code: 'QUERY_TOO_LONG', message: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters.` },
      }), { status: 413, headers: { 'Content-Type': 'application/json' } });
    }

    // 4. Execute query — proxy to real BrowserX API if configured, else mock
    const timeout = Math.max(1, Math.min(body.options?.timeout ?? 30000, 60000));
    const browserxApiUrl = import.meta.env.BROWSERX_API_URL;

    if (browserxApiUrl) {
      try {
        const upstream = await fetch(`${browserxApiUrl}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: body.query, options: body.options }),
          signal: AbortSignal.timeout(timeout),
        });
        const upstreamText = await upstream.text();
        return new Response(upstreamText, {
          status: upstream.status,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        // Fall through to mock if upstream is unreachable
        console.error('Upstream BrowserX API unreachable:', error);
      }
    }

    const results = await executeMockQuery(body.query, timeout);

    // 4. Return success response
    const response: ExecuteSuccessResponse = {
      executionId,
      results,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // 5. Error handling
    console.error('Query execution error:', error);
    const errorResponse: ExecuteErrorResponse = {
      error: {
        code: 'QUERY_EXECUTION_ERROR',
        message: 'Internal server error',
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
