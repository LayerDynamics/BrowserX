/**
 * Execution Plan Builder and Utilities
 *
 * This module provides a fluent builder API for constructing execution plans,
 * along with validation, serialization, and optimization metadata utilities.
 */

import {
  DependencyGraph,
  DependencyNode,
  ExecutionPlan,
  ExecutionStep,
  ExecutionStepType,
  ResourceRequirements,
} from "./plan.ts";
import { Statement } from "../types/ast.ts";
import { DurationMs, QueryID } from "../types/primitives.ts";

/**
 * Execution plan validation error
 */
export class ExecutionPlanValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message);
    this.name = "ExecutionPlanValidationError";
  }
}

/**
 * Execution plan builder with fluent API
 */
export class ExecutionPlanBuilder {
  private id?: QueryID;
  private query?: Statement;
  private steps: ExecutionStep[] = [];
  private estimatedCost: DurationMs = 0;
  private resources: ResourceRequirements = {
    browsers: 0,
    pages: 0,
    connections: 0,
    memory: 0,
    cpu: 0,
  };
  private cacheableSteps: string[] = [];
  private parallelGroups: string[][] = [];
  private metadata: {
    optimizationApplied: boolean;
    appliedPasses: string[];
    estimatedImprovement: number;
  } = {
    optimizationApplied: false,
    appliedPasses: [],
    estimatedImprovement: 0,
  };

  /**
   * Set the plan ID
   */
  withId(id: QueryID): this {
    this.id = id;
    return this;
  }

  /**
   * Set the source query statement
   */
  withQuery(query: Statement): this {
    this.query = query;
    return this;
  }

  /**
   * Add an execution step
   */
  addStep(step: ExecutionStep): this {
    this.steps.push(step);

    // Update estimated cost
    this.estimatedCost += step.estimatedCost;

    // Track cacheable steps
    if (step.cacheable && step.cacheKey) {
      this.cacheableSteps.push(step.id);
    }

    // Update resource requirements based on step type
    this.updateResourcesForStep(step);

    return this;
  }

  /**
   * Add multiple execution steps
   */
  addSteps(steps: ExecutionStep[]): this {
    steps.forEach((step) => this.addStep(step));
    return this;
  }

  /**
   * Set estimated cost manually
   */
  withEstimatedCost(cost: DurationMs): this {
    this.estimatedCost = cost;
    return this;
  }

  /**
   * Set resource requirements manually
   */
  withResources(resources: Partial<ResourceRequirements>): this {
    this.resources = {
      ...this.resources,
      ...resources,
    };
    return this;
  }

  /**
   * Add a parallel execution group
   */
  addParallelGroup(stepIds: string[]): this {
    if (stepIds.length > 1) {
      this.parallelGroups.push([...stepIds]);
    }
    return this;
  }

  /**
   * Mark optimization as applied
   */
  withOptimization(passes: string[], improvement: number): this {
    this.metadata.optimizationApplied = true;
    this.metadata.appliedPasses = [...passes];
    this.metadata.estimatedImprovement = improvement;
    return this;
  }

  /**
   * Update resource requirements based on step type
   */
  private updateResourcesForStep(step: ExecutionStep): void {
    switch (step.type) {
      case ExecutionStepType.NAVIGATE:
        this.resources.browsers = Math.max(this.resources.browsers, 1);
        this.resources.pages++;
        this.resources.connections++;
        this.resources.memory += 100; // MB per page
        this.resources.cpu = Math.max(this.resources.cpu, 30);
        break;

      case ExecutionStepType.DOM_QUERY:
        this.resources.cpu = Math.max(this.resources.cpu, 20);
        this.resources.memory += 10;
        break;

      case ExecutionStepType.SCREENSHOT:
      case ExecutionStepType.PDF:
        this.resources.memory += 50;
        this.resources.cpu = Math.max(this.resources.cpu, 40);
        break;

      case ExecutionStepType.EVALUATE_JS:
        this.resources.cpu = Math.max(this.resources.cpu, 25);
        this.resources.memory += 20;
        break;

      case ExecutionStepType.PARALLEL:
        // Parallel steps may require more resources simultaneously
        this.resources.cpu = Math.max(this.resources.cpu, 60);
        break;
    }
  }

