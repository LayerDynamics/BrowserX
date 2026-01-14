/**
 * Dependency graph builder and analyzer
 */

import { DependencyGraph, DependencyNode, ExecutionStep } from "./plan.ts";

/**
 * Dependency graph builder
 */
export class DependencyGraphBuilder {
  /**
   * Build dependency graph from execution steps
   */
  build(steps: ExecutionStep[]): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();

    // Create nodes
    for (const step of steps) {
      nodes.set(step.id, {
        stepId: step.id,
        step,
        dependencies: [...step.dependencies],
        dependents: [],
      });
    }

    // Build dependent relationships
    for (const node of nodes.values()) {
      for (const depId of node.dependencies) {
        const depNode = nodes.get(depId);
        if (depNode) {
          depNode.dependents.push(node.stepId);
        }
      }
    }

    // Find roots (no dependencies) and leaves (no dependents)
    const roots: string[] = [];
    const leaves: string[] = [];

    for (const node of nodes.values()) {
      if (node.dependencies.length === 0) {
        roots.push(node.stepId);
      }
      if (node.dependents.length === 0) {
        leaves.push(node.stepId);
      }
    }

    return {
      nodes,
      roots,
      leaves,
    };
  }

  /**
   * Get topological ordering of steps
   */
  topologicalSort(graph: DependencyGraph): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (nodeId: string): void => {
      if (visited.has(nodeId)) {
        return;
      }

      if (visiting.has(nodeId)) {
        throw new Error(`Circular dependency detected: ${nodeId}`);
      }

      visiting.add(nodeId);

      const node = graph.nodes.get(nodeId);
      if (node) {
        // Visit dependencies first
        for (const depId of node.dependencies) {
          visit(depId);
        }
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      sorted.push(nodeId);
    };

    // Visit all nodes
    for (const nodeId of graph.nodes.keys()) {
      visit(nodeId);
    }

    return sorted;
  }

  /**
   * Find steps that can run in parallel
   */
  findParallelGroups(graph: DependencyGraph): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();

    // Level-by-level traversal
    let currentLevel = [...graph.roots];

    while (currentLevel.length > 0) {
      // All steps in current level can run in parallel
      if (currentLevel.length > 1) {
        groups.push([...currentLevel]);
      }

      // Mark as processed
      for (const nodeId of currentLevel) {
        processed.add(nodeId);
      }

      // Find next level
      const nextLevel = new Set<string>();

      for (const nodeId of currentLevel) {
        const node = graph.nodes.get(nodeId);
        if (node) {
          // Add dependents whose dependencies are all processed
          for (const dependentId of node.dependents) {
            const dependentNode = graph.nodes.get(dependentId);
            if (dependentNode) {
              const allDepsProcessed = dependentNode.dependencies.every((depId) =>
                processed.has(depId)
              );

              if (allDepsProcessed) {
                nextLevel.add(dependentId);
              }
            }
          }
        }
      }

      currentLevel = Array.from(nextLevel);
    }

    return groups;
  }

  /**
   * Check if graph has cycles
   */
  hasCycles(graph: DependencyGraph): boolean {
    try {
      this.topologicalSort(graph);
      return false;
    } catch (_error) {
      return true;
    }
  }

  /**
   * Get critical path (longest dependency chain)
   */
  getCriticalPath(graph: DependencyGraph): string[] {
    const stepCosts = new Map<string, number>();

    // Calculate total cost for each step (including dependencies)
    const calculateCost = (nodeId: string): number => {
      if (stepCosts.has(nodeId)) {
        return stepCosts.get(nodeId)!;
      }

      const node = graph.nodes.get(nodeId);
      if (!node) {
        return 0;
      }

      const stepCost = node.step.estimatedCost;
      const depCosts = node.dependencies.map((depId) => calculateCost(depId));
      const maxDepCost = depCosts.length > 0 ? Math.max(...depCosts) : 0;
      const totalCost = stepCost + maxDepCost;

      stepCosts.set(nodeId, totalCost);
      return totalCost;
    };

    // Calculate costs for all nodes
    for (const nodeId of graph.nodes.keys()) {
      calculateCost(nodeId);
    }

    // Find node with highest cost
    let maxCost = 0;
    let maxNode = "";

    for (const [nodeId, cost] of stepCosts) {
      if (cost > maxCost) {
        maxCost = cost;
        maxNode = nodeId;
      }
    }

    // Build critical path by following dependencies
    const path: string[] = [];
    let currentNode = maxNode;

    while (currentNode) {
      path.unshift(currentNode);

      const node = graph.nodes.get(currentNode);
      if (!node || node.dependencies.length === 0) {
        break;
      }

      // Find dependency with highest cost
      let maxDepCost = 0;
      let maxDep = "";

      for (const depId of node.dependencies) {
        const depCost = stepCosts.get(depId) || 0;
        if (depCost > maxDepCost) {
          maxDepCost = depCost;
          maxDep = depId;
        }
      }

      currentNode = maxDep;
    }

    return path;
  }

  /**
   * Calculate estimated parallel execution time
   */
  estimateParallelExecutionTime(graph: DependencyGraph): number {
    const stepCosts = new Map<string, number>();

    // Calculate earliest start time for each step
    const calculateStartTime = (nodeId: string): number => {
      if (stepCosts.has(nodeId)) {
        return stepCosts.get(nodeId)!;
      }

      const node = graph.nodes.get(nodeId);
      if (!node) {
        return 0;
      }

      // Start time is max end time of all dependencies
      const depEndTimes = node.dependencies.map((depId) => {
        const depNode = graph.nodes.get(depId);
        return calculateStartTime(depId) + (depNode?.step.estimatedCost || 0);
      });

      const startTime = depEndTimes.length > 0 ? Math.max(...depEndTimes) : 0;
      stepCosts.set(nodeId, startTime);
      return startTime;
    };

    // Calculate start times for all nodes
    for (const nodeId of graph.nodes.keys()) {
      calculateStartTime(nodeId);
    }

    // Total time is max(start time + step cost) across all steps
    let maxEndTime = 0;

    for (const [nodeId, startTime] of stepCosts) {
      const node = graph.nodes.get(nodeId);
      const endTime = startTime + (node?.step.estimatedCost || 0);
      maxEndTime = Math.max(maxEndTime, endTime);
    }

    return maxEndTime;
  }
}
