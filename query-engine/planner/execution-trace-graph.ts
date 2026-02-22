/**
 * Execution Plan Visualizer
 *
 * Converts an ExecutionPlan into a GraphX DiGraph for visualization,
 * rendering step dependencies as a directed graph.
 */

import { DiGraph, GraphNode, GraphEdge, hierarchical, render, DEFAULT_LIGHT_THEME } from "@browserx/graphx";
import type { LayoutResult, SVGRenderOptions } from "@browserx/graphx";
import type { ExecutionPlan, ExecutionStep } from "./plan.ts";

/**
 * Node data for each execution step in the graph.
 */
export interface ExecutionStepNodeData {
  type: string;
  estimatedCost: number;
  cacheable: boolean;
}

/**
 * Convert an ExecutionPlan into a DiGraph.
 * Each step becomes a node; dependency relationships become edges.
 */
export function executionPlanToGraph(plan: ExecutionPlan): DiGraph<ExecutionStepNodeData> {
  const graph = new DiGraph<ExecutionStepNodeData>();
  let edgeCounter = 0;

  // Add all steps as nodes
  for (const step of plan.steps) {
    const data: ExecutionStepNodeData = {
      type: step.type,
      estimatedCost: step.estimatedCost as number,
      cacheable: step.cacheable,
    };
    const label = `${step.type}(${step.id})`;
    const node = new GraphNode<ExecutionStepNodeData>(step.id, data, label);
    graph.addNode(node);
  }

  // Add dependency edges
  for (const step of plan.steps) {
    for (const depId of step.dependencies) {
      // Only add edge if the dependency node exists in the graph
      if (graph.getNode(depId)) {
        const edgeId = `e${edgeCounter++}`;
        const edge = new GraphEdge(edgeId, depId, step.id);
        graph.addEdge(edge);
      }
    }
  }

  return graph;
}

/**
 * Render an ExecutionPlan as an SVG string using hierarchical LR layout.
 */
export function renderExecutionPlanAsSvg(plan: ExecutionPlan): string {
  const graph = executionPlanToGraph(plan);
  const layout: LayoutResult = hierarchical(graph, { direction: "LR" });
  const svgOptions: SVGRenderOptions = {
    directed: true,
    showLabels: true,
    theme: DEFAULT_LIGHT_THEME,
  };
  return render(graph, layout, svgOptions);
}
