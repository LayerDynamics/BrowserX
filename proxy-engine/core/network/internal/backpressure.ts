/**
 * Backpressure Handler
 *
 * Handle backpressure signals between network layers
 */

/**
 * Backpressure signal
 */
export interface BackpressureSignal {
  source: string;
  level: number; // 0-1 (0 = no pressure, 1 = critical)
  timestamp: number;
  reason?: string;
}

/**
 * Backpressure strategy
 */
export type BackpressureStrategy =
  | "drop"
  | "buffer"
  | "throttle"
  | "reject"
  | "pause";

/**
 * Backpressure handler configuration
 */
export interface BackpressureConfig {
  strategy: BackpressureStrategy;
  bufferSize?: number;
  throttleRate?: number;
  pauseThreshold?: number;
  resumeThreshold?: number;
}

/**
 * Backpressure Handler
 */
export class BackpressureHandler {
  private config: BackpressureConfig;
  private buffer: Uint8Array[] = [];
  private paused: boolean = false;
  private pressure: number = 0;
  private listeners: Array<(signal: BackpressureSignal) => void> = [];

  constructor(config: Partial<BackpressureConfig> = {}) {
    this.config = {
      strategy: "buffer",
      bufferSize: 1000,
      throttleRate: 100,
      pauseThreshold: 0.8,
      resumeThreshold: 0.5,
      ...config,
    };
  }

  /**
   * Handle incoming data with backpressure
   */
  async handleData(data: Uint8Array): Promise<boolean> {
    switch (this.config.strategy) {
      case "drop":
        return this.handleDrop(data);
      case "buffer":
        return this.handleBuffer(data);
      case "throttle":
        return this.handleThrottle(data);
      case "reject":
        return this.handleReject(data);
      case "pause":
        return this.handlePause(data);
      default:
        return true;
    }
  }

  /**
   * Drop strategy - drop data when under pressure
   */
  private handleDrop(data: Uint8Array): boolean {
    if (this.pressure > (this.config.pauseThreshold || 0.8)) {
      this.emitSignal({
        source: "backpressure",
        level: this.pressure,
        timestamp: Date.now(),
        reason: "Data dropped due to backpressure",
      });
      return false;
    }
    return true;
  }

  /**
   * Buffer strategy - buffer data up to limit
   */
  private handleBuffer(data: Uint8Array): boolean {
    if (this.buffer.length >= (this.config.bufferSize || 1000)) {
      this.pressure = 1.0;
      this.emitSignal({
        source: "backpressure",
        level: this.pressure,
        timestamp: Date.now(),
        reason: "Buffer full",
      });
      return false;
    }

    this.buffer.push(data);
    this.pressure = this.buffer.length / (this.config.bufferSize || 1000);

    if (this.pressure > (this.config.pauseThreshold || 0.8)) {
      this.emitSignal({
        source: "backpressure",
        level: this.pressure,
        timestamp: Date.now(),
        reason: "Buffer nearly full",
      });
    }

    return true;
  }

  /**
   * Throttle strategy - delay processing
   */
  private async handleThrottle(data: Uint8Array): Promise<boolean> {
    if (this.pressure > (this.config.pauseThreshold || 0.8)) {
      const delay = (this.config.throttleRate || 100) * this.pressure;
      await new Promise((resolve) => setTimeout(resolve, delay));

      this.emitSignal({
        source: "backpressure",
        level: this.pressure,
        timestamp: Date.now(),
        reason: `Throttled for ${delay}ms`,
      });
    }

    return true;
  }

  /**
   * Reject strategy - reject new data
   */
  private handleReject(_data: Uint8Array): boolean {
    if (this.pressure > (this.config.pauseThreshold || 0.8)) {
      this.emitSignal({
        source: "backpressure",
        level: this.pressure,
        timestamp: Date.now(),
        reason: "Rejected due to backpressure",
      });
      return false;
    }
    return true;
  }

  /**
   * Pause strategy - pause until pressure reduces
   */
  private async handlePause(data: Uint8Array): Promise<boolean> {
    if (this.paused) {
      // Wait until resumed
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.paused) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    return true;
  }

  /**
   * Drain buffered data
   */
  drain(): Uint8Array[] {
    const data = [...this.buffer];
    this.buffer = [];
    this.updatePressure();
    return data;
  }

  /**
   * Get next buffered item
   */
  next(): Uint8Array | undefined {
    const data = this.buffer.shift();
    this.updatePressure();
    return data;
  }

  /**
   * Update pressure level
   */
  private updatePressure(): void {
    const oldPressure = this.pressure;
    this.pressure = this.buffer.length / (this.config.bufferSize || 1000);

    // Check pause/resume thresholds
    if (
      oldPressure <= (this.config.pauseThreshold || 0.8) &&
      this.pressure > (this.config.pauseThreshold || 0.8)
    ) {
      this.pause();
    } else if (
      oldPressure >= (this.config.resumeThreshold || 0.5) &&
      this.pressure < (this.config.resumeThreshold || 0.5)
    ) {
      this.resume();
    }
  }

  /**
   * Set pressure level manually
   */
  setPressure(level: number): void {
    this.pressure = Math.max(0, Math.min(1, level));

    if (this.pressure > (this.config.pauseThreshold || 0.8)) {
      this.pause();
    } else if (this.pressure < (this.config.resumeThreshold || 0.5)) {
      this.resume();
    }

    this.emitSignal({
      source: "backpressure",
      level: this.pressure,
      timestamp: Date.now(),
    });
  }

  /**
   * Get current pressure level
   */
  getPressure(): number {
    return this.pressure;
  }

  /**
   * Pause flow
   */
  pause(): void {
    this.paused = true;
    this.emitSignal({
      source: "backpressure",
      level: this.pressure,
      timestamp: Date.now(),
      reason: "Flow paused",
    });
  }

  /**
   * Resume flow
   */
  resume(): void {
    this.paused = false;
    this.emitSignal({
      source: "backpressure",
      level: this.pressure,
      timestamp: Date.now(),
      reason: "Flow resumed",
    });
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Subscribe to backpressure signals
   */
  onSignal(listener: (signal: BackpressureSignal) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit backpressure signal
   */
  private emitSignal(signal: BackpressureSignal): void {
    for (const listener of this.listeners) {
      try {
        listener(signal);
      } catch (error) {
        console.error("Error in backpressure listener:", error);
      }
    }
  }

  /**
   * Get buffer size
   */
  get bufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = [];
    this.updatePressure();
  }
}

/**
 * Backpressure-aware transform stream
 */
export class BackpressureTransformStream extends TransformStream<
  Uint8Array,
  Uint8Array
> {
  private handler: BackpressureHandler;

  constructor(config?: Partial<BackpressureConfig>) {
    const handler = new BackpressureHandler(config);

    super({
      async transform(chunk, controller) {
        const accepted = await handler.handleData(chunk);

        if (accepted) {
          controller.enqueue(chunk);
        } else {
          // Data was dropped/rejected
          console.warn("Backpressure: chunk dropped");
        }
      },

      flush(controller) {
        // Drain any buffered data
        const buffered = handler.drain();
        for (const chunk of buffered) {
          controller.enqueue(chunk);
        }
      },
    });

    this.handler = handler;
  }

  /**
   * Get pressure level
   */
  getPressure(): number {
    return this.handler.getPressure();
  }

  /**
   * Subscribe to pressure signals
   */
  onSignal(listener: (signal: BackpressureSignal) => void): () => void {
    return this.handler.onSignal(listener);
  }
}
