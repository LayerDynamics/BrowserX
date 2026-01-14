// step-executor.ts - Individual step execution

import { ExecutionContext } from "./execution-context.ts";

/**
 * Execution step
 */
export interface ExecutionStep {
  id: string;
  type: string;
  execute(context: ExecutionContext): Promise<unknown>;
}

/**
 * Step executor for executing individual steps
 */
export class StepExecutor {
  /**
   * Execute a single step
   */
  async executeStep(step: ExecutionStep, context: ExecutionContext): Promise<unknown> {
    try {
      return await step.execute(context);
    } catch (error) {
      throw new Error('Step execution failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Execute multiple steps sequentially
   */
  async executeSteps(steps: ExecutionStep[], context: ExecutionContext): Promise<unknown[]> {
    const results: unknown[] = [];
    
    for (const step of steps) {
      const result = await this.executeStep(step, context);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Execute steps in parallel
   */
  async executeStepsParallel(steps: ExecutionStep[], context: ExecutionContext): Promise<unknown[]> {
    const promises = steps.map(step => this.executeStep(step, context));
    return await Promise.all(promises);
  }
}
