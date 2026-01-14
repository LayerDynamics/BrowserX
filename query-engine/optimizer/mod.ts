/**
 * Query Optimizer Module
 * Exports all optimizer components
 */

// Main optimizer
export {
  type OptimizationPass,
  type OptimizationResult,
  type OptimizerConfig,
  QueryOptimizer,
} from "./optimizer.ts";

// Cost estimation
export { CostEstimator, type CostEstimatorConfig, type QueryCost } from "./cost.ts";

// Optimization passes
export { ConstantFoldingPass } from "./passes/constant-folding.ts";
export { DeadCodeEliminationPass } from "./passes/dead-code-elimination.ts";
export { PredicatePushdownPass } from "./passes/predicate-pushdown.ts";
export { ProjectionPushdownPass } from "./passes/projection-pushdown.ts";
export { type CacheMetadata, CacheOptimizationPass } from "./passes/cache-optimization.ts";
export { ParallelDetectionPass, type ParallelGroup } from "./passes/parallel-detection.ts";
