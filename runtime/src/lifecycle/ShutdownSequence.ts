/**
 * Shutdown Sequence
 *
 * Manages ordered shutdown of runtime components with graceful timeouts.
 * Executes shutdown in reverse dependency order to ensure clean teardown.
 */

import type {
  RuntimeEvent,
  RuntimeEventListener,
  ShutdownStep,
} from "../types.ts";
import { RuntimeState } from "../types.ts";
import { LifecycleManager } from "./LifecycleManager.ts";

/**
 * Result of executing a single shutdown step
 */
export interface ShutdownStepResult {
  step: ShutdownStep;
  success: boolean;
  duration: number;
  error?: Error;
  timedOut?: boolean;
  forced?: boolean;
}

/**
 * Progress callback for shutdown
 */
export interface ShutdownProgress {
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
  percentage: number;
  elapsedTime: number;
  remainingTime: number;
}

/**
 * Shutdown sequence configuration
 */
interface ShutdownSequenceConfig {
  /**
   * Total shutdown timeout (ms)
   */
  totalTimeout: number;

  /**
   * Default per-step timeout (ms)
   */
  defaultStepTimeout: number;

  /**
   * Force shutdown on timeout
   */
  forceOnTimeout: boolean;

  /**
   * Time to wait before force shutdown (ms)
   */
  forceShutdownDelay: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ShutdownSequenceConfig = {
  totalTimeout: 30000,
  defaultStepTimeout: 5000,
  forceOnTimeout: true,
  forceShutdownDelay: 1000,
};

/**
 * Shutdown Sequence
 *
 * Orchestrates the ordered shutdown of runtime components, ensuring
 * dependents are stopped before their dependencies.
 */
export class ShutdownSequence {
  private steps: ShutdownStep[] = [];
  private results: Map<string, ShutdownStepResult> = new Map();
  private eventListeners: RuntimeEventListener[] = [];
  private config: ShutdownSequenceConfig;
  private abortController?: AbortController;
  private isRunning = false;

  constructor(
    private lifecycleManager: LifecycleManager,
    config: Partial<ShutdownSequenceConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a shutdown step
   */
  registerStep(step: ShutdownStep): void {
    // Validate step
    if (!step.name || !step.component || !step.execute) {
      throw new Error("Invalid shutdown step: missing required fields");
    }

    // Check for duplicate names
    if (this.steps.some((s) => s.name === step.name)) {
      throw new Error(`Duplicate shutdown step name: ${step.name}`);
    }

    // Use default timeout if not specified
    if (!step.timeout) {
      step.timeout = this.config.defaultStepTimeout;
    }

    this.steps.push(step);
  }

  /**
   * Get all registered steps
   */
  getSteps(): ShutdownStep[] {
    return [...this.steps];
  }

  /**
   * Get execution order (reverse of registration order by default)
   */
  private getExecutionOrder(): ShutdownStep[] {
    // Reverse order - last registered components stop first
    // This typically means dependent components stop before their dependencies
    return [...this.steps].reverse();
  }

  /**
   * Execute the shutdown sequence
   */
  async execute(
    reason: string,
    onProgress?: (progress: ShutdownProgress) => void,
  ): Promise<ShutdownStepResult[]> {
    if (this.isRunning) {
      throw new Error("Shutdown sequence already in progress");
    }

    this.isRunning = true;
    this.results.clear();
    this.abortController = new AbortController();

    const startTime = Date.now();
    const order = this.getExecutionOrder();
    const results: ShutdownStepResult[] = [];

    // Emit shutdown initiated event
    this.emitEvent({
      type: "shutdown_initiated",
      reason,
    });

    // Set up total timeout
    const totalTimeoutId = setTimeout(() => {
      this.emitEvent({
        type: "shutdown_timeout",
        elapsed: Date.now() - startTime,
      });

      if (this.config.forceOnTimeout) {
        this.abortController?.abort();
      }
    }, this.config.totalTimeout);

    try {
      for (let i = 0; i < order.length; i++) {
        const step = order[i];
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, this.config.totalTimeout - elapsed);

        // Check if aborted
        if (this.abortController.signal.aborted) {
          // Force remaining steps
          for (let j = i; j < order.length; j++) {
            const forceStep = order[j];
            const forceResult = await this.forceStep(forceStep);
            results.push(forceResult);
            this.results.set(forceStep.name, forceResult);
          }
          break;
        }

        // Report progress
        if (onProgress) {
          onProgress({
            currentStep: step.name,
            completedSteps: i,
            totalSteps: order.length,
            percentage: Math.round((i / order.length) * 100),
            elapsedTime: elapsed,
            remainingTime: remaining,
          });
        }

        // Execute the step
        const stepTimeout = Math.min(step.timeout, remaining);
        const result = await this.executeStep(step, stepTimeout);
        results.push(result);
        this.results.set(step.name, result);
      }
    } finally {
      clearTimeout(totalTimeoutId);
      this.isRunning = false;
    }

    const totalDuration = Date.now() - startTime;

    // Emit shutdown complete event
    this.emitEvent({
      type: "shutdown_complete",
      duration: totalDuration,
    });

    // Final progress
    if (onProgress) {
      onProgress({
        currentStep: "complete",
        completedSteps: order.length,
        totalSteps: order.length,
        percentage: 100,
        elapsedTime: totalDuration,
        remainingTime: 0,
      });
    }

    return results;
  }

