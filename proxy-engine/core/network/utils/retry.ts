/**
 * Retry Logic Utilities
 *
 * Exponential backoff and retry strategies
 */

/**
 * Retry configuration
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts
   */
  maxAttempts: number;

  /**
   * Initial delay in milliseconds
   */
  initialDelay: number;

  /**
   * Maximum delay in milliseconds
   */
  maxDelay: number;

  /**
   * Backoff multiplier (default: 2 for exponential backoff)
   */
  backoffMultiplier: number;

  /**
   * Add random jitter to delays (0-1, where 1 = 100% jitter)
   */
  jitter: number;

  /**
   * Function to determine if error is retryable
   */
  isRetryable?: (error: Error) => boolean;

  /**
   * Callback on each retry attempt
   */
  onRetry?: (attempt: number, error: Error, delay: number) => void;

  /**
   * AbortSignal to cancel retries
   */
  signal?: AbortSignal;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: 0.1,
};

/**
 * Retry with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error;
  let attempt = 0;

  while (attempt < cfg.maxAttempts) {
    // Check if aborted
    if (cfg.signal?.aborted) {
      throw new Error("Retry aborted");
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++;

      // Check if retryable
      if (cfg.isRetryable && !cfg.isRetryable(lastError)) {
        throw lastError;
      }

      // Don't delay after last attempt
      if (attempt >= cfg.maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = calculateDelay(attempt, cfg);

      // Call retry callback
      cfg.onRetry?.(attempt, lastError, delay);

      // Wait before retrying
      await sleep(delay, cfg.signal);
    }
  }

  throw lastError!;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff
  const exponentialDelay = config.initialDelay *
    Math.pow(config.backoffMultiplier, attempt - 1);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

  // Add jitter
  const jitterAmount = cappedDelay * config.jitter;
  const jitter = (Math.random() - 0.5) * 2 * jitterAmount;

  return Math.max(0, cappedDelay + jitter);
}

/**
 * Sleep with abort signal support
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    signal?.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      reject(new Error("Aborted"));
    }, { once: true });
  });
}

/**
 * Retry with linear backoff
 */
export async function retryLinear<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  return retry(fn, {
    ...config,
    backoffMultiplier: 1, // Linear = no exponential growth
  });
}

/**
 * Retry with constant delay
 */
export async function retryConstant<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delay: number,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  return retry(fn, {
    ...config,
    maxAttempts,
    initialDelay: delay,
    maxDelay: delay,
    backoffMultiplier: 1,
    jitter: 0,
  });
}

/**
 * Retry only on specific errors
 */
export function retryOn<T>(
  fn: () => Promise<T>,
  errorTypes: (new (...args: any[]) => Error)[],
  config: Partial<RetryConfig> = {},
): Promise<T> {
  return retry(fn, {
    ...config,
    isRetryable: (error) => {
      return errorTypes.some((ErrorType) => error instanceof ErrorType);
    },
  });
}

/**
 * Retry until condition is met
 */
export async function retryUntil<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let attempt = 0;

  while (attempt < cfg.maxAttempts) {
    if (cfg.signal?.aborted) {
      throw new Error("Retry aborted");
    }

    const result = await fn();

    if (condition(result)) {
      return result;
    }

    attempt++;

    if (attempt < cfg.maxAttempts) {
      const delay = calculateDelay(attempt, cfg);
      await sleep(delay, cfg.signal);
    }
  }

  throw new Error(
    `Condition not met after ${cfg.maxAttempts} attempts`,
  );
}

/**
 * Retry statistics
 */
export interface RetryStats {
  attempts: number;
  totalDelay: number;
  lastError?: Error;
  success: boolean;
}

/**
 * Retry with statistics tracking
 */
export async function retryWithStats<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<{ result: T; stats: RetryStats }> {
  const stats: RetryStats = {
    attempts: 0,
    totalDelay: 0,
    success: false,
  };

  const cfg: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
    onRetry: (attempt, error, delay) => {
      stats.attempts = attempt;
      stats.lastError = error;
      stats.totalDelay += delay;
      config.onRetry?.(attempt, error, delay);
    },
  };

  try {
    const result = await retry(fn, cfg);
    stats.success = true;
    stats.attempts = stats.attempts || 1;
    return { result, stats };
  } catch (error) {
    stats.lastError = error instanceof Error ? error : new Error(String(error));
    stats.attempts++;
    throw error;
  }
}

/**
 * Common retryable error checkers
 */
export const RetryableErrors = {
  /**
   * Network errors (connection, timeout, DNS)
   */
  isNetworkError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("etimedout") ||
      message.includes("dns")
    );
  },

  /**
   * HTTP 5xx errors (server errors)
   */
  isServerError(error: Error & { status?: number }): boolean {
    return error.status !== undefined && error.status >= 500 &&
      error.status < 600;
  },

  /**
   * HTTP 429 (rate limit)
   */
  isRateLimitError(error: Error & { status?: number }): boolean {
    return error.status === 429;
  },

  /**
   * Temporary errors (network, server, rate limit)
   */
  isTemporaryError(error: Error & { status?: number }): boolean {
    return (
      this.isNetworkError(error) ||
      this.isServerError(error) ||
      this.isRateLimitError(error)
    );
  },
};

/**
 * Create retry config for network requests
 */
export function createNetworkRetryConfig(
  config: Partial<RetryConfig> = {},
): RetryConfig {
  return {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    isRetryable: RetryableErrors.isTemporaryError,
    ...config,
  };
}

/**
 * Batch retry - retry multiple operations with shared backoff
 */
export async function retryBatch<T>(
  fns: (() => Promise<T>)[],
  config: Partial<RetryConfig> = {},
): Promise<T[]> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const results: T[] = [];
  let attempt = 0;
  let failedIndices = fns.map((_, i) => i);

  while (failedIndices.length > 0 && attempt < cfg.maxAttempts) {
    if (cfg.signal?.aborted) {
      throw new Error("Batch retry aborted");
    }

    const currentIndices = [...failedIndices];
    failedIndices = [];

    for (const idx of currentIndices) {
      try {
        results[idx] = await fns[idx]();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        if (!cfg.isRetryable || cfg.isRetryable(err)) {
          failedIndices.push(idx);
        } else {
          throw err;
        }
      }
    }

    if (failedIndices.length > 0) {
      attempt++;

      if (attempt < cfg.maxAttempts) {
        const delay = calculateDelay(attempt, cfg);
        await sleep(delay, cfg.signal);
      }
    }
  }

  if (failedIndices.length > 0) {
    throw new Error(
      `${failedIndices.length} operations failed after ${cfg.maxAttempts} attempts`,
    );
  }

  return results;
}
