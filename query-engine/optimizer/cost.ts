/**
 * Cost estimation for query optimization
 * Estimates execution cost of different query plans
 */

import {
  BinaryExpression,
  Expression,
  ForStatement,
  IfStatement,
  NavigateStatement,
  SelectStatement,
  Statement,
} from "../types/ast.ts";
import { DurationMs } from "../types/primitives.ts";

/**
 * Cost breakdown for a query
 */
export interface QueryCost {
  totalCost: DurationMs;
  networkCost: DurationMs;
  computeCost: DurationMs;
  renderCost: DurationMs;
  cacheLookupCost: DurationMs;
}

/**
 * Cost estimation configuration
 */
export interface CostEstimatorConfig {
  // Base costs (in milliseconds)
  baseCosts: {
    navigate: DurationMs; // Base cost of navigation
    domQuery: DurationMs; // Cost of DOM query (SELECT)
    click: DurationMs; // Cost of click action
    type: DurationMs; // Cost of typing
    wait: DurationMs; // Cost per ms of wait
    screenshot: DurationMs; // Cost of screenshot
    cacheLookup: DurationMs; // Cost of cache lookup
    cacheHit: DurationMs; // Cost reduction for cache hit
    networkRequest: DurationMs; // Base network request cost
    domTraversal: DurationMs; // Cost per DOM node traversed
    jsExecution: DurationMs; // Cost per JS operation
  };

  // Scaling factors
  scaling: {
    networkLatency: number; // Multiplier for network latency
    domComplexity: number; // Multiplier based on DOM size
    parallelismFactor: number; // Cost reduction for parallel execution (0-1)
  };
}

/**
 * Default cost estimator configuration
 */
const DEFAULT_CONFIG: CostEstimatorConfig = {
  baseCosts: {
    navigate: 500,
    domQuery: 10,
    click: 50,
    type: 100,
    wait: 1,
    screenshot: 200,
    cacheLookup: 5,
    cacheHit: -450, // Reduces navigate cost significantly
    networkRequest: 100,
    domTraversal: 0.1,
    jsExecution: 0.01,
  },
  scaling: {
    networkLatency: 1.5,
    domComplexity: 1.2,
    parallelismFactor: 0.7,
  },
};

/**
 * Cost estimator class
 */
export class CostEstimator {
  private config: CostEstimatorConfig;

  constructor(config: Partial<CostEstimatorConfig> = {}) {
    this.config = {
      baseCosts: { ...DEFAULT_CONFIG.baseCosts, ...config.baseCosts },
      scaling: { ...DEFAULT_CONFIG.scaling, ...config.scaling },
    };
  }

  /**
   * Estimate cost of a statement
   */
  estimateStatement(stmt: Statement): QueryCost {
    switch (stmt.type) {
      case "SELECT":
        return this.estimateSelect(stmt as SelectStatement);
      case "NAVIGATE":
        return this.estimateNavigate(stmt as NavigateStatement);
      case "FOR":
        return this.estimateFor(stmt as ForStatement);
      case "IF":
        return this.estimateIf(stmt as IfStatement);
      case "SET":
      case "SHOW":
        return this.createCost(1, 0, 1, 0, 0);
      case "INSERT":
      case "UPDATE":
      case "DELETE":
        return this.createCost(10, 5, 5, 0, 0);
      case "WITH":
        // WITH statements have nested queries
        return this.estimateStatement(stmt.query);
      default:
        return this.createCost(10, 0, 10, 0, 0);
    }
  }

  /**
   * Estimate cost of SELECT statement
   */
  private estimateSelect(stmt: SelectStatement): QueryCost {
    let computeCost = this.config.baseCosts.domQuery;
    let networkCost = 0;
    let renderCost = 0;
    let cacheLookupCost = 0;

    // Cost of source
    if (stmt.source.type === "URL") {
      // Will need to navigate if not already on page
      networkCost += this.config.baseCosts.navigate;
      cacheLookupCost += this.config.baseCosts.cacheLookup;
    } else if (stmt.source.type === "SUBQUERY") {
      const subqueryCost = this.estimateStatement(stmt.source.value as Statement);
      networkCost += subqueryCost.networkCost;
      computeCost += subqueryCost.computeCost;
      renderCost += subqueryCost.renderCost;
      cacheLookupCost += subqueryCost.cacheLookupCost;
    }

    // Cost of field extraction
    computeCost += stmt.fields.length * this.config.baseCosts.domTraversal;

    // Cost of WHERE clause
    if (stmt.where) {
      computeCost += this.estimateExpression(stmt.where);
    }

    // Cost of ORDER BY
    if (stmt.orderBy && stmt.orderBy.length > 0) {
      computeCost += 5 * stmt.orderBy.length; // Sorting cost
    }

    return this.createCost(
      computeCost,
      networkCost,
      renderCost,
      cacheLookupCost,
      0,
    );
  }

