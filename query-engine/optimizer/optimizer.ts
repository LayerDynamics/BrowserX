/**
 * Query Optimizer
 * Applies optimization passes to improve query execution performance
 */

import { Statement } from "../types/ast.ts";
import { CostEstimator, QueryCost } from "./cost.ts";
import { ConstantFoldingPass } from "./passes/constant-folding.ts";
import { DeadCodeEliminationPass } from "./passes/dead-code-elimination.ts";
import { PredicatePushdownPass } from "./passes/predicate-pushdown.ts";
import { ProjectionPushdownPass } from "./passes/projection-pushdown.ts";
import { CacheMetadata, CacheOptimizationPass } from "./passes/cache-optimization.ts";
import { ParallelDetectionPass, ParallelGroup } from "./passes/parallel-detection.ts";

/**
 * Optimization pass interface
 */
export interface OptimizationPass {
  name: string;
  apply(stmt: Statement): Statement | null;
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  optimizedAST: Statement;
  appliedPasses: string[];
  originalCost: QueryCost;
  optimizedCost: QueryCost;
  improvement: number; // Percentage improvement
  cacheMetadata?: Map<Statement, CacheMetadata>;
  parallelGroups?: ParallelGroup[];
}

/**
 * Optimizer configuration
 */
export interface OptimizerConfig {
  enableConstantFolding?: boolean;
  enableDeadCodeElimination?: boolean;
  enablePredicatePushdown?: boolean;
  enableProjectionPushdown?: boolean;
  enableCacheOptimization?: boolean;
  enableParallelDetection?: boolean;
  maxPasses?: number;
}

/**
 * Default optimizer configuration
 */
const DEFAULT_CONFIG: OptimizerConfig = {
  enableConstantFolding: true,
  enableDeadCodeElimination: true,
  enablePredicatePushdown: true,
  enableProjectionPushdown: true,
  enableCacheOptimization: true,
  enableParallelDetection: true,
  maxPasses: 3,
};

/**
 * Query Optimizer
 */
export class QueryOptimizer {
  private config: OptimizerConfig;
  private costEstimator: CostEstimator;
  private passes: OptimizationPass[];

  constructor(config: Partial<OptimizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.costEstimator = new CostEstimator();
    this.passes = this.initializePasses();
  }

  /**
   * Initialize optimization passes
   */
  private initializePasses(): OptimizationPass[] {
    const passes: OptimizationPass[] = [];

    if (this.config.enableConstantFolding) {
      passes.push({
        name: "ConstantFolding",
        apply: (stmt) => new ConstantFoldingPass().apply(stmt),
      });
    }

    if (this.config.enableDeadCodeElimination) {
      passes.push({
        name: "DeadCodeElimination",
        apply: (stmt) => new DeadCodeEliminationPass().apply(stmt),
      });
    }

    if (this.config.enablePredicatePushdown) {
      passes.push({
        name: "PredicatePushdown",
        apply: (stmt) => new PredicatePushdownPass().apply(stmt),
      });
    }

    if (this.config.enableProjectionPushdown) {
      passes.push({
        name: "ProjectionPushdown",
        apply: (stmt) => new ProjectionPushdownPass().apply(stmt),
      });
    }

    return passes;
  }

