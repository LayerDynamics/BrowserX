/**
 * Query Engine Optimizer Passes
 *
 * This module exports all optimization passes used by the query optimizer.
 * Each pass implements specific optimizations to improve query execution performance.
 */

export { ConstantFoldingPass } from "./constant-folding.ts";
export { DeadCodeEliminationPass } from "./dead-code-elimination.ts";
export { ParallelDetectionPass } from "./parallel-detection.ts";
export { PredicatePushdownPass } from "./predicate-pushdown.ts";
export { ProjectionPushdownPass } from "./projection-pushdown.ts";
export { CacheOptimizationPass } from "./cache-optimization.ts";
