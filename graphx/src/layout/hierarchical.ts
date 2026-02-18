import type { DiGraph } from "../graph/DiGraph.ts";
import type { HierarchicalOptions, LayoutResult, LayoutNode } from "./types.ts";
import { topologicalSort } from "../algorithms/topological-sort.ts";

/**
 * Hierarchical layout (Sugiyama-style).
 * Requires a directed graph. Throws if graph has cycles.
 */
export function hierarchical<N, E>(
  graph: DiGraph<N, E>,
  options: HierarchicalOptions = {},
): LayoutResult {
  const direction = options.direction ?? "TB";
  const hSpacing = options.horizontalSpacing ?? 100;
  const vSpacing = options.verticalSpacing ?? 100;

  const { order, hasCycle } = topologicalSort(graph);
  if (hasCycle) {
    throw new Error("Cannot create hierarchical layout for a graph with cycles");
  }

  // Assign layers using longest-path layering
  const layer = new Map<string, number>();
  for (const nodeId of order) {
    let maxLayer = 0;
    for (const pred of graph.predecessors(nodeId)) {
      const predLayer = layer.get(pred.id) ?? 0;
      maxLayer = Math.max(maxLayer, predLayer + 1);
    }
    layer.set(nodeId, maxLayer);
  }

  // Group nodes by layer
  const layers: string[][] = [];
  for (const nodeId of order) {
    const l = layer.get(nodeId)!;
    if (!layers[l]) layers[l] = [];
    layers[l].push(nodeId);
  }

  // Assign positions
  const layoutNodes: LayoutNode[] = [];

  for (let l = 0; l < layers.length; l++) {
    const layerNodes = layers[l];
    for (let i = 0; i < layerNodes.length; i++) {
      const nodeId = layerNodes[i];
      let x: number, y: number;

      switch (direction) {
        case "TB": // Top-Bottom
          x = (i - (layerNodes.length - 1) / 2) * hSpacing;
          y = l * vSpacing;
          break;
        case "LR": // Left-Right
          x = l * hSpacing;
          y = (i - (layerNodes.length - 1) / 2) * vSpacing;
          break;
        case "BT": // Bottom-Top
          x = (i - (layerNodes.length - 1) / 2) * hSpacing;
          y = -(l * vSpacing);
          break;
        case "RL": // Right-Left
          x = -(l * hSpacing);
          y = (i - (layerNodes.length - 1) / 2) * vSpacing;
          break;
      }

      layoutNodes.push({ id: nodeId, x, y });
    }
  }

  // Calculate bounds
  const xs = layoutNodes.map((n) => n.x);
  const ys = layoutNodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Normalize to positive coordinates
  for (const node of layoutNodes) {
    node.x -= minX;
    node.y -= minY;
  }

  const width = maxX - minX + hSpacing;
  const height = maxY - minY + vSpacing;

  return { nodes: layoutNodes, width, height };
}
