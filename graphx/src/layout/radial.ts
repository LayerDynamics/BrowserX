import type { Graph } from "../graph/Graph.ts";
import type { RadialOptions, LayoutResult, LayoutNode } from "./types.ts";

/**
 * Radial (circular) layout.
 * Nodes are arranged in a circle.
 */
export function radial<N, E>(
  graph: Graph<N, E>,
  options: RadialOptions = {},
): LayoutResult {
  const center = options.center ?? { x: 0, y: 0 };
  const radius = options.radius ?? 200;
  const startAngle = options.startAngle ?? 0;

  const nodes = graph.nodes();
  const layoutNodes: LayoutNode[] = [];

  const angleStep = (2 * Math.PI) / nodes.length;

  for (let i = 0; i < nodes.length; i++) {
    const angle = startAngle + i * angleStep;
    const x = center.x + radius * Math.cos(angle);
    const y = center.y + radius * Math.sin(angle);
    layoutNodes.push({ id: nodes[i].id, x, y });
  }

  const width = radius * 2;
  const height = radius * 2;

  return { nodes: layoutNodes, width, height };
}
