/**
 * Execution planner
 * Converts optimized AST into executable plan
 */

import {
  DeleteStatement,
  Expression,
  ForStatement,
  IfStatement,
  InsertStatement,
  NavigateStatement,
  SelectStatement,
  SetStatement,
  ShowStatement,
  Statement,
  UpdateStatement,
} from "../types/ast.ts";
import { QueryID } from "../types/primitives.ts";
import {
  AssignStep,
  BranchStep,
  DOMQueryStep,
  EvaluateJSStep,
  ExecutionPlan,
  ExecutionStep,
  ExecutionStepType,
  FilterStep,
  LimitStep,
  LoopStep,
  NavigateStep,
  ParallelStep,
  ReadVariableStep,
  ResourceRequirements,
  SortStep,
  TypeStep,
} from "./plan.ts";
import { DependencyGraphBuilder } from "./dependency-graph.ts";

/**
 * Execution planner
 */
export class ExecutionPlanner {
  private dependencyGraphBuilder: DependencyGraphBuilder;
  private stepCounter: number;
  private currentSteps: ExecutionStep[];

  constructor() {
    this.dependencyGraphBuilder = new DependencyGraphBuilder();
    this.stepCounter = 0;
    this.currentSteps = [];
  }

  /**
   * Create execution plan from statement
   */
  plan(stmt: Statement, metadata?: {
    optimizationApplied: boolean;
    appliedPasses: string[];
    estimatedImprovement: number;
  }): ExecutionPlan {
    // Reset state
    this.stepCounter = 0;
    this.currentSteps = [];

    // Generate steps from statement
    this.generateSteps(stmt);

    // Build dependency graph
    const dependencies = this.dependencyGraphBuilder.build(this.currentSteps);

    // Find parallel execution opportunities
    const parallelGroups = this.dependencyGraphBuilder.findParallelGroups(dependencies);

    // Estimate total cost
    const estimatedCost = this.estimateTotalCost(this.currentSteps, dependencies);

    // Calculate resource requirements
    const resources = this.calculateResourceRequirements(this.currentSteps);

    // Find cacheable steps
    const cacheableSteps = this.currentSteps
      .filter((step) => step.cacheable)
      .map((step) => step.id);

    const plan: ExecutionPlan = {
      id: this.generatePlanId(),
      query: stmt,
      steps: this.currentSteps,
      estimatedCost,
      resources,
      dependencies,
      cacheableSteps,
      parallelGroups,
      metadata: metadata || {
        optimizationApplied: false,
        appliedPasses: [],
        estimatedImprovement: 0,
      },
    };

    return plan;
  }

  /**
   * Generate execution steps from a statement
   */
  private generateSteps(stmt: Statement, dependencies: string[] = []): string {
    switch (stmt.type) {
      case "SELECT":
        return this.generateSelectSteps(stmt as SelectStatement, dependencies);

      case "NAVIGATE":
        return this.generateNavigateSteps(stmt as NavigateStatement, dependencies);

      case "SET":
        return this.generateSetSteps(stmt as SetStatement, dependencies);

      case "FOR":
        return this.generateForSteps(stmt as ForStatement, dependencies);

      case "IF":
        return this.generateIfSteps(stmt as IfStatement, dependencies);

      case "INSERT":
        return this.generateInsertSteps(stmt as InsertStatement, dependencies);

      case "UPDATE":
        return this.generateUpdateSteps(stmt as UpdateStatement, dependencies);

      case "DELETE":
        return this.generateDeleteSteps(stmt as DeleteStatement, dependencies);

      case "SHOW":
        return this.generateShowSteps(stmt as ShowStatement, dependencies);

      default:
        // Return a no-op step ID
        return "";
    }
  }

  /**
   * Generate steps for SELECT statement
   */
  private generateSelectSteps(stmt: SelectStatement, dependencies: string[]): string {
    const steps: string[] = [...dependencies];

    // If source is a URL, navigate first
    if (stmt.source.type === "URL") {
      const navStep: NavigateStep = {
        id: this.generateStepId(),
        type: ExecutionStepType.NAVIGATE,
        url: stmt.source.value as string,
        estimatedCost: 500,
        dependencies: steps,
        cacheable: true,
        cacheKey: `nav:${stmt.source.value}`,
      };
      this.currentSteps.push(navStep);
      steps.push(navStep.id);
    } else if (stmt.source.type === "SUBQUERY") {
      // Execute subquery first
      const subqueryStepId = this.generateSteps(stmt.source.value as Statement, steps);
      if (subqueryStepId) {
        steps.push(subqueryStepId);
      }
    }

    // DOM query step
    const domQueryStep: DOMQueryStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.DOM_QUERY,
      selector: this.extractSelector(stmt),
      selectorType: "css",
      extractFields: stmt.fields.map((f) => ({
        name: f.alias || f.name,
        expression: f.expression || {
          type: "IDENTIFIER",
          name: f.name,
        },
      })),
      filter: stmt.where,
      estimatedCost: 10,
      dependencies: steps,
      cacheable: false,
    };
    this.currentSteps.push(domQueryStep);
    steps.push(domQueryStep.id);

