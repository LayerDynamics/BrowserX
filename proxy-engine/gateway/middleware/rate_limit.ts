/**
 * Rate Limiting Middleware
 *
 * Token bucket and sliding window rate limiting algorithms
 */

import type { MiddlewareResult, RequestContext, RequestMiddleware } from "./types.ts";
import type { HTTPRequest, HTTPResponse } from "../../core/network/transport/http/http.ts";

/**
 * Rate limit algorithm
 */
export type RateLimitAlgorithm = "token_bucket" | "sliding_window" | "fixed_window";

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Algorithm to use
   */
  algorithm: RateLimitAlgorithm;

  /**
   * Maximum requests per window
   */
  maxRequests: number;

  /**
   * Window duration in milliseconds
   */
  windowMs: number;

  /**
   * Key generator function (default: uses client IP)
   */
  keyGenerator?: (request: HTTPRequest, context: RequestContext) => string;

  /**
   * Skip rate limiting for certain requests
   */
  skip?: (request: HTTPRequest, context: RequestContext) => boolean;

  /**
   * Custom headers to add to response
   */
  headers?: {
    /**
     * Add X-RateLimit-Limit header
     */
    limit?: boolean;

    /**
     * Add X-RateLimit-Remaining header
     */
    remaining?: boolean;

    /**
     * Add X-RateLimit-Reset header
     */
    reset?: boolean;

    /**
     * Add Retry-After header when limited
     */
    retryAfter?: boolean;
  };

  /**
   * Custom response when rate limited
   */
  onLimitReached?: (
    request: HTTPRequest,
    context: RequestContext,
  ) => HTTPResponse;
}

/**
 * Rate limit state for a key
 */
interface RateLimitState {
  /**
   * Number of tokens/requests available
   */
  tokens: number;

  /**
   * Last refill/reset time
   */
  lastRefill: number;

  /**
   * Request timestamps (for sliding window)
   */
  timestamps?: number[];
}

/**
 * Rate limiting middleware
 */
export class RateLimitMiddleware implements RequestMiddleware {
  readonly name = "rate_limit";

  private state: Map<string, RateLimitState> = new Map();
  private cleanupIntervalId?: number;

  constructor(private config: RateLimitConfig) {
    // Start cleanup interval
    this.startCleanup();
  }

  async processRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<MiddlewareResult> {
    // Check if request should be skipped
    if (this.config.skip && this.config.skip(request, context)) {
      return { type: "continue" };
    }

    // Generate key for rate limiting
    const key = this.config.keyGenerator
      ? this.config.keyGenerator(request, context)
      : context.clientIP;

    // Check rate limit
    const result = this.checkRateLimit(key);

    if (!result.allowed) {
      // Rate limit exceeded
      const response = this.config.onLimitReached
        ? this.config.onLimitReached(request, context)
        : this.createRateLimitResponse(result.retryAfter);

      // Add rate limit headers if configured
      if (this.config.headers) {
        this.addRateLimitHeaders(response, result);
      }

      return { type: "respond", response };
    }

    // Store rate limit info in context for response middleware
    context.metadata.rateLimit = {
      limit: this.config.maxRequests,
      remaining: result.remaining,
      reset: result.resetTime,
    };

    return { type: "continue" };
  }

  /**
   * Check rate limit for key
   */
  private checkRateLimit(key: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    switch (this.config.algorithm) {
      case "token_bucket":
        return this.checkTokenBucket(key);

      case "sliding_window":
        return this.checkSlidingWindow(key);

      case "fixed_window":
        return this.checkFixedWindow(key);

      default:
        throw new Error(`Unknown rate limit algorithm: ${this.config.algorithm}`);
    }
  }

  /**
   * Token bucket algorithm
   * Tokens are added at a constant rate, consumed by requests
   */
  private checkTokenBucket(key: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const now = Date.now();
    let state = this.state.get(key);

    if (!state) {
      // First request from this key
      state = {
        tokens: this.config.maxRequests - 1,
        lastRefill: now,
      };
      this.state.set(key, state);

      return {
        allowed: true,
        remaining: state.tokens,
        resetTime: now + this.config.windowMs,
      };
    }

    // Calculate tokens to add based on time elapsed
    const elapsed = now - state.lastRefill;
    const refillRate = this.config.maxRequests / this.config.windowMs;
    const tokensToAdd = Math.floor(elapsed * refillRate);

    // Refill tokens
    state.tokens = Math.min(
      this.config.maxRequests,
      state.tokens + tokensToAdd,
    );
    state.lastRefill = now;

    // Check if request can proceed
    if (state.tokens > 0) {
      state.tokens--;
      return {
        allowed: true,
        remaining: state.tokens,
        resetTime: now + this.config.windowMs,
      };
    }

    // Rate limited
    const retryAfter = Math.ceil(
      (1 - state.tokens) / refillRate,
    );

    return {
      allowed: false,
      remaining: 0,
      resetTime: now + retryAfter,
      retryAfter,
    };
  }