  /**
   * Execute a single shutdown step with timeout
   */
  private async executeStep(
    step: ShutdownStep,
    timeout: number,
  ): Promise<ShutdownStepResult> {
    const startTime = Date.now();

    // Update component state to STOPPING
    this.lifecycleManager.updateComponentState(
      step.component,
      RuntimeState.STOPPING,
    );

    // Emit event
    this.emitEvent({
      type: "component_stopping",
      componentId: step.component,
    });

    let timeoutId: number | undefined;

    try {
      // Execute with timeout
      const executePromise = step.execute();
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(`Shutdown step "${step.name}" timed out after ${timeout}ms`),
          );
        }, timeout);
      });

      await Promise.race([executePromise, timeoutPromise]);

      const duration = Date.now() - startTime;

      // Update component state to STOPPED
      this.lifecycleManager.updateComponentState(
        step.component,
        RuntimeState.STOPPED,
      );

      // Emit success event
      this.emitEvent({
        type: "component_stopped",
        componentId: step.component,
      });

      return {
        step,
        success: true,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      const timedOut = err.message.includes("timed out");

      // If timed out and graceful, try force shutdown
      if (timedOut && step.graceful && this.config.forceOnTimeout) {
        return this.forceStep(step);
      }

      // Update component state to ERROR
      this.lifecycleManager.updateComponentState(
        step.component,
        RuntimeState.ERROR,
        err,
      );

      // Emit error event
      this.emitEvent({
        type: "component_error",
        componentId: step.component,
        error: err,
      });

      return {
        step,
        success: false,
        duration,
        error: err,
        timedOut,
      };
    } finally {
      // Always clear the timeout to prevent leaks
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Force shutdown a step (non-graceful)
   */
  private async forceStep(step: ShutdownStep): Promise<ShutdownStepResult> {
    const startTime = Date.now();

    try {
      // Give a brief delay then mark as stopped
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.forceShutdownDelay)
      );

      const duration = Date.now() - startTime;

      // Force update component state to STOPPED
      this.lifecycleManager.updateComponentState(
        step.component,
        RuntimeState.STOPPED,
      );

      this.emitEvent({
        type: "component_stopped",
        componentId: step.component,
      });

      return {
        step,
        success: true,
        duration,
        forced: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      return {
        step,
        success: false,
        duration,
        error: err,
        forced: true,
      };
    }
  }

  /**
   * Abort the shutdown sequence
   */
  abort(): void {
    this.abortController?.abort();
  }

  /**
   * Get execution results
   */
  getResults(): Map<string, ShutdownStepResult> {
    return new Map(this.results);
  }

  /**
   * Check if shutdown succeeded
   */
  isSuccessful(): boolean {
    if (this.results.size === 0) {
      return false;
    }

    for (const result of this.results.values()) {
      if (!result.success) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if shutdown is currently running
   */
  isShuttingDown(): boolean {
    return this.isRunning;
  }

  /**
   * Get failed steps
   */
  getFailedSteps(): ShutdownStepResult[] {
    return Array.from(this.results.values()).filter((r) => !r.success);
  }

  /**
   * Get total execution time
   */
  getTotalDuration(): number {
    let total = 0;
    for (const result of this.results.values()) {
      total += result.duration;
    }
    return total;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: RuntimeEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: RuntimeEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: RuntimeEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Reset the sequence for re-execution
   */
  reset(): void {
    if (this.isRunning) {
      throw new Error("Cannot reset while shutdown is in progress");
    }
    this.results.clear();
  }
}