    // Filter step if WHERE clause exists
    if (stmt.where) {
      const filterStep: FilterStep = {
        id: this.generateStepId(),
        type: ExecutionStepType.FILTER,
        predicate: stmt.where,
        inputVariable: "__query_result",
        outputVariable: "__filtered_result",
        estimatedCost: 5,
        dependencies: [domQueryStep.id],
        cacheable: false,
      };
      this.currentSteps.push(filterStep);
      steps.push(filterStep.id);
    }

    // Sort step if ORDER BY exists
    if (stmt.orderBy && stmt.orderBy.length > 0) {
      const sortStep: SortStep = {
        id: this.generateStepId(),
        type: ExecutionStepType.SORT,
        fields: stmt.orderBy.map((o) => ({
          field: o.field,
          direction: o.direction,
        })),
        inputVariable: "__filtered_result",
        outputVariable: "__sorted_result",
        estimatedCost: 10,
        dependencies: steps,
        cacheable: false,
      };
      this.currentSteps.push(sortStep);
      steps.push(sortStep.id);
    }

    // Limit step if LIMIT exists
    if (stmt.limit) {
      const limitStep: LimitStep = {
        id: this.generateStepId(),
        type: ExecutionStepType.LIMIT,
        limit: stmt.limit.limit,
        offset: stmt.limit.offset,
        inputVariable: "__sorted_result",
        outputVariable: "__final_result",
        estimatedCost: 1,
        dependencies: steps,
        cacheable: false,
      };
      this.currentSteps.push(limitStep);
      return limitStep.id;
    }