  /**
   * Build the execution plan with dependency graph
   */
  build(dependencyGraph: DependencyGraph): ExecutionPlan {
    // Validate before building
    this.validate();

    if (!this.id) {
      throw new Error("Plan ID is required. Use withId() before build().");
    }

    if (!this.query) {
      throw new Error("Query statement is required. Use withQuery() before build().");
    }

    return {
      id: this.id,
      query: this.query,
      steps: [...this.steps],
      estimatedCost: this.estimatedCost,
      resources: { ...this.resources },
      dependencies: dependencyGraph,
      cacheableSteps: [...this.cacheableSteps],
      parallelGroups: this.parallelGroups.map((group) => [...group]),
      metadata: { ...this.metadata },
    };
  }

  /**
   * Validate the current plan state
   */
  private validate(): void {
    const errors: string[] = [];

    if (!this.id) {
      errors.push("Plan ID is required");
    }

    if (!this.query) {
      errors.push("Query statement is required");
    }

    if (this.steps.length === 0) {
      errors.push("At least one execution step is required");
    }

    // Validate step IDs are unique
    const stepIds = new Set<string>();
    for (const step of this.steps) {
      if (stepIds.has(step.id)) {
        errors.push(`Duplicate step ID: ${step.id}`);
      }
      stepIds.add(step.id);
    }

    // Validate dependencies reference existing steps
    for (const step of this.steps) {
      for (const depId of step.dependencies) {
        if (!stepIds.has(depId)) {
          errors.push(
            `Step ${step.id} depends on non-existent step: ${depId}`,
          );
        }
      }
    }

    // Validate parallel groups
    for (const group of this.parallelGroups) {
      for (const stepId of group) {
        if (!stepIds.has(stepId)) {
          errors.push(`Parallel group contains non-existent step: ${stepId}`);
        }
      }
    }

    // Validate cacheable steps
    for (const stepId of this.cacheableSteps) {
      if (!stepIds.has(stepId)) {
        errors.push(`Cacheable steps list contains non-existent step: ${stepId}`);
      }
    }

    if (errors.length > 0) {
      throw new ExecutionPlanValidationError(
        `Execution plan validation failed with ${errors.length} error(s)`,
        errors,
      );
    }
  }

  /**
   * Reset the builder to initial state
   */
  reset(): this {
    this.id = undefined;
    this.query = undefined;
    this.steps = [];
    this.estimatedCost = 0;
    this.resources = {
      browsers: 0,
      pages: 0,
      connections: 0,
      memory: 0,
      cpu: 0,
    };
    this.cacheableSteps = [];
    this.parallelGroups = [];
    this.metadata = {
      optimizationApplied: false,
      appliedPasses: [],
      estimatedImprovement: 0,
    };
    return this;
  }
}

/**
 * Validate an execution plan
 */
