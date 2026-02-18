import type { NodeId } from "../types.ts";
import type { DiGraph } from "../graph/DiGraph.ts";

export interface TopologicalSortResult {
  /** Nodes in topological order (or partial order if cycle exists) */
  order: NodeId[];
  /** True if the graph has a cycle */
  hasCycle: boolean;
}

/**
 * Topological sort using Kahn's algorithm.
 * Works on directed graphs (DiGraph).
 */
export function topologicalSort<N, E>(graph: DiGraph<N, E>): TopologicalSortResult {
  const inDegree = new Map<NodeId, number>();
  for (const node of graph.nodes()) {
    inDegree.set(node.id, graph.inDegree(node.id));
  }

  const queue: NodeId[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: NodeId[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    for (const successor of graph.successors(current)) {
      const deg = inDegree.get(successor.id)! - 1;
      inDegree.set(successor.id, deg);
      if (deg === 0) queue.push(successor.id);
    }
  }

  const hasCycle = order.length !== graph.nodeCount;

  return { order, hasCycle };
}
