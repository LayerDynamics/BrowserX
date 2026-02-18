import type { Graph } from "../graph/Graph.ts";
import type { GridOptions, LayoutResult, LayoutNode } from "./types.ts";

/**
 * Grid layout.
 * Nodes are arranged in a grid.
 */
export function grid<N, E>(
  graph: Graph<N, E>,
  options: GridOptions = {},
): LayoutResult {
  const cellWidth = options.cellWidth ?? 100;
  const cellHeight = options.cellHeight ?? 100;
  const padding = options.padding ?? 10;

  const nodes = graph.nodes();
  const columns = options.columns ?? Math.ceil(Math.sqrt(nodes.length));

  const layoutNodes: LayoutNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const x = col * (cellWidth + padding);
    const y = row * (cellHeight + padding);
    layoutNodes.push({ id: nodes[i].id, x, y });
  }

  const rows = Math.ceil(nodes.length / columns);
  const width = columns * (cellWidth + padding);
  const height = rows * (cellHeight + padding);

  return { nodes: layoutNodes, width, height };
}
