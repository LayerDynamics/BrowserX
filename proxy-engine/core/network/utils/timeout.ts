/**
 * Timeout Management Utilities
 *
 * Centralized timeout handling with AbortController
 */

/**
 * Create timeout with AbortController
 */
export function createTimeout(ms: number): AbortController {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Operation timed out after ${ms}ms`));
  }, ms);

  // Clean up timeout if aborted manually
  controller.signal.addEventListener("abort", () => {
    clearTimeout(timeoutId);
  }, { once: true });

  return controller;
}

/**
 * Execute function with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string,
): Promise<T> {
  const controller = createTimeout(ms);

  try {
    const race = Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(
            new TimeoutError(
              message || `Operation timed out after ${ms}ms`,
              ms,
            ),
          );
        });
      }),
    ]);

    return await race;
  } finally {
    controller.abort(); // Clean up
  }
}

/**
 * Timeout error class
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeout: number,
  ) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Create combined AbortController from multiple signals
 */
export function combineAbortSignals(
  ...signals: AbortSignal[]
): AbortController {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }

    signal.addEventListener("abort", () => {
      controller.abort(signal.reason);
    }, { once: true });
  }

  return controller;
}

/**
 * Create timeout signal
 */
export function timeoutSignal(ms: number): AbortSignal {
  return createTimeout(ms).signal;
}

/**
 * Check if error is timeout error
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError ||
    (error instanceof Error && error.name === "TimeoutError");
}

/**
 * Timeout manager for tracking multiple timeouts
 */
export class TimeoutManager {
  private timeouts: Map<string, number> = new Map();
  private controllers: Map<string, AbortController> = new Map();

  /**
   * Set timeout with ID
   */
  setTimeout(id: string, ms: number, callback: () => void): void {
    this.clearTimeout(id);

    const timeoutId = setTimeout(() => {
      this.controllers.delete(id);
      this.timeouts.delete(id);
      callback();
    }, ms);

    this.timeouts.set(id, timeoutId);
  }

  /**
   * Clear timeout by ID
   */
  clearTimeout(id: string): void {
    const timeoutId = this.timeouts.get(id);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      this.timeouts.delete(id);
    }

    const controller = this.controllers.get(id);
    if (controller) {
      controller.abort();
      this.controllers.delete(id);
    }
  }

  /**
   * Create timeout controller with ID
   */
  createTimeoutController(id: string, ms: number): AbortController {
    this.clearTimeout(id);

    const controller = createTimeout(ms);
    this.controllers.set(id, controller);

    controller.signal.addEventListener("abort", () => {
      this.controllers.delete(id);
    }, { once: true });

    return controller;
  }

  /**
   * Clear all timeouts
   */
  clearAll(): void {
    for (const id of this.timeouts.keys()) {
      this.clearTimeout(id);
    }
  }

  /**
   * Get active timeout count
   */
  get activeCount(): number {
    return this.timeouts.size + this.controllers.size;
  }
}

/**
 * Deadline tracker
 */
export class Deadline {
  private readonly endTime: number;

  constructor(ms: number) {
    this.endTime = Date.now() + ms;
  }

  /**
   * Get remaining time in milliseconds
   */
  get remaining(): number {
    return Math.max(0, this.endTime - Date.now());
  }

  /**
   * Check if deadline has passed
   */
  get isExpired(): boolean {
    return this.remaining === 0;
  }

  /**
   * Create AbortController that aborts at deadline
   */
  createController(): AbortController {
    return createTimeout(this.remaining);
  }

  /**
   * Execute function with remaining time as timeout
   */
  async execute<T>(promise: Promise<T>, message?: string): Promise<T> {
    if (this.isExpired) {
      throw new TimeoutError(message || "Deadline already expired", 0);
    }

    return withTimeout(promise, this.remaining, message);
  }
}

/**
 * Idle timeout tracker
 */
export class IdleTimeout {
  private timeoutId?: number;
  private lastActivity: number;

  constructor(
    private readonly ms: number,
    private readonly onTimeout: () => void,
  ) {
    this.lastActivity = Date.now();
    this.reset();
  }

  /**
   * Reset idle timer
   */
  reset(): void {
    this.lastActivity = Date.now();

    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.onTimeout();
    }, this.ms);
  }

  /**
   * Cancel idle timeout
   */
  cancel(): void {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }

  /**
   * Get time since last activity
   */
  get idleTime(): number {
    return Date.now() - this.lastActivity;
  }

  /**
   * Get remaining time until timeout
   */
  get remaining(): number {
    return Math.max(0, this.ms - this.idleTime);
  }
}

/**
 * Debounce function with timeout
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  ms: number,
): T {
  let timeoutId: number | undefined;

  return ((...args: any[]) => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, ms);
  }) as T;
}

/**
 * Throttle function with timeout
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  ms: number,
): T {
  let lastCall = 0;
  let timeoutId: number | undefined;

  return ((...args: any[]) => {
    const now = Date.now();

    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    } else {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
      }, ms - (now - lastCall));
    }
  }) as T;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sleep with AbortSignal support
 */
export function sleepWithSignal(
  ms: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    signal?.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      reject(signal.reason);
    }, { once: true });
  });
}
