/**
 * Performance utility functions
 * Timing, profiling, benchmarking
 */

import type { DurationMs } from "../types/primitives.ts";

/**
 * Timer interface
 */
export interface Timer {
  start: () => void;
  stop: () => DurationMs;
  elapsed: () => DurationMs;
  reset: () => void;
}

/**
 * Create high-precision timer
 */
export function createTimer(): Timer {
  let startTime: number | null = null;
  let stopTime: number | null = null;

  return {
    start() {
      startTime = performance.now();
      stopTime = null;
    },

    stop() {
      if (startTime === null) {
        throw new Error("Timer not started");
      }
      stopTime = performance.now();
      return stopTime - startTime;
    },

    elapsed() {
      if (startTime === null) {
        return 0;
      }
      const end = stopTime !== null ? stopTime : performance.now();
      return end - startTime;
    },

    reset() {
      startTime = null;
      stopTime = null;
    },
  };
}

/**
 * Measure execution time of function
 * Returns [result, duration]
 */
export function measure<T>(fn: () => T): [T, DurationMs] {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  return [result, duration];
}

/**
 * Measure async function execution time
 */
export async function measureAsync<T>(fn: () => Promise<T>): Promise<[T, DurationMs]> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return [result, duration];
}

/**
 * Measure execution time and call callback with result
 * Returns the function result
 */
export function measureWith<T>(
  fn: () => T,
  callback: (duration: DurationMs) => void,
): T {
  const [result, duration] = measure(fn);
  callback(duration);
  return result;
}

/**
 * Measure async execution time with callback
 */
export async function measureAsyncWith<T>(
  fn: () => Promise<T>,
  callback: (duration: DurationMs) => void,
): Promise<T> {
  const [result, duration] = await measureAsync(fn);
  callback(duration);
  return result;
}

/**
 * Format duration for display
 */
export function formatDuration(ms: DurationMs): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}μs`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(2);
  return `${minutes}m ${seconds}s`;
}

/**
 * Profile function execution with detailed stats
 */
export interface ProfileResult {
  name: string;
  count: number;
  totalTime: DurationMs;
  averageTime: DurationMs;
  minTime: DurationMs;
  maxTime: DurationMs;
}

/**
 * Profiler class for tracking multiple function calls
 */
export class Profiler {
  private profiles: Map<string, ProfileResult>;

  constructor() {
    this.profiles = new Map();
  }

  /**
   * Profile a function call
   */
  profile<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    this.recordDuration(name, duration);
    return result;
  }

  /**
   * Profile an async function call
   */
  async profileAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    this.recordDuration(name, duration);
    return result;
  }

  /**
   * Record a duration measurement
   */
  recordDuration(name: string, duration: DurationMs): void {
    const existing = this.profiles.get(name);

    if (existing) {
      existing.count++;
      existing.totalTime += duration;
      existing.averageTime = existing.totalTime / existing.count;
      existing.minTime = Math.min(existing.minTime, duration);
      existing.maxTime = Math.max(existing.maxTime, duration);
    } else {
      this.profiles.set(name, {
        name,
        count: 1,
        totalTime: duration,
        averageTime: duration,
        minTime: duration,
        maxTime: duration,
      });
    }
  }

  /**
   * Get profile result for specific function
   */
  getProfile(name: string): ProfileResult | undefined {
    return this.profiles.get(name);
  }

  /**
   * Get all profile results
   */
  getAllProfiles(): ProfileResult[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get profile results sorted by total time
   */
  getProfilesSortedByTotalTime(): ProfileResult[] {
    return this.getAllProfiles().sort((a, b) => b.totalTime - a.totalTime);
  }

  /**
   * Get profile results sorted by average time
   */
  getProfilesSortedByAverageTime(): ProfileResult[] {
    return this.getAllProfiles().sort((a, b) => b.averageTime - a.averageTime);
  }

  /**
   * Clear all profiles
   */
  clear(): void {
    this.profiles.clear();
  }

  /**
   * Print profile report
   */
  printReport(): string {
    const profiles = this.getProfilesSortedByTotalTime();
    const lines: string[] = ["Performance Profile Report", "=".repeat(80)];

    for (const profile of profiles) {
      lines.push(
        `${profile.name}:`,
        `  Calls: ${profile.count}`,
        `  Total: ${formatDuration(profile.totalTime)}`,
        `  Avg: ${formatDuration(profile.averageTime)}`,
        `  Min: ${formatDuration(profile.minTime)}`,
        `  Max: ${formatDuration(profile.maxTime)}`,
        "",
      );
    }

    return lines.join("\n");
  }
}

/**
 * Global profiler instance
 */
export const globalProfiler = new Profiler();

/**
 * Throttle function execution
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: DurationMs,
): T {
  let lastCall = 0;
  let timeout: number | null = null;

  return ((...args: any[]) => {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      return fn(...args);
    }

    if (timeout !== null) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      lastCall = Date.now();
      fn(...args);
      timeout = null;
    }, delay - (now - lastCall));
  }) as T;
}

/**
 * Debounce function execution
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: DurationMs,
): T & { cancel: () => void } {
  let timeout: number | null = null;

  const debounced = ((...args: any[]) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      fn(...args);
      timeout = null;
    }, delay);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}

/**
 * Memoize function results
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string,
): T & { cache: Map<string, ReturnType<T>>; clear: () => void } {
  const cache = new Map<string, ReturnType<T>>();

  const defaultKeyFn = (...args: any[]) => JSON.stringify(args);
  const getKey = keyFn || defaultKeyFn;

  const memoized = ((...args: Parameters<T>) => {
    const key = getKey(...args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T & { cache: Map<string, ReturnType<T>>; clear: () => void };

  memoized.cache = cache;
  memoized.clear = () => cache.clear();

  return memoized;
}

/**
 * Once - ensure function is only called once
 */
export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false;
  let result: ReturnType<T>;

  return ((...args: any[]) => {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  }) as T;
}