  /**
   * Estimate cost of NAVIGATE statement
   */
  private estimateNavigate(stmt: NavigateStatement): QueryCost {
    let networkCost = this.config.baseCosts.navigate;
    let renderCost = 200; // Page render cost
    let computeCost = 10;
    let cacheLookupCost = this.config.baseCosts.cacheLookup;

    // Options can affect cost
    if (stmt.options) {
      if (stmt.options.waitUntil) {
        // Wait for specific loading state
        computeCost += 50;
      }

      if (stmt.options.timeout) {
        // Higher timeout means more potential wait time
        computeCost += stmt.options.timeout * 0.1;
      }
    }

    // Capture clause adds DOM query cost
    if (stmt.capture) {
      computeCost += stmt.capture.fields.length * this.config.baseCosts.domQuery;
    }

    return this.createCost(
      computeCost,
      networkCost,
      renderCost,
      cacheLookupCost,
      0,
    );
  }

  /**
   * Estimate cost of FOR loop
   */
  private estimateFor(stmt: ForStatement): QueryCost {
    // Estimate collection size (default to 10 if unknown)
    const estimatedIterations = this.estimateCollectionSize(stmt.collection);

    // Cost of body multiplied by iterations
    const bodyCost = this.estimateStatement(stmt.body);

    return this.createCost(
      bodyCost.computeCost * estimatedIterations,
      bodyCost.networkCost * estimatedIterations,
      bodyCost.renderCost * estimatedIterations,
      bodyCost.cacheLookupCost * estimatedIterations,
      0,
    );
  }

  /**
   * Estimate cost of IF statement
   */
  private estimateIf(stmt: IfStatement): QueryCost {
    // Condition evaluation cost
    const conditionCost = this.estimateExpression(stmt.condition);

    // Average of both branches (assume 50/50 probability)
    const thenCost = this.estimateStatement(stmt.thenBranch);
    const elseCost = stmt.elseBranch
      ? this.estimateStatement(stmt.elseBranch)
      : this.createCost(0, 0, 0, 0, 0);

    return this.createCost(
      conditionCost + (thenCost.computeCost + elseCost.computeCost) / 2,
      (thenCost.networkCost + elseCost.networkCost) / 2,
      (thenCost.renderCost + elseCost.renderCost) / 2,
      (thenCost.cacheLookupCost + elseCost.cacheLookupCost) / 2,
      0,
    );
  }

  /**
   * Estimate cost of an expression
   */
  private estimateExpression(expr: Expression): DurationMs {
    switch (expr.type) {
      case "BINARY":
        const binExpr = expr as BinaryExpression;
        return (
          this.estimateExpression(binExpr.left) +
          this.estimateExpression(binExpr.right) +
          this.config.baseCosts.jsExecution
        );
      case "UNARY":
        return this.estimateExpression(expr.operand) + this.config.baseCosts.jsExecution;
      case "CALL":
        // Function calls are more expensive
        const argsCost = expr.arguments.reduce(
          (sum, arg) => sum + this.estimateExpression(arg),
          0,
        );
        return argsCost + this.config.baseCosts.domQuery;
      case "MEMBER":
        return this.estimateExpression(expr.object) + this.config.baseCosts.domTraversal;
      case "ARRAY":
        return expr.elements.reduce(
          (sum, el) => sum + this.estimateExpression(el),
          0,
        );
      case "OBJECT":
        return expr.properties.reduce(
          (sum, prop) => sum + this.estimateExpression(prop.value),
          0,
        );
      case "IDENTIFIER":
      case "LITERAL":
        return this.config.baseCosts.jsExecution;
      default:
        return this.config.baseCosts.jsExecution;
    }
  }

  /**
   * Estimate collection size from expression
   */
  private estimateCollectionSize(expr: Expression): number {
    switch (expr.type) {
      case "ARRAY":
        return expr.elements.length;
      case "CALL":
        // DOM queries typically return ~10 elements
        return 10;
      default:
        // Unknown, assume moderate size
        return 10;
    }
  }

  /**
   * Create a QueryCost object
   */
  private createCost(
    compute: DurationMs,
    network: DurationMs,
    render: DurationMs,
    cacheLookup: DurationMs,
    cacheHit: DurationMs,
  ): QueryCost {
    return {
      computeCost: compute,
      networkCost: network,
      renderCost: render,
      cacheLookupCost: cacheLookup,
      totalCost: compute + network + render + cacheLookup + cacheHit,
    };
  }

  /**
   * Compare two costs
   */
  compareCosts(cost1: QueryCost, cost2: QueryCost): number {
    return cost1.totalCost - cost2.totalCost;
  }

  /**
   * Apply parallelism discount
   */
  applyParallelismDiscount(cost: QueryCost, parallelSteps: number): QueryCost {
    if (parallelSteps <= 1) {
      return cost;
    }

    const discount = 1 -
      (this.config.scaling.parallelismFactor * (parallelSteps - 1) / parallelSteps);

    return {
      ...cost,
      networkCost: cost.networkCost * discount,
      totalCost: cost.totalCost * discount,
    };
  }

  /**
   * Apply cache hit discount
   */
  applyCacheHit(cost: QueryCost): QueryCost {
    return {
      ...cost,
      networkCost: cost.networkCost + this.config.baseCosts.cacheHit,
      totalCost: cost.totalCost + this.config.baseCosts.cacheHit,
    };
  }

  /**
   * Get cost estimator configuration
   */
  getConfig(): Readonly<CostEstimatorConfig> {
    return {
      baseCosts: { ...this.config.baseCosts },
      scaling: { ...this.config.scaling },
    };
  }
}