  /**
   * Optimize a statement
   */
  optimize(stmt: Statement): OptimizationResult {
    const appliedPasses: string[] = [];

    // Estimate original cost
    const originalCost = this.costEstimator.estimateStatement(stmt);

    // Apply optimization passes iteratively
    let currentAST = stmt;
    let previousCost = originalCost.totalCost;
    let passCount = 0;

    while (passCount < this.config.maxPasses!) {
      let improved = false;

      for (const pass of this.passes) {
        const optimized = pass.apply(currentAST);

        // If pass returns null, statement was completely eliminated
        if (optimized === null) {
          currentAST = this.createNoOpStatement();
          appliedPasses.push(pass.name);
          improved = true;
          break;
        }

        // Estimate cost after this pass
        const newCost = this.costEstimator.estimateStatement(optimized);

        // If cost improved, keep the optimization
        if (newCost.totalCost < previousCost) {
          currentAST = optimized;
          previousCost = newCost.totalCost;
          appliedPasses.push(pass.name);
          improved = true;
        }
      }

      // If no pass improved the cost, stop
      if (!improved) {
        break;
      }

      passCount++;
    }

    // Apply cache optimization (analysis only, doesn't modify AST)
    let cacheMetadata: Map<Statement, CacheMetadata> | undefined;

    if (this.config.enableCacheOptimization) {
      const cachePass = new CacheOptimizationPass();
      cachePass.apply(currentAST);
      cacheMetadata = new Map();

      // Collect cache metadata
      const collectMetadata = (st: Statement) => {
        const metadata = cachePass.getCacheMetadata(st);
        if (metadata) {
          cacheMetadata!.set(st, metadata);
        }

        // Recursively collect from nested statements
        switch (st.type) {
          case "SELECT":
            if (st.source.type === "SUBQUERY") {
              collectMetadata(st.source.value as Statement);
            }
            break;

          case "NAVIGATE":
            // NAVIGATE statements are cacheable
            break;

          case "INSERT":
          case "UPDATE":
          case "DELETE":
            // Mutation statements - not cacheable
            break;

          case "FOR":
            collectMetadata(st.body);
            break;

          case "IF":
            collectMetadata(st.thenBranch);
            if (st.elseBranch) {
              collectMetadata(st.elseBranch);
            }
            break;

          case "WITH":
            for (const cte of st.ctes) {
              collectMetadata(cte.query);
            }
            collectMetadata(st.query);
            break;

          case "SHOW":
          case "SET":
            // State queries - generally not cacheable
            break;
        }
      };

      collectMetadata(currentAST);
      appliedPasses.push("CacheOptimization");
    }

    // Apply parallel detection (analysis only)
    let parallelGroups: ParallelGroup[] | undefined;

    if (this.config.enableParallelDetection) {
      const parallelPass = new ParallelDetectionPass();
      parallelPass.apply(currentAST);
      parallelGroups = parallelPass.getParallelGroups();
      appliedPasses.push("ParallelDetection");
    }

    // Estimate final cost (with parallelism and caching discounts)
    let optimizedCost = this.costEstimator.estimateStatement(currentAST);

    // Apply cache hit discount if cacheable
    if (cacheMetadata && cacheMetadata.size > 0) {
      for (const [_stmt, metadata] of cacheMetadata) {
        if (metadata.cacheable) {
          optimizedCost = this.costEstimator.applyCacheHit(optimizedCost);
        }
      }
    }

    // Apply parallelism discount
    if (parallelGroups && parallelGroups.length > 0) {
      const maxParallelSteps = Math.max(
        ...parallelGroups.map((g) => g.statements.length),
      );
      optimizedCost = this.costEstimator.applyParallelismDiscount(
        optimizedCost,
        maxParallelSteps,
      );
    }

    // Calculate improvement percentage
    const improvement = originalCost.totalCost > 0
      ? ((originalCost.totalCost - optimizedCost.totalCost) / originalCost.totalCost) * 100
      : 0;

    return {
      optimizedAST: currentAST,
      appliedPasses: [...new Set(appliedPasses)], // Remove duplicates
      originalCost,
      optimizedCost,
      improvement,
      cacheMetadata,
      parallelGroups,
    };
  }

  /**
   * Create a no-op statement
   */
  private createNoOpStatement(): Statement {
    return {
      type: "SHOW",
      target: "METRICS",
    };
  }

  /**
   * Get cost estimator
   */
  getCostEstimator(): CostEstimator {
    return this.costEstimator;
  }

  /**
   * Get optimizer configuration
   */
  getConfig(): Readonly<OptimizerConfig> {
    return { ...this.config };
  }

  /**
   * Get optimization passes
   */
  getOptimizationPasses(): OptimizationPass[] {
    return [...this.passes];
  }
}
