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
  REFILL_RATE: 1 / 6000, // 1 token per 6 seconds (ms)
  MAX_TOKENS_PER_MINUTE: 10,
} as const;

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
 * @param request Astro API request
 * @returns Client IP address
 */
function getClientIp(request: Request): string {
  // Check x-forwarded-for header first (for proxies/load balancers)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, use the first one
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback to x-real-ip
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a default (shouldn't happen in production with proper proxy setup)
  return 'unknown';
}

/**
 * Generate execution ID.
 * @returns Unique execution ID
 */
function generateExecutionId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
async function executeMockQuery(query: string, timeout: number): Promise<unknown> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Parse basic query info for mock response
  const queryLower = query.toLowerCase();
  const isSelect = queryLower.includes('select');
  const hasUrl = query.match(/"(https?:\/\/[^"]+)"/);

  return {
    queryId: `query_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    data: isSelect
      ? [
          {
            title: 'Example Domain',
            description: 'This domain is for use in illustrative examples in documents.',
          },
        ]
      : { success: true },
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

    // 2. Parse and validate request body
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

    // 3. Execute query (mock for now)
    const timeout = body.options?.timeout ?? 30000;
    const result = await executeMockQuery(body.query, timeout);

    // 4. Return success response
    const response: ExecuteSuccessResponse = {
      executionId,
      results: result,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // 5. Error handling
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    const errorResponse: ExecuteErrorResponse = {
      error: {
        code: 'QUERY_EXECUTION_ERROR',
        message: errorMessage,
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
