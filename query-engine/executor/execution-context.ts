// execution-context.ts - Execution context for query execution

/**
 * Execution context for tracking state during query execution
 */
export class ExecutionContext {
  private variables: Map<string, unknown>;
  private readonly startTime: number;

  constructor() {
    this.variables = new Map();
    this.startTime = Date.now();
  }

  /**
   * Set a variable in the context
   */
  setVariable(name: string, value: unknown): void {
    this.variables.set(name, value);
  }

  /**
   * Get a variable from the context
   */
  getVariable(name: string): unknown {
    return this.variables.get(name);
  }

  /**
   * Check if variable exists
   */
  hasVariable(name: string): boolean {
    return this.variables.has(name);
  }

  /**
   * Get all variables
   */
  getAllVariables(): Record<string, unknown> {
    return Object.fromEntries(this.variables);
  }

  /**
   * Clear all variables
   */
  clear(): void {
    this.variables.clear();
  }

  /**
   * Get execution time in milliseconds
   */
  getExecutionTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Clone the context
   */
  clone(): ExecutionContext {
    const cloned = new ExecutionContext();
    for (const [key, value] of this.variables) {
      cloned.setVariable(key, value);
    }
    return cloned;
  }
}