  /**
   * Sliding window algorithm
   * Tracks exact timestamps of requests
   */
  private checkSlidingWindow(key: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    let state = this.state.get(key);

    if (!state) {
      // First request from this key
      state = {
        tokens: this.config.maxRequests,
        lastRefill: now,
        timestamps: [now],
      };
      this.state.set(key, state);

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs,
      };
    }

    // Remove timestamps outside window
    state.timestamps = state.timestamps!.filter((ts) => ts > windowStart);

    // Check if request can proceed
    if (state.timestamps.length < this.config.maxRequests) {
      state.timestamps.push(now);
      state.lastRefill = now;

      return {
        allowed: true,
        remaining: this.config.maxRequests - state.timestamps.length,
        resetTime: state.timestamps[0] + this.config.windowMs,
      };
    }

    // Rate limited - calculate retry after
    const oldestTimestamp = state.timestamps[0];
    const retryAfter = oldestTimestamp + this.config.windowMs - now;

    return {
      allowed: false,
      remaining: 0,
      resetTime: oldestTimestamp + this.config.windowMs,
      retryAfter,
    };
  }

  /**
   * Fixed window algorithm
   * Simple counter that resets at fixed intervals
   */
  private checkFixedWindow(key: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const now = Date.now();
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
    const resetTime = windowStart + this.config.windowMs;
    let state = this.state.get(key);

    if (!state || state.lastRefill < windowStart) {
      // New window
      state = {
        tokens: this.config.maxRequests - 1,
        lastRefill: windowStart,
      };
      this.state.set(key, state);

      return {
        allowed: true,
        remaining: state.tokens,
        resetTime,
      };
    }

    // Check if request can proceed
    if (state.tokens > 0) {
      state.tokens--;
      return {
        allowed: true,
        remaining: state.tokens,
        resetTime,
      };
    }

    // Rate limited
    const retryAfter = resetTime - now;

    return {
      allowed: false,
      remaining: 0,
      resetTime,
      retryAfter,
    };
  }

  /**
   * Create default rate limit response
   */
  private createRateLimitResponse(retryAfter?: number): HTTPResponse {
    const body = new TextEncoder().encode(
      JSON.stringify({
        error: "Too Many Requests",
        message: "Rate limit exceeded",
        retryAfter,
      }),
    );

    return {
      version: "1.1",
      statusCode: 429,
      statusText: "Too Many Requests",
      headers: {
        "content-type": "application/json",
        "content-length": body.length.toString(),
        ...(retryAfter ? { "retry-after": Math.ceil(retryAfter / 1000).toString() } : {}),
      },
      body,
    };
  }

  /**
   * Add rate limit headers to response
   */
  private addRateLimitHeaders(
    response: HTTPResponse,
    result: {
      remaining: number;
      resetTime: number;
      retryAfter?: number;
    },
  ): void {
    if (this.config.headers?.limit) {
      response.headers["x-ratelimit-limit"] = this.config.maxRequests.toString();
    }

    if (this.config.headers?.remaining) {
      response.headers["x-ratelimit-remaining"] = result.remaining.toString();
    }

    if (this.config.headers?.reset) {
      response.headers["x-ratelimit-reset"] = Math.ceil(result.resetTime / 1000).toString();
    }

    if (this.config.headers?.retryAfter && result.retryAfter) {
      response.headers["retry-after"] = Math.ceil(result.retryAfter / 1000).toString();
    }
  }

  /**
   * Start cleanup interval for old state
   */
  private startCleanup(): void {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanup();
    }, this.config.windowMs);
  }

  /**
   * Cleanup old rate limit state
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowMs * 2; // Keep 2 windows

    for (const [key, state] of this.state.entries()) {
      if (state.lastRefill < cutoff) {
        this.state.delete(key);
      }
    }
  }

  /**
   * Shutdown middleware
   */
  shutdown(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }

    this.state.clear();
  }

  /**
   * Get rate limit statistics
   */
  getStats() {
    return {
      totalKeys: this.state.size,
      algorithm: this.config.algorithm,
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<RateLimitConfig> {
    return { ...this.config };
  }

  /**
   * Get state size
   */
  getStateSize(): number {
    return this.state.size;
  }

  /**
   * Get cleanup interval ID
   */
  getCleanupIntervalId(): number | undefined {
    return this.cleanupIntervalId;
  }

  /**
   * Get rate limit state (returns copy)
   */
  getState(): Map<string, RateLimitState> {
    return new Map(this.state);
  }

  /**
   * Get rate limit statistics
   */
  getRateLimitStats() {
    let totalTokens = 0;
    let keysWithZeroTokens = 0;

    for (const state of this.state.values()) {
      totalTokens += state.tokens;
      if (state.tokens === 0) {
        keysWithZeroTokens++;
      }
    }

    return {
      totalKeys: this.state.size,
      keysWithZeroTokens,
      averageTokensPerKey: this.state.size > 0 ? totalTokens / this.state.size : 0,
    };
  }
}
