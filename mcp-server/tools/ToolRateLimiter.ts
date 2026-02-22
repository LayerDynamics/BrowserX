export class RateLimitError extends Error {
  constructor(sessionId: string, limit: number, windowMs: number) {
    super(`Rate limit exceeded for session ${sessionId}: ${limit} requests per ${windowMs}ms`);
    this.name = "RateLimitError";
  }
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

export class ToolRateLimiter {
  private windows = new Map<string, WindowEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(sessionId: string): void {
    const now = Date.now();
    let entry = this.windows.get(sessionId);

    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      entry = { count: 0, windowStart: now };
      this.windows.set(sessionId, entry);
    }

    entry.count++;
    if (entry.count > this.config.maxRequests) {
      throw new RateLimitError(sessionId, this.config.maxRequests, this.config.windowMs);
    }
  }
}
