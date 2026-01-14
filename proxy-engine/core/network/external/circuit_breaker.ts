/**
 * Circuit Breaker Pattern
 *
 * Prevent cascading failures to external services
 */

/**
 * Circuit breaker state
 */
export enum CircuitState {
  CLOSED = "CLOSED", // Normal operation
  OPEN = "OPEN", // Failing, reject requests
  HALF_OPEN = "HALF_OPEN", // Testing recovery
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /**
   * Failure threshold to open circuit
   */
  failureThreshold: number;

  /**
   * Success threshold to close circuit from half-open
   */
  successThreshold: number;

  /**
   * Timeout before trying half-open (ms)
   */
  timeout: number;

  /**
   * Reset timeout after successful recovery (ms)
   */
  resetTimeout: number;

  /**
   * Time window for counting failures (ms)
   */
  windowSize: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 1 minute
  resetTimeout: 10000, // 10 seconds
  windowSize: 10000, // 10 seconds
};

/**
 * Circuit breaker error
 */
export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly state: CircuitState) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

/**
 * Circuit Breaker
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number[] = []; // Timestamps of failures
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private nextAttemptTime: number = 0;
  private listeners: Array<(state: CircuitState) => void> = [];

  constructor(
    private readonly name: string,
    config: Partial<CircuitBreakerConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute function with circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();

      // Check if timeout has passed
      if (now < this.nextAttemptTime) {
        throw new CircuitBreakerError(
          `Circuit breaker '${this.name}' is OPEN`,
          this.state,
        );
      }

      // Try half-open
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    try {
      const result = await fn();

      // Record success
      this.onSuccess();

      return result;
    } catch (error) {
      // Record failure
      this.onFailure();

      throw error;
    }
  }

  /**
   * Record success
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;

      if (this.successes >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.reset();
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Remove old failures outside window
      this.cleanFailures();
    }
  }

  /**
   * Record failure
   */
  private onFailure(): void {
    const now = Date.now();
    this.lastFailureTime = now;
    this.failures.push(now);

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery, back to open
      this.transitionTo(CircuitState.OPEN);
      this.nextAttemptTime = now + this.config.timeout;
    } else if (this.state === CircuitState.CLOSED) {
      // Clean old failures
      this.cleanFailures();

      // Check if threshold exceeded
      if (this.failures.length >= this.config.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
        this.nextAttemptTime = now + this.config.timeout;
      }
    }
  }

  /**
   * Clean failures outside time window
   */
  private cleanFailures(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowSize;
    this.failures = this.failures.filter((time) => time >= cutoff);
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    console.log(
      `Circuit breaker '${this.name}': ${oldState} -> ${newState}`,
    );

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(newState);
      } catch (error) {
        console.error("Error in circuit breaker listener:", error);
      }
    }
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.failures = [];
    this.successes = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
  }

  /**
   * Force open circuit
   */
  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN);
    this.nextAttemptTime = Date.now() + this.config.timeout;
  }

  /**
   * Force close circuit
   */
  forceClose(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.reset();
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Get failure count in current window
   */
  getFailureCount(): number {
    this.cleanFailures();
    return this.failures.length;
  }

  /**
   * Get success count in half-open state
   */
  getSuccessCount(): number {
    return this.successes;
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(listener: (state: CircuitState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    name: string;
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailure: number;
    nextAttempt: number;
  } {
    this.cleanFailures();

    return {
      name: this.name,
      state: this.state,
      failures: this.failures.length,
      successes: this.successes,
      lastFailure: this.lastFailureTime,
      nextAttempt: this.nextAttemptTime,
    };
  }
}

/**
 * Circuit breaker registry
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create circuit breaker
   */
  get(
    name: string,
    config?: Partial<CircuitBreakerConfig>,
  ): CircuitBreaker {
    let breaker = this.breakers.get(name);

    if (!breaker) {
      breaker = new CircuitBreaker(name, config);
      this.breakers.set(name, breaker);
    }

    return breaker;
  }

  /**
   * Remove circuit breaker
   */
  remove(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * Get all breakers
   */
  getAll(): CircuitBreaker[] {
    return Array.from(this.breakers.values());
  }

  /**
   * Get all breaker stats
   */
  getAllStats(): Array<ReturnType<CircuitBreaker["getStats"]>> {
    return this.getAll().map((breaker) => breaker.getStats());
  }

  /**
   * Clear all breakers
   */
  clear(): void {
    this.breakers.clear();
  }
}

/**
 * Global circuit breaker registry
 */
export const globalCircuitBreakers = new CircuitBreakerRegistry();
