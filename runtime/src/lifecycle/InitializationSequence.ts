/**
 * Initialization Sequence
 *
 * Manages ordered startup of runtime components with dependency resolution.
 * Executes initialization steps in the correct order based on dependencies.
 */

import type {
  InitializationStep,
  RuntimeEvent,
  RuntimeEventListener,
} from "../types.ts";
import { RuntimeState } from "../types.ts";
import { LifecycleManager } from "./LifecycleManager.ts";

/**
 * Result of executing a single initialization step
 */
export interface StepExecutionResult {
  step: InitializationStep;
  success: boolean;
  duration: number;
  error?: Error;
  skipped?: boolean;
}

/**
 * Progress callback for initialization
 */
export interface InitializationProgress {
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
  percentage: number;
}

/**
 * Initialization sequence configuration
 */
interface InitializationSequenceConfig {
  /**
   * Default timeout for steps without explicit timeout
   */
  defaultTimeout: number;

  /**
   * Continue initialization if optional steps fail
   */
  continueOnOptionalFailure: boolean;

  /**
   * Maximum concurrent step execution (for independent steps)
   */
  maxConcurrency: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: InitializationSequenceConfig = {
  defaultTimeout: 30000,
  continueOnOptionalFailure: true,
  maxConcurrency: 3,
};

/**
 * Initialization Sequence
 *
 * Orchestrates the ordered startup of runtime components, ensuring
 * dependencies are satisfied before each step executes.
 */
export class InitializationSequence {
  private steps: InitializationStep[] = [];
  private executionOrder: InitializationStep[] = [];
  private results: Map<string, StepExecutionResult> = new Map();
  private eventListeners: RuntimeEventListener[] = [];
  private config: InitializationSequenceConfig;

  constructor(
    private lifecycleManager: LifecycleManager,
    config: Partial<InitializationSequenceConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register an initialization step
   */
  registerStep(step: InitializationStep): void {
    // Validate step
    if (!step.name || !step.component || !step.execute) {
      throw new Error("Invalid initialization step: missing required fields");
    }

    // Check for duplicate names
    if (this.steps.some((s) => s.name === step.name)) {
      throw new Error(`Duplicate initialization step name: ${step.name}`);
    }

    // Ensure component is registered with lifecycle manager
    if (!this.lifecycleManager.hasComponent(step.component)) {
      this.lifecycleManager.registerComponent(step.component);
    }

    this.steps.push(step);

    // Invalidate execution order (will be recalculated)
    this.executionOrder = [];
  }

  /**
   * Get all registered steps
   */
  getSteps(): InitializationStep[] {
    return [...this.steps];
  }

  /**
   * Calculate execution order based on dependencies
   */
  private calculateExecutionOrder(): InitializationStep[] {
    if (this.executionOrder.length > 0) {
      return this.executionOrder;
    }

    const ordered: InitializationStep[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (step: InitializationStep): void => {
      if (visited.has(step.name)) {
        return;
      }

      if (visiting.has(step.name)) {
        throw new Error(`Circular dependency detected: ${step.name}`);
      }

      visiting.add(step.name);

      // Visit dependencies first
      for (const depId of step.dependencies) {
        const depStep = this.steps.find((s) => s.component === depId);
        if (depStep) {
          visit(depStep);
        }
      }

      visiting.delete(step.name);
      visited.add(step.name);
      ordered.push(step);
    };

    // Visit all steps
    for (const step of this.steps) {
      visit(step);
    }

    this.executionOrder = ordered;
    return ordered;
  }

  /**
   * Execute the initialization sequence
   */
  async execute(
    onProgress?: (progress: InitializationProgress) => void,
  ): Promise<StepExecutionResult[]> {
    this.results.clear();

    const order = this.calculateExecutionOrder();
    const results: StepExecutionResult[] = [];

    for (let i = 0; i < order.length; i++) {
      const step = order[i];

      // Report progress
      if (onProgress) {
        onProgress({
          currentStep: step.name,
          completedSteps: i,
          totalSteps: order.length,
          percentage: Math.round((i / order.length) * 100),
        });
      }

      // Check if dependencies completed successfully
      const dependenciesMet = this.checkDependencies(step);
      if (!dependenciesMet) {
        const result: StepExecutionResult = {
          step,
          success: false,
          duration: 0,
          skipped: true,
          error: new Error("Dependencies not met"),
        };
        results.push(result);
        this.results.set(step.name, result);
        continue;
      }

      // Execute the step
      const result = await this.executeStep(step);
      results.push(result);
      this.results.set(step.name, result);

      // Stop on failure if not optional
      if (!result.success && !step.optional) {
        break;
      }
    }

    // Final progress
    if (onProgress) {
      onProgress({
        currentStep: "complete",
        completedSteps: order.length,
        totalSteps: order.length,
        percentage: 100,
      });
    }

    return results;
  }

  /**
   * Check if a step's dependencies are satisfied
   */
  private checkDependencies(step: InitializationStep): boolean {
    for (const depId of step.dependencies) {
      const depResult = Array.from(this.results.values()).find(
        (r) => r.step.component === depId,
      );

      if (!depResult || !depResult.success) {
        return false;
      }
    }
    return true;
  }

  /**
   * Execute a single initialization step with timeout
   */
  private async executeStep(
    step: InitializationStep,
  ): Promise<StepExecutionResult> {
    const timeout = step.timeout ?? this.config.defaultTimeout;
    const startTime = Date.now();

    // Update component state to STARTING
    this.lifecycleManager.updateComponentState(
      step.component,
      RuntimeState.STARTING,
    );

    // Emit event
    this.emitEvent({
      type: "component_starting",
      componentId: step.component,
    });

    let timeoutId: number | undefined;

    try {
      // Execute with timeout
      const executePromise = step.execute();
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Step "${step.name}" timed out after ${timeout}ms`));
        }, timeout);
      });

      await Promise.race([executePromise, timeoutPromise]);

      const duration = Date.now() - startTime;

      // Update component state to RUNNING
      this.lifecycleManager.updateComponentState(
        step.component,
        RuntimeState.RUNNING,
      );

      // Emit success event
      this.emitEvent({
        type: "component_started",
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
      };
    } finally {
      // Always clear the timeout to prevent leaks
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Get execution results
   */
  getResults(): Map<string, StepExecutionResult> {
    return new Map(this.results);
  }

  /**
   * Check if initialization succeeded
   */
  isSuccessful(): boolean {
    if (this.results.size === 0) {
      return false;
    }

    for (const result of this.results.values()) {
      if (!result.success && !result.step.optional) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get failed steps
   */
  getFailedSteps(): StepExecutionResult[] {
    return Array.from(this.results.values()).filter(
      (r) => !r.success && !r.skipped,
    );
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
    this.results.clear();
  }
}