export function validateExecutionPlan(plan: ExecutionPlan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate basic structure
  if (!plan.id) {
    errors.push("Plan must have an ID");
  }

  if (!plan.query) {
    errors.push("Plan must have a query statement");
  }

  if (!plan.steps || plan.steps.length === 0) {
    errors.push("Plan must have at least one execution step");
  }

  // Validate step IDs are unique
  const stepIds = new Set<string>();
  for (const step of plan.steps) {
    if (!step.id) {
      errors.push("All steps must have an ID");
    } else if (stepIds.has(step.id)) {
      errors.push(`Duplicate step ID: ${step.id}`);
    } else {
      stepIds.add(step.id);
    }
  }

  // Validate dependency graph
  if (!plan.dependencies) {
    errors.push("Plan must have a dependency graph");
  } else {
    // Validate all nodes reference existing steps
    for (const [nodeId, node] of plan.dependencies.nodes.entries()) {
      if (!stepIds.has(nodeId)) {
        errors.push(`Dependency graph node ${nodeId} references non-existent step`);
      }

      // Validate dependencies
      for (const depId of node.dependencies) {
        if (!stepIds.has(depId)) {
          errors.push(`Step ${nodeId} depends on non-existent step: ${depId}`);
        }
      }

      // Validate dependents
      for (const depId of node.dependents) {
        if (!stepIds.has(depId)) {
          errors.push(`Step ${nodeId} has non-existent dependent: ${depId}`);
        }
      }
    }
  }

  // Validate no circular dependencies
  const circularDeps = detectCircularDependencies(plan);
  if (circularDeps.length > 0) {
    errors.push(`Circular dependencies detected: ${circularDeps.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Detect circular dependencies in execution plan
 */
export function detectCircularDependencies(plan: ExecutionPlan): string[] {
  const cycles: string[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(stepId: string, path: string[]): boolean {
    if (recursionStack.has(stepId)) {
      // Found a cycle
      const cycleStart = path.indexOf(stepId);
      const cycle = [...path.slice(cycleStart), stepId].join(" -> ");
      cycles.push(cycle);
      return true;
    }

    if (visited.has(stepId)) {
      return false;
    }

    visited.add(stepId);
    recursionStack.add(stepId);
    path.push(stepId);

    const node = plan.dependencies.nodes.get(stepId);
    if (node) {
      for (const depId of node.dependencies) {
        dfs(depId, path);
      }
    }

    path.pop();
    recursionStack.delete(stepId);
    return false;
  }

  for (const stepId of plan.dependencies.nodes.keys()) {
    if (!visited.has(stepId)) {
      dfs(stepId, []);
    }
  }

  return cycles;
}

/**
 * Serialize execution plan to JSON
 */
export function serializeExecutionPlan(plan: ExecutionPlan): string {
  const serializable = {
    id: plan.id,
    query: plan.query,
    steps: plan.steps,
    estimatedCost: plan.estimatedCost,
    resources: plan.resources,
    dependencies: {
      nodes: Array.from(plan.dependencies.nodes.entries()).map(([id, node]) => ({
        id,
        stepId: node.stepId,
        dependencies: node.dependencies,
        dependents: node.dependents,
      })),
      roots: plan.dependencies.roots,
      leaves: plan.dependencies.leaves,
    },
    cacheableSteps: plan.cacheableSteps,
    parallelGroups: plan.parallelGroups,
    metadata: plan.metadata,
  };

  return JSON.stringify(serializable, null, 2);
}

/**
 * Deserialize execution plan from JSON
 */
export function deserializeExecutionPlan(json: string): ExecutionPlan {
  const parsed = JSON.parse(json);

  // Reconstruct dependency graph Map
  const nodes = new Map<string, DependencyNode>(
    parsed.dependencies.nodes.map((node: any) => [
      String(node.id),
      {
        stepId: node.stepId,
        step: parsed.steps.find((s: ExecutionStep) => s.id === node.stepId),
        dependencies: node.dependencies,
        dependents: node.dependents,
      },
    ]),
  );

  const plan: ExecutionPlan = {
    id: parsed.id,
    query: parsed.query,
    steps: parsed.steps,
    estimatedCost: parsed.estimatedCost,
    resources: parsed.resources,
    dependencies: {
      nodes,
      roots: parsed.dependencies.roots,
      leaves: parsed.dependencies.leaves,
    },
    cacheableSteps: parsed.cacheableSteps,
    parallelGroups: parsed.parallelGroups,
    metadata: parsed.metadata,
  };

  // Validate the deserialized plan
  const validation = validateExecutionPlan(plan);
  if (!validation.valid) {
    throw new ExecutionPlanValidationError(
      "Deserialized plan is invalid",
      validation.errors,
    );
  }

  return plan;
}

/**
 * Get plan execution statistics
 */
export interface PlanStatistics {
  totalSteps: number;
  cacheableSteps: number;
  parallelGroups: number;
  maxParallelism: number;
  estimatedCost: DurationMs;
  criticalPathLength: number;
  criticalPathCost: DurationMs;
  resourceRequirements: ResourceRequirements;
  optimizationMetrics: {
    applied: boolean;
    passes: string[];
    improvement: number;
  };
}

/**
 * Calculate plan statistics
 */
export function calculatePlanStatistics(plan: ExecutionPlan): PlanStatistics {
  const maxParallelism = plan.parallelGroups.length > 0
    ? Math.max(...plan.parallelGroups.map((group) => group.length))
    : 1;

  // Find critical path (longest dependency chain)
  const criticalPath = findCriticalPath(plan);

  return {
    totalSteps: plan.steps.length,
    cacheableSteps: plan.cacheableSteps.length,
    parallelGroups: plan.parallelGroups.length,
    maxParallelism,
    estimatedCost: plan.estimatedCost,
    criticalPathLength: criticalPath.length,
    criticalPathCost: criticalPath.reduce(
      (sum, stepId) => {
        const step = plan.steps.find((s) => s.id === stepId);
        return sum + (step?.estimatedCost || 0);
      },
      0,
    ),
    resourceRequirements: plan.resources,
    optimizationMetrics: {
      applied: plan.metadata.optimizationApplied,
      passes: plan.metadata.appliedPasses,
      improvement: plan.metadata.estimatedImprovement,
    },
  };
}

/**
 * Find the critical path (longest dependency chain) in the plan
 */
export function findCriticalPath(plan: ExecutionPlan): string[] {
  const memo = new Map<string, { length: number; path: string[] }>();

  function dfs(stepId: string): { length: number; path: string[] } {
    if (memo.has(stepId)) {
      return memo.get(stepId)!;
    }

    const node = plan.dependencies.nodes.get(stepId);
    if (!node || node.dependencies.length === 0) {
      const result = { length: 1, path: [stepId] };
      memo.set(stepId, result);
      return result;
    }

    let maxPath = { length: 0, path: [] as string[] };
    for (const depId of node.dependencies) {
      const depPath = dfs(depId);
      if (depPath.length > maxPath.length) {
        maxPath = depPath;
      }
    }

    const result = {
      length: maxPath.length + 1,
      path: [...maxPath.path, stepId],
    };
    memo.set(stepId, result);
    return result;
  }

  // Find the longest path from any leaf node
  let longestPath = { length: 0, path: [] as string[] };
  for (const leafId of plan.dependencies.leaves) {
    const path = dfs(leafId);
    if (path.length > longestPath.length) {
      longestPath = path;
    }
  }

  return longestPath.path;
}

/**
 * Clone an execution plan
 */
export function cloneExecutionPlan(plan: ExecutionPlan): ExecutionPlan {
  // Deep clone the dependency graph
  const nodes = new Map(
    Array.from(plan.dependencies.nodes.entries()).map(([id, node]) => [
      id,
      {
        stepId: node.stepId,
        step: { ...node.step },
        dependencies: [...node.dependencies],
        dependents: [...node.dependents],
      },
    ]),
  );

  return {
    id: plan.id,
    query: { ...plan.query },
    steps: plan.steps.map((step) => ({ ...step })),
    estimatedCost: plan.estimatedCost,
    resources: { ...plan.resources },
    dependencies: {
      nodes,
      roots: [...plan.dependencies.roots],
      leaves: [...plan.dependencies.leaves],
    },
    cacheableSteps: [...plan.cacheableSteps],
    parallelGroups: plan.parallelGroups.map((group) => [...group]),
    metadata: { ...plan.metadata },
  };
}

/**
 * Merge multiple execution plans into a single plan
 */
export function mergeExecutionPlans(
  plans: ExecutionPlan[],
  combineMode: "sequential" | "parallel" = "sequential",
): ExecutionPlan {
  if (plans.length === 0) {
    throw new Error("Cannot merge empty plan list");
  }

  if (plans.length === 1) {
    return cloneExecutionPlan(plans[0]);
  }

  const builder = new ExecutionPlanBuilder()
    .withId(`merged_${Date.now()}` as QueryID)
    .withQuery(plans[0].query);

  let totalCost = 0;
  const allSteps: ExecutionStep[] = [];
  const allCacheableSteps: string[] = [];
  const allParallelGroups: string[][] = [];
  const nodeMap = new Map();
  let previousPlanStepIds: string[] = [];

  for (const plan of plans) {
    const stepIdOffset = allSteps.length;

    // Add steps with updated dependencies
    for (const step of plan.steps) {
      const updatedStep = {
        ...step,
        dependencies:
          combineMode === "sequential" && previousPlanStepIds.length > 0
            ? [...step.dependencies, ...previousPlanStepIds.slice(-1)]
            : step.dependencies,
      };
      builder.addStep(updatedStep);
      allSteps.push(updatedStep);
    }

    // Track cacheable steps
    allCacheableSteps.push(...plan.cacheableSteps);

    // Merge parallel groups
    allParallelGroups.push(...plan.parallelGroups);

    // Update cost
    if (combineMode === "parallel") {
      totalCost = Math.max(totalCost, plan.estimatedCost);
    } else {
      totalCost += plan.estimatedCost;
    }

    // Track previous plan's step IDs for sequential chaining
    previousPlanStepIds = plan.steps.map((s) => s.id);

    // Merge dependency graphs
    for (const [nodeId, node] of plan.dependencies.nodes.entries()) {
      nodeMap.set(nodeId, node);
    }
  }

  builder.withEstimatedCost(totalCost);

  // Reconstruct dependency graph
  const mergedDependencyGraph: DependencyGraph = {
    nodes: nodeMap,
    roots: Array.from(new Set(plans.flatMap((p) => p.dependencies.roots))),
    leaves: combineMode === "sequential"
      ? plans[plans.length - 1].dependencies.leaves
      : Array.from(new Set(plans.flatMap((p) => p.dependencies.leaves))),
  };

  return builder.build(mergedDependencyGraph);
}
