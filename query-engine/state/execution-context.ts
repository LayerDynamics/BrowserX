/**
 * Execution context manager
 * Manages per-query execution state with variable scoping, step results, and browser references
 */

import type { QueryID } from "../types/primitives.ts";
import type { ExecutionContext } from "../planner/plan.ts";
import type { StepResult } from "../planner/plan.ts";
import { VariableScope } from "./variable-scope.ts";

/**
 * Execution context manager with lexical variable scoping
 *
 * Wraps VariableScope to provide:
 * - Variable management with scope support
 * - Step result tracking
 * - Browser/page references
 * - Backward compatibility with legacy ExecutionContext interface
 */
export class ExecutionContextManager {
  private readonly queryId: QueryID;
  private readonly rootScope: VariableScope;
  private currentScope: VariableScope;
  private readonly stepResults: Map<string, StepResult>;
  private currentPage: unknown = undefined;
  private currentBrowser: unknown = undefined;

  constructor(queryId: QueryID) {
    this.queryId = queryId;
    this.rootScope = new VariableScope(null, "root");
    this.currentScope = this.rootScope;
    this.stepResults = new Map();
  }

  /**
   * Get query ID
   */
  getQueryId(): QueryID {
    return this.queryId;
  }

  /**
   * Get variable from current scope chain
   */
  getVariable(name: string): unknown {
    return this.currentScope.get(name);
  }

  /**
   * Set variable in current scope
   * Creates new variable or shadows parent scope variable
   */
  setVariable(name: string, value: unknown): void {
    this.currentScope.set(name, value);
  }

  /**
   * Update variable where defined in scope chain
   * Useful for updating loop counters defined in parent scopes
   */
  updateVariable(name: string, value: unknown): void {
    this.currentScope.update(name, value);
  }

  /**
   * Check if variable exists in scope chain
   */
  hasVariable(name: string): boolean {
    return this.currentScope.has(name);
  }

  /**
   * Delete variable from current scope
   */
  deleteVariable(name: string): boolean {
    return this.currentScope.delete(name);
  }

  /**
   * Get all variables from scope chain
   */
  getAllVariables(): Map<string, unknown> {
    return this.currentScope.getAllVariables();
  }

  /**
   * Push a new scope (for loops, conditionals, etc.)
   * Variables in the new scope can shadow parent variables
   */
  pushScope(): void {
    this.currentScope = this.currentScope.createChild();
  }

  /**
   * Pop current scope and return to parent
   * Throws if trying to pop root scope
   */
  popScope(): void {
    const parent = this.currentScope.getParent();
    if (!parent) {
      throw new Error("Cannot pop root scope");
    }
    this.currentScope = parent;
  }

  /**
   * Get current scope depth
   */
  getScopeDepth(): number {
    return this.currentScope.getDepth();
  }

  /**
   * Get root scope
   */
  getRootScope(): VariableScope {
    return this.rootScope;
  }

  /**
   * Get current scope
   */
  getCurrentScope(): VariableScope {
    return this.currentScope;
  }

  /**
   * Set step result
   */
  setStepResult(stepId: string, result: StepResult): void {
    this.stepResults.set(stepId, result);
  }

  /**
   * Get step result
   */
  getStepResult(stepId: string): StepResult | undefined {
    return this.stepResults.get(stepId);
  }

  /**
   * Get all step results
   */
  getAllStepResults(): Map<string, StepResult> {
    return new Map(this.stepResults);
  }

  /**
   * Set current browser page reference
   */
  setCurrentPage(page: unknown): void {
    this.currentPage = page;
  }

  /**
   * Get current browser page reference
   */
  getCurrentPage(): unknown {
    return this.currentPage;
  }

  /**
   * Set current browser instance reference
   */
  setCurrentBrowser(browser: unknown): void {
    this.currentBrowser = browser;
  }

  /**
   * Get current browser instance reference
   */
  getCurrentBrowser(): unknown {
    return this.currentBrowser;
  }

  /**
   * Clear all step results
   */
  clearStepResults(): void {
    this.stepResults.clear();
  }

  /**
   * Clear all variables (resets to root scope)
   */
  clearVariables(): void {
    this.rootScope.clear();
    this.currentScope = this.rootScope;
  }

  /**
   * Reset context (clear all data, return to root scope)
   */
  reset(): void {
    this.clearVariables();
    this.clearStepResults();
    this.currentPage = undefined;
    this.currentBrowser = undefined;
  }

  /**
   * Convert to legacy ExecutionContext for backward compatibility
   * This allows gradual migration of existing code
   */
  toLegacyContext(): ExecutionContext {
    return {
      queryId: this.queryId,
      variables: this.getAllVariables(),
      stepResults: this.getAllStepResults(),
      currentPage: this.currentPage,
      currentBrowser: this.currentBrowser,
      cache: new Map(), // Legacy cache, now handled by QueryCacheManager
    };
  }

  /**
   * Create from legacy ExecutionContext
   * Useful for migration from old code
   */
  static fromLegacyContext(legacy: ExecutionContext): ExecutionContextManager {
    const manager = new ExecutionContextManager(legacy.queryId);

    // Import variables
    for (const [name, value] of legacy.variables) {
      manager.setVariable(name, value);
    }

    // Import step results
    for (const [stepId, result] of legacy.stepResults) {
      manager.setStepResult(stepId, result);
    }

    // Import browser references
    if (legacy.currentPage) {
      manager.setCurrentPage(legacy.currentPage);
    }
    if (legacy.currentBrowser) {
      manager.setCurrentBrowser(legacy.currentBrowser);
    }

    return manager;
  }

  /**
   * Export state for debugging
   */
  toJSON(): object {
    return {
      queryId: this.queryId,
      scopeDepth: this.getScopeDepth(),
      variableCount: this.getAllVariables().size,
      stepResultCount: this.stepResults.size,
      hasCurrentPage: this.currentPage !== undefined,
      hasCurrentBrowser: this.currentBrowser !== undefined,
      scopeTree: this.rootScope.toJSON(),
    };
  }

  /**
   * Print scope tree for debugging
   */
  printScopeTree(): string {
    return this.rootScope.printTree();
  }
}
