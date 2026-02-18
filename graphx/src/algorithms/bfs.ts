import type { NodeId } from "../types.ts";
import type { Graph } from "../graph/Graph.ts";

export interface BFSResult {
  /** Nodes in BFS traversal order */
  order: NodeId[];
  /** Parent map for reconstructing paths */
  parent: Map<NodeId, NodeId | null>;
  /** Depth of each node from start */
  depth: Map<NodeId, number>;
}

/**
 * Breadth-First Search from a start node.
 */
export function bfs<N, E>(graph: Graph<N, E>, start: NodeId): BFSResult {
  if (!graph.hasNode(start)) {
    throw new Error(`Start node "${start}" does not exist`);
  }

  const order: NodeId[] = [];
  const parent = new Map<NodeId, NodeId | null>();
  const depth = new Map<NodeId, number>();
  const visited = new Set<NodeId>();

  const queue: NodeId[] = [start];
  visited.add(start);
  parent.set(start, null);
  depth.set(start, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    const currentDepth = depth.get(current)!;
    for (const neighbor of graph.neighbors(current)) {
      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        parent.set(neighbor.id, current);
        depth.set(neighbor.id, currentDepth + 1);
        queue.push(neighbor.id);
      }
    }
  }

  return { order, parent, depth };
}