    return steps[steps.length - 1];
  }

  /**
   * Generate steps for NAVIGATE statement
   */
  private generateNavigateSteps(stmt: NavigateStatement, dependencies: string[]): string {
    // Extract URL
    let url = "";
    if (stmt.url.type === "LITERAL") {
      url = stmt.url.value as string;
    }

    const navStep: NavigateStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.NAVIGATE,
      url,
      options: stmt.options
        ? {
          waitFor: stmt.options.waitUntil,
          timeout: stmt.options.timeout,
          proxy: stmt.options.proxy
            ? {
              enabled: !!stmt.options.proxy.cache,
              cache: !!stmt.options.proxy.cache,
            }
            : undefined,
        }
        : undefined,
      estimatedCost: 500,
      dependencies,
      cacheable: true,
      cacheKey: `nav:${url}`,
    };

    this.currentSteps.push(navStep);

    // If capture clause exists, add DOM query
    if (stmt.capture) {
      const domQueryStep: DOMQueryStep = {
        id: this.generateStepId(),
        type: ExecutionStepType.DOM_QUERY,
        selector: "body", // Default selector
        selectorType: "css",
        extractFields: stmt.capture.fields.map((f) => ({
          name: f.alias || f.name,
          expression: f.expression || {
            type: "IDENTIFIER",
            name: f.name,
          },
        })),
        estimatedCost: 10,
        dependencies: [navStep.id],
        cacheable: false,
      };
      this.currentSteps.push(domQueryStep);
      return domQueryStep.id;
    }

    return navStep.id;
  }

  /**
   * Generate steps for SET statement
   */
  private generateSetSteps(stmt: SetStatement, dependencies: string[]): string {
    const assignStep: AssignStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.ASSIGN,
      variable: stmt.path.join("."), // Convert path array to dot-separated string
      value: stmt.value,
      estimatedCost: 1,
      dependencies,
      cacheable: false,
    };

    this.currentSteps.push(assignStep);
    return assignStep.id;
  }

  /**
   * Generate steps for FOR loop
   */
  private generateForSteps(stmt: ForStatement, dependencies: string[]): string {
    // Generate body steps (will be wrapped in loop)
    const bodyStepIds: string[] = [];
    const savedSteps = this.currentSteps.length;

    // Temporarily generate body steps
    this.generateSteps(stmt.body, []);

    // Extract body steps
    const bodySteps = this.currentSteps.splice(savedSteps);

    const loopStep: LoopStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.LOOP,
      iteratorVariable: stmt.variable,
      collectionVariable: "__collection", // Will be bound at runtime
      bodySteps,
      estimatedCost: bodySteps.reduce((sum, s) => sum + s.estimatedCost, 0) * 10, // Assume 10 iterations
      dependencies,
      cacheable: false,
      parallel: false, // Can be set to true if body has no cross-iteration dependencies
    };

    this.currentSteps.push(loopStep);
    return loopStep.id;
  }

  /**
   * Generate steps for IF statement
   */
  private generateIfSteps(stmt: IfStatement, dependencies: string[]): string {
    // Generate then branch steps
    const savedSteps = this.currentSteps.length;
    this.generateSteps(stmt.thenBranch, []);
    const thenSteps = this.currentSteps.splice(savedSteps);

    // Generate else branch steps
    let elseSteps: ExecutionStep[] = [];
    if (stmt.elseBranch) {
      const savedSteps2 = this.currentSteps.length;
      this.generateSteps(stmt.elseBranch, []);
      elseSteps = this.currentSteps.splice(savedSteps2);
    }

    const branchStep: BranchStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.BRANCH,
      condition: stmt.condition,
      thenSteps,
      elseSteps: elseSteps.length > 0 ? elseSteps : undefined,
      estimatedCost: Math.max(
        thenSteps.reduce((sum, s) => sum + s.estimatedCost, 0),
        elseSteps.reduce((sum, s) => sum + s.estimatedCost, 0),
      ) / 2, // Average of both branches
      dependencies,
      cacheable: false,
    };

    this.currentSteps.push(branchStep);
    return branchStep.id;
  }

  /**
   * Generate steps for INSERT statement
   */
  private generateInsertSteps(stmt: InsertStatement, dependencies: string[]): string {
    const steps: string[] = [...dependencies];

    // Type step to input text
    const typeStep: TypeStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.TYPE,
      selector: this.extractSelectorFromExpression(stmt.target) || "body",
      selectorType: "css",
      text: String(stmt.value.type === "LITERAL" ? (stmt.value as any).value : ""),
      clear: false,
      delay: 50, // Delay between keystrokes
      estimatedCost: 20,
      dependencies: steps,
      cacheable: false,
    };

    this.currentSteps.push(typeStep);
    return typeStep.id;
  }

  /**
   * Generate steps for UPDATE statement
   */
  private generateUpdateSteps(stmt: UpdateStatement, dependencies: string[]): string {
    const steps: string[] = [...dependencies];

    // Evaluate JS to modify element properties
    const selector = this.extractSelectorFromExpression(stmt.target) || "body";

    for (const assignment of stmt.assignments) {
      const evalStep: EvaluateJSStep = {
        id: this.generateStepId(),
        type: ExecutionStepType.EVALUATE_JS,
        script: this.buildUpdateScript(selector, assignment.property, assignment.value),
        args: [],
        estimatedCost: 15,
        dependencies: steps,
        cacheable: false,
      };

      this.currentSteps.push(evalStep);
      steps.push(evalStep.id);
    }

    return steps[steps.length - 1];
  }

  /**
   * Generate steps for DELETE statement
   */
  private generateDeleteSteps(stmt: DeleteStatement, dependencies: string[]): string {
    const selector = this.extractSelectorFromExpression(stmt.target) || "body";

    const evalStep: EvaluateJSStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.EVALUATE_JS,
      script: `
      const elements = document.querySelectorAll('${selector}');
      elements.forEach(el => el.remove());
      return elements.length;  // Return count of deleted elements
    `,
      args: [],
      estimatedCost: 10,
      dependencies,
      cacheable: false,
    };

    this.currentSteps.push(evalStep);
    return evalStep.id;
  }

  /**
   * Generate steps for SHOW statement
   */
  private generateShowSteps(stmt: ShowStatement, dependencies: string[]): string {
    // SHOW statements query engine state
    const readStep: ReadVariableStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.READ_VARIABLE,
      variable: `__state_${stmt.target.toLowerCase()}`, // e.g., __state_cache, __state_cookies
      outputVariable: `__show_${stmt.target.toLowerCase()}_result`,
      estimatedCost: 1,
      dependencies,
      cacheable: false,
    };

    this.currentSteps.push(readStep);
    return readStep.id;
  }

  /**
   * Build JavaScript for UPDATE
   */
  private buildUpdateScript(selector: string, property: string, value: Expression): string {
    const valueStr = value.type === "LITERAL"
      ? JSON.stringify((value as any).value)
      : `"${value}"`; // Simplified

    return `
    const elements = document.querySelectorAll('${selector}');
    elements.forEach(el => {
      if ('${property}' in el) {
        el['${property}'] = ${valueStr};
      } else {
        el.setAttribute('${property}', ${valueStr});
      }
    });
  `;
  }

  /**
   * Extract selector from SELECT statement
   */
  private extractSelector(stmt: SelectStatement): string {
    // Priority 1: Check if source contains selector hint
    if (stmt.source.type === "URL" && typeof stmt.source.value === "string") {
      const url = stmt.source.value;
      // Check if URL has fragment identifier (e.g., "https://example.com#selector")
      const hashIndex = url.indexOf("#");
      if (hashIndex !== -1) {
        const fragment = url.slice(hashIndex + 1);
        if (fragment && fragment.length > 0) {
          return fragment; // Use fragment as selector
        }
      }
    }

    // Priority 2: Check if fields contain selector information
    for (const field of stmt.fields) {
      if (field.expression && field.expression.type === "IDENTIFIER") {
        const name = (field.expression as any).name;

        // If field name looks like a CSS selector, use it
        if (
          name.startsWith(".") || name.startsWith("#") ||
          name.includes("[") || name.includes(">")
        ) {
          return name;
        }
      }

      // Check if field name suggests a specific selector
      if (field.name.startsWith("css:")) {
        return field.name.slice(4); // Extract selector after "css:"
      }
      if (field.name.startsWith("xpath:")) {
        return field.name.slice(6); // Extract selector after "xpath:"
      }
    }

    // Priority 3: Check WHERE clause for selector hints
    if (stmt.where) {
      // Look for selector-like patterns in WHERE expressions
      const selectorHint = this.extractSelectorFromExpression(stmt.where);
      if (selectorHint) {
        return selectorHint;
      }
    }

    // Default: Use 'body' to query entire document
    return "body";
  }

  /**
   * Helper to extract selector from expression
   */
  private extractSelectorFromExpression(expr: Expression): string | null {
    if (expr.type === "BINARY" && (expr as any).operator === "=") {
      const binaryExpr = expr as any;
      // Look for patterns like: selector = ".myclass"
      if (
        binaryExpr.left.type === "IDENTIFIER" &&
        binaryExpr.left.name.toLowerCase() === "selector" &&
        binaryExpr.right.type === "LITERAL"
      ) {
        return String(binaryExpr.right.value);
      }
    }

    // Recursively check nested expressions
    if (expr.type === "BINARY") {
      const binaryExpr = expr as any;
      return this.extractSelectorFromExpression(binaryExpr.left) ||
        this.extractSelectorFromExpression(binaryExpr.right);
    }

    return null;
  }

  /**
   * Estimate total execution cost
   */
  private estimateTotalCost(
    steps: ExecutionStep[],
    _dependencies: any,
  ): number {
    // Use parallel execution time if available
    return this.dependencyGraphBuilder.estimateParallelExecutionTime(_dependencies);
  }

  /**
   * Calculate resource requirements
   */
  private calculateResourceRequirements(steps: ExecutionStep[]): ResourceRequirements {
    let browsers = 0;
    let pages = 0;
    let connections = 0;
    let memory = 0;
    let cpu = 0;

    for (const step of steps) {
      switch (step.type) {
        case ExecutionStepType.NAVIGATE:
          browsers = Math.max(browsers, 1);
          pages++;
          connections++;
          memory += 100; // MB per page
          cpu = Math.max(cpu, 30);
          break;

        case ExecutionStepType.DOM_QUERY:
          cpu = Math.max(cpu, 20);
          memory += 10;
          break;

        case ExecutionStepType.SCREENSHOT:
        case ExecutionStepType.PDF:
          memory += 50;
          cpu = Math.max(cpu, 40);
          break;
      }
    }

    return {
      browsers,
      pages,
      connections,
      memory,
      cpu,
    };
  }

  /**
   * Generate unique step ID
   */
  private generateStepId(): string {
    return `step_${++this.stepCounter}`;
  }

  /**
   * Generate unique plan ID
   */
  private generatePlanId(): QueryID {
    return `plan_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get dependency graph builder
   */
  getDependencyGraphBuilder(): DependencyGraphBuilder {
    return this.dependencyGraphBuilder;
  }

  /**
   * Get step counter (for debugging)
   */
  getStepCounter(): number {
    return this.stepCounter;
  }

  /**
   * Get current steps (returns copy)
   */
  getCurrentSteps(): ExecutionStep[] {
    return [...this.currentSteps];
  }
}

/**
 * Alias for ExecutionPlanner for backward compatibility
 */
export const Planner = ExecutionPlanner;
